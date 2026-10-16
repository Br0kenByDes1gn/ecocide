/**
 * Re-base every wallet onto the current allowance.
 *
 * The ledger was re-denominated: it used to hold arbitrary "credits" minted at
 * 1,000,000 a citizen, and it now counts credit units (1 unit = 1/100 of a carbon
 * credit = 10 kg CO₂e) with an allowance of one year's average footprint. Balances
 * from before that change are meaningless in the new unit, so this sets them to the
 * allowance and writes a reconciling `adjustment` entry — the ledger keeps summing
 * to the balance instead of quietly disagreeing with it.
 *
 * The pre-change ledger is not kept: its entries were written in a denomination
 * that no longer exists (250 of them meant 250 whole credits), so reading them
 * back through the new unit would report "2.50 credits, balance 9,987.50" for a
 * coffee-sized fee. Each wallet is instead re-opened with a single opening
 * allowance entry, which is what a fresh account gets anyway.
 *
 * Idempotent: running it twice leaves the same state. Run it once against a
 * database that predates the change:
 *
 *   pnpm --filter @ecocide/server db:reset-allowance
 */
import { VAULT_ALLOWANCE } from '@ecocide/types';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { initDb, runMigrations } from '../src/db/index.js';
import { walletLedger, wallets } from '../src/db/schema.js';

async function main(): Promise<void> {
  const conn = await initDb();
  await runMigrations(conn);
  const { db } = conn;

  const rows = await db.select().from(wallets);
  console.log(`[allowance] ${rows.length} wallet(s) on file; allowance is ${VAULT_ALLOWANCE} units`);

  let rebased = 0;
  for (const row of rows) {
    const before = Number(row.credits);

    await db.delete(walletLedger).where(eq(walletLedger.user_id, row.user_id));
    await db
      .update(wallets)
      .set({ credits: VAULT_ALLOWANCE, updated_at: new Date().toISOString() })
      .where(eq(wallets.user_id, row.user_id));
    await db.insert(walletLedger).values({
      id: nanoid(12),
      user_id: row.user_id,
      delta: VAULT_ALLOWANCE,
      reason: 'seed',
      ref: null,
      balance_after: VAULT_ALLOWANCE,
      created_at: new Date().toISOString(),
    });

    rebased += 1;
    console.log(`[allowance] ${row.user_id}: ${before} → ${VAULT_ALLOWANCE} (ledger re-opened)`);
  }

  console.log(`[allowance] rebased ${rebased} wallet(s)`);
  await conn.close();
}

main().catch((err) => {
  console.error('[allowance] failed:', err);
  process.exit(1);
});
