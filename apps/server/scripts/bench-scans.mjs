#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ECOCIDE scan benchmark (`pnpm bench`).
//
// Drives a REAL server process over HTTP and records what actually happened:
// end-to-end scan wall clock, the per-pass model latencies the server logged
// (`scan_api_logs`), tokens, cost, per-tier breakdown, endpoint percentiles and
// throughput against concurrency.
//
// Design rules:
//   - Isolated. A throwaway database (a fresh PGlite dir, or a disposable
//     Postgres container) and a throwaway evidence dir. `apps/server/data` is
//     never touched.
//   - Reproducible. A seeded synthetic image corpus (or a fixed directory of
//     real photos), fixed workload sizes, and the engine/commit recorded in the
//     output. Same inputs → comparable numbers across revisions.
//   - Honest. Offline mode runs the deterministic simulation (no network, no
//     tokens); live mode spends real tokens and is gated behind an explicit
//     confirmation flag.
//
// Usage:
//   node scripts/bench-scans.mjs --db=pglite --mode=offline
//   node scripts/bench-scans.mjs --db=postgres --mode=offline
//   node scripts/bench-scans.mjs --db=postgres --mode=live --live-n=5 --live-confirm=yes
//
// Requires `pnpm build` first (the server is spawned from dist/).
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { householdRatio } from '@ecocide/compliance';
import { generateSimulatedInventory, getFaction } from '@ecocide/lore';
import { summarize, mean, groupBy } from './lib/bench-stats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const TMP_ROOT = process.env.BENCH_TMP_DIR || '/tmp/opencode/ecocide-bench';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    db: 'pglite',
    mode: 'offline',
    scans: 200,
    warmup: 20,
    concurrency: '1,4,8,16',
    liveN: 5,
    liveConfirm: '',
    out: '',
    corpus: 24,
    corpusDir: '',
    port: 0,
    keep: false,
    label: '',
    quiet: false,
  };
  for (const arg of argv) {
    const match = /^--([a-zA-Z][a-zA-Z-]*)(?:=(.*))?$/.exec(arg);
    if (!match) continue;
    const key = match[1];
    const value = match[2] === undefined ? true : match[2];
    switch (key) {
      case 'db': opts.db = String(value); break;
      case 'mode': opts.mode = String(value); break;
      case 'scans': opts.scans = Number(value); break;
      case 'warmup': opts.warmup = Number(value); break;
      case 'concurrency': opts.concurrency = String(value); break;
      case 'live-n': opts.liveN = Number(value); break;
      case 'live-confirm': opts.liveConfirm = String(value); break;
      case 'out': opts.out = String(value); break;
      case 'corpus': opts.corpus = Number(value); break;
      case 'corpus-dir': opts.corpusDir = String(value); break;
      case 'port': opts.port = Number(value); break;
      case 'keep': opts.keep = true; break;
      case 'label': opts.label = String(value); break;
      case 'quiet': opts.quiet = true; break;
      default: console.warn(`[bench] ignoring unknown flag --${key}`);
    }
  }
  if (!['pglite', 'postgres'].includes(opts.db)) throw new Error(`--db must be pglite|postgres, got "${opts.db}"`);
  if (!['offline', 'live'].includes(opts.mode)) throw new Error(`--mode must be offline|live, got "${opts.mode}"`);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const runDir = path.join(TMP_ROOT, runId);

const log = (...args) => {
  if (!opts.quiet) console.log(...args);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Environment / provenance
// ---------------------------------------------------------------------------

/** `git` facts for the report header; never fatal. */
function gitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return { commit, commitShort: commit.slice(0, 8), dirty: status.length > 0 };
  } catch {
    return { commit: 'unknown', commitShort: 'unknown', dirty: false };
  }
}

/** Newest mtime under `dir` (used to flag a stale dist/). */
function newestMtime(dir, exts = ['.ts']) {
  let newest = 0;
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.includes(path.extname(entry.name))) {
        newest = Math.max(newest, fs.statSync(full).mtimeMs);
      }
    }
  };
  walk(dir);
  return newest;
}

/** Parse a KEY=VALUE dotenv file (no expansion) — used only for the cost guard. */
function readEnvFile() {
  const candidates = [path.join(REPO_ROOT, '.env'), path.join(SERVER_DIR, '.env')];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
    return env;
  }
  return {};
}

