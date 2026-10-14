import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Hono } from 'hono';
import { VAULT_ALLOWANCE, VAULT_CLAIM_FEE, type OraclePayload } from '@ecocide/types';
import { createRepositories, initDb, runMigrations, type Repositories } from '../db/index.js';
import { user } from '../db/schema.js';
import type { Auth } from '../auth/index.js';
import type { AuthVariables } from '../auth/middleware.js';
import { createVaultRoutes } from './routes.js';

/**
 * Vault routes are exercised through Hono's `app.request` against a throwaway
 * migrated SQLite file. Auth is stubbed (Better Auth itself is covered by the
 * email-OTP integration path) so the tests focus on wallet/link semantics.
 */

let repositories: Repositories;
let db: any;
let closeDb: () => void;
let tempDir: string;

const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecocide-vault-test-'));
  const conn = await initDb({ path: path.join(tempDir, 'dossiers.db') });
  await runMigrations(conn.db);
  db = conn.db;
  repositories = createRepositories(conn.db);
  closeDb = conn.close;

  for (const [id, email] of [
    [USER_A, 'a@arbiter.test'],
    [USER_B, 'b@arbiter.test'],
  ] as const) {
    db.insert(user).values({ id, name: '', email, emailVerified: true }).run();
  }
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
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
    expect(linked.wallet.credits).toBe(VAULT_ALLOWANCE - VAULT_CLAIM_FEE);
    expect(linked.dossier.ownerId).toBe(USER_A);

    // Idempotent: re-linking does not double-charge.
    const second = await app.request('/api/vault/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId }),
    });
    const relinked = await second.json();
    expect(relinked.linked).toBe(false);
    expect(relinked.wallet.credits).toBe(VAULT_ALLOWANCE - VAULT_CLAIM_FEE);

    const ledger = await repositories.getWalletLedger(USER_A);
    expect(ledger.filter((e) => e.reason === 'claim_fee')).toHaveLength(1);
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
      body: JSON.stringify({ amount: 500, reason: 'appeal_fee', ref: 'dossier-1' }),
    });
    expect(res.status).toBe(200);
    const charge = await res.json();
    expect(charge.wallet.credits).toBe(VAULT_ALLOWANCE - 500);
    expect(charge.entry.reason).toBe('appeal_fee');
    expect(charge.entry.ref).toBe('dossier-1');
    expect(charge.entry.balanceAfter).toBe(VAULT_ALLOWANCE - 500);

    const ledger = await repositories.getWalletLedger(USER_A);
    expect(ledger.map((e) => e.reason)).toEqual(['appeal_fee', 'seed']);
  });

  it('rejects invalid charge payloads', async () => {
    const app = makeApp(USER_A);
    const post = (body: unknown) =>
      app.request('/api/vault/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    expect((await post({ amount: 0, reason: 'appeal_fee' })).status).toBe(400);
    expect((await post({ amount: -5, reason: 'appeal_fee' })).status).toBe(400);
    expect((await post({ amount: 1.5, reason: 'appeal_fee' })).status).toBe(400);
    expect((await post({ amount: 500, reason: '' })).status).toBe(400);
    expect((await post({ amount: 500, reason: 'Bad Reason!' })).status).toBe(400);
  });

  it('rejects unauthenticated charges', async () => {
    const res = await makeApp(null).request('/api/vault/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, reason: 'appeal_fee' }),
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
      body: JSON.stringify({ amount: 500, reason: 'appeal_fee', ref: dossierId }),
    });

    const state = await (await app.request('/api/vault')).json();
    expect(state.stats).toEqual({
      totalCredited: VAULT_ALLOWANCE,
      totalSpent: VAULT_CLAIM_FEE + 500,
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

  it('rejects unauthenticated ledger access', async () => {
    expect((await makeApp(null).request('/api/vault/ledger')).status).toBe(401);
  });
});
