#!/usr/bin/env node
/**
 * Screenshots of every screen a production visitor can reach.
 *
 *   pnpm screenshots                      # both viewports, ./screenshots
 *   pnpm screenshots --viewport mobile    # just the phone
 *   pnpm screenshots --only verdict,grid  # write only these frames
 *   pnpm screenshots --headed --keep      # watch it, leave the server up
 *
 * The app is driven *for real*: the script boots the built server (one process
 * serves the API and the SPA), forces the offline simulation (`GEMINI_MODE=off`,
 * so no Vertex calls and no cost), and walks the citizen's path — upload the
 * evidence photo, read the verdict, file an appeal, unlock the registry with the
 * one-time code the server prints, accept the ruling, then the orders.
 *
 * Nothing touches a real deployment: the database is a throwaway PGlite
 * directory under the OS temp dir, deleted after the run.
 *
 * The evidence photo is the committed fixture (`scripts/fixtures/demo-scan.jpg`,
 * metadata-stripped). `--photo <path>` swaps in another.
 *
 * Requires `pnpm build` first (the server and the production SPA).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ENTRY = path.join(ROOT, 'apps/server/dist/index.js');
const WEB_ENTRY = path.join(ROOT, 'apps/web/dist/index.html');
const DEFAULT_PHOTO = path.join(ROOT, 'scripts/fixtures/demo-scan.jpg');

const REGISTRY_EMAIL = 'screenshots@arbiter.test';

/** The two presets double as the sizes the PWA manifest declares. */
const VIEWPORTS = {
  mobile: {
    name: 'mobile',
    width: 540,
    height: 960,
    deviceScaleFactor: 2, // 1080×1920
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    name: 'desktop',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

const HELP = `
Screenshots of the production-reachable screens.

Usage: pnpm screenshots [options]

  --viewport <mobile|desktop|both>  Which sizes to capture (default: both)
  --out <dir>                       Output directory (default: ./screenshots)
  --photo <path>                    Evidence photo (default: scripts/fixtures/demo-scan.jpg)
  --only <name,name>                Only write these shots (the flow still runs)
  --full-page                       Capture the whole scrollable page
  --include-analysis                Also capture the in-flight analysis screen
  --headed                          Show the browser
  --keep                            Leave the server running (and its temp DB)
  --base-url <url>                  Use an already-running app (skips booting one)
  --otp <code>                      One-time code, for --base-url runs
  --port <port>                     Port for the booted server (default: 4177)
  --help                            This text
`;

function parseArgs(argv) {
  const options = {
    viewport: 'both',
    out: 'screenshots',
    photo: DEFAULT_PHOTO,
    only: null,
    fullPage: false,
    includeAnalysis: false,
    headed: false,
    keep: false,
    baseUrl: null,
    otp: null,
    port: 4177,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq > 0 ? arg.slice(0, eq) : arg;
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined;
    const value = () => (inline !== undefined ? inline : argv[(i += 1)]);

    switch (flag) {
      case '--viewport':
        options.viewport = value();
        break;
      case '--out':
        options.out = value();
        break;
      case '--photo':
        options.photo = path.resolve(value());
        break;
      case '--only':
        options.only = value()
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);
        break;
      case '--full-page':
        options.fullPage = true;
        break;
      case '--include-analysis':
        options.includeAnalysis = true;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--keep':
        options.keep = true;
        break;
      case '--base-url':
        options.baseUrl = value().replace(/\/+$/, '');
        break;
      case '--otp':
        options.otp = value();
        break;
      case '--port':
        options.port = Number(value());
        break;
      case '--help':
      case '-h':
        console.log(HELP.trim());
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}\n${HELP}`);
        process.exit(1);
    }
  }

  if (!['mobile', 'desktop', 'both'].includes(options.viewport)) {
    console.error(`--viewport must be mobile, desktop or both (got "${options.viewport}")`);
    process.exit(1);
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Routes whose last segment is a dossier id — the same set the web app knows. */
const ID_ROUTES = new Set(['citizen', 'arbitration', 'claim', 'appeal', 'appeals', 'inform']);

/** `/citizen/abc123` → `/citizen/:id`: the gallery should not read like a log. */
function routePattern(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  if (segments.length > 1 && ID_ROUTES.has(segments[0])) return `/${segments[0]}/:id`;
  return `/${segments.join('/')}`;
}

/** Poll `check` until it returns something truthy, or throw after `timeoutMs`. */
async function waitFor(check, { timeoutMs = 30_000, intervalMs = 150, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------
// The app: booted server (or an existing one) + the one-time code it prints
// ---------------------------------------------------------------------------

async function bootServer({ port }) {
  if (!existsSync(SERVER_ENTRY) || !existsSync(WEB_ENTRY)) {
    throw new Error('Run `pnpm build` first — the server and the web build are missing.');
  }

  const root = path.join(os.tmpdir(), 'ecocide-screenshots');
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    PGLITE_DATA_DIR: path.join(root, 'db'),
    EVIDENCE_DIR: path.join(root, 'evidence'),
    // Force the deterministic offline pipeline: no Vertex, no cost, no network.
    GEMINI_MODE: 'off',
    BETTER_AUTH_URL: baseUrl,
    APP_BASE_URL: baseUrl,
  };
  // The one-time code is only printed in development mode (that is how the app
  // keeps it out of production logs). This script is development tooling.
  delete env.NODE_ENV;

  const child = spawn(process.execPath, [SERVER_ENTRY], { cwd: ROOT, env, stdio: 'pipe' });
  let log = '';
  child.stdout.on('data', (chunk) => {
    log += chunk;
  });
  child.stderr.on('data', (chunk) => {
    log += chunk;
  });

  const stop = async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(root, { recursive: true, force: true });
  };

  try {
    await waitFor(
      async () => {
        if (child.exitCode !== null) {
          throw new Error(`The server exited (${child.exitCode}).\n${log.slice(-2000)}`);
        }
        try {
          const res = await fetch(`${baseUrl}/api/health`);
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      },
      { timeoutMs: 90_000, intervalMs: 300, what: 'the app to boot' }
    );
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }

  console.log(`[screenshots] app ready on ${baseUrl} (jobs: inline, engine: simulated)`);

  /** The most recent code the server printed for this address, not yet used. */
  const usedCodes = new Set();
  const waitForOtp = async (email) => {
    const pattern = new RegExp(`Registry unlock OTP for ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: (\\d+)`, 'g');
    const code = await waitFor(
      () => {
        const matches = [...log.matchAll(pattern)];
        const fresh = matches.map((match) => match[1]).filter((value) => !usedCodes.has(value));
        return fresh.at(-1) ?? null;
      },
      { timeoutMs: 20_000, what: `the one-time code for ${email}` }
    );
    usedCodes.add(code);
    return code;
  };

  return { baseUrl, waitForOtp, stop };
}

/** No server to read: ask for the code up front or fail with a clear message. */
function manualOtp(baseUrl, otp) {
  if (otp) return async () => otp;
  return async () => {
    throw new Error(
      `--base-url ${baseUrl} cannot read the one-time code (it is printed by the server this script boots). ` +
        'Pass --otp <code> when the app asks for it, or drop --base-url to let the script boot its own server.'
    );
  };
}

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------

function makeShots(page, options, viewportName, manifest) {
  let counter = 0;
  return async function shot(name, caption, { settleMs = 400, fullPage = options.fullPage } = {}) {
    if (options.only && !options.only.some((prefix) => name.startsWith(prefix))) return;
    counter += 1;
    await page.evaluate(() => document.fonts.ready);
    // Stamps land, the typewriter settles, confetti falls — a capture should be
    // a resting frame, not an animation still.
    await page.waitForTimeout(settleMs);
    const file = path.join(options.out, viewportName, `${String(counter).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage });
    const route = new URL(page.url()).pathname;
    manifest.push({
      name,
      caption,
      viewport: viewportName,
      route,
      routePattern: routePattern(route),
      file: path.relative(options.out, file),
    });
    console.log(`[screenshots] ${path.relative(ROOT, file)}`);
  };
}