const envFile = readEnvFile();
const distEntry = path.join(SERVER_DIR, 'dist', 'index.js');
const distBuiltAt = fs.existsSync(distEntry) ? fs.statSync(distEntry).mtimeMs : 0;
const srcNewest = newestMtime(path.join(SERVER_DIR, 'src'));

function environmentBlock() {
  const git = gitInfo();
  const cpus = os.cpus();
  return {
    generatedAt: new Date().toISOString(),
    ...git,
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: cpus[0]?.model?.trim() ?? 'unknown',
    cpuCount: cpus.length,
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    distBuiltAt: distBuiltAt ? new Date(distBuiltAt).toISOString() : null,
    distStale: distBuiltAt > 0 && srcNewest > distBuiltAt,
  };
}

// ---------------------------------------------------------------------------
// Engine provisioning
// ---------------------------------------------------------------------------

function dockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Disposable Postgres 17 container on an ephemeral host port. */
async function startPostgresContainer() {
  if (!dockerAvailable()) {
    throw new Error('--db=postgres needs Docker (docker info failed). Start Docker, or pass BENCH_DATABASE_URL.');
  }
  const name = `ecocide-bench-pg-${runId}`;
  log(`[bench] starting throwaway Postgres container ${name} ...`);
  execFileSync(
    'docker',
    [
      'run', '--rm', '-d', '--name', name,
      '-e', 'POSTGRES_PASSWORD=bench',
      '-e', 'POSTGRES_USER=bench',
      '-e', 'POSTGRES_DB=ecocide_bench',
      '-p', '127.0.0.1::5432',
      'postgres:17-alpine',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const portLine = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim();
  const port = Number(portLine.split(':').pop());
  if (!Number.isFinite(port) || port <= 0) throw new Error(`could not read the container port from "${portLine}"`);

  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'bench', '-d', 'ecocide_bench'], { stdio: 'ignore' });
      ready = true;
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!ready) throw new Error('Postgres container did not become ready within 90s');

  // `pg_isready` can succeed against the temporary server initdb runs before the
  // real one binds TCP, so confirm a real client connection before handing the
  // URL to the app — otherwise the server boots and dies on its first query.
  const databaseUrl = `postgres://bench:bench@127.0.0.1:${port}/ecocide_bench`;
  const { Client } = await import('pg');
  const connectDeadline = Date.now() + 60_000;
  for (;;) {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      break;
    } catch (error) {
      await client.end().catch(() => {});
      if (Date.now() > connectDeadline) {
        throw new Error(`Postgres container refused client connections: ${error.message}`);
      }
      await sleep(500);
    }
  }

  return {
    databaseUrl,
    stop: () => {
      try {
        execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    },
  };
}

/**
 * Resolve the database the server should use, and how to read it afterwards.
 * PGlite is single-process (advisory lock), so metrics are read only after the
 * server is stopped.
 */
async function provisionEngine() {
  if (opts.db === 'postgres') {
    if (process.env.BENCH_DATABASE_URL) {
      log('[bench] using BENCH_DATABASE_URL (no container managed)');
      return { kind: 'postgres', databaseUrl: process.env.BENCH_DATABASE_URL, stop: () => {} };
    }
    const container = await startPostgresContainer();
    return { kind: 'postgres', databaseUrl: container.databaseUrl, stop: container.stop };
  }

  const pgdataDir = path.join(runDir, 'pgdata');
  fs.mkdirSync(pgdataDir, { recursive: true });
  return { kind: 'pglite', pgdataDir, stop: () => {} };
}

// ---------------------------------------------------------------------------
// Image corpus
// ---------------------------------------------------------------------------

