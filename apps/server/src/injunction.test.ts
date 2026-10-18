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
  it('files the checklist against the accepted verdict', async () => {
    const dossierId = await repositories.saveDossier(payload());
    await repositories.acceptDossier(dossierId);

    const result = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(result.status).toBe('filed');
    expect(result.source).toBe('simulated');
    expect(result.issued).toBeGreaterThan(0);

    const tasks = await repositories.getInjunctionTasksByUser(USER);
    expect(tasks).toHaveLength(result.issued);
    // Every action is attributed to the verdict it came from.
    expect(tasks.every((task) => task.dossierId === dossierId)).toBe(true);
    expect(tasks.every((task) => task.action.length > 0 && task.replaces.length > 0)).toBe(true);
    expect(tasks.every((task) => task.completed === false && task.points === 0)).toBe(true);
    // Filing is recorded once, on the verdict — that bit is what stops retries.
    const filedAt = await repositories.getInjunctionFiledAt(dossierId);
    expect(filedAt).toBeTruthy();
  });

  it('is idempotent: re-issuing does not duplicate the actions', async () => {
    const dossierId = await repositories.saveDossier(payload());
    await repositories.acceptDossier(dossierId);
    const first = await issueInjunction({ repositories, userId: USER, dossierId });
    const before = await repositories.getInjunctionTasksByUser(USER);

    // A retried acceptance (double-click, replayed request, a stale queued job)
    // is a no-op once the verdict is filed, so nothing doubles and the filing
    // date the stamp prints cannot be rewritten.
    const filedAt = await repositories.getInjunctionFiledAt(dossierId);
    const second = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(second.status).toBe('skipped');
    const after = await repositories.getInjunctionTasksByUser(USER);
    expect(after).toHaveLength(before.length);
    expect(after.map((task) => task.id).sort()).toEqual(before.map((task) => task.id).sort());
    expect(first.issued).toBe(before.length);
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBe(filedAt);
  });

  it('is a no-op for a verdict that has not been accepted', async () => {
    const dossierId = await repositories.saveDossier(payload());

    const result = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(result).toEqual({ status: 'skipped', issued: 0, source: 'none' });
    expect(await repositories.getInjunctionTasksByUser(USER)).toEqual([]);
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeNull();
  });

  it('keeps each citizen separate', async () => {
    const dossierId = await repositories.saveDossier(payload());
    await repositories.acceptDossier(dossierId);
    await issueInjunction({ repositories, userId: USER, dossierId });

    expect(await repositories.getInjunctionTasksByUser(OTHER)).toEqual([]);
    // ...but the public count still reports the filing to any reader.
    expect(await repositories.countInjunctionTasksForDossier(dossierId)).toBe(
      (await repositories.getInjunctionTasksByUser(USER)).length
    );
  });

  it('is a no-op for an unknown verdict', async () => {
    const result = await issueInjunction({ repositories, userId: USER, dossierId: 'does-not-exist' });

    expect(result).toEqual({ status: 'skipped', issued: 0, source: 'none' });
    expect(await repositories.getInjunctionTasksByUser(USER)).toEqual([]);
  });

  it('files an empty checklist as a filing, and never retries it', async () => {
    // The Arbiter can find nothing to correct. That is a *filing* — the dossier
    // says "no corrective orders" — not a failed issuance, so it is flagged and a
    // later read must not spend a model call on it again.
    const empty = payload();
    empty.audit.items = [];
    const dossierId = await repositories.saveDossier(empty);
    await repositories.acceptDossier(dossierId);

    const result = await issueInjunction({ repositories, userId: USER, dossierId });

    expect(result).toEqual({ status: 'empty', issued: 0, source: 'simulated' });
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeTruthy();
    expect(await repositories.getInjunctionTasksByUser(USER)).toEqual([]);
    expect(await repositories.countInjunctionTasksForDossier(dossierId)).toBe(0);

    expect((await issueInjunction({ repositories, userId: USER, dossierId })).status).toBe(
      'skipped'
    );
  });

  it('shares one run between concurrent asks for the same verdict', async () => {
    // Inline mode fires issuance without waiting (acceptance) while the dossier's
    // `ensure=1` read can ask again a moment later. Both must ride one execution,
    // or the model is paid for twice and the rows race each other.
    const dossierId = await repositories.saveDossier(payload());
    await repositories.acceptDossier(dossierId);

    let inserts = 0;
    const counting = {
      ...repositories,
      addInjunctionTasks: async (
        userId: string,
        id: string,
        items: Parameters<Repositories['addInjunctionTasks']>[2]
      ) => {
        inserts += 1;
        return repositories.addInjunctionTasks(userId, id, items);
      },
    };

    const [first, second] = await Promise.all([
      issueInjunction({ repositories: counting, userId: USER, dossierId }),
      issueInjunction({ repositories: counting, userId: USER, dossierId }),
    ]);

    expect(inserts).toBe(1);
    expect(first).toBe(second);
    expect(first.status).toBe('filed');
    expect(await repositories.getInjunctionTasksByUser(USER)).toHaveLength(first.issued);
  });

  it('leaves a failed filing unfiled, so the next attempt retries it', async () => {    const dossierId = await repositories.saveDossier(payload());
    await repositories.acceptDossier(dossierId);

    // The checklist generated, but the rows never committed.
    const failing = {
      ...repositories,
      addInjunctionTasks: async () => {
        throw new Error('insert exploded');
      },
    };
    await expect(
      issueInjunction({ repositories: failing, userId: USER, dossierId })
    ).rejects.toThrow('insert exploded');

    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeNull();
    expect(await repositories.getInjunctionTasksByUser(USER)).toEqual([]);

    // ...and the retry (a queued job, or the next page load) files it, reusing the
    // cached checklist instead of paying for a second model call.
    const retried = await issueInjunction({ repositories, userId: USER, dossierId });
    expect(retried.status).toBe('filed');
    expect(retried.source).toBe('cache');
    expect(await repositories.getInjunctionFiledAt(dossierId)).toBeTruthy();
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
