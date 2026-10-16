import { INFORMANT_REWARD_UNITS, type Wallet } from '@ecocide/types';
import type { Repositories } from './db/repositories.js';
import { normalizeEmail } from './email/index.js';
import type { JobDispatcher } from './jobs/index.js';

/**
 * Submitting a verdict as evidence against another household (the informant act).
 *
 * The verdict is attributed to the accused address and the informant is paid a
 * flat bounty. Two invariants ride on the conditional attribution in the
 * repository:
 *  • a verdict can be attributed once (two concurrent filings cannot overwrite
 *    each other, and a claimed verdict cannot be re-attributed), and
 *  • the bounty is paid once — guarded by its own ledger entry, so a retry or a
 *    double-submit cannot mint credits twice.
 */

export type InformantOutcome =
  | 'ok'
  | 'invalid_email'
  | 'self'
  | 'not_found'
  | 'accepted'
  | 'already_attributed';

export interface InformantResult {
  outcome: InformantOutcome;
  /** The informant's wallet after the bounty was paid (only on `ok`). */
  wallet?: Wallet;
  /** Credit units paid to the informant (0 of `ok` was a replay that paid nothing). */
  rewardUnits: number;
}

export interface SubmitInformantTipOptions {
  repositories: Repositories;
  jobs: JobDispatcher;
  dossierId: string;
  /** The signed-in citizen who filed the tip. */
  informantUserId: string;
  /** The informant's own address (must differ from the accused). */
  informantEmail: string;
  /** The accused household's address, as typed. */
  targetEmail: string;
}

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function submitInformantTip(
  options: SubmitInformantTipOptions
): Promise<InformantResult> {
  const { repositories, jobs, dossierId, informantUserId, informantEmail } = options;

  const normalized = normalizeEmail(options.targetEmail);
  if (!normalized) return { outcome: 'invalid_email', rewardUnits: 0 };
  // Case-folded so the same household is always the same address, whatever case
  // the informant typed.
  const subjectEmail = normalized.toLowerCase();
  if (sameAddress(subjectEmail, informantEmail)) return { outcome: 'self', rewardUnits: 0 };

  const record = await repositories.getDossier(dossierId);
  if (!record) return { outcome: 'not_found', rewardUnits: 0 };
  if (record.acceptedAt) return { outcome: 'accepted', rewardUnits: 0 };

  const attributed = await repositories.attributeDossierToSubject(
    dossierId,
    subjectEmail,
    informantUserId
  );
  if (!attributed) return { outcome: 'already_attributed', rewardUnits: 0 };

  // The bounty is paid once per verdict: the ledger entry is the guard.
  let rewardUnits = 0;
  const alreadyPaid = await repositories.getWalletLedgerByRef(
    informantUserId,
    dossierId,
    'informant_reward'
  );
  if (!alreadyPaid) {
    rewardUnits = INFORMANT_REWARD_UNITS;
    await repositories.applyWalletDelta({
      userId: informantUserId,
      delta: rewardUnits,
      reason: 'informant_reward',
      ref: dossierId,
    });
  }

  const wallet = await repositories.getWalletByUser(informantUserId);

  // Notify the accused household. Best-effort: the tip is already filed, and a
  // failed delivery must not unwind the attribution.
  await jobs
    .enqueue(
      'email:informant-tip',
      { dossierId, to: subjectEmail },
      { jobId: `email:informant-tip:${dossierId}` }
    )
    .catch((err) => console.warn('[Informant] tip email enqueue failed:', err?.message || err));

  return { outcome: 'ok', wallet: wallet ?? undefined, rewardUnits };
}
