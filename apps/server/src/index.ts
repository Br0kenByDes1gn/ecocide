import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { cors } from 'hono/cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateSimulatedVerdict, type AppealVerdict, type AppealRequest, type OraclePayload, type ScanRequest } from '@ecocide/types';
import {
  generateAppealVerdict,
  generateOracleVerdict,
  generateReArbitrationVerdict,
  generateSimulatedAppealVerdict,
  generateSimulatedReArbitration,
  type OracleVerdictResult,
  type ReArbitrationVerdict,
} from './gemini.js';
import { createRepositories, initDb, runMigrations } from './db/index.js';
import { createMailer, loadMailConfig, normalizeEmail } from './email/index.js';
import { createJobSystem } from './jobs/index.js';
import { avatarRegistry } from './avatar/registry.js';
import { createAuth } from './auth/index.js';
import { loadAuthConfig } from './auth/config.js';
import type { AuthVariables } from './auth/middleware.js';
import { createVaultRoutes } from './vault/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Explicitly boot the database: open the connection, apply drizzle-kit migrations,
// then build the typed repository interface the routes call. Top-level await is
// supported under NodeNext, and env vars are loaded above *before* the DB opens.
//
// AUTO_MIGRATE defaults to running migrations at boot (dev, plain docker run).
// The Helm chart sets AUTO_MIGRATE=false because a dedicated "migrate" init
// container owns DDL — migrations then run exactly once per pod start.
const { db, close } = await initDb();
if (process.env.AUTO_MIGRATE !== 'false') {
  await runMigrations(db);
}
const repositories = createRepositories(db);

// Email + async jobs. With REDIS_URL set the job system runs an in-process
// BullMQ worker (durable, retried); without it, handlers run inline so local
// development and tests need no Redis. SMTP is optional too — unconfigured
// mail is logged via nodemailer's jsonTransport instead of sent.
const mailConfig = loadMailConfig();
const mailer = createMailer(mailConfig);
void mailer.verify();

const jobSystem = await createJobSystem({
  redisUrl: process.env.REDIS_URL,
  context: { repositories, mailer, appBaseUrl: mailConfig.appBaseUrl },
});
const jobs = jobSystem.dispatcher;

