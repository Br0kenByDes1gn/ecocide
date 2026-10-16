import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { INFORMANT_REWARD_UNITS, type OraclePayload } from '@ecocide/types';
import { createRepositories, initDb, runMigrations, type DbConnection, type Repositories } from './db/index.js';
import { user as userTable } from './db/schema.js';
import type { JobDispatcher } from './jobs/index.js';
import { submitInformantTip } from './informant.js';

/**
 * The informant act: attribute a verdict to another household and pay the
 * bounty once. Runs against one in-process PGlite cluster per file, truncated
 * between tests; jobs are a recording stub, so nothing is mailed.
 */

let repositories: Repositories;
let conn: DbConnection;

const TIPPER = 'tipper-user';
const TIPPER_EMAIL = 'tipper@example.com';

/** Records what the service asked to be delivered, in order. */
interface SentJob {
  name: string;
  data: Record<string, unknown>;
}
let sent: SentJob[];

const jobs: JobDispatcher = {
  mode: 'inline',
  async enqueue(name, data) {
    sent.push({ name, data: data as Record<string, unknown> });
  },
  async schedule() {},
};

async function truncateAll(): Promise<void> {
  await conn.db.execute(
    sql`TRUNCATE TABLE "user", "session", "account", "verification", "wallets", "wallet_ledger", "dossiers", "appeals", "injunction_tasks", "scan_api_logs" CASCADE`
  );
}

function makePayload(): OraclePayload {
  return {
    user_profile: {
      caste: 'carbon-neutral-legend',
      biocarbon_ratio: 98,
      honorific_title: 'Plastic-Curious',
    },
    prophecy: { headline: 'H', paragraph_1: 'P1', paragraph_2: 'P2', paragraph_3: 'P3' },
    audit: { roomType: 'kitchen', items: [], ratio: 98, hardFails: 0, topOffenderLabel: null },
    suggestions: [],
  };
}

async function seedUser(id: string, email: string): Promise<void> {
  await conn.db.insert(userTable).values({ id, name: '', email, emailVerified: true });
}

function tip(dossierId: string, targetEmail: string) {
  return submitInformantTip({
    repositories,
    jobs,
    dossierId,
    informantUserId: TIPPER,
    informantEmail: TIPPER_EMAIL,
    targetEmail,
  });
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
  sent = [];
  await seedUser(TIPPER, TIPPER_EMAIL);
});

describe('submitInformantTip', () => {
  it('attributes the verdict to the accused and pays the bounty once', async () => {
    const dossierId = await repositories.saveDossier(makePayload());

    const result = await tip(dossierId, 'Accused@Example.com');
    expect(result.outcome).toBe('ok');
    expect(result.rewardUnits).toBe(INFORMANT_REWARD_UNITS);
    expect(result.wallet?.credits).toBe(INFORMANT_REWARD_UNITS);

    // The address is stored case-folded, and the public record reports only that
    // it is attributed — never the address itself.
    expect(await repositories.getDossierSubjectEmail(dossierId)).toBe('accused@example.com');
    const record = await repositories.getDossier(dossierId);
    expect(record?.attributed).toBe(true);
    expect(JSON.stringify(record)).not.toContain('accused@example.com');

    // One ledger entry, and one tip email to the accused.
    const ledger = await repositories.getWalletLedgerByRef(TIPPER, dossierId, 'informant_reward');
    expect(ledger?.delta).toBe(INFORMANT_REWARD_UNITS);
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe('email:informant-tip');
    expect(sent[0].data.to).toBe('accused@example.com');
  });

  it('refuses a second tip against the same verdict (and never double-pays)', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    await tip(dossierId, 'accused@example.com');

    const second = await tip(dossierId, 'other@example.com');
    expect(second.outcome).toBe('already_attributed');
    expect(second.rewardUnits).toBe(0);

    const wallet = await repositories.getWalletByUser(TIPPER);
    expect(wallet?.credits).toBe(INFORMANT_REWARD_UNITS);
    expect(sent).toHaveLength(1);
  });

  it('pays per verdict, so a second household is a second bounty', async () => {
    const first = await repositories.saveDossier(makePayload());
    const second = await repositories.saveDossier(makePayload());

    await tip(first, 'a@example.com');
    const result = await tip(second, 'b@example.com');
    expect(result.outcome).toBe('ok');

    const wallet = await repositories.getWalletByUser(TIPPER);
    expect(wallet?.credits).toBe(INFORMANT_REWARD_UNITS * 2);
  });

  it('refuses self-informing and malformed addresses', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    expect((await tip(dossierId, TIPPER_EMAIL)).outcome).toBe('self');
    expect((await tip(dossierId, 'not-an-address')).outcome).toBe('invalid_email');
    expect(await repositories.getDossierSubjectEmail(dossierId)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('refuses a verdict that was already accepted', async () => {
    const dossierId = await repositories.saveDossier(makePayload());
    await repositories.acceptDossier(dossierId);
    expect((await tip(dossierId, 'accused@example.com')).outcome).toBe('accepted');
  });

  it('reports a missing verdict', async () => {
    expect((await tip('no-such-dossier', 'accused@example.com')).outcome).toBe('not_found');
  });
});
