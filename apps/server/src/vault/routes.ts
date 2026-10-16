import { Hono } from 'hono';
import { registryStanding } from '@ecocide/compliance';
import {
  VAULT_ALLOWANCE,
  appealFeeUnits,
  claimFeeUnits,
  injunctionRewardUnits,
  injunctionTaskPoints,
  getCasteFromScore,
  type VaultChargeResult,
  type VaultDossierSummary,
  type VaultLedgerPage,
  type VaultLinkResult,
  type VaultState,
} from '@ecocide/types';
import type { Auth } from '../auth/index.js';
import { requireSession, type AuthVariables } from '../auth/middleware.js';
import type { Repositories } from '../db/index.js';
import { issueInjunction, injunctionRunsInBackground } from '../injunction.js';

export interface VaultRouteDeps {
  repositories: Repositories;
  auth: Auth;
}

/** Default page size for the vault's recent-ledger slice. */
const LEDGER_PAGE_SIZE = 25;

/** Clamp a query-string integer into [min, max], falling back when absent/invalid. */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Carbon Registry endpoints, mounted at `/api/vault`. Every route requires a valid
 * session (cookie on web, bearer token on native).
 *
 *  - `GET  /`        → the signed-in citizen's vault: wallet, stats, the pooled
 *                      carbon standing, the archived assessment summaries and
 *                      the most recent ledger page.
 *  - `GET  /ledger`  → a paginated slice of the wallet ledger (`limit`/`offset`).
 *  - `POST /link`    → attach a freshly-scanned anonymous dossier to the vault and
 *                      charge the certification fee (idempotent per dossier).
 *  - `POST /charge`  → draw a fixed fee from the wallet ledger.
 */
