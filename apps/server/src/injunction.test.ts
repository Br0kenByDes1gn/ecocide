import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import type { OraclePayload } from '@ecocide/types';
import { createRepositories, initDb, runMigrations } from './db/index.js';
import type { DbConnection, Repositories } from './db/index.js';
import { user as userTable } from './db/schema.js';
import { issueInjunction } from './injunction.js';

/**
 * Issuance runs against one in-process PostgreSQL (PGlite, in memory) per file,
 * truncated between tests. No AI credentials are configured in tests, so the
 * deterministic simulation is exercised — including its cache.
 */

let repositories: Repositories;
let conn: DbConnection;

const USER = 'user-injunction';
const OTHER = 'user-other';

async function truncateAll(): Promise<void> {
  await conn.db.execute(
    sql`TRUNCATE TABLE "user", "session", "account", "verification", "wallets", "wallet_ledger", "dossiers", "appeals", "injunction_tasks", "scan_api_logs" CASCADE`
  );
}

function payload(): OraclePayload {
  return {
    user_profile: {
      caste: 'statistically-average-polluter',
      biocarbon_ratio: 55,
      honorific_title: 'Average Consumer',
    },
    prophecy: { headline: 'H', paragraph_1: 'P1', paragraph_2: 'P2', paragraph_3: 'P3' },
    audit: {
      roomType: 'kitchen',
      items: [
        {
          label: 'coffee pod',
          category: 'packaging',
          count: 3,
          ratings: { m: 5, r: 1, d: 5, c: 3 },
          materialFamily: 'plastic',
          si: 21.3,
          status: 'non-compliant',
          overrides: ['single-use-plastic'],
        },
        {
          label: 'glass jar',
          category: 'packaging',
          count: 4,
          ratings: { m: 1, r: 1, d: 1, c: 1 },
          materialFamily: 'glass',
          si: 100,
          status: 'compliant',
        },
      ],
      ratio: 55,
      hardFails: 1,
      topOffenderLabel: 'coffee pod',
    },
    suggestions: [],
  };
}

beforeAll(async () => {
  conn = await initDb({ memory: true });
  await runMigrations(conn);
  repositories = createRepositories(conn.db);
});

afterAll(async () => {
  await conn.close();
});

beforeEach(async () => {
  await truncateAll();
  for (const [id, email] of [
    [USER, 'injunction@arbiter.test'],
    [OTHER, 'other@arbiter.test'],
  ] as const) {
    await conn.db.insert(userTable).values({ id, name: '', email, emailVerified: true });
  }
});

describe('injunction issuance', () => {
  it('issues the checklist against the accepted verdict', async () => {
    const dossierId = await repositories.saveDossier(payload());

    const result = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(result.source).toBe('simulated');
    expect(result.issued).toBeGreaterThan(0);

    const tasks = await repositories.getInjunctionTasksByUser(USER);
    expect(tasks).toHaveLength(result.issued);
    // Every action is attributed to the verdict it came from.
    expect(tasks.every((task) => task.dossierId === dossierId)).toBe(true);
    expect(tasks.every((task) => task.action.length > 0 && task.replaces.length > 0)).toBe(true);
    expect(tasks.every((task) => task.completed === false && task.points === 0)).toBe(true);
  });

  it('is idempotent: re-issuing does not duplicate the actions', async () => {
    const dossierId = await repositories.saveDossier(payload());
    const first = await issueInjunction({ repositories, userId: USER, dossierId });
    const before = await repositories.getInjunctionTasksByUser(USER);

    // A retried acceptance (double-click, replayed request) reuses the cached
    // checklist and the unique (user, dossier, action) key, so nothing doubles.
    const second = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(second.source).toBe('cache');
    const after = await repositories.getInjunctionTasksByUser(USER);
    expect(after).toHaveLength(before.length);
    expect(after.map((task) => task.id).sort()).toEqual(before.map((task) => task.id).sort());
    expect(first.issued).toBe(second.issued);
  });

  it('keeps each citizen separate', async () => {
    const dossierId = await repositories.saveDossier(payload());
    await issueInjunction({ repositories, userId: USER, dossierId });

    expect(await repositories.getInjunctionTasksByUser(OTHER)).toEqual([]);
  });

  it('is a no-op for an unknown verdict', async () => {
    const result = await issueInjunction({ repositories, userId: USER, dossierId: 'does-not-exist' });

    expect(result).toEqual({ issued: 0, source: 'skipped' });
    expect(await repositories.getInjunctionTasksByUser(USER)).toEqual([]);
  });
});

describe('acceptance is terminal', () => {
  it('stamps the acceptance once and refuses to re-accept', async () => {
    const dossierId = await repositories.saveDossier(payload());
    expect((await repositories.getDossier(dossierId))?.acceptedAt).toBeUndefined();

    const acceptedAt = await repositories.acceptDossier(dossierId);
    expect(acceptedAt).toBeTruthy();

    const record = await repositories.getDossier(dossierId);
    expect(record?.acceptedAt).toBe(acceptedAt);

    // The second attempt (double-click, replay) changes nothing — this is what
    // closes appeals and keeps issuance to a single pass.
    expect(await repositories.acceptDossier(dossierId)).toBeNull();
    expect((await repositories.getDossier(dossierId))?.acceptedAt).toBe(acceptedAt);
  });
});
