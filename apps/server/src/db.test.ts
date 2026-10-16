import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createRepositories, initDb, runMigrations } from './db/index.js';
import type { DbConnection, Repositories } from './db/index.js';
import { user as userTable } from './db/schema.js';
import type { OraclePayload } from '@ecocide/types';

/**
 * Each test file boots ONE throwaway in-process PostgreSQL (PGlite, in memory)
 * that is migrated fresh from the drizzle-kit baseline; every test then starts
 * from empty tables. `apps/server/data/pgdata` is never touched, so the suite
 * stays hermetic — no Docker, no network — while exercising the real migration
 * path. (A cluster per *test* would cost ~2s each, so the cluster is per file.)
 */

let repositories: Repositories;
let conn: DbConnection;

/** Empty every table in schema.ts between tests. */
async function truncateAll(db: DbConnection['db']): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE "user", "session", "account", "verification", "wallets", "wallet_ledger", "dossiers", "appeals", "injunction_tasks", "scan_api_logs" CASCADE`
  );
}

function makePayload(overrides: Partial<OraclePayload> = {}): OraclePayload {
  return {
    user_profile: {
      caste: 'carbon-neutral-legend',
      biocarbon_ratio: 98,
      honorific_title: 'Plastic-Curious',
    },
    prophecy: {
      headline: 'HOUSEHOLD AUDIT COMPLETE: CARBON NEUTRAL LEGEND',
      paragraph_1: 'The Bureau has examined your possessions.',
      paragraph_2: 'P2',
      paragraph_3: 'P3',
    },
    audit: {
      roomType: 'kitchen',
      items: [
        {
          label: 'coffee pod',
          category: 'packaging',
          count: 3,
          ratings: { m: 5, r: 1, d: 5, c: 3, l: 5, t: 2, p: 3 },
          materialFamily: 'plastic',
          size: 'small',
          overrides: ['single-use-plastic'],
          justification: 'One espresso’s lifespan; one landfill’s retirement plan.',
          bounds: { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 },
          si: 21.3,
          status: 'non-compliant',
        },
        {
          label: 'compost bin',
          category: 'waste',
          count: 1,
          ratings: { m: 1, r: 4, d: 1, c: 1, l: 1, t: 1, p: 1 },
          materialFamily: 'organic',
          size: 'medium',
          justification: 'The Bureau’s favorite appliance.',
          si: 100,
          status: 'compliant',
        },
      ],
      ratio: 98,
      hardFails: 1,
      topOffenderLabel: 'coffee pod',
    },
    suggestions: [
      { text: 'Retire the coffee pod.', target_label: 'coffee pod', pledge: 'Retire 3 pods per week', impact_pct: 8 },
    ],
    ...overrides,
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
  await truncateAll(conn.db);
});

describe('postgres database dossier repository', () => {
  it('appends and lists injunction tasks newest first', async () => {
    const id = await repositories.saveDossier(makePayload());
    await conn.db.insert(userTable).values({
      id: 'user-1',
      name: '',
      email: 'user-1@test',
      emailVerified: true,
    });
    expect(await repositories.getInjunctionTasksByUser('user-1')).toEqual([]);

    await repositories.addInjunctionTasks('user-1', id, [
      { action: 'Reuse the jar.', replaces: 'glass jar', why: 'Less waste.', category: 'reuse', impact: 'low', effort: 'easy' },
    ]);
    await repositories.addInjunctionTasks('user-1', id, [
      { action: 'Retire the pods.', replaces: 'coffee pod', why: 'Less plastic.', category: 'reduce', impact: 'high', effort: 'easy' },
    ]);

    const tasks = await repositories.getInjunctionTasksByUser('user-1');
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.replaces).sort()).toEqual(['coffee pod', 'glass jar']);
    expect(tasks[0].dossierId).toBe(id);
    expect(tasks[0].createdAt).toBeTruthy();
    expect(await repositories.getInjunctionTasksByUser('user-2')).toEqual([]);
  });

  it('caches and retrieves the injunction checklist per dossier', async () => {
    const id = await repositories.saveDossier(makePayload());
    expect(await repositories.getCachedInjunction(id)).toBeNull();

    const checklist = { headline: 'Six actions.', items: [], closing_line: 'Pledge on.' };
    await repositories.saveCachedInjunction(id, 'hash-1', JSON.stringify(checklist));
    expect(await repositories.getCachedInjunction(id)).toEqual({
      hash: 'hash-1',
      checklistJson: JSON.stringify(checklist),
    });

    await repositories.saveCachedInjunction(id, 'hash-2', JSON.stringify(checklist));
    expect((await repositories.getCachedInjunction(id))?.hash).toBe('hash-2');
  });


  it('saves and retrieves a household dossier by id', async () => {
    const payload = makePayload();

    const id = await repositories.saveDossier(payload, {
      evidenceFileName: 'abc123.jpg',
      roomType: 'kitchen',
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const retrieved = await repositories.getDossier(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.profile.caste).toBe('carbon-neutral-legend');
    expect(retrieved?.profile.biocarbon_ratio).toBe(98);
    expect(retrieved?.profile.honorific_title).toBe('Plastic-Curious');
    expect(retrieved?.prophecy.headline).toBe('HOUSEHOLD AUDIT COMPLETE: CARBON NEUTRAL LEGEND');
    expect(retrieved?.audit.roomType).toBe('kitchen');
    expect(retrieved?.audit.items).toHaveLength(2);
    expect(retrieved?.audit.items[0].label).toBe('coffee pod');
    expect(retrieved?.audit.items[0].si).toBe(21.3);
    expect(retrieved?.audit.hardFails).toBe(1);
    expect(retrieved?.audit.topOffenderLabel).toBe('coffee pod');
    expect(retrieved?.suggestions).toHaveLength(1);
    expect(retrieved?.suggestions[0].pledge).toContain('Retire 3 pods per week');
  });

  it('exposes the evidence URL derived from the stored file name', async () => {
    const id = await repositories.saveDossier(makePayload(), { evidenceFileName: 'abc123.jpg' });
    const retrieved = await repositories.getDossier(id);
    expect(retrieved?.evidenceUrl).toBe('/api/evidence/abc123.jpg');
  });

  it('tolerates legacy rows with empty item JSON (defaults to an empty audit)', async () => {
    const id = await repositories.saveDossier(
      makePayload({
        user_profile: { caste: 'carbon-neutral-legend', biocarbon_ratio: 50, honorific_title: 'Plastic-Curious' },
        audit: { roomType: null, items: [], ratio: 50, hardFails: 0, topOffenderLabel: null },
      })
    );
    const retrieved = await repositories.getDossier(id);
    expect(retrieved?.audit.items).toEqual([]);
    expect(retrieved?.audit.ratio).toBe(50);
    expect(retrieved?.evidenceUrl).toBeUndefined();
  });

  it('retrieves recent dossiers in descending order', async () => {
    const seededId = await repositories.saveDossier(makePayload());
    const recents = await repositories.getRecentDossiers(5);
    expect(Array.isArray(recents)).toBe(true);
    expect(recents.length).toBeGreaterThan(0);
    expect(recents[0].id).toBe(seededId);
  });

  it('logs both oracle calls and aggregates costs per scan', async () => {
    const dossierId = await repositories.saveDossier(makePayload());

    const call1Id = await repositories.logApiCall({
      dossierId,
      callType: 'oracle_inventory',
      provider: 'google',
      model: 'gemini-3.8-flash',
      promptTokens: 1350,
      candidatesTokens: 410,
      thoughtsTokens: 0,
      totalTokens: 1760,
      costUsd: 0.00054,
      durationMs: 3200,
      status: 'success',
    });
    expect(call1Id).toBeDefined();

    const call2Id = await repositories.logApiCall({
      dossierId,
      callType: 'oracle_classify',
      provider: 'google',
      model: 'gemini-3.8-flash',
      promptTokens: 900,
      candidatesTokens: 320,
      thoughtsTokens: 0,
      totalTokens: 1220,
      costUsd: 0.00039,
      durationMs: 1800,
      status: 'success',
    });
    expect(call2Id).toBeDefined();

    const logs = await repositories.getScanApiLogs(dossierId);
    expect(logs.length).toBe(2);
    expect(logs[0].callType).toBe('oracle_inventory');
    expect(logs[1].callType).toBe('oracle_classify');

    const summaries = await repositories.getRecentScansWithCosts(5);
    const target = summaries.find((s) => s.dossierId === dossierId);
    expect(target).toBeDefined();
    expect(target?.caste).toBe('carbon-neutral-legend');
    expect(target?.totalTokens).toBe(1760 + 1220);
    expect(target?.totalCostUsd).toBeCloseTo(0.00054 + 0.00039, 5);
    expect(target?.apiCalls.length).toBe(2);
  });

  it('updateDossierAppeal rewrites classification columns while preserving the rest', async () => {
    const id = await repositories.saveDossier(makePayload());

    await repositories.updateDossierAppeal(id, {
      caste: 'marginally-acceptable-human',
      honorificTitle: 'Re-Assigned Household',
      headline: 'APPEAL GRANTED: RECLASSIFIED',
      paragraph_1: 'A1',
      paragraph_2: 'A2',
      paragraph_3: 'A3',
    });

    const updated = await repositories.getDossier(id);
    expect(updated?.profile.caste).toBe('marginally-acceptable-human');
    expect(updated?.profile.honorific_title).toBe('Re-Assigned Household');
    expect(updated?.prophecy.headline).toBe('APPEAL GRANTED: RECLASSIFIED');
    expect(updated?.prophecy.paragraph_1).toBe('A1');

    // Non-appeal columns survive intact
    expect(updated?.profile.biocarbon_ratio).toBe(98);
    expect(updated?.audit.items).toHaveLength(2);
    expect(updated?.suggestions).toHaveLength(1);
  });

  it('attributes a dossier to a subject exactly once', async () => {
    const id = await repositories.saveDossier(makePayload());
    await conn.db.insert(userTable).values({
      id: 'tipster',
      name: '',
      email: 'tipster@test',
      emailVerified: true,
    });

    expect(await repositories.getDossierSubjectEmail(id)).toBeNull();
    expect((await repositories.getDossier(id))?.attributed).toBe(false);

    expect(await repositories.attributeDossierToSubject(id, 'accused@example.com', 'tipster')).toBe(
      true
    );
    expect(await repositories.getDossierSubjectEmail(id)).toBe('accused@example.com');
    expect((await repositories.getDossier(id))?.attributed).toBe(true);

    // Conditional: a second attribution is refused and the first address stands.
    expect(await repositories.attributeDossierToSubject(id, 'other@example.com', 'tipster')).toBe(
      false
    );
    expect(await repositories.getDossierSubjectEmail(id)).toBe('accused@example.com');
  });

  it('refuses to attribute an accepted verdict', async () => {
    const id = await repositories.saveDossier(makePayload());
    await repositories.acceptDossier(id);
    expect(await repositories.attributeDossierToSubject(id, 'accused@example.com', 'tipster')).toBe(
      false
    );
    expect(await repositories.getDossierSubjectEmail(id)).toBeNull();
  });

  it('stores and lists appeal filings newest first', async () => {
    const dossierId = await repositories.saveDossier(makePayload());

    await repositories.saveAppeal({
      dossierId,
      appealText: 'first appeal',
      accepted: false,
      reason: 'r1',
      casteBefore: 'carbon-neutral-legend',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await repositories.saveAppeal({
      dossierId,
      appealText: 'second appeal',
      accepted: true,
      newCaste: 'marginally-acceptable-human',
      newHonorificTitle: 'Re-Assigned Household',
      headline: 'GRANTED',
      reason: 'r2',
      scripture: ['a', 'b', 'c'],
      casteBefore: 'carbon-neutral-legend',
      casteAfter: 'marginally-acceptable-human',
    });

    const appeals = await repositories.getAppealsByDossier(dossierId);
    expect(appeals.length).toBe(2);
    expect(appeals[0].appealText).toBe('second appeal');
    expect(appeals[0].accepted).toBe(true);
    expect(appeals[0].newCaste).toBe('marginally-acceptable-human');
    expect(appeals[0].scripture).toEqual(['a', 'b', 'c']);
    expect(appeals[1].appealText).toBe('first appeal');
    expect(appeals[1].accepted).toBe(false);
  });

  it('keeps only the pledges a granted appeal had accepted', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    const pledge = (phrase: string, impact_pct = 5) => ({
      text: `Replace ${phrase}`,
      pledge: phrase,
      impact_pct,
    });

    // A rejected filing offered a pledge it never had granted.
    await repositories.saveAppeal({
      dossierId,
      appealText: 'rejected filing',
      pledges: [pledge('copper pot set')],
      accepted: false,
      reason: 'not convincing',
      casteBefore: 'carbon-neutral-legend',
    });
    // A granted one offered two, one of them worded differently the second time.
    await repositories.saveAppeal({
      dossierId,
      appealText: 'granted filing',
      pledges: [pledge('soap bar', 7), pledge('  Soap Bar  ')],
      accepted: true,
      newCaste: 'marginally-acceptable-human',
      reason: 'granted',
      casteBefore: 'carbon-neutral-legend',
      casteAfter: 'marginally-acceptable-human',
    });

    const accepted = await repositories.getAcceptedPledges(dossierId);
    expect(accepted.map((p) => p.pledge)).toEqual(['soap bar']);
    expect(accepted[0].impact_pct).toBe(7);
    expect(accepted[0].grantedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('round-trips the pledges offered with a filing', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    await repositories.saveAppeal({
      dossierId,
      appealText: 'filing',
      pledges: [{ text: 'Halve the plastic bottle count', pledge: 'Halve bottles', impact_pct: 9 }],
      accepted: true,
      reason: 'granted',
      casteBefore: 'carbon-neutral-legend',
    });

    const [stored] = await repositories.getAppealsByDossier(dossierId);
    expect(stored.pledges).toEqual([
      { text: 'Halve the plastic bottle count', pledge: 'Halve bottles', impact_pct: 9 },
    ]);
    // A filing that offered nothing reads as an empty list, never undefined.
    await repositories.saveAppeal({
      dossierId,
      appealText: 'no pledges',
      accepted: false,
      reason: 'filed without pledges',
      casteBefore: 'carbon-neutral-legend',
    });
    const listed = await repositories.getAppealsByDossier(dossierId);
    // Newest first: the plain filing, then the one that offered a pledge.
    expect(listed[0].pledges).toEqual([]);
    expect(listed[1].pledges).toHaveLength(1);
  });

  it('reports the live census with a 50-audit sufficiency gate', async () => {
    const empty = await repositories.getCensusReport();
    expect(empty.total).toBe(0);
    expect(empty.sufficient).toBe(false);

    const id = await repositories.saveDossier(makePayload());
    const single = await repositories.getCensusReport();
    expect(single.total).toBe(1);
    expect(single.sufficient).toBe(false);
    expect(single.entries.find((e) => e.caste === 'carbon-neutral-legend')?.count).toBe(1);

    for (let i = 0; i < 50; i++) {
      await repositories.saveDossier(
        makePayload({
          user_profile: {
            caste: i % 2 === 0 ? 'statistically-average-polluter' : 'power-grid-liability',
            biocarbon_ratio: i % 2 === 0 ? 60 : 25,
            honorific_title: `Case #${i}`,
          },
        })
      );
    }
    void id;
    const full = await repositories.getCensusReport();
    expect(full.sufficient).toBe(true);
    expect(full.total).toBe(51);
    expect(full.entries.find((e) => e.caste === 'statistically-average-polluter')?.count).toBe(25);
    expect(full.entries.find((e) => e.caste === 'power-grid-liability')?.count).toBe(25);
  });
});