/** Deterministic synthetic room photo (seeded), as a data URL. */
async function syntheticImage(index, size = 640) {
  const width = size;
  const height = Math.round(size * 0.75);
  const pixels = Buffer.alloc(width * height * 3);

  // xorshift32 — deterministic per index.
  let state = (index * 2654435761 + 1) >>> 0;
  const rand = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };

  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const base = 40 + rand() * 120;
  const hue = 1 + (index % 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const wave = Math.sin((x / (width - 1)) * Math.PI * 2 * hue) * 38;
      const noise = (rand() - 0.5) * 24;
      pixels[i] = clamp(base + wave + noise);
      pixels[i + 1] = clamp(base * 0.62 + Math.cos((y / (height - 1)) * Math.PI * 2) * 34 + noise);
      pixels[i + 2] = clamp(base * 0.32 + 58 + noise);
    }
  }

  const buffer = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 72 })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function dataUrlForFile(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * Build `count` distinct images. Live mode prefers real room photos (a
 * synthetic gradient makes the vision model hallucinate), falling back to the
 * seeded generator.
 *
 * Directory sources are filtered by size: the local evidence archive is full of
 * 70-byte 1x1 placeholders left by test runs, and a 1x1 image makes the vision
 * model report "no household objects". Only substantial photos are usable, and
 * the largest ones are picked first.
 */
async function loadCorpus({ count, mode, corpusDir, minBytes = 4096 }) {
  const sources = [];

  const dir = corpusDir || (mode === 'live' ? path.join(SERVER_DIR, 'data', 'evidence') : '');
  if (dir) {
    const resolved = path.resolve(REPO_ROOT, dir);
    if (!fs.existsSync(resolved)) throw new Error(`--corpus-dir not found: ${resolved}`);
    const files = fs
      .readdirSync(resolved)
      .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
      .map((name) => ({ name, path: path.join(resolved, name), bytes: fs.statSync(path.join(resolved, name)).size }))
      .filter((file) => file.bytes >= minBytes)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, count);

    for (const file of files) sources.push(dataUrlForFile(file.path));

    if (sources.length) {
      const label = corpusDir ? 'directory' : 'real evidence photos';
      if (sources.length < count) {
        log(`[bench] WARNING: only ${sources.length} usable image(s) ≥ ${minBytes}B in ${resolved}; cycling them.`);
      }
      return { images: sources, source: `${label}: ${resolved} (${sources.length} files ≥ ${minBytes}B)` };
    }
    if (corpusDir) throw new Error(`no images ≥ ${minBytes} bytes found in ${resolved}`);
  }

  for (let i = 0; i < count; i++) sources.push(await syntheticImage(i));
  return { images: sources, source: `synthetic (seeded, ${count} generated 640x480 JPEGs)` };
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

async function findFreePort(start) {
  for (let port = start; port < start + 200; port++) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error('no free port found');
}

async function startServer({ env, port, logPath }) {
  if (!fs.existsSync(distEntry)) {
    throw new Error('apps/server/dist/index.js is missing — run `pnpm build` first.');
  }
  const logStream = fs.createWriteStream(logPath);
  const child = spawn(process.execPath, [distEntry], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const baseUrl = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();
  const deadline = startedAt + 90_000;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early (code ${child.exitCode}); log: ${logPath}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return { child, baseUrl, health: await response.json(), bootMs: Date.now() - startedAt };
      }
    } catch (error) {
      lastError = error.message;
    }
    await sleep(200);
  }
  throw new Error(`server not healthy within 90s (${lastError}); log: ${logPath}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timeout = sleep(5000).then(() => 'timeout');
  if ((await Promise.race([exited.then(() => 'exited'), timeout])) === 'timeout') {
    child.kill('SIGKILL');
    await exited;
  }
}

// ---------------------------------------------------------------------------
// Load generation
// ---------------------------------------------------------------------------

/** One POST /api/oracle/scan, timed. */
async function postScan({ baseUrl, image }) {
  const startedAt = performance.now();
  let status = 0;
  let payload = null;
  let error = '';
  let bytes = 0;
  try {
    const response = await fetch(`${baseUrl}/api/oracle/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, category: null }),
    });
    status = response.status;
    const text = await response.text();
    bytes = Buffer.byteLength(text);
    payload = JSON.parse(text);
  } catch (err) {
    error = err.message;
  }
  return { ms: performance.now() - startedAt, status, payload, error, bytes };
}

/**
 * Run `count` scans at `concurrency`, collecting per-request timings.
 *
 * `retries` re-attempts a failed scan with the next image in the corpus — a
 * single unusable photo (or a transient upstream error) would otherwise leave a
 * hole in a small live sample. Retries cost tokens when Pass 1 already ran, so
 * the default is 0 offline and small in live mode.
 */