// Better Auth: email-OTP identity + Asset Vault sessions. Built after the job
// system so the OTP email can be dispatched through the same queue/mailer.
const authConfig = loadAuthConfig();
const auth = createAuth({ db, jobs, config: authConfig });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Core] ${signal} received — shutting down (draining jobs, closing db)...`);
  await jobSystem.close().catch((err) => console.warn('[Core] Job system close failed:', err));
  mailer.close();
  close();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

const app = new Hono<{ Variables: AuthVariables }>();

// CORS is an allowlist (not `*`) so credentialed requests — the session cookie
// and the bearer fallback — are accepted. Same-origin dev/prod requests are
// unaffected.
app.use(
  '*',
  cors({
    origin: authConfig.trustedOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Asset Vault identity (Better Auth). Must be mounted before the SPA catch-all.
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));
app.route('/api/vault', createVaultRoutes({ repositories, auth }));

// Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'online',
    system: 'ECOCIDE Core',
    database: 'SQLite Active',
    avatarEngines: avatarRegistry.list(),
    timestamp: new Date().toISOString(),
  });
});

// List Available Avatar Engines
app.get('/api/avatar/engines', (c) => {
  return c.json({
    default: process.env.AVATAR_ENGINE || 'gemini-text-svg',
    engines: avatarRegistry.list(),
  });
});

// Primary Biometric Scan Endpoint
app.post('/api/oracle/scan', async (c) => {
  try {
    const body = await c.req.json<ScanRequest>();
    const { image, telemetry, stylizedPortrait, landmarks, portraitStyle, portraitColor, sourceSnapshot } = body;

    if (!telemetry || !image) {
      return c.json({ error: 'Missing image or biometric telemetry payload' }, 400);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let result: OraclePayload;
    let oracleResult: OracleVerdictResult | null = null;

    if (apiKey) {
      // Invoke Gemini 3.8 Flash Multimodal Vision + Sarcastic Fortune
      oracleResult = await generateOracleVerdict(image, telemetry, apiKey);
      result = oracleResult.payload;
    } else {
      // Development mock fallback
      console.warn('[Oracle] GEMINI_API_KEY not configured, using dynamic simulated oracle engine.');
      result = generateSimulatedVerdict(telemetry);
    }

    // Determine chosen avatar synthesis engine
    const queryEngine = c.req.query('engine');
    const chosenEngine = body.avatarEngine || queryEngine || process.env.AVATAR_ENGINE || 'gemini-text-svg';

    // Persist to SQLite with initial 'synthesizing' status
    const id = await repositories.saveDossier(result, stylizedPortrait, 'synthesizing', chosenEngine, {
      landmarks,
      telemetry,
      portraitStyle: portraitStyle || 'neon-hologram',
      portraitColor: portraitColor || undefined,
      sourceSnapshot: sourceSnapshot || image,
    });

    // Log the oracle verdict API call
    if (oracleResult?.usage) {
      await repositories.logApiCall({
        dossierId: id,
        callType: 'oracle_verdict',
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
        callType: 'oracle_verdict',
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

    // Queue durable background avatar synthesis (retried by BullMQ)
    await jobs.enqueue('avatar:synthesize', { dossierId: id, engine: chosenEngine });

    // Optional: deliver the verdict to the address supplied with the scan
    const email = normalizeEmail(body.email);
    if (email) {
      await jobs.enqueue('email:verdict', { dossierId: id, to: email }, { jobId: `email:verdict:${id}` });
    }

    return c.json({
      ...result,
      id,
      avatarStatus: 'synthesizing',
      avatarEngine: chosenEngine,
      landmarks,
      telemetry,
      portraitStyle: portraitStyle || 'neon-hologram',
      portraitColor: portraitColor || undefined,
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
  return c.json(record);
});

// Trigger Avatar Re-Synthesis with Specific Engine
app.post('/api/citizen/:id/avatar', async (c) => {
  const id = c.req.param('id');
  const record = await repositories.getDossier(id);
  if (!record) {
    return c.json({ error: 'Citizen record not found' }, 404);
  }

  const body = await c.req.json<{ engine?: string; image?: string }>().catch(() => ({ engine: undefined, image: undefined }));
  const engine = body.engine || c.req.query('engine') || process.env.AVATAR_ENGINE || 'gemini-text-svg';

  const photo = body.image || record.stylizedPortraitUrl;
  if (!photo) {
    return c.json({ error: 'No reference image available for avatar synthesis' }, 400);
  }

  await repositories.updateDossierAvatar(id, null, 'synthesizing', engine);
  await jobs.enqueue('avatar:synthesize', { dossierId: id, engine, image: body.image || undefined });

  return c.json({
    status: 'synthesizing',
    id,
    engine,
  });
});

// Citizen Appeal Arbitration Endpoint
app.post('/api/citizen/:id/appeal', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await repositories.getDossier(id);
    if (!record) {
      return c.json({ error: 'Citizen record not found' }, 404);
    }

    const body = (await c.req.json().catch(() => ({}))) as AppealRequest;
    const appeal = (body.appeal || '').trim();
    if (!appeal) {
      return c.json({ error: 'Appeal text is required' }, 400);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let verdict: AppealVerdict;
    if (apiKey) {
      const result = await generateAppealVerdict(record, appeal, apiKey);
      verdict = result.verdict;
    } else {
      console.warn('[Appeal] GEMINI_API_KEY not configured, using simulated appeal ruling.');
      verdict = generateSimulatedAppealVerdict(record, appeal);
    }

    // Persist the appeal filing + ruling; the re-classification is applied to
    // the archive only when the citizen re-arbitrates (deferred).
    const appealId = await repositories.saveAppeal({
      dossierId: id,
      appealText: appeal,
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

  const appeal = (await repositories.getAppealsByDossier(id)).find((a) => a.id === appealId);
  if (!appeal) {
    return c.json({ error: 'Appeal not found for this citizen' }, 404);
  }
  if (!appeal.accepted || !appeal.newCaste) {
    return c.json({ error: 'Only an accepted appeal with a re-classification can be applied' }, 400);
  }

  // Re-arbitrate like a brand-new scan: the ORIGINAL oracle vision prompt is
  // re-run against the archived photo snapshot, with the appeal acknowledged
  // only in paragraph 1. Text-only simulation when no vision key is present.
  const apiKey = process.env.GEMINI_API_KEY;
  let fresh: ReArbitrationVerdict;
  if (apiKey && record.sourceSnapshot) {
    fresh = await generateReArbitrationVerdict(record, appeal, apiKey);
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
// bull-board ships no authentication, so it inherits the middleware below.
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
