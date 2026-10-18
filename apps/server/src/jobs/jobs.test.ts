import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import type { OraclePayload } from '@ecocide/types';
import { createRepositories, initDb, runMigrations } from '../db/index.js';
import type { DbConnection, Repositories } from '../db/index.js';
import { user as userTable } from '../db/schema.js';
import type { EmailMessage, Mailer } from '../email/index.js';
import { createInlineDispatcher } from './dispatcher.js';
import { createHandlers } from './handlers/index.js';
import type { JobContext } from './types.js';

interface FakeMailer extends Mailer {
  sent: EmailMessage[];
}

function fakeMailer(): FakeMailer {
  const sent: EmailMessage[] = [];
  return {
    enabled: true,
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
      return 'fake-message-id';
    },
    async verify() {
      return true;
    },
    close() {},
  };
}

const payload: OraclePayload = {
  user_profile: {
    caste: 'power-grid-liability',
    biocarbon_ratio: 22,
    honorific_title: 'Phantom Load Keeper',
  },
  prophecy: {
    headline: 'HOUSEHOLD AUDIT COMPLETE: POWER GRID LIABILITY',
    paragraph_1: 'P1',
    paragraph_2: 'P2',
    paragraph_3: 'P3',
  },
  audit: {
    roomType: 'living room',
    items: [
      { label: 'standby power strip', category: 'electronics', count: 2, ratings: { e: 5, m: 4 }, si: 12.5, status: 'non-compliant' },
      { label: 'led bulb', category: 'electronics', count: 4, ratings: { e: 3, m: 3 }, si: 43.8, status: 'needs-improvement' },
    ],
    ratio: 22,
    hardFails: 1,
    topOffenderLabel: 'standby power strip',
  },
  suggestions: [
    { text: 'Unplug the standby power strip.', target_label: 'standby power strip', pledge: 'Cut standby load by half', impact_pct: 12 },
  ],
};

let repositories: Repositories;
let conn: DbConnection;

beforeAll(async () => {
  conn = await initDb({ memory: true });
  await runMigrations(conn);
  repositories = createRepositories(conn.db);
});

afterAll(async () => {
  await conn.close();
});

beforeEach(async () => {
  await conn.db.execute(
    sql`TRUNCATE TABLE "user", "session", "account", "verification", "wallets", "wallet_ledger", "dossiers", "appeals", "scan_api_logs" CASCADE`
  );
});

function makeDispatcher(mailer: FakeMailer) {
  const context: JobContext = { repositories, mailer, appBaseUrl: 'https://registry.test' };
  return createInlineDispatcher(createHandlers(context));
}

describe('job dispatch (inline mode)', () => {
  it('sends a verdict email for a stored dossier', async () => {
    const dossierId = await repositories.saveDossier(payload);
    const mailer = fakeMailer();

    await makeDispatcher(mailer).enqueue(
      'email:verdict',
      { dossierId, to: 'citizen@example.com' },
      { jobId: `email:verdict:${dossierId}` }
    );

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('citizen@example.com');
    expect(mailer.sent[0].subject).toContain('Power Grid Liability');
    expect(mailer.sent[0].html).toContain(`https://registry.test/arbitration/${dossierId}`);
  });

  it('sends an appeal-ruling email', async () => {
    const dossierId = await repositories.saveDossier(payload);
    const appealId = await repositories.saveAppeal({
      dossierId,
      appealText: 'please reconsider',
      accepted: true,
      newCaste: 'marginally-acceptable-human',
      newHonorificTitle: 'Re-Assigned Household',
      headline: 'APPEAL GRANTED',
      reason: 'documentation sufficient',
      scripture: ['a', 'b', 'c'],
      casteBefore: 'power-grid-liability',
      casteAfter: 'marginally-acceptable-human',
    });
    const mailer = fakeMailer();

    await makeDispatcher(mailer).enqueue(
      'email:appeal-ruling',
      { dossierId, appealId, to: 'citizen@example.com' },
      { jobId: `email:appeal-ruling:${appealId}` }
    );

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].subject).toContain('APPEAL RULING');
    expect(mailer.sent[0].subject).toContain('GRANTED');
    expect(mailer.sent[0].html).toContain('Power Grid Liability');
  });

  it('does not send when the dossier is missing', async () => {
    const mailer = fakeMailer();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await makeDispatcher(mailer).enqueue('email:verdict', { dossierId: 'missing', to: 'citizen@example.com' });

    warnSpy.mockRestore();
    expect(mailer.sent).toHaveLength(0);
  });

  it('swallows unknown-job and handler errors without throwing', async () => {
    const mailer = fakeMailer();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      makeDispatcher(mailer).enqueue('does:not:exist' as never, {} as never)
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });

  it('issues an accepted verdict’s injunction', async () => {
    const userId = 'user-jobs';
    await conn.db.insert(userTable).values({ id: userId, name: '', email: 'jobs@arbiter.test', emailVerified: true });
    const dossierId = await repositories.saveDossier(payload);
    await repositories.acceptDossier(dossierId);

    await makeDispatcher(fakeMailer()).enqueue('injunction:issue', { dossierId, userId });

    const tasks = await repositories.getInjunctionTasksByUser(userId);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.dossierId === dossierId)).toBe(true);
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeTruthy();
  });

  it('issues nothing for a verdict that was never accepted', async () => {
    const userId = 'user-jobs';
    await conn.db.insert(userTable).values({ id: userId, name: '', email: 'jobs@arbiter.test', emailVerified: true });
    const dossierId = await repositories.saveDossier(payload);

    await makeDispatcher(fakeMailer()).enqueue('injunction:issue', { dossierId, userId });

    expect(await repositories.getInjunctionTasksByUser(userId)).toEqual([]);
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeNull();
  });
});
