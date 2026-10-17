#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Render the ECOCIDE performance report (`pnpm bench:report`).
//
// Reads one or more benchmark JSON files (written by `bench-scans.mjs`),
// writes `docs/performance/PERFORMANCE.md` and the SVG charts it embeds, and is
// fully re-runnable without re-running the benchmark: the raw numbers are the
// source of truth and the report is a pure function of them.
//
// Usage:
//   node scripts/render-perf-report.mjs                     # all data/*.json
//   node scripts/render-perf-report.mjs path/to/run.json     # specific files
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fmtNumber,
  groupedBarChart,
  lineChart,
  stackedBarChart,
} from './lib/svg-chart.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'performance');
const CHARTS_DIR = path.join(DOCS_DIR, 'charts');
const DATA_DIR = path.join(DOCS_DIR, 'data');

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const fmtInt = (v) => Number(v ?? 0).toLocaleString('en-US');

/** Milliseconds, switching to seconds once it stops being readable. */
function fmtMs(v) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  return `${Number(v.toFixed(2))} ms`;
}

/** USD with enough precision to see per-scan costs. */
function fmtUsd(v) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  if (v < 0.01) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(4)}`;
}

/** Markdown table cell: pipes and newlines would break the row. */
function cell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** Repo-relative when inside the repo, absolute otherwise. */
function displayPath(file) {
  const relative = path.relative(REPO_ROOT, file);
  return relative.startsWith('..') ? file : relative;
}

function table(headers, rows) {
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function resolveInputs(argv) {
  const explicit = argv.filter((arg) => !arg.startsWith('--'));
  if (explicit.length) return explicit.map((file) => path.resolve(REPO_ROOT, file));
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(DATA_DIR, name));
}

function loadRuns(files) {
  const docs = files.map((file) => {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.schemaVersion !== 1) {
      throw new Error(`${file}: unsupported schemaVersion ${parsed.schemaVersion}`);
    }
    return { file, environment: parsed.environment, run: parsed.run };
  });
  if (!docs.length) {
    throw new Error(`no benchmark JSON found (looked in ${DATA_DIR}). Run \`pnpm bench\` first.`);
  }

  const rank = (run) => [run.mode === 'offline' ? 0 : 1, run.engine === 'postgres' ? 0 : 1];
  const runs = docs
    .map((doc) => ({ ...doc.run, sourceFile: path.relative(REPO_ROOT, doc.file) }))
    .sort((a, b) => {
      const [am, ae] = rank(a);
      const [bm, be] = rank(b);
      return am - bm || ae - be || a.id.localeCompare(b.id);
    });

  const environments = docs.map((doc) => doc.environment);
  return { runs, environments };
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const writtenCharts = [];

function writeChart(name, svg) {
  fs.mkdirSync(CHARTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(CHARTS_DIR, `${name}.svg`), svg);
  writtenCharts.push(name);
  return `./charts/${name}.svg`;
}

