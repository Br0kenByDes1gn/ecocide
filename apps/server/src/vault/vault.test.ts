import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  INJUNCTION_REWARD_MAX_UNITS,
  INJUNCTION_REWARD_MIN_UNITS,
  VAULT_ALLOWANCE,
  appealFeeUnits,
  claimFeeUnits,
  type OraclePayload,
} from '@ecocide/types';
import { createRepositories, initDb, runMigrations, type DbConnection, type Repositories } from '../db/index.js';
import { user } from '../db/schema.js';
import type { Auth } from '../auth/index.js';
import type { AuthVariables } from '../auth/middleware.js';
import { createVaultRoutes } from './routes.js';

/**
 * Vault routes are exercised through Hono's `app.request` against one in-process
 * PostgreSQL (PGlite, in memory) per file, truncated between tests. Auth is
 * stubbed (Better Auth itself is covered by the email-OTP integration path) so
 * the tests focus on wallet/link semantics.
 */

let repositories: Repositories;
let db: any;
let conn: DbConnection;

const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';

/** Empty every table in schema.ts between tests. */
/** The fee the Bureau prices for a stored dossier (tier rate × audit load). */
async function pricedFee(dossierId: string, kind: 'claim' | 'appeal'): Promise<number> {
  const record = await repositories.getDossier(dossierId);
  const caste = (record!.user_profile || record!.profile).caste;
  return kind === 'claim'
    ? claimFeeUnits(caste, record!.audit.items)
    : appealFeeUnits(caste, record!.audit.items);
}

