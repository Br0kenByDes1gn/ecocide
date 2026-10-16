import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { cors } from 'hono/cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import type { AppealRequest, AppealVerdict, OraclePayload, PledgeRef, ScanRequest } from '@ecocide/types';
import { getCasteFromScore, simulateHouseholdScan, type Caste } from '@ecocide/types';
import { householdRatio } from '@ecocide/compliance';
import {
  generateAppealVerdict,
  generateHouseholdInventory,
  generateHouseholdVerdict,
  generateReArbitrationVerdict,
  generateSimulatedAppealVerdict,
  generateSimulatedReArbitration,
  type InventoryResult,
  type ReArbitrationVerdict,
  type VerdictResult,
} from './gemini.js';
import { createRepositories, initDb, runMigrations } from './db/index.js';
import { createMailer, loadMailConfig, normalizeEmail } from './email/index.js';
import { createJobSystem } from './jobs/index.js';
import { createAuth } from './auth/index.js';
import { loadAuthConfig } from './auth/config.js';
import type { AuthVariables } from './auth/middleware.js';
import { createVaultRoutes } from './vault/routes.js';
import { dossierAccessError } from './access.js';
import { submitInformantTip } from './informant.js';
import { geminiConfigured, geminiModeLabel } from './gemini/config.js';
import {
  evidenceFileNameFor,
  evidenceUrlFor,
  isValidEvidenceName,
  mimeForEvidenceName,
  readEvidenceFile,
  saveEvidenceBase64,
  splitBase64DataUrl,
} from './evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env resolution order (first file to define a key wins; a real process env var
// always beats the files; missing files are skipped silently):
//   1. DOTENV_CONFIG_PATH — explicit override for custom deployments.
//   2. apps/server/.env  — package-local override.
//   3. Repo/workspace root .env — where README/.env.example tell you to put it.
//   4. cwd/.env — fallback when launched from an unexpected directory.
dotenv.config({
  path: [
    ...(process.env.DOTENV_CONFIG_PATH ? [process.env.DOTENV_CONFIG_PATH] : []),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
  ],
});

// Explicitly boot the database: open the connection, apply drizzle-kit migrations,
// then build the typed repository interface the routes call. Top-level await is
// supported under NodeNext, and env vars are loaded above *before* the DB opens.
const conn = await initDb();
const { db, close, driver } = conn;
if (process.env.AUTO_MIGRATE !== 'false') {
  await runMigrations(conn);
}
const repositories = createRepositories(db);

console.log(
  `[Db] ${driver === 'postgres' ? 'PostgreSQL' : 'PGlite (in-process PostgreSQL)'} online.`
);

// Boot-time engine status: makes a missing/typo'd env file obvious immediately
// instead of only surfacing as a simulated verdict on the first scan.
console.log(`[Oracle] Gemini engine ${geminiConfigured() ? `online — ${geminiModeLabel()}` : 'offline — simulated audits enabled.'}`);

// Email + async jobs. With REDIS_URL set the job system runs an in-process
// BullMQ worker (durable, retried); without it, handlers run inline so local
// development and tests need no Redis. SMTP is optional too — unconfigured
// mail is logged via nodemailer's jsonTransport instead of sent.
const mailConfig = loadMailConfig();
const mailer = createMailer(mailConfig);

/**
 * Mail-delivery status reported by `/api/health`.
 *
 * The SMTP handshake runs in the background on purpose: awaiting it at boot
 * could stall startup for minutes against an unreachable host, and Cloud Run
 * would fail the revision. So health says `checking` until it settles.
 *
 * Only verified when SMTP is configured: `Mailer.verify()` returns `true` for a
 * disabled mailer, which must not be reported as a working one.
 *
 * The release smoke test waits for `checking` to settle and fails on `error`,
 * which is the only way a wrong SMTP key fails a deploy instead of a login.
 */
type MailStatus = 'disabled' | 'checking' | 'smtp' | 'error';
let mailStatus: MailStatus = mailConfig.enabled ? 'checking' : 'disabled';
if (mailConfig.enabled) {
  void mailer
    .verify()
    .then((ok) => {
      mailStatus = ok ? 'smtp' : 'error';
    })
    .catch(() => {
      mailStatus = 'error';
    });
}