function buildCharts(runs) {
  const charts = {};
  const offlineRuns = runs.filter((run) => run.mode === 'offline');
  const liveRuns = runs.filter((run) => run.mode === 'live');

  // End-to-end latency by run (engine × mode).
  charts.latencyByMode = writeChart(
    'latency-by-mode',
    groupedBarChart({
      title: 'End-to-end audit latency by run (server-measured)',
      categories: runs.map((run) => run.id),
      series: [
        { name: 'p50', values: runs.map((run) => run.primary.serverTotalMs.p50) },
        { name: 'p95', values: runs.map((run) => run.primary.serverTotalMs.p95) },
      ],
      format: fmtMs,
      yLabel: '',
      rotateX: runs.length > 3,
      note: 'scan_total rows: request receipt → dossier persisted, measured in the server process',
    })
  );

  // Where the live latency actually goes.
  if (liveRuns.length) {
    charts.liveDecomposition = writeChart(
      'live-latency-decomposition',
      stackedBarChart({
        title: 'Live audit latency composition (p50, per pass)',
        categories: liveRuns.map((run) => run.id),
        series: [
          { name: 'Pass 1 — vision', values: liveRuns.map((run) => run.primary.pass1Ms.p50) },
          { name: 'Pass 2 — verdict', values: liveRuns.map((run) => run.primary.pass2Ms.p50) },
          { name: 'Server overhead', values: liveRuns.map((run) => run.primary.overheadMs.p50) },
        ],
        format: fmtMs,
        yLabel: '',
        note: 'Server overhead is everything outside the two model calls — it includes the deterministic compliance math',
      })
    );
  }

  // Throughput against concurrency, one line per offline run.
  if (offlineRuns.length) {
    const levels = offlineRuns[0].concurrencyCurve.map((point) => point.concurrency);
    charts.throughput = writeChart(
      'throughput-concurrency',
      lineChart({
        title: 'Scan throughput vs concurrency',
        xValues: levels.map((level) => `c=${level}`),
        series: offlineRuns.map((run) => ({
          name: run.id,
          values: levels.map((level) => {
            const point = run.concurrencyCurve.find((entry) => entry.concurrency === level);
            return point ? point.scansPerSec : 0;
          }),
        })),
        format: (v) => `${Number(v.toFixed(1))}/s`,
        yLabel: 'scans / second',
        xLabel: 'client concurrency',
        note: 'Offline (simulated) scans — measures the server pipeline, not the model',
      })
    );
  }

  // Endpoint latency percentiles for the most production-like offline run.
  const endpointRun = offlineRuns.find((run) => run.engine === 'postgres') || offlineRuns[0] || runs[0];
  if (endpointRun?.endpoints?.length) {
    charts.endpoints = writeChart(
      'endpoint-latency',
      groupedBarChart({
        title: `Endpoint latency — ${endpointRun.id}`,
        categories: endpointRun.endpoints.map((endpoint) => endpoint.name),
        series: [
          { name: 'p50', values: endpointRun.endpoints.map((endpoint) => endpoint.p50) },
          { name: 'p95', values: endpointRun.endpoints.map((endpoint) => endpoint.p95) },
          { name: 'p99', values: endpointRun.endpoints.map((endpoint) => endpoint.p99) },
        ],
        format: fmtMs,
        yLabel: '',
        rotateX: true,
        note: '60 requests per read endpoint, 30 for the scan endpoint, concurrency 1',
      })
    );
  }

  // Token composition for live runs.
  if (liveRuns.length) {
    charts.tokens = writeChart(
      'token-composition',
      stackedBarChart({
        title: 'Tokens per audit (mean, both passes)',
        categories: liveRuns.map((run) => run.id),
        series: [
          { name: 'Prompt (input)', values: liveRuns.map((run) => run.primary.promptTokens.mean) },
          { name: 'Output (verdict + thinking)', values: liveRuns.map((run) => run.primary.outputTokens.mean) },
        ],
        format: fmtNumber,
        yLabel: 'tokens',
      })
    );

    const tieredRun = liveRuns.find((run) => run.byTier?.length);
    if (tieredRun) {
      charts.costByTier = writeChart(
        'cost-by-tier',
        groupedBarChart({
          title: `Cost per audit by tier — ${tieredRun.id}`,
          categories: tieredRun.byTier.map((tier) => tier.tierName),
          series: [{ name: 'USD / audit', values: tieredRun.byTier.map((tier) => tier.costUsdMean) }],
          format: fmtUsd,
          yLabel: 'USD',
          rotateX: true,
        })
      );
    }
  }

  return charts;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function environmentSection(environment, files) {
  return table(
    ['Property', 'Value'],
    [
      ['Commit', `${environment.commitShort}${environment.dirty ? ' (uncommitted changes at run time)' : ''}`],
      ['Generated', environment.generatedAt],
      ['Node', environment.node],
      ['Platform', `${environment.platform} (${environment.arch})`],
      ['CPU', `${environment.cpuModel} · ${environment.cpuCount} cores`],
      ['Memory', `${fmtInt(environment.totalMemMb)} MB`],
      ['Server build', environment.distBuiltAt ? `${environment.distBuiltAt}${environment.distStale ? ' — STALE (src newer than dist)' : ''}` : 'unknown'],
      ['Raw data', files.map(displayPath).join(', ')],
    ]
  );
}

function workloadSection(runs) {
  return table(
    ['Run', 'Engine', 'Mode', 'Model', 'Scans', 'Warmup', 'Concurrency', 'Corpus', 'Boot'],
    runs.map((run) => [
      run.id,
      run.engine,
      run.mode,
      run.model,
      fmtInt(run.scansPerLevel),
      fmtInt(run.warmup),
      run.concurrencyLevels.join(', '),
      run.corpus,
      run.bootMs != null ? fmtMs(run.bootMs) : '—',
    ])
  );
}

function pipelineSection(runs) {
  return table(
    ['Run', 'Pass 1 p50', 'Pass 1 p95', 'Pass 2 p50', 'Pass 2 p95', 'Overhead p50', 'End-to-end p50', 'End-to-end p95', 'Wall p50', 'Errors'],
    runs.map((run) => {
      const p = run.primary;
      return [
        run.id,
        fmtMs(p.pass1Ms.p50),
        fmtMs(p.pass1Ms.p95),
        fmtMs(p.pass2Ms.p50),
        fmtMs(p.pass2Ms.p95),
        fmtMs(p.overheadMs.p50),
        fmtMs(p.serverTotalMs.p50),
        fmtMs(p.serverTotalMs.p95),
        fmtMs(p.wallMs.p50),
        `${p.errors}${p.erroredScans ? ` (+${p.erroredScans} errored rows)` : ''}`,
      ];
    })
  );
}

function tokenCostSection(runs) {
  return table(
    ['Run', 'Prompt (mean)', 'Output (mean)', 'Total (mean)', 'USD / audit (mean)', 'USD / audit (p95)', 'USD total', 'USD / 1,000 audits'],
    runs.map((run) => {
      const p = run.primary;
      return [
        run.id,
        fmtInt(Math.round(p.promptTokens.mean)),
        fmtInt(Math.round(p.outputTokens.mean)),
        fmtInt(Math.round(p.totalTokens.mean)),
        fmtUsd(p.costUsdPerScan.mean),
        fmtUsd(p.costUsdPerScan.p95),
        fmtUsd(p.costUsdPerScan.total),
        fmtUsd(p.costUsdPerScan.mean * 1000),
      ];
    })
  );
}

function throughputSection(runs) {
  const rows = [];
  for (const run of runs) {
    for (const point of run.concurrencyCurve) {
      rows.push([
        run.id,
        point.concurrency,
        fmtInt(point.scans),
        point.wallSeconds,
        `${point.scansPerSec}/s`,
        fmtMs(point.wallMsP50),
        fmtMs(point.wallMsP95),
        point.errors,
      ]);
    }
  }
  return table(['Run', 'Concurrency', 'Scans', 'Wall (s)', 'Throughput', 'p50', 'p95', 'Errors'], rows);
}

function endpointSection(runs) {
  const blocks = [];
  for (const run of runs) {
    if (!run.endpoints?.length) continue;
    blocks.push(
      `**${run.id}**`,
      '',
      table(
        ['Endpoint', 'Requests', 'p50', 'p95', 'p99', 'req/s', 'Mean bytes', 'Errors'],
        run.endpoints.map((endpoint) => [
          `\`${endpoint.path}\``,
          endpoint.requests,
          fmtMs(endpoint.p50),
          fmtMs(endpoint.p95),
          fmtMs(endpoint.p99),
          endpoint.rps,
          fmtInt(endpoint.bytesMean),
          endpoint.errors,
        ])
      ),
      ''
    );
  }
  return blocks.join('\n');
}

function tierSection(runs) {
  const liveRun = runs.find((run) => run.mode === 'live' && run.byTier?.length);
  if (!liveRun) return '';
  return table(
    ['Tier', 'Audits', 'Tokens (mean)', 'USD / audit (mean)', 'End-to-end p50'],
    liveRun.byTier.map((tier) => [
      tier.tierName,
      tier.count,
      fmtInt(tier.tokensMean),
      fmtUsd(tier.costUsdMean),
      fmtMs(tier.totalMsP50),
    ])
  );
}

function errorSection(runs) {
  const samples = runs.flatMap((run) => (run.primary.errorSamples ?? []).map((sample) => [run.id, sample]));
  if (!samples.length) return '';
  return table(['Run', 'Sample error'], samples);
}

/** Data-driven bullets — the report's conclusions, derived, not asserted. */
function findings(runs) {
  const bullets = [];
  const offline = runs.filter((run) => run.mode === 'offline');
  const live = runs.filter((run) => run.mode === 'live');

  for (const run of live) {
    const p = run.primary;
    // Share against the sum of the p50 components, not the p50 of the sums —
    // medians of parts and the median of the whole are different samples.
    const composition = (p.pass1Ms.p50 + p.pass2Ms.p50 + p.overheadMs.p50) || 1;
    bullets.push(
      `**${run.id}**: Pass 1 (vision) is ${((p.pass1Ms.p50 / composition) * 100).toFixed(0)}% of the end-to-end audit and ` +
        `Pass 2 (verdict text) ${((p.pass2Ms.p50 / composition) * 100).toFixed(0)}%; everything else — request parse, ` +
        `compliance math, evidence write, persistence — is ${((p.overheadMs.p50 / composition) * 100).toFixed(1)}% (${fmtMs(p.overheadMs.p50)}).`
    );
  }

  if (live.length && offline.length) {
    const liveP50 = live[0].primary.serverTotalMs.p50;
    const offlineP50 = offline[0].primary.serverTotalMs.p50;
    if (liveP50 > 0 && offlineP50 > 0) {
      bullets.push(
        `A real audit costs ~${fmtInt(Math.round(liveP50 / offlineP50))}× the simulated one in latency ` +
          `(${fmtMs(liveP50)} vs ${fmtMs(offlineP50)}) and ${fmtUsd(live[0].primary.costUsdPerScan.mean)} in tokens; ` +
          'the offline path is free, which is what keeps the test suite and local development hermetic.'
      );
    }
  }

  for (const run of offline) {
    const curve = run.concurrencyCurve;
    if (curve.length < 2) continue;
    const first = curve[0];
    const last = curve[curve.length - 1];
    const scaling = last.scansPerSec / (first.scansPerSec || 1);
    bullets.push(
      `**${run.id}**: concurrency ${first.concurrency} → ${last.concurrency} multiplies throughput by ` +
        `${scaling.toFixed(2)}× (${first.scansPerSec}/s → ${last.scansPerSec}/s) while p50 rises ` +
        `${(last.wallMsP50 / (first.wallMsP50 || 1)).toFixed(2)}× — the audit is CPU-bound in one Node process, ` +
        'so extra concurrency mostly buys queueing, not parallelism.'
    );
  }

  if (offline.length > 1) {
    const postgres = offline.find((run) => run.engine === 'postgres');
    const pglite = offline.find((run) => run.engine === 'pglite');
    if (postgres && pglite) {
      const delta = postgres.primary.serverTotalMs.p50 - pglite.primary.serverTotalMs.p50;
      bullets.push(
        `Database driver moves the p50 by ${fmtMs(Math.abs(delta))} ` +
          `(${postgres.engine} ${fmtMs(postgres.primary.serverTotalMs.p50)} vs ${pglite.engine} ${fmtMs(pglite.primary.serverTotalMs.p50)}) — ` +
          'the storage layer is not the bottleneck; PGlite is fine for local work and the Postgres numbers are the ones to quote.'
      );
    }
  }

  const mathRun = runs.find((run) => run.math);
  if (mathRun) {
    const math = mathRun.math;
    bullets.push(
      `The compliance formula runs in ${math.usPerCall} µs per household (${math.usPerItem} µs per item, ` +
        `${math.itemsPerCall} items) — five orders of magnitude below a single model call, which is why keeping ` +
        'the math out of the model costs nothing and makes the verdict reproducible.'
    );
  }

  const failures = runs.reduce((sum, run) => sum + run.primary.errors, 0);
  bullets.push(
    failures === 0
      ? 'No failed requests across the measured runs.'
      : `${fmtInt(failures)} failed request(s) across the measured runs — see the error samples below.`
  );

  return bullets.map((bullet) => `- ${bullet}`).join('\n');
}

function threatsSection(runs, environment) {
  const items = [
    '- **Synthetic corpus (offline).** Offline runs use seeded generated images. That is the point — it makes the workload reproducible — but the simulated pipeline does no image decoding beyond hashing, so offline latency is a floor, not a model estimate.',
    '- **Single Node process.** The audit handler is synchronous CPU work on one thread, so concurrency converts to queueing. These numbers bound one instance; they are not a horizontal-scaling result.',
    '- **PGlite is a lower bound.** In-process PGlite takes a single-process advisory lock, so it cannot be compared to Postgres on throughput; the Postgres run is the production-like one.',
    '- **Disposable Postgres ≠ Cloud SQL.** The container runs on the same machine with no network hop, no connection pooler and no shared-CPU limits. Cloud SQL will be slower than these figures.',
    '- **Live runs carry upstream variance.** Model latency depends on the provider, region (`global` endpoint) and load. Percentiles from a small N are indicative, not a service-level guarantee.',
    '- **Cold start includes migrations.** `boot` time covers process start, database init and schema migration on a fresh database, not a warm restart.',
  ];
  if (runs.some((run) => run.mode === 'live')) {
    items.push(
      '- **Small live sample.** Live scans are bounded deliberately (each one bills real tokens), so p95/p99 from a handful of audits are weakly estimated; treat them as order-of-magnitude.'
    );
  }
  if (environment.dirty) {
    items.push('- **Uncommitted changes at run time.** The recorded commit does not fully describe the code that ran, so these figures are attributable to a working tree, not a release tag.');
  }
  if (environment.distStale) {
    items.push('- **Stale build.** `apps/server/src` is newer than `dist/`, so the numbers came from an older compiled server.');
  }
  return items.join('\n');
}

function render({ runs, environments, files }) {
  const environment = environments[0];
  const charts = buildCharts(runs);
  const liveRuns = runs.filter((run) => run.mode === 'live');
  const primaryRun = liveRuns[0] ?? runs[0];

  const sections = [];
  sections.push('# ECOCIDE — Performance Report');
  sections.push(
    [
      `Controlled benchmark of the household-audit pipeline and the API surface, measured by driving a real server process over HTTP.`,
      '',
      `**Headline (${primaryRun.id}):** ${fmtMs(primaryRun.primary.serverTotalMs.p50)} median end-to-end audit` +
        (primaryRun.mode === 'live'
          ? `, ${fmtUsd(primaryRun.primary.costUsdPerScan.mean)} of tokens per audit (${fmtInt(Math.round(primaryRun.primary.totalTokens.mean))} tokens).`
          : `, offline simulation — no tokens spent.`),
      '',
      '> Regenerate with `pnpm bench` (measure) and `pnpm bench:report` (render). The report is a pure function of the JSON in `docs/performance/data/`.',
    ].join('\n')
  );

  sections.push('## 1. Environment');
  sections.push(environmentSection(environment, files));

  sections.push('## 2. Workload');
  sections.push(workloadSection(runs));

  sections.push('## 3. Method');
  sections.push(
    [
      'Each run provisions a **throwaway** database (a fresh PGlite directory, or a disposable `postgres:17-alpine` container) and a throwaway evidence directory, starts the real server binary, waits for `/api/health`, then drives load over HTTP.',
      '',
      '- **Warmup** scans are discarded before measurement.',
      '- **Per-pass latency** is read back from `scan_api_logs` (the server logs each model call), not inferred from the client.',
      '- **End-to-end latency** comes from the `scan_total` row the scan handler writes: request receipt → dossier persisted.',
      '- **Concurrency** is swept by running the same scan count with a pool of N in-flight requests.',
      '- **Endpoint latency** is measured separately with fixed request counts at concurrency 1.',
      '- **Offline** mode forces `GEMINI_MODE=off`, so the deterministic simulation runs and no tokens are spent; **live** mode uses the configured Gemini engine and is gated behind `--live-confirm=yes`.',
    ].join('\n')
  );

  sections.push('## 4. Results');
  sections.push('### 4.1 End-to-end latency');
  sections.push(`![End-to-end latency by run](${charts.latencyByMode})`);
  sections.push(pipelineSection(runs));
  if (runs.some((run) => run.mode === 'offline')) {
    sections.push(
      '> Offline runs make no model call, so their Pass 1 / Pass 2 columns are the simulation\'s placeholder (1 ms) — ' +
        'their **End-to-end** and **Overhead** columns are real measurements of the offline pipeline.'
    );
  }

  if (charts.liveDecomposition) {
    sections.push('### 4.2 Where the live time goes');
    sections.push(`![Live latency decomposition](${charts.liveDecomposition})`);
    sections.push(
      table(
        ['Run', 'Pass 1 (vision)', 'Pass 2 (verdict)', 'Server overhead', 'Share of overhead'],
        liveRuns.map((run) => {
          const p = run.primary;
          const composition = (p.pass1Ms.p50 + p.pass2Ms.p50 + p.overheadMs.p50) || 1;
          return [
            run.id,
            `${fmtMs(p.pass1Ms.p50)} (${((p.pass1Ms.p50 / composition) * 100).toFixed(0)}%)`,
            `${fmtMs(p.pass2Ms.p50)} (${((p.pass2Ms.p50 / composition) * 100).toFixed(0)}%)`,
            fmtMs(p.overheadMs.p50),
            `${((p.overheadMs.p50 / composition) * 100).toFixed(1)}%`,
          ];
        })
      )
    );
    sections.push(
      '> The overhead segment is too small to see next to two multi-second model calls, which is itself the finding: ' +
        'the compliance math, evidence write and persistence are negligible.'
    );
  }

  sections.push('### 4.3 Tokens and cost');
  sections.push(tokenCostSection(runs));
  if (charts.tokens) {
    sections.push(`![Tokens per audit](${charts.tokens})`);
  }
  if (charts.costByTier) {
    sections.push('Cost is not uniform across the taxonomy — a worse audit carries more objects and more text:');
    sections.push(`![Cost per audit by tier](${charts.costByTier})`);
    sections.push(tierSection(runs));
  }

  sections.push('### 4.4 Throughput and concurrency');
  if (charts.throughput) sections.push(`![Throughput vs concurrency](${charts.throughput})`);
  sections.push(throughputSection(runs));

  sections.push('### 4.5 API endpoints');
  if (charts.endpoints) sections.push(`![Endpoint latency](${charts.endpoints})`);
  sections.push(endpointSection(runs));

  sections.push('### 4.6 Compliance math');
  const mathRun = runs.find((run) => run.math);
  if (mathRun) {
    sections.push(
      table(
        ['Metric', 'Value'],
        [
          ['Household roll-up per call', `${mathRun.math.usPerCall} µs`],
          ['Per audited item', `${mathRun.math.usPerItem} µs`],
          ['Items per simulated household', mathRun.math.itemsPerCall],
          ['Calls measured', fmtInt(mathRun.math.calls)],
        ]
      )
    );
  }

  const errors = errorSection(runs);
  if (errors) {
    sections.push('### 4.7 Errors');
    sections.push(errors);
  }

  sections.push('## 5. Findings');
  sections.push(findings(runs));

  sections.push('## 6. Threats to validity');
  sections.push(threatsSection(runs, environment));

  sections.push('## 7. Reproduce');
  sections.push(
    [
      '```bash',
      'pnpm build                       # the bench spawns apps/server/dist',
      'pnpm bench:matrix                # PGlite + Postgres, offline (free, ~2 min)',
      'pnpm bench --db=postgres --mode=live --live-n=5 --live-confirm=yes   # real tokens',
      'pnpm bench:report                # renders this file and the charts',
      '```',
      '',
      'Each run writes one JSON file into `docs/performance/data/`; the report merges every file it finds there, so runs accumulate as the project changes.',
    ].join('\n')
  );

  return `${sections.join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = resolveInputs(process.argv.slice(2));
const { runs, environments } = loadRuns(files);
const markdown = render({ runs, environments, files });

fs.mkdirSync(DOCS_DIR, { recursive: true });
const outPath = path.join(DOCS_DIR, 'PERFORMANCE.md');
fs.writeFileSync(outPath, markdown);

console.log(`[report] ${runs.length} run(s) → ${path.relative(REPO_ROOT, outPath)}`);
console.log(`[report] charts: ${writtenCharts.join(', ')}`);