async function runScanBatch({ baseUrl, images, count, concurrency, retries = 0, onResult }) {
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = next++;
      if (index >= count) return;
      let result = await postScan({ baseUrl, image: images[index % images.length] });
      let attempt = 0;
      while (result.status !== 200 && attempt < retries) {
        attempt++;
        const retryImage = images[(index + attempt * 7) % images.length];
        result = await postScan({ baseUrl, image: retryImage });
      }
      onResult({ index, ...result, concurrency, attempts: attempt + 1 });
    }
  });
  await Promise.all(workers);
}

async function benchEndpoint({ baseUrl, name, target, method = 'GET', body, requests = 60, concurrency = 1 }) {
  const latencies = [];
  const errorSamples = [];
  let errors = 0;
  let bytes = 0;
  let next = 0;
  const startedAt = performance.now();

  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = next++;
      if (index >= requests) return;
      const t0 = performance.now();
      try {
        const init = method === 'POST'
          ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
          : undefined;
        const response = await fetch(baseUrl + target, init);
        const buffer = await response.arrayBuffer();
        bytes += buffer.byteLength;
        if (!response.ok) {
          errors++;
          if (errorSamples.length < 3) {
            errorSamples.push(`HTTP ${response.status}: ${Buffer.from(buffer).toString('utf8').slice(0, 240)}`);
          }
        }
        latencies.push(performance.now() - t0);
      } catch (error) {
        errors++;
        if (errorSamples.length < 3) errorSamples.push(error.message);
        latencies.push(performance.now() - t0);
      }
    }
  });
  await Promise.all(workers);

  const wallSeconds = (performance.now() - startedAt) / 1000;
  return {
    ...summarize(latencies),
    name,
    path: target,
    requests,
    concurrency,
    errors,
    errorSamples,
    rps: Number((requests / wallSeconds).toFixed(1)),
    bytesMean: Math.round(bytes / requests),
  };
}

// ---------------------------------------------------------------------------
// Post-run database read
// ---------------------------------------------------------------------------

async function openDatabase({ engine }) {
  if (engine.kind === 'postgres') {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: engine.databaseUrl });
    await client.connect();
    return {
      query: (text, params) => client.query(text, params),
      close: () => client.end(),
      label: `PostgreSQL (${new URL(engine.databaseUrl).host})`,
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const client = new PGlite(engine.pgdataDir);
  await client.waitReady;
  return {
    query: (text, params) => client.query(text, params),
    close: () => client.close(),
    label: `PGlite (${engine.pgdataDir})`,
  };
}

/** Per-dossier facts from `scan_api_logs` + `dossiers` for the scanned ids. */
async function collectDatabaseFacts({ engine, dossierIds }) {
  const db = await openDatabase({ engine });
  try {
    const placeholders = dossierIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: versionRows } = await db.query('SELECT version() AS version');
    const { rows: logRows } = await db.query(
      `SELECT dossier_id, call_type, duration_ms, prompt_tokens, candidates_tokens,
              thoughts_tokens, total_tokens, cost_usd, status
         FROM scan_api_logs
        WHERE dossier_id IN (${placeholders})`,
      dossierIds
    );
    const { rows: dossierRows } = await db.query(
      `SELECT id, caste FROM dossiers WHERE id IN (${placeholders})`,
      dossierIds
    );

    const perDossier = new Map();
    for (const row of logRows) {
      const record =
        perDossier.get(row.dossier_id) ??
        { pass1: null, pass2: null, total: null, prompt: 0, output: 0, tokens: 0, cost: 0, errored: false };
      const duration = Number(row.duration_ms) || 0;
      if (row.call_type === 'oracle_inventory') record.pass1 = duration;
      else if (row.call_type === 'oracle_classify') record.pass2 = duration;
      else if (row.call_type === 'scan_total') record.total = duration;
      else continue;
      if (row.call_type !== 'scan_total') {
        record.prompt += Number(row.prompt_tokens) || 0;
        record.output += (Number(row.candidates_tokens) || 0) + (Number(row.thoughts_tokens) || 0);
        record.tokens += Number(row.total_tokens) || 0;
        record.cost += Number(row.cost_usd) || 0;
        if (row.status !== 'success') record.errored = true;
      }
      perDossier.set(row.dossier_id, record);
    }

    const casteById = new Map(dossierRows.map((row) => [row.id, row.caste]));
    return {
      label: db.label,
      engineVersion: versionRows[0]?.version ?? 'unknown',
      perDossier,
      casteById,
    };
  } finally {
    await db.close();
  }
}