async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE "user", "session", "account", "verification", "wallets", "wallet_ledger", "dossiers", "appeals", "scan_api_logs" CASCADE`
  );
}

beforeAll(async () => {
  conn = await initDb({ memory: true });
  await runMigrations(conn);
  db = conn.db;
  repositories = createRepositories(conn.db);
});

afterAll(async () => {
  await conn.close();
});

beforeEach(async () => {
  await truncateAll();

  for (const [id, email] of [
    [USER_A, 'a@arbiter.test'],
    [USER_B, 'b@arbiter.test'],
  ] as const) {
    await db.insert(user).values({ id, name: '', email, emailVerified: true });
  }
});

/** Stub auth: returns a fixed identity (or none) regardless of headers. */
function stubAuth(userId: string | null): Auth {
  return {
    api: {
      getSession: async () =>
        userId
          ? {
              user: { id: userId, email: `${userId}@arbiter.test`, name: '' },
              session: {
                id: 'sess',
                userId,
                token: 'tok',
                expiresAt: new Date(Date.now() + 3_600_000),
              },
            }
          : null,
    },
  } as unknown as Auth;
}

function makeApp(userId: string | null) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.route('/api/vault', createVaultRoutes({ repositories, auth: stubAuth(userId) }));
  return app;
}

function makePayload(): OraclePayload {
  return {
    user_profile: {
      caste: 'disaster-zone',
      biocarbon_ratio: 15,
      honorific_title: 'Microplastic Dispenser',
    },
    prophecy: { headline: 'H', paragraph_1: 'P1', paragraph_2: 'P2', paragraph_3: 'P3' },
    audit: {
      roomType: 'kitchen',
      items: [
        { label: 'plastic bag', category: 'packaging', count: 9, ratings: { m: 5, p: 5 }, materialFamily: 'plastic', si: 6.3, status: 'non-compliant' },
      ],
      ratio: 15,
      hardFails: 1,
      topOffenderLabel: 'plastic bag',
    },
    suggestions: [],
  };
}

/** A pristine small object (SI 100, roll-up weight 0.5) for standing tests. */
function makeCleanPayload(): OraclePayload {
  return {
    user_profile: {
      caste: 'carbon-neutral-legend',
      biocarbon_ratio: 100,
      honorific_title: 'Recycling Ascetic',
    },
    prophecy: { headline: 'H', paragraph_1: 'P1', paragraph_2: 'P2', paragraph_3: 'P3' },
    audit: {
      roomType: 'desk',
      items: [
        {
          label: 'glass jar',
          category: 'packaging',
          count: 1,
          ratings: { m: 1, r: 1, d: 1, c: 1, l: 1, t: 1, p: 1 },
          materialFamily: 'glass',
          size: 'small',
          si: 100,
          status: 'compliant',
        },
      ],
      ratio: 100,
      hardFails: 0,
      topOffenderLabel: null,
    },
    suggestions: [],
  };
}

/** `saveDossier` stamps ISO-ms timestamps; a tick keeps two saves ordered. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * Issuance hangs off the claim without being awaited (a model call must not block
 * the certification screen), so the test waits for the actions to land.
 */
async function waitForTasks(userId: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const tasks = await repositories.getInjunctionTasksByUser(userId);
    if (tasks.length > 0 || Date.now() > deadline) return tasks;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('vault routes', () => {
  it('rejects unauthenticated access', async () => {
    const app = makeApp(null);
    expect((await app.request('/api/vault')).status).toBe(401);
    expect(
      (
        await app.request('/api/vault/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dossierId: 'nope' }),
        })
      ).status
    ).toBe(401);
  });

  it('provisions a wallet with the token allowance on first access', async () => {
    const res = await makeApp(USER_A).request('/api/vault');
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.wallet.credits).toBe(VAULT_ALLOWANCE);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0].reason).toBe('seed');
    expect(state.stats).toEqual({
      totalCredited: VAULT_ALLOWANCE,
      totalSpent: 0,
      transactionCount: 1,
    });
    expect(state.dossiers).toEqual([]);
    // An empty registry is neutral 50 and has nothing to compare against.
    expect(state.standing).toMatchObject({
      index: 50,
      assessmentCount: 0,
      objectCount: 0,
      hardFailCount: 0,
      topOffenderLabel: null,
      dominantMaterialFamily: null,
      baselineIndex: null,
      delta: null,
      firstAuditAt: null,
      lastAuditAt: null,
    });
  });

  it('links a dossier and charges the certification fee exactly once', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    const app = makeApp(USER_A);

    const first = await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    expect(first.status).toBe(200);
    const linked = await first.json();
    expect(linked.linked).toBe(true);
    expect(linked.wallet.credits).toBe(VAULT_ALLOWANCE - (await pricedFee(dossierId, 'claim')));
    expect(linked.dossier.ownerId).toBe(USER_A);
    // Accepting the verdict is part of the claim.
    expect(linked.dossier.acceptedAt).toBeTruthy();

    // Idempotent: re-linking does not double-charge.
    const second = await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    const relinked = await second.json();
    expect(relinked.linked).toBe(false);
    expect(relinked.wallet.credits).toBe(VAULT_ALLOWANCE - (await pricedFee(dossierId, 'claim')));

    const ledger = await repositories.getWalletLedger(USER_A);
    expect(ledger.filter((e) => e.reason === 'claim_fee')).toHaveLength(1);
  });

  it('issues the injunction from the accepted verdict, exactly once', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    const app = makeApp(USER_A);
    const link = () =>
      app.request('/api/vault/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId }),
      });

    const first = await (await link()).json();
    const acceptedAt = first.dossier.acceptedAt;
    expect(acceptedAt).toBeTruthy();

    const tasks = await waitForTasks(USER_A);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.dossierId === dossierId)).toBe(true);
    expect(tasks.every((task) => task.completed === false)).toBe(true);

    // Re-linking neither re-accepts the verdict nor duplicates the actions.
    const relinked = await (await link()).json();
    expect(relinked.linked).toBe(false);
    expect(relinked.dossier.acceptedAt).toBe(acceptedAt);
    expect(await repositories.getInjunctionTasksByUser(USER_A)).toHaveLength(tasks.length);
  });

  it('refuses to bind a dossier already owned by another vault', async () => {
    const dossierId = await repositories.saveDossier(makePayload());

    const ownerLink = await makeApp(USER_A).request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    expect(ownerLink.status).toBe(200);

    const clash = await makeApp(USER_B).request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    expect(clash.status).toBe(409);
  });

  it('validates the dossierId payload', async () => {
    const res = await makeApp(USER_A).request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('charges a generic fee from the vault and records it in the ledger', async () => {
    const res = await makeApp(USER_A).request('/api/vault/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, reason: 'adjustment', ref: 'dossier-1' }),
    });
    expect(res.status).toBe(200);
    const charge = await res.json();
    expect(charge.wallet.credits).toBe(VAULT_ALLOWANCE - 500);
    expect(charge.entry.reason).toBe('adjustment');
    expect(charge.entry.ref).toBe('dossier-1');
    expect(charge.entry.balanceAfter).toBe(VAULT_ALLOWANCE - 500);

    const ledger = await repositories.getWalletLedger(USER_A);
    expect(ledger.map((e) => e.reason)).toEqual(['adjustment', 'seed']);
  });

  it('prices the appeal fee from the dossier and ignores what the client sends', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    const priced = await pricedFee(dossierId, 'appeal');
    const charge = await (await makeApp(USER_A).request('/api/vault/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1, reason: 'appeal_fee', ref: dossierId }),
    })).json();

    // The client asked to pay one unit; the Bureau charged its own price.
    expect(charge.entry.delta).toBe(-priced);
    expect(charge.wallet.credits).toBe(VAULT_ALLOWANCE - priced);
  });

  it('rejects invalid charge payloads', async () => {
    const app = makeApp(USER_A);
    const post = (body: unknown) =>
      app.request('/api/vault/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    expect((await post({ amount: 0, reason: 'adjustment' })).status).toBe(400);
    expect((await post({ amount: -5, reason: 'adjustment' })).status).toBe(400);
    expect((await post({ amount: 1.5, reason: 'adjustment' })).status).toBe(400);
    expect((await post({ amount: 500, reason: '' })).status).toBe(400);
    expect((await post({ amount: 500, reason: 'Bad Reason!' })).status).toBe(400);
      // A priced reason is derived from its dossier, never from the client.
      expect((await post({ reason: 'appeal_fee' })).status).toBe(400);
      expect((await post({ reason: 'appeal_fee', ref: 'no-such-dossier' })).status).toBe(404);
  });

  it('rejects unauthenticated charges', async () => {
    const res = await makeApp(null).request('/api/vault/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, reason: 'adjustment' }),
    });
    expect(res.status).toBe(401);
  });

  it('reports aggregate stats and lightweight dossier summaries', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    const app = makeApp(USER_A);

    await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    await app.request('/api/vault/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'appeal_fee', ref: dossierId }),
    });

    const state = await (await app.request('/api/vault')).json();
    expect(state.stats).toEqual({
      totalCredited: VAULT_ALLOWANCE,
      totalSpent: (await pricedFee(dossierId, 'claim')) + (await pricedFee(dossierId, 'appeal')),
      transactionCount: 3,
    });
    expect(state.dossiers).toHaveLength(1);
    // Summaries carry the archive fields but no heavy verdict/items payload.
    expect(state.dossiers[0]).toMatchObject({
      id: dossierId,
      caste: 'disaster-zone',
      roomType: 'kitchen',
      objectCount: 9,
      hardFailCount: 0,
    });
    expect(state.dossiers[0]).not.toHaveProperty('prophecy');
    expect(state.dossiers[0]).not.toHaveProperty('sourceSnapshot');
    expect(state.dossiers[0]).not.toHaveProperty('items');
  });

  it('pools the standing across linked assessments, weighted by item weight', async () => {
    const app = makeApp(USER_A);

    // Older assessment: 9 heavy plastic bags, SI 0 → weight 9.
    const fouled = await repositories.saveDossier(makePayload());
    await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId: fouled }),
    });

    await tick();

    // Newer assessment: one small pristine jar, SI 100 → weight 0.5.
    const clean = await repositories.saveDossier(makeCleanPayload());
    await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId: clean }),
    });

    const state = await (await app.request('/api/vault')).json();
    expect(state.dossiers.map((d: { id: string }) => d.id)).toEqual([clean, fouled]); // newest first

    // Pooled: 100 × 0.5 / 9.5 = 5.26 → 5 (NOT the equal-weight mean of 0 and 100).
    expect(state.standing).toMatchObject({
      index: 5,
      assessmentCount: 2,
      objectCount: 10,
      hardFailCount: 0,
      topOffenderLabel: 'plastic bag',
      dominantMaterialFamily: 'plastic',
      baselineIndex: 0, // the older assessment alone
      delta: 5, // what the newest audit did to the record
    });
    expect(state.standing.firstAuditAt).toBeTruthy();
    expect(state.standing.lastAuditAt).toBeTruthy();
    expect(state.standing.firstAuditAt <= state.standing.lastAuditAt).toBe(true);
  });

  it('paginates the ledger and clamps limit/offset', async () => {
    const app = makeApp(USER_A);
    for (const amount of [10, 20, 30]) {
      await app.request('/api/vault/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: 'adjustment' }),
      });
    }

    // 3 charges + 1 seed = 4 entries.
    const first = await (await app.request('/api/vault/ledger?limit=2&offset=0')).json();
    expect(first.total).toBe(4);
    expect(first.limit).toBe(2);
    expect(first.offset).toBe(0);
    expect(first.entries).toHaveLength(2);

    const second = await (await app.request('/api/vault/ledger?limit=2&offset=2')).json();
    expect(second.entries).toHaveLength(2);

    // No overlap between pages.
    const ids = new Set([...first.entries, ...second.entries].map((e: { id: string }) => e.id));
    expect(ids.size).toBe(4);

    // Clamp: limit above the max, negative offset.
    const clamped = await (await app.request('/api/vault/ledger?limit=9999&offset=-4')).json();
    expect(clamped.limit).toBe(100);
    expect(clamped.offset).toBe(0);
  });

  it('scopes the orders to one verdict on request', async () => {
    const app = makeApp(USER_A);
    const first = await repositories.saveDossier(makePayload());
    const second = await repositories.saveDossier(makePayload());
    await repositories.addInjunctionTasks(USER_A, first, [
      { action: 'Retire the pods.', replaces: 'coffee pod', why: 'W', category: 'reduce', impact: 'high', effort: 'easy' },
      { action: 'Reuse the jar.', replaces: 'glass jar', why: 'W', category: 'reuse', impact: 'low', effort: 'easy' },
    ]);
    await repositories.addInjunctionTasks(USER_A, second, [
      { action: 'Swap the bulb.', replaces: 'bulb', why: 'W', category: 'swap', impact: 'medium', effort: 'easy' },
    ]);

    // Bare request = the whole worksheet, which is what /injunction shows.
    const all = await (await app.request('/api/vault/injunction-tasks')).json();
    expect(all.tasks).toHaveLength(3);

    // ?dossierId= is the small answer the dossier page polls while it waits for
    // issuance: only this verdict's rows.
    const scoped = await (
      await app.request(`/api/vault/injunction-tasks?dossierId=${first}`)
    ).json();
    expect(scoped.tasks).toHaveLength(2);
    expect(scoped.tasks.every((task) => task.dossierId === first)).toBe(true);

    // A verdict with no orders of its own answers with nothing, not the rest.
    const empty = await (
      await app.request('/api/vault/injunction-tasks?dossierId=no-such-verdict')
    ).json();
    expect(empty.tasks).toEqual([]);

    // Another citizen's scope never reaches these orders.
    const foreign = await (
      await makeApp(USER_B).request(`/api/vault/injunction-tasks?dossierId=${first}`)
    ).json();
    expect(foreign.tasks).toEqual([]);
  });

  it('rejects unauthenticated ledger access', async () => {
    expect((await makeApp(null).request('/api/vault/ledger')).status).toBe(401);
  });

  it('confirms injunction tasks with impact x effort points, idempotently', async () => {
    const app = makeApp(USER_A);
    // Actions are issued against an accepted verdict, so seed real dossiers:
    // the FK makes the provenance real rather than a free-form string.
    const dossierA = await repositories.saveDossier(makePayload());
    const dossierB = await repositories.saveDossier(makePayload());
    await repositories.addInjunctionTasks(USER_A, dossierA, [
      { action: 'A', replaces: 'x', why: 'W', category: 'reduce', impact: 'medium', effort: 'easy' },
      { action: 'B', replaces: 'y', why: 'W', category: 'swap', impact: 'high', effort: 'hard' },
    ]);
    await repositories.addInjunctionTasks(USER_B, dossierB, [
      { action: 'C', replaces: 'z', why: 'W', category: 'reuse', impact: 'low', effort: 'easy' },
    ]);
    const own = await repositories.getInjunctionTasksByUser(USER_A);
    const foreign = (await repositories.getInjunctionTasksByUser(USER_B))[0];

    const res = await app.request('/api/vault/injunction-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: [...own.map((t) => t.id), foreign.id, 'nope'] }),
    });
    const body = await res.json();
    // medium(4) x easy(2) = 8; high(8) x hard(8) = 64; foreign + unknown ignored.
    expect(body.confirmed).toHaveLength(2);
    expect(body.bonusTotal).toBe(72);
    expect(body.effectiveIndex).toBeLessThanOrEqual(100);

    // Each confirmed order also pays credits, from the action's own ratings.
    const paidUnits = body.confirmed.reduce(
      (sum: number, task: { rewardUnits: number }) => sum + task.rewardUnits,
      0
    );
    expect(body.rewardUnits).toBe(paidUnits);
    expect(paidUnits).toBeGreaterThan(0);
    for (const task of body.confirmed as Array<{ rewardUnits: number }>) {
      expect(task.rewardUnits).toBeGreaterThanOrEqual(INJUNCTION_REWARD_MIN_UNITS);
      expect(task.rewardUnits).toBeLessThanOrEqual(INJUNCTION_REWARD_MAX_UNITS);
    }
    // The heavier chore pays more than the lighter one (looked up by rating, not
    // by list order — tasks come back newest first).
    const byId = new Map(
      (body.confirmed as Array<{ id: string; rewardUnits: number }>).map((t) => [t.id, t.rewardUnits])
    );
    const heavy = own.find((t) => t.impact === 'high')!;
    const light = own.find((t) => t.impact === 'medium')!;
    expect(byId.get(heavy.id)!).toBeGreaterThan(byId.get(light.id)!);

    // The wallet was credited (provisioned with the allowance if it was new).
    expect(body.wallet.credits).toBe(VAULT_ALLOWANCE + paidUnits);
    const rewardEntries = (await repositories.getWalletLedger(USER_A)).filter(
      (e) => e.reason === 'injunction_reward'
    );
    expect(rewardEntries).toHaveLength(1);
    expect(rewardEntries[0].delta).toBe(paidUnits);
    expect(rewardEntries[0].balanceAfter).toBe(VAULT_ALLOWANCE + paidUnits);
    // And the payout is recorded on the task, not only in the ledger.
    const stored = await repositories.getInjunctionTasksByUser(USER_A);
    expect(stored.reduce((sum, t) => sum + t.rewardUnits, 0)).toBe(paidUnits);

    // Idempotent: confirming again yields nothing new.
    const again = await (
      await app.request('/api/vault/injunction-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: own.map((t) => t.id) }),
      })
    ).json();
    expect(again.confirmed).toHaveLength(0);
    expect(again.bonusTotal).toBe(72);
    // No second payout, and no second ledger entry.
    expect(again.rewardUnits).toBe(0);
    expect(again.wallet.credits).toBe(VAULT_ALLOWANCE + paidUnits);
    expect(
      (await repositories.getWalletLedger(USER_A)).filter((e) => e.reason === 'injunction_reward')
    ).toHaveLength(1);

    // Empty selection is a 400.
    expect(
      (
        await app.request('/api/vault/injunction-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds: [] }),
        })
      ).status
    ).toBe(400);
  });
});