const jobSystem = await createJobSystem({
  redisUrl: process.env.REDIS_URL,
  context: { repositories, mailer, appBaseUrl: mailConfig.appBaseUrl },
});
const jobs = jobSystem.dispatcher;

// Better Auth: email-OTP identity + Carbon Registry sessions.
const authConfig = loadAuthConfig();
const auth = createAuth({ db, jobs, config: authConfig });

/**
 * The signed-in citizen behind a request, or null. The permalink endpoints are
 * public, so the attributed-verdict gates read the session here instead of
 * rejecting every unauthenticated caller.
 */
async function sessionUser(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Core] ${signal} received — shutting down (draining jobs, closing db)...`);
  await jobSystem.close().catch((err) => console.warn('[Core] Job system close failed:', err));
  mailer.close();
  await close();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

const app = new Hono<{ Variables: AuthVariables }>();

app.use(
  '*',
  cors({
    origin: authConfig.trustedOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Carbon Registry identity (Better Auth).
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));
app.route('/api/vault', createVaultRoutes({ repositories, auth }));

// Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'online',
    system: 'ECOCIDE Core',
    database: driver === 'postgres' ? 'PostgreSQL Active' : 'PGlite Active',
    auditProtocol: 'PROTOCOL-9',
    engine: geminiModeLabel(),
    mail: mailStatus,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Primary Household Audit Endpoint
//
// Runs the full two-pass pipeline server-side:
//   PASS 1  inventory  — vision model detects objects + ratings + boxes
//   MATH    compliance — H → SI → Household Sustainability Index → tier
//   PASS 2  verdict    — second prompt writes copy + suggestions (never math)
// The evidence photo is written to disk; the DB stores only the file name.
// ---------------------------------------------------------------------------
app.post('/api/oracle/scan', async (c) => {
  try {
    const body = await c.req.json<ScanRequest>();
    const { image, category } = body;
    if (!image) {
      return c.json({ error: 'Missing audit photograph' }, 400);
    }

    let inventory: InventoryResult | null = null;
    let oracleResult: VerdictResult | null = null;
    let payload: OraclePayload;
    let ratio: number;
    let caste: Caste;

    if (geminiConfigured()) {
      // PASS 1 — object inventory (vision + structured JSON).
      inventory = await generateHouseholdInventory(image, category);
      ratio = householdRatio(inventory.items);
      // Deterministic tier from the arithmetic (lore taxonomy).
      caste = getCasteFromScore(ratio);

      // PASS 2 — classification verdict (text-only copy).
      oracleResult = await generateHouseholdVerdict({
        items: inventory.items,
        roomType: inventory.roomType,
        ratio,
        caste,
      });
      payload = oracleResult.payload;
    } else {
      // Development mock fallback: the image hash seeds a deterministic audit.
      console.warn('[Oracle] Gemini engine offline — using simulated household audit.');
      const simulated = simulateHouseholdScan(image);
      ratio = simulated.ratio;
      caste = simulated.caste;
      payload = simulated.payload;
    }

    // Persist the evidence photo as a file (DB keeps only the file name).
    const dossierId = nanoid(10);
    const [head] = splitBase64DataUrl(image);
    const evidenceName = evidenceFileNameFor(dossierId, head.match(/^data:([^;]+);/)?.[1] || 'image/jpeg');
    saveEvidenceBase64(image, dossierId);

    const id = await repositories.saveDossier(payload, {
      id: dossierId,
      evidenceFileName: evidenceName,
      roomType: payload.audit.roomType,
    });

    // Log both model calls under the new dossier id.
    if (inventory?.usage && oracleResult?.usage) {
      await repositories.logApiCall({
        dossierId: id,
        callType: 'oracle_inventory',
        provider: oracleResult.usage.provider,
        model: oracleResult.usage.model,
        promptTokens: inventory.usage.promptTokens,
        candidatesTokens: inventory.usage.candidatesTokens,
        thoughtsTokens: inventory.usage.thoughtsTokens,
        totalTokens: inventory.usage.totalTokens,
        costUsd: inventory.usage.costUsd,
        durationMs: inventory.usage.durationMs,
        status: 'success',
      });
      await repositories.logApiCall({
        dossierId: id,
        callType: 'oracle_classify',
        provider: oracleResult.usage.provider,
        model: oracleResult.usage.model,
        promptTokens: oracleResult.usage.promptTokens,
        candidatesTokens: oracleResult.usage.candidatesTokens,
        thoughtsTokens: oracleResult.usage.thoughtsTokens,
        totalTokens: oracleResult.usage.totalTokens,
        costUsd: oracleResult.usage.costUsd,
        durationMs: oracleResult.usage.durationMs,
        status: 'success',
      });
    } else {
      await repositories.logApiCall({
        dossierId: id,
        callType: 'oracle_inventory',
        provider: 'mock',
        model: 'simulated-engine',
        promptTokens: 0,
        candidatesTokens: 0,
        thoughtsTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        durationMs: 1,
        status: 'success',
      });
      await repositories.logApiCall({
        dossierId: id,
        callType: 'oracle_classify',
        provider: 'mock',
        model: 'simulated-engine',
        promptTokens: 0,
        candidatesTokens: 0,
        thoughtsTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        durationMs: 1,
        status: 'success',
      });
    }

    // Optional: deliver the verdict to the address supplied with the scan
    const email = normalizeEmail(body.email);
    if (email) {
      await jobs.enqueue('email:verdict', { dossierId: id, to: email }, { jobId: `email:verdict:${id}` });
    }

    return c.json({
      ...payload,
      id,
      evidenceUrl: evidenceUrlFor(evidenceName),
    });
  } catch (error: any) {
    console.error('[Oracle Scan Error]', error);
    return c.json({ error: error.message || 'Internal oracle error' }, 500);
  }
});

// Public Citizen Permalink Endpoint
app.get('/api/citizen/:id', async (c) => {
  const id = c.req.param('id');
  const record = await repositories.getDossier(id);
  if (!record) {
    return c.json({ error: 'Subject dossier not found in the registry archives' }, 404);
  }
  // What the file holds, derived from granted appeals: the verdict page needs it
  // to show which pledges were actually accepted, and nothing else does.
  const acceptedPledges = await repositories.getAcceptedPledges(id);
  return c.json({ ...record, acceptedPledges });
});

/**
 * Submit a verdict as evidence against another household (the informant act).
 *
 * Requires a Carbon Registry session — the informant is paid a bounty, so there
 * must be a wallet to pay it into. The verdict is attributed to the accused
 * address; from then on only that address may claim or appeal.
 */
app.post('/api/citizen/:id/inform', async (c) => {
  const id = c.req.param('id');
  const user = await sessionUser(c);
  if (!user) {
    return c.json({ error: 'Carbon Registry locked — authentication required' }, 401);
  }

  const body = (await c.req.json<{ email?: unknown }>().catch(() => ({}))) as { email?: unknown };
  const targetEmail = typeof body.email === 'string' ? body.email : '';
  if (!targetEmail.trim()) {
    return c.json({ error: 'An accused household address is required', code: 'invalid_email' }, 400);
  }

  const result = await submitInformantTip({
    repositories,
    jobs,
    dossierId: id,
    informantUserId: user.id,
    informantEmail: user.email,
    targetEmail,
  });

  switch (result.outcome) {
    case 'ok':
      return c.json({ rewardUnits: result.rewardUnits, wallet: result.wallet });
    case 'invalid_email':
      return c.json({ error: 'Invalid accused household address', code: 'invalid_email' }, 400);
    case 'self':
      return c.json({ error: 'A household cannot inform on itself', code: 'self' }, 400);
    case 'not_found':
      return c.json({ error: 'Subject dossier not found in the registry archives' }, 404);
    case 'accepted':
      return c.json(
        { error: 'This verdict was accepted — the ruling is final', code: 'accepted' },
        409
      );
    case 'already_attributed':
      return c.json(
        {
          error: 'This verdict has already been submitted as evidence against a household',
          code: 'already_attributed',
        },
        409
      );
  }
});

// Live census of audited households (art §7: real counts, never invented)
app.get('/api/census', async (c) => {
  return c.json(await repositories.getCensusReport());
});

// Archived evidence photos (file on disk, DB stores only the name)
app.get('/api/evidence/:name', (c) => {
  const name = c.req.param('name');
  if (!isValidEvidenceName(name)) {
    return c.json({ error: 'Invalid evidence reference' }, 400);
  }
  const buffer = readEvidenceFile(name);
  if (!buffer) {
    return c.json({ error: 'Evidence not found in the archive' }, 404);
  }
  c.header('Content-Type', mimeForEvidenceName(name));
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.body(buffer);
});

// Citizen Appeal Arbitration Endpoint
/** Filing ceiling: the appeal screen offers at most this many pledges. */
const MAX_APPEAL_PLEDGES = 8;

/**
 * Keep only well-formed pledges from a filing: a phrase the tribunal can read, an
 * action it came from, and an impact figure inside the 0–100 the rest of the app
 * assumes. Anything else is dropped rather than stored half-formed.
 */
function sanitizePledges(input: unknown): PledgeRef[] {
  if (!Array.isArray(input)) return [];
  const out: PledgeRef[] = [];
  for (const raw of input.slice(0, MAX_APPEAL_PLEDGES)) {
    const entry = raw as Partial<PledgeRef> | null;
    const pledge = typeof entry?.pledge === 'string' ? entry.pledge.trim() : '';
    if (!pledge) continue;
    const impact = Number(entry?.impact_pct);
    out.push({
      pledge,
      text: typeof entry?.text === 'string' ? entry.text.trim() : pledge,
      impact_pct: Number.isFinite(impact) ? Math.min(100, Math.max(0, Math.round(impact))) : 0,
    });
  }
  return out;
}

/**
 * Compose the offered pledges into the appeal text the tribunal reads. Mirrors the
 * wording the appeal screen used to append client-side, so existing rulings and
 * rulings from here on look the same to the model.
 */
function withPledgeBlock(appeal: string, pledges: PledgeRef[]): string {
  if (pledges.length === 0) return appeal;
  return `${appeal}\n\nPLEDGES OFFERED: ${pledges.map((p) => p.pledge).join(' // ')}`;
}

app.post('/api/citizen/:id/appeal', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await repositories.getDossier(id);
    if (!record) {
      return c.json({ error: 'Citizen record not found' }, 404);
    }

      // Acceptance is terminal: the ruling is frozen and appeals are closed.
      // Enforced here, not just in the UI — these permalink endpoints are public,
      // so the rule has to hold without a session.
      if (record.acceptedAt) {
        return c.json({ error: 'This verdict was accepted — the ruling is final and appeals are closed' }, 409);
      }

      // A verdict tipped against another household may only be appealed by that
      // household — read the session here since this endpoint is otherwise public.
      const access = dossierAccessError(
        await repositories.getDossierSubjectEmail(id),
        (await sessionUser(c))?.email ?? null
      );
      if (access) {
        return c.json({ error: access.error }, access.status);
      }

    const body = (await c.req.json().catch(() => ({}))) as AppealRequest;
    const appeal = (body.appeal || '').trim();
    if (!appeal) {
      return c.json({ error: 'Appeal text is required' }, 400);
    }

    // Pledges offered with the filing. The tribunal reads them inside the appeal
    // text, so they are composed in here — one place builds both, which is what
    // keeps the record of what was offered in step with the prose it came from.
    const pledges = sanitizePledges(body.pledges);
    const appealText = withPledgeBlock(appeal, pledges);

    let verdict: AppealVerdict;
    if (geminiConfigured()) {
      const result = await generateAppealVerdict(record, appealText);
      verdict = result.verdict;
    } else {
      console.warn('[Appeal] Gemini engine offline, using simulated appeal ruling.');
      verdict = generateSimulatedAppealVerdict(record, appealText);
    }

    // Persist the appeal filing + ruling; the re-classification is applied to
    // the archive only when the citizen re-arbitrates (deferred).
    const appealId = await repositories.saveAppeal({
      dossierId: id,
      appealText,
      pledges,
      accepted: verdict.accepted,
      newCaste: verdict.newCaste,
      newHonorificTitle: verdict.newHonorificTitle,
      headline: verdict.headline,
      reason: verdict.reason,
      scripture: verdict.scripture,
      casteBefore: (record.user_profile || record.profile).caste,
      casteAfter: verdict.accepted ? verdict.newCaste : undefined,
    });

    const stored = (await repositories.getAppealsByDossier(id))[0];

    // Optional: email the ruling to the address supplied with the appeal
    const email = normalizeEmail(body.email);
    if (email) {
      await jobs.enqueue(
        'email:appeal-ruling',
        { dossierId: id, appealId, to: email },
        { jobId: `email:appeal-ruling:${appealId}` }
      );
    }

    return c.json({ ...verdict, id, appeal: stored });
  } catch (error: any) {
    console.error('[Appeal Error]', error);
    return c.json({ error: error.message || 'Internal appeal error' }, 500);
  }
});

// Appeal Records Listing
app.get('/api/citizen/:id/appeals', async (c) => {
  const id = c.req.param('id');
  const record = await repositories.getDossier(id);
  if (!record) {
    return c.json({ error: 'Citizen record not found' }, 404);
  }
  return c.json(await repositories.getAppealsByDossier(id));
});

// Apply an accepted appeal's re-classification to the archive
app.post('/api/citizen/:id/appeals/:appealId/apply', async (c) => {
  const id = c.req.param('id');
  const appealId = c.req.param('appealId');
  const record = await repositories.getDossier(id);
  if (!record) {
    return c.json({ error: 'Citizen record not found' }, 404);
  }

  // Re-arbitration rewrites the classification, so it closes with acceptance.
  if (record.acceptedAt) {
    return c.json({ error: 'This verdict was accepted — the ruling is final and cannot be re-arbitrated' }, 409);
  }

  // Applying a ruling is part of the appeal: an attributed verdict stays locked
  // to the accused household.
  const access = dossierAccessError(
    await repositories.getDossierSubjectEmail(id),
    (await sessionUser(c))?.email ?? null
  );
  if (access) {
    return c.json({ error: access.error }, access.status);
  }

  const appeal = (await repositories.getAppealsByDossier(id)).find((a) => a.id === appealId);
  if (!appeal) {
    return c.json({ error: 'Appeal not found for this citizen' }, 404);
  }
  if (!appeal.accepted || !appeal.newCaste) {
    return c.json({ error: 'Only an accepted appeal with a re-classification can be applied' }, 400);
  }
  // Re-arbitrate against the STORED inventory (no vision re-call).
  let fresh: ReArbitrationVerdict;
  if (geminiConfigured()) {
    fresh = await generateReArbitrationVerdict(record, appeal);
  } else {
    fresh = generateSimulatedReArbitration(record, appeal);
  }

  await repositories.updateDossierAppeal(id, {
    caste: appeal.newCaste,
    honorificTitle: fresh.newHonorificTitle,
    headline: fresh.headline,
    paragraph_1: fresh.scripture[0],
    paragraph_2: fresh.scripture[1],
    paragraph_3: fresh.scripture[2],
  });

  return c.json({ record: await repositories.getDossier(id) });
});

// Recent Citizens Archive
app.get('/api/citizens/recent', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50);
  const records = await repositories.getRecentDossiers(limit);
  return c.json(records);
});

// Bull Board queue dashboard (BullMQ mode only, protected by HTTP Basic auth).
const bullBoardUser = process.env.BULL_BOARD_USER;
const bullBoardPass = process.env.BULL_BOARD_PASS;
if (jobSystem.queue && bullBoardUser && bullBoardPass) {
  const basePath = '/admin/queues';
  const serverAdapter = new HonoAdapter(serveStatic);
  createBullBoard({ queues: [new BullMQAdapter(jobSystem.queue)], serverAdapter });
  serverAdapter.setBasePath(basePath);
  app.use(`${basePath}/*`, basicAuth({ username: bullBoardUser, password: bullBoardPass }));
  app.route(basePath, serverAdapter.registerPlugin());
  console.log(`[BullBoard] Queue dashboard available at ${basePath} (basic auth enabled).`);
} else if (jobSystem.queue) {
  console.warn('[BullBoard] Queue dashboard disabled — set BULL_BOARD_USER and BULL_BOARD_PASS to enable it.');
}

// Production Static Web Assets & SPA Client Routing
const staticDir = process.env.STATIC_DIR || path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(staticDir)) {
  console.log(`[Static Web] Serving production UI assets from: ${staticDir}`);
  app.use('/*', serveStatic({ root: staticDir }));
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) {
      return c.notFound();
    }
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return c.html(fs.readFileSync(indexPath, 'utf-8'));
    }
    return c.text('Not found', 404);
  });
}

const port = Number(process.env.PORT) || 3001;
console.log(`[ECOCIDE Engine] Running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});