/** Sign in through the registry unlock form (email → code from the server log). */
async function signIn(page, waitForOtp) {
  await page.getByLabel('Registry email address').fill(REGISTRY_EMAIL);
  await page.getByRole('button', { name: 'Unlock Carbon Registry' }).click();
  const code = await waitForOtp(REGISTRY_EMAIL);
  await page.getByLabel('One-time access code').fill(code);
  await page.getByRole('button', { name: 'Unlock registry' }).click();
}

async function captureViewport(browser, options, viewport, baseUrl, waitForOtp, manifest) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    colorScheme: 'dark',
    // The app flattens its stamp/typewriter motion under this, so a capture is
    // a settled frame rather than a mid-animation one.
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  const shot = makeShots(page, options, viewport.name, manifest);
  const goto = async (route) => {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  };

  console.log(`\n[screenshots] --- ${viewport.name} ---`);

  // 01 — landing
  await goto('/');
  await shot('landing', 'The landing screen: terminal + paper dossier, the audit starts here.');

  // 02 — scanner (the screen a visitor captures a room on)
  await page.getByRole('button', { name: 'BEGIN AUDIT' }).click();
  await page.waitForURL(/\/scan$/);
  await shot('scanner', 'The household scanner: camera, drag-and-drop or file upload.');

  // 03 — verdict, from a real upload of the fixture photo
  const photoName = path.basename(options.photo);
  await page.setInputFiles('input[type="file"]', options.photo);
  await page.getByText(photoName, { exact: false }).first().waitFor();
  if (options.includeAnalysis) {
    await page.route('**/api/oracle/scan', async (route) => {
      await sleep(8000);
      await route.continue();
    });
  }
  await page.getByRole('button', { name: 'ANALYZE ITEMS' }).click();
  if (options.includeAnalysis) {
    await sleep(1500);
    await shot('analysis', 'The audit in flight: the analysis panel while the Arbiter works.');
  }
  await page.waitForURL(/\/arbitration\//, { timeout: 120_000 });
  await page.unroute('**/api/oracle/scan');
  const dossierId = new URL(page.url()).pathname.split('/').pop();
  // The scan fires confetti from the app; give it its ~3s to fall out of frame.
  await shot('verdict', 'The verdict: tier, index, per-item findings and the three acts.', {
    settleMs: 3600,
    // A phone shows one column at a time; the desk layout fits in one screen.
    fullPage: viewport.isMobile,
  });

  // 04 — claim, before any account exists (the unlock form of the terminal)
  await goto(`/claim/${dossierId}`);
  await page.getByText('Planetary Carbon Bank').first().waitFor();
  await shot('claim-locked', 'Claiming a verdict: the payment terminal, registry locked.');

  // 05 — registry, locked
  await goto('/registry');
  await page.getByRole('button', { name: 'Unlock Carbon Registry' }).waitFor();
  await shot('registry-locked', 'The Carbon Registry before unlocking.');

  // 06 — appeal: pay the filing fee (this is where the citizen first signs in)
  await goto(`/appeal/${dossierId}`);
  await page.getByText('APPEAL FILING FEE').first().waitFor();
  await signIn(page, waitForOtp);
  await page.getByRole('button', { name: 'Authorize carbon debit' }).click();
  await page.getByText('STATE YOUR CASE').first().waitFor({ timeout: 30_000 });
  await page
    .locator('textarea')
    .fill(
      'The evidence is a working desk, not a landfill. Every item on it is second-hand, repaired or ' +
        'old enough to vote, and the Bureau has priced their lifespan from a catalogue it invented. ' +
        'I plead clerical error and offer the pledges below.'
    );
  await shot('appeal-form', 'Filing an appeal: the citizen states their case and offers pledges.', {
    fullPage: viewport.isMobile,
  });

  // 07 — appeal records, after the ruling
  await page.getByRole('button', { name: 'SUBMIT APPEAL' }).click();
  await page.getByText('APPEAL RECORDS').first().waitFor({ timeout: 60_000 });
  await shot('appeal-records', 'The ruling on appeal, archived on the verdict.');

  // 08 — registry, unlocked
  await goto('/registry');
  await page.getByRole('button', { name: 'Unlock Carbon Registry' }).waitFor({ state: 'detached' });
  await shot('registry-unlocked', 'The registry unlocked: pooled standing, archive and the carbon account.');

  // 09 — claim, authorize step (the same terminal, now signed in)
  await goto(`/claim/${dossierId}`);
  await page.getByRole('button', { name: 'Authorize carbon debit' }).waitFor();
  await shot('claim-authorize', 'The certification fee, quoted in carbon credits.');

  // 10 — the accepted dossier, with its injunction mark
  await page.getByRole('button', { name: 'Authorize carbon debit' }).click();
  await page.waitForURL(/\/citizen\//, { timeout: 60_000 });
  await page
    .getByText(/Injunction issued|No corrective orders|drafting your orders/i)
    .first()
    .waitFor()
    .catch(() => {});
  await shot('citizen-accepted', 'The accepted verdict: sealed ruling, disposition mark and injunction stamp.', {
    fullPage: viewport.isMobile,
  });

  // 11 — the environmental injunction worksheet
  await goto('/injunction');
  await page.getByText('Environmental Injunction').first().waitFor({ timeout: 30_000 });
  await shot('injunction', 'The environmental injunction: the corrective orders for the accepted verdict.', {
    fullPage: viewport.isMobile,
  });

  // 12 — informant (tip a verdict against another household)
  await goto(`/inform/${dossierId}`);
  await page.getByText('SURRENDER EVIDENCE').first().waitFor();
  await shot('informant', 'Submitting a verdict as evidence against another household.');

  // 13 — the credits page
  await goto('/adjudicators');
  await page.waitForTimeout(600);
  await shot('adjudicators', 'The Adjudicators: who runs the Bureau.');

  // 14 — the Planetary Grid
  await goto('/grid');
  await page.waitForTimeout(2600); // the activity log prepends a line every ~3s
  await shot('grid', 'The Planetary Grid: live system status and activity log.');

  await context.close();

  if (consoleErrors.length > 0) {
    console.warn(`[screenshots] ${viewport.name}: ${consoleErrors.length} console error(s)`);
    for (const entry of consoleErrors.slice(0, 5)) console.warn(`  · ${entry}`);
  }
}

/**
 * The gallery page written next to the images, so a `screenshots/` directory is
 * browsable on GitHub without opening files one at a time. Built from the
 * manifest, so it always matches whatever the run just produced.
 */
function renderReadme({ shots, viewports, capturedAt, appVersion }) {
  const width = { mobile: 320, desktop: 760 };
  const sizes = { mobile: '1080×1920', desktop: '1920×1080' };
  const sources = { mobile: '540×960 @2×, touch', desktop: '1920×1080 @1×' };
  const lines = [
    '# Screenshots',
    '',
    'Every screen a production visitor can reach, captured from the built app by',
    '`pnpm screenshots`. The audits run on the deterministic offline simulation',
    '(no model calls, throwaway database), so the set is reproducible and free.',
    '',
    `- **Captured** ${capturedAt.slice(0, 10)} · ECOCIDE v${appVersion}`,
    `- **Viewports** ${viewports.map((name) => `${name} ${sizes[name]} (${sources[name]})`).join(' · ')}`,
    `- **Screens** ${viewports.map((name) => `${shots.filter((shot) => shot.viewport === name).length} ${name}`).join(' · ')}`,
    '',
  ];

  for (const viewport of viewports) {
    const group = shots.filter((shot) => shot.viewport === viewport);
    if (group.length === 0) continue;
    lines.push(
      `## ${viewport[0].toUpperCase()}${viewport.slice(1)} — ${sizes[viewport]}`,
      '',
      `<sub>Captured from a ${sources[viewport]} viewport.</sub>`,
      ''
    );
    lines.push('| # | Screen | Shot |', '|:--|:--|:--|');
    for (const [index, shot] of group.entries()) {
      const cap = shot.caption.replace(/\|/g, '\\|');
      const title = shot.name.replace(/-/g, ' ');
      const heading = `${title[0].toUpperCase()}${title.slice(1)}`;
      lines.push(
        `| ${String(index + 1).padStart(2, '0')} | **${heading}**<br>` +
          `${cap}<br><sub>\`${shot.routePattern}\`</sub> | ` +
          `<img src="${shot.file}" width="${width[viewport] ?? 480}" alt="${cap}"> |`
      );
    }
    lines.push('');
  }

  lines.push(
    '---',
    '',
    'Regenerate with `pnpm build && pnpm screenshots` (add `--viewport mobile` or',
    '`--only verdict,grid` for a subset). The evidence photo is',
    '`scripts/fixtures/demo-scan.jpg`; `--photo <path>` swaps in another.',
    ''
  );
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.photo)) {
    console.error(`Evidence photo not found: ${options.photo}`);
    process.exit(1);
  }

  options.out = path.resolve(options.out);
  const viewports =
    options.viewport === 'both' ? [VIEWPORTS.mobile, VIEWPORTS.desktop] : [VIEWPORTS[options.viewport]];

  let server = null;
  let baseUrl = options.baseUrl;
  let waitForOtp = null;

  if (options.baseUrl) {
    waitForOtp = manualOtp(options.baseUrl, options.otp);
    console.log(`[screenshots] using the app already running at ${baseUrl}`);
  } else {
    server = await bootServer({ port: options.port });
    baseUrl = server.baseUrl;
    waitForOtp = server.waitForOtp;
  }

  const manifest = [];
  const browser = await chromium.launch({ headless: !options.headed });

  try {
    for (const viewport of viewports) {
      await mkdir(path.join(options.out, viewport.name), { recursive: true });
      await captureViewport(browser, options, viewport, baseUrl, waitForOtp, manifest);
    }
  } finally {
    await browser.close();
    if (server && !options.keep) await server.stop();
    else if (server) console.log(`[screenshots] server left running at ${baseUrl} (--keep)`);
  }

  const capturedAt = new Date().toISOString();
  const appVersion = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')).version;
  const viewportNames = viewports.map((viewport) => viewport.name);

  await writeFile(
    path.join(options.out, 'manifest.json'),
    `${JSON.stringify({ capturedAt, viewports: viewportNames, shots: manifest }, null, 2)}\n`
  );
  await writeFile(
    path.join(options.out, 'README.md'),
    renderReadme({ shots: manifest, viewports: viewportNames, capturedAt, appVersion })
  );

  console.log(`\n[screenshots] ${manifest.length} shot(s) → ${path.relative(ROOT, options.out)}/`);
}

main().catch((error) => {
  console.error(`\n[screenshots] failed: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exit(1);
});