export function createVaultRoutes(deps: VaultRouteDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requireSession(deps.auth));

  app.get('/', async (c) => {
    const user = c.get('user');

    const wallet =
      (await deps.repositories.getWalletByUser(user.id)) ??
      (await deps.repositories.createWalletForUser(user.id, VAULT_ALLOWANCE));

    const [stats, rows, page] = await Promise.all([
      deps.repositories.getWalletStats(user.id),
      deps.repositories.getVaultAssessmentRows(user.id),
      deps.repositories.getWalletLedgerPage(user.id, { limit: LEDGER_PAGE_SIZE, offset: 0 }),
    ]);

    // The pooled standing comes from the archived items; the client only ever
    // sees the derived summary, never the raw item lists.
    const standing = registryStanding(
      rows.map((row) => ({ createdAt: row.createdAt, items: row.items }))
    );
    const dossiers: VaultDossierSummary[] = rows.map((row) => ({
      id: row.id,
      caste: row.caste,
      honorificTitle: row.honorificTitle,
      biocarbonRatio: row.biocarbonRatio,
      roomType: row.roomType,
      objectCount: row.objectCount,
      hardFailCount: row.hardFailCount,
      createdAt: row.createdAt,
      evidenceUrl: row.evidenceUrl,
    }));

    const state: VaultState = {
      user: { id: user.id, email: user.email, name: user.name },
      wallet,
      stats,
      standing,
      dossiers,
      ledger: page.entries,
    };
    return c.json(state);
  });

  app.get('/ledger', async (c) => {
    const user = c.get('user');
    const limit = clampInt(c.req.query('limit'), LEDGER_PAGE_SIZE, 1, 100);
    const offset = clampInt(c.req.query('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

    const page = await deps.repositories.getWalletLedgerPage(user.id, { limit, offset });
    const result: VaultLedgerPage = { entries: page.entries, total: page.total, limit, offset };
    return c.json(result);
  });

  app.get('/injunction-tasks', async (c) => {
    const user = c.get('user');
    // `?dossierId=` answers for one verdict: the dossier page polls this while it
    // waits for issuance, and the whole worksheet would be a wasteful answer to a
    // yes/no question (it also grows with every verdict the citizen ever collects).
    const dossierId = c.req.query('dossierId')?.trim();
    const tasks = dossierId
      ? await deps.repositories.getInjunctionTasksByDossier(user.id, dossierId)
      : await deps.repositories.getInjunctionTasksByUser(user.id);
    return c.json({ tasks });
  });

  app.post('/injunction-confirm', async (c) => {
    const user = c.get('user');
    const body = (await c.req.json<{ taskIds?: string[] }>().catch(() => ({}))) as {
      taskIds?: string[];
    };
    const taskIds = Array.isArray(body.taskIds)
      ? body.taskIds.filter((id): id is string => typeof id === 'string').slice(0, 100)
      : [];
    if (taskIds.length === 0) {
      return c.json({ error: 'No tasks selected' }, 400);
    }

    const owned = await deps.repositories.getInjunctionTasksByUser(user.id);
    const pendingById = new Map(owned.filter((t) => !t.completed).map((t) => [t.id, t]));
    // Both figures come from the same two ratings: the standing that lifts the
    // index, and the credits the action is worth (a property of the chore, so a
    // second household doing the same thing is paid identically).
    const confirmed = taskIds
      .filter((id) => pendingById.has(id))
      .map((id) => {
        const task = pendingById.get(id)!;
        return {
          id,
          points: injunctionTaskPoints(task.impact, task.effort),
          rewardUnits: injunctionRewardUnits(task.impact, task.effort, task.action),
        };
      });

    const banked = await deps.repositories.confirmInjunctionTasks(user.id, confirmed);
    const rewardUnits = banked.reduce((sum, task) => sum + task.rewardUnits, 0);

    // Paying for completed paperwork is the one movement that *credits* a wallet.
    let wallet = await deps.repositories.getWalletByUser(user.id);
    if (rewardUnits > 0) {
      wallet =
        wallet ?? (await deps.repositories.createWalletForUser(user.id, VAULT_ALLOWANCE));
      wallet = (
        await deps.repositories.applyWalletDelta({
          userId: user.id,
          delta: rewardUnits,
          reason: 'injunction_reward',
        })
      ).wallet;
    }

    const bonusTotal = await deps.repositories.getInjunctionBonusTotal(user.id);

    const rows = await deps.repositories.getVaultAssessmentRows(user.id);
    const standing = registryStanding(
      rows.map((row) => ({ createdAt: row.createdAt, items: row.items }))
    );
    const effectiveIndex = Math.min(100, standing.index + bonusTotal);
    return c.json({
      confirmed: banked,
      rewardUnits,
      wallet,
      bonusTotal,
      effectiveIndex,
      effectiveCaste: getCasteFromScore(effectiveIndex),
    });
  });

  app.post('/link', async (c) => {
    const user = c.get('user');
    const body = (await c.req.json<{ dossierId?: string }>().catch(() => ({}))) as {
      dossierId?: string;
    };
    const dossierId = body.dossierId?.trim();
    if (!dossierId) {
      return c.json({ error: 'dossierId is required' }, 400);
    }

    const dossier = await deps.repositories.getDossier(dossierId);
    if (!dossier) {
      return c.json({ error: 'Subject dossier not found in the registry archives' }, 404);
    }
    if (dossier.ownerId && dossier.ownerId !== user.id) {
      return c.json({ error: 'Dossier is already bound to another Carbon Registry' }, 409);
    }

    // Provision the vault (with its token allowance) on first use.
    let wallet =
      (await deps.repositories.getWalletByUser(user.id)) ??
      (await deps.repositories.createWalletForUser(user.id, VAULT_ALLOWANCE));

    let linked = false;
    if (dossier.ownerId !== user.id) {
      // Charge the certification fee exactly once per dossier.
      const alreadyCharged = await deps.repositories.getWalletLedgerByRef(user.id, dossierId, 'claim_fee');
      if (!alreadyCharged) {
        // Priced from the dossier, never from the client: the tier's rate scaled
        // by what the audit actually found.
        const feeUnits = claimFeeUnits(
          (dossier.user_profile || dossier.profile).caste,
          dossier.audit?.items
        );
        wallet = (
          await deps.repositories.applyWalletDelta({
            userId: user.id,
            delta: -feeUnits,
            reason: 'claim_fee',
            ref: dossierId,
          })
        ).wallet;
      }
      await deps.repositories.linkDossierToUser(dossierId, user.id);
      linked = true;
      wallet = (await deps.repositories.getWalletByUser(user.id)) ?? wallet;

      // Accepting the verdict is terminal: it freezes the ruling (appeals close)
      // and issues the injunction from it. `acceptDossier` only stamps the first
      // acceptance, so a repeated claim neither re-accepts nor re-issues.
      const acceptedAt = await deps.repositories.acceptDossier(dossierId);
      if (acceptedAt) {
        const issuance = issueInjunction({
          repositories: deps.repositories,
          userId: user.id,
          dossierId,
        }).catch((err) => console.warn('[Injunction] issuance failed:', err?.message || err));

        // A model call must not hold up the certification screen, so it runs
        // after the response (Cloud Run has CPU always allocated). Offline the
        // checklist is local arithmetic, so it is awaited and the actions are
        // already there when the citizen opens the worksheet.
        if (injunctionRunsInBackground()) void issuance;
        else await issuance;
      }
    }

    const updated = await deps.repositories.getDossier(dossierId);
    const result: VaultLinkResult = { wallet, dossier: updated!, linked };
    return c.json(result);
  });

  // Fee drawn from the vault and recorded in the ledger.
  //
  // A *priced* reason ('claim_fee', 'appeal_fee') is never trusted from the
  // client: the price belongs to the Bureau, so the dossier is looked up and the
  // amount derived from its tier and its audit. Any other reason takes an explicit
  // amount — this endpoint only ever debits, so that is a spend, not a mint, and it
  // stays bounded by the allowance.
  app.post('/charge', async (c) => {
    const user = c.get('user');
    const body = (await c.req
      .json<{ amount?: unknown; reason?: unknown; ref?: unknown }>()
      .catch(() => ({}))) as { amount?: unknown; reason?: unknown; ref?: unknown };

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!/^[a-z][a-z0-9_]{2,31}$/.test(reason)) {
      return c.json({ error: 'a valid ledger reason is required' }, 400);
    }
    const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim() : undefined;

    let amount: number;
    if (reason === 'claim_fee' || reason === 'appeal_fee') {
      if (!ref) {
        return c.json({ error: `a dossier reference is required to price a ${reason}` }, 400);
      }
      const priced = await deps.repositories.getDossier(ref);
      if (!priced) {
        return c.json({ error: 'Subject dossier not found in the registry archives' }, 404);
      }
      const caste = (priced.user_profile || priced.profile).caste;
      amount =
        reason === 'claim_fee'
          ? claimFeeUnits(caste, priced.audit?.items)
          : appealFeeUnits(caste, priced.audit?.items);
    } else {
      amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > VAULT_ALLOWANCE) {
        return c.json(
          { error: 'amount must be a positive integer in credit units, within the allowance' },
          400
        );
      }
    }

    // Ensure the allowance exists before the first-ever charge against a vault.
    const existing = await deps.repositories.getWalletByUser(user.id);
    if (!existing) {
      await deps.repositories.createWalletForUser(user.id, VAULT_ALLOWANCE);
    }

    const { wallet, entry } = await deps.repositories.applyWalletDelta({
      userId: user.id,
      delta: -amount,
      reason,
      ref,
    });

    const result: VaultChargeResult = { wallet, entry };
    return c.json(result);
  });

  return app;
}