// ---------------------------------------------------------------------------
// Compliance math micro-benchmark
// ---------------------------------------------------------------------------

function measureComplianceMath() {
  const items = generateSimulatedInventory('bench-math-seed');
  for (let i = 0; i < 500; i++) householdRatio(items); // warm up the JIT
  const calls = 50_000;
  const startedAt = performance.now();
  let checksum = 0;
  for (let i = 0; i < calls; i++) checksum += householdRatio(items);
  const usPerCall = ((performance.now() - startedAt) * 1000) / calls;
  return {
    calls,
    itemsPerCall: items.length,
    usPerCall: Number(usPerCall.toFixed(3)),
    usPerItem: Number((usPerCall / items.length).toFixed(4)),
    checksum,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (opts.mode === 'live') {
    const model = envFile.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    let perScan = 0.0027;
    try {
      const costModule = await import(path.join(SERVER_DIR, 'dist', 'cost.js'));
      // Token assumptions calibrated against a measured live scan
      // (~4.4k prompt / ~2.6k output for the two passes combined).
      perScan =
        costModule.calculateApiCost(model, { promptTokens: 4500, candidatesTokens: 2600, thoughtsTokens: 0 })
          .totalCostUsd || perScan;
    } catch {
      /* estimate only */
    }
    const estimate = (perScan * opts.liveN).toFixed(4);
    log(
      `\n[bench] LIVE MODE — ${opts.liveN} real scans against ${model}.\n` +
        `[bench] Rough estimate: ~$${perScan.toFixed(4)}/scan → ~$${estimate} total (real usage varies).\n`
    );
    if (opts.liveConfirm !== 'yes') {
      console.error('[bench] Refusing to spend tokens without confirmation. Re-run with --live-confirm=yes');
      process.exit(2);
    }
  }

  fs.mkdirSync(runDir, { recursive: true });
  const serverLog = path.join(runDir, 'server.log');
  const engine = await provisionEngine();
  const evidenceDir = path.join(runDir, 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const port = opts.port || (await findFreePort(3400));
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    EVIDENCE_DIR: evidenceDir,
    AUTO_MIGRATE: 'true',
  };
  if (engine.kind === 'pglite') {
    delete serverEnv.DATABASE_URL;
    serverEnv.PGLITE_DATA_DIR = engine.pgdataDir;
  } else {
    delete serverEnv.PGLITE_DATA_DIR;
    serverEnv.DATABASE_URL = engine.databaseUrl;
  }
  // Offline mode forces the deterministic simulation, whatever .env says.
  if (opts.mode === 'offline') serverEnv.GEMINI_MODE = 'off';

  let server = null;
  let run = null;
  try {
    const corpus = await loadCorpus({ count: opts.corpus, mode: opts.mode, corpusDir: opts.corpusDir });
    log(`[bench] corpus: ${corpus.source}`);

    log(`[bench] starting server on :${port} (${engine.kind}, ${opts.mode}) ...`);
    server = await startServer({ env: serverEnv, port, logPath: serverLog });
    const bootMs = server.bootMs;
    const serverEngineLabel = server.health.engine;
    log(`[bench] server healthy in ${bootMs}ms — engine: ${serverEngineLabel}`);

    if (opts.mode === 'live' && /offline/i.test(serverEngineLabel)) {
      throw new Error(
        `live mode requested but the server booted offline (${serverEngineLabel}). ` +
          'Set GEMINI_MODE=vertex|api with credentials in .env, or use --mode=offline.'
      );
    }

    const engineNote =
      engine.kind === 'pglite'
        ? 'PGlite in-process (single-process advisory lock — throughput is a lower bound)'
        : 'PostgreSQL in a disposable container (production-like)';

    const concurrencyLevels =
      opts.mode === 'live' ? [1] : opts.concurrency.split(',').map((n) => Number(n.trim())).filter((n) => n > 0);
    const scansPerLevel = opts.mode === 'live' ? opts.liveN : opts.scans;

    // --- Warmup (discarded) -------------------------------------------------
    const warmupCount = opts.mode === 'live' ? 1 : opts.warmup;
    if (warmupCount > 0) {
      log(`[bench] warmup: ${warmupCount} scans ...`);
      await runScanBatch({
        baseUrl: server.baseUrl,
        images: corpus.images,
        count: warmupCount,
        concurrency: 1,
        retries: opts.mode === 'live' ? 2 : 0,
        onResult: () => {},
      });
    }

    // --- Measured scan batches ---------------------------------------------
    const primary = { latencies: [], errors: 0, ids: [], bytes: [], evidenceUrl: null, errorSamples: [], retried: 0 };
    const curve = [];
    let allIds = [];

    for (const concurrency of concurrencyLevels) {
      const latencies = [];
      const ids = [];
      let errors = 0;
      const bytes = [];
      const startedAt = performance.now();

      await runScanBatch({
        baseUrl: server.baseUrl,
        images: corpus.images,
        count: scansPerLevel,
        concurrency,
        retries: opts.mode === 'live' ? 2 : 0,
        onResult: (result) => {
          latencies.push(result.ms);
          bytes.push(result.bytes);
          if (result.attempts > 1) primary.retried++;
          if (result.status === 200 && result.payload?.id) {
            ids.push(result.payload.id);
            if (!primary.evidenceUrl && result.payload.evidenceUrl) primary.evidenceUrl = result.payload.evidenceUrl;
          } else {
            errors++;
            if (primary.errorSamples.length < 3) {
              primary.errorSamples.push(
                result.error
                  ? `transport: ${result.error}`
                  : `HTTP ${result.status}: ${JSON.stringify(result.payload ?? {}).slice(0, 240)}`
              );
            }
          }
        },
      });

      const wallSeconds = (performance.now() - startedAt) / 1000;
      const stats = summarize(latencies);
      curve.push({
        concurrency,
        scans: scansPerLevel,
        wallSeconds: Number(wallSeconds.toFixed(2)),
        scansPerSec: Number((scansPerLevel / wallSeconds).toFixed(2)),
        wallMsP50: stats.p50,
        wallMsP95: stats.p95,
        errors,
      });
      log(
        `[bench] concurrency ${concurrency}: ${scansPerLevel} scans in ${wallSeconds.toFixed(2)}s ` +
          `(${(scansPerLevel / wallSeconds).toFixed(1)}/s) p50=${stats.p50}ms p95=${stats.p95}ms errors=${errors}`
      );

      allIds = allIds.concat(ids);
      if (concurrency === concurrencyLevels[0]) {
        primary.latencies = latencies;
        primary.errors = errors;
        primary.ids = ids;
        primary.bytes = bytes;
      }
    }

    if (!primary.ids.length) throw new Error('no successful scans — nothing to measure');

    // --- Endpoint latency ---------------------------------------------------
    const sampleId = primary.ids[0];
    const evidenceUrl = primary.evidenceUrl || `/api/evidence/${sampleId}.jpg`;
    log('[bench] endpoint latency sweep ...');
    const endpoints = [];
    endpoints.push(await benchEndpoint({ baseUrl: server.baseUrl, name: 'health', target: '/api/health', requests: 60 }));
    endpoints.push(await benchEndpoint({ baseUrl: server.baseUrl, name: 'census', target: '/api/census', requests: 60 }));
    endpoints.push(
      await benchEndpoint({ baseUrl: server.baseUrl, name: 'citizen/:id', target: `/api/citizen/${sampleId}`, requests: 60 })
    );
    endpoints.push(await benchEndpoint({ baseUrl: server.baseUrl, name: 'evidence/:name', target: evidenceUrl, requests: 60 }));
    // The scan endpoint is only re-issued in offline mode: in live mode every
    // request spends real tokens and the scan batch already measured it.
    if (opts.mode === 'offline') {
      endpoints.push(
        await benchEndpoint({
          baseUrl: server.baseUrl,
          name: 'oracle/scan',
          target: '/api/oracle/scan',
          method: 'POST',
          body: { image: corpus.images[0], category: null },
          requests: 30,
        })
      );
    }
    for (const endpoint of endpoints) {
      log(`[bench]   ${endpoint.name.padEnd(16)} p50=${String(endpoint.p50).padStart(7)}ms p95=${String(endpoint.p95).padStart(7)}ms errors=${endpoint.errors}`);
    }

    // --- Stop the server, then read what it wrote ---------------------------
    await stopServer(server.child);
    server = null;

    log('[bench] reading scan_api_logs from the run database ...');
    const facts = await collectDatabaseFacts({ engine, dossierIds: allIds });

    const primaryRecords = primary.ids.map((id) => facts.perDossier.get(id)).filter(Boolean);
    const pick = (record, field) => record?.[field];
    const overheadOf = (record) =>
      record?.total != null && record.pass1 != null && record.pass2 != null
        ? record.total - record.pass1 - record.pass2
        : null;

    const costTotal = primaryRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    const primaryStats = {
      concurrency: concurrencyLevels[0],
      scans: primary.ids.length,
      errors: primary.errors,
      wallMs: summarize(primary.latencies),
      payloadBytes: summarize(primary.bytes),
      serverTotalMs: summarize(primaryRecords.map((r) => pick(r, 'total')).filter((v) => v != null)),
      pass1Ms: summarize(primaryRecords.map((r) => pick(r, 'pass1')).filter((v) => v != null)),
      pass2Ms: summarize(primaryRecords.map((r) => pick(r, 'pass2')).filter((v) => v != null)),
      overheadMs: summarize(primaryRecords.map(overheadOf).filter((v) => v != null)),
      promptTokens: summarize(primaryRecords.map((r) => r.prompt)),
      outputTokens: summarize(primaryRecords.map((r) => r.output)),
      totalTokens: summarize(primaryRecords.map((r) => r.tokens)),
      costUsdPerScan: {
        mean: Number(mean(primaryRecords.map((r) => r.cost)).toFixed(6)),
        p95: summarize(primaryRecords.map((r) => r.cost), 6).p95,
        total: Number(costTotal.toFixed(6)),
      },
      erroredScans: primaryRecords.filter((r) => r.errored).length,
      retriedScans: primary.retried,
      errorSamples: primary.errorSamples,
    };

    // --- By tier ------------------------------------------------------------
    const tierRecords = allIds.map((id) => ({ id, caste: facts.casteById.get(id), record: facts.perDossier.get(id) }));
    const byTier = [...groupBy(tierRecords, (entry) => entry.caste ?? 'unknown')].map(([caste, entries]) => {
      const totalMs = entries.map((e) => e.record?.total).filter((v) => v != null);
      return {
        caste,
        tierName: caste === 'unknown' ? 'unknown' : getFaction(caste).name,
        count: entries.length,
        tokensMean: Math.round(mean(entries.map((e) => e.record?.tokens ?? 0))),
        costUsdMean: Number(mean(entries.map((e) => e.record?.cost ?? 0)).toFixed(6)),
        totalMsP50: summarize(totalMs).p50,
      };
    });

    run = {
      id: opts.label || `${engine.kind}-${opts.mode}`,
      engine: engine.kind,
      engineLabel: engineNote,
      engineVersion: facts.engineVersion,
      databaseLabel: facts.label,
      mode: opts.mode,
      model: opts.mode === 'live' ? envFile.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash' : 'simulated-engine',
      engineReportedByServer: serverEngineLabel,
      bootMs,
      corpus: corpus.source,
      warmup: warmupCount,
      scansPerLevel,
      concurrencyLevels,
      primary: primaryStats,
      concurrencyCurve: curve,
      endpoints,
      byTier,
      math: measureComplianceMath(),
    };
  } finally {
    if (server?.child) await stopServer(server.child);
    engine.stop();
    if (!opts.keep) {
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    } else {
      log(`[bench] artifacts kept in ${runDir}`);
    }
  }

  if (!run) throw new Error('benchmark produced no run data');

  const output = { schemaVersion: 1, environment: environmentBlock(), run };
  const outPath = opts.out
    ? path.resolve(REPO_ROOT, opts.out)
    : path.join(REPO_ROOT, 'docs', 'performance', 'data', `bench-${run.id}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

  log(`\n[bench] wrote ${path.relative(REPO_ROOT, outPath)}`);
  log(`[bench] run ${run.id}: ${run.primary.scans} scans, p50 ${run.primary.wallMs.p50}ms, ` +
    `${run.primary.costUsdPerScan.total.toFixed(6)} USD total`);
  log('[bench] render the report with: pnpm bench:report');
}

main().catch((error) => {
  console.error(`\n[bench] FAILED: ${error.message}`);
  process.exitCode = 1;
});
