import { createHash } from 'node:crypto';
import type { InjunctionChecklist } from '@ecocide/types';
import type { Repositories } from './db/repositories.js';
import {
  buildInjunctionPromptInput,
  generateInjunctionChecklist,
  generateSimulatedInjunctionChecklist,
} from './gemini.js';
import { geminiConfigured, getGeminiModel } from './gemini/config.js';

/**
 * Issuing the environmental injunction.
 *
 * The injunction is issued for an **accepted** verdict — the "ACCEPT VERDICT"
 * action (the Carbon Registry claim), which is also the moment appeals close. So
 * the checklist is always derived from the final ruling, including any granted
 * appeal, and it is issued exactly once per accepted verdict.
 *
 * The actions themselves stay exactly as they were when this ran at scan time:
 * a text-only Gemini checklist built from the stored dossier's items, with the
 * deterministic simulation as the offline fallback (no AI credentials).
 *
 * ## Filed, empty, or failed
 *
 * `dossiers.injunction_issued_at` is the filed bit, and it is what makes a
 * retry safe: issuance runs from a queue job (and again from the dossier page's
 * first read whenever the flag is missing), so the difference between the three
 * outcomes has to be durable:
 *
 *   • **filed**  — actions exist and were committed; the stamp links to them.
 *   • **empty**  — the Arbiter parsed a checklist with no actions at all. That
 *                  is a real filing ("no corrective orders"), not a failure, so
 *                  it is flagged and never retried.
 *   • **failed** — the model call or its JSON threw, or it returned entries none
 *                  of which survived sanitizing. Nothing is cached or flagged:
 *                  the caller sees the throw and the next page load tries again.
 *
 * `injunction_hash` / `injunction_json` on the dossier are the cache: the prompt
 * input is hashed and, when unchanged, the stored checklist is reused instead of
 * paying for a second model call on a retried issuance.
 */

export type InjunctionSource = 'cache' | 'gemini' | 'simulated' | 'none';

/** How an issuance attempt ended. `skipped` = nothing to do. */
export type InjunctionIssueStatus = 'filed' | 'empty' | 'skipped';

export interface IssueInjunctionResult {
  status: InjunctionIssueStatus;
  /**
   * How many actions were filed for this verdict — the deterministic count after
   * collapsing repeated actions within one checklist. (A *retried* issue reports
   * the same number; the rows themselves are not duplicated.)
   */
  issued: number;
  source: InjunctionSource;
}

export interface IssueInjunctionOptions {
  repositories: Repositories;
  /** The citizen who accepted the verdict. */
  userId: string;
  /** The accepted verdict. */
  dossierId: string;
}

/**
 * Issues the injunction for one accepted verdict.
 *
 * Throws when the attempt failed (model error, unparseable JSON, unusable
 * checklist) so the queue job retries with backoff and the next page load can
 * try again. Returns `skipped` when there is nothing to do — the verdict is not
 * accepted, or its orders are already on file.
 */
export async function issueInjunction(
  options: IssueInjunctionOptions
): Promise<IssueInjunctionResult> {
  const { repositories, userId, dossierId } = options;

  const record = await repositories.getDossier(dossierId);
  if (!record) return { status: 'skipped', issued: 0, source: 'none' };

  // Issuance belongs to an accepted verdict, and only happens once. Both checks
  // make the call idempotent: a queued job that lands after a manual retry, or a
  // double claim, is a no-op rather than a second filing.
  if (!record.acceptedAt) return { status: 'skipped', issued: 0, source: 'none' };
  if (record.injunctionFiledAt) return { status: 'skipped', issued: 0, source: 'cache' };

  const input = buildInjunctionPromptInput(record);
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

  let checklist: InjunctionChecklist | null = null;
  let source: InjunctionSource = 'cache';

  const cached = await repositories.getCachedInjunction(dossierId);
  if (cached && cached.hash === hash) {
    try {
      checklist = JSON.parse(cached.checklistJson) as InjunctionChecklist;
    } catch {
      checklist = null; // unreadable cache entry → regenerate below
    }
  }

  if (!checklist) {
    if (geminiConfigured()) {
      // A throw here (network, 5xx, unparseable JSON) is a *failure*: nothing is
      // cached or flagged, so the next attempt starts from scratch. It is still
      // logged, because a silent injunction is exactly the bug this guards.
      let generated: Awaited<ReturnType<typeof generateInjunctionChecklist>>;
      try {
        generated = await generateInjunctionChecklist(record);
      } catch (err: any) {
        await repositories.logApiCall({
          dossierId,
          callType: 'oracle_injunction',
          provider: 'google',
          model: getGeminiModel(),
          promptTokens: 0,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          durationMs: 0,
          status: 'error',
          errorMessage: err?.message || String(err),
        });
        throw err;
      }
      if (generated.rawItemCount > 0 && generated.checklist.items.length === 0) {
        // The model answered but nothing usable survived: not an empty filing.
        await repositories.logApiCall({
          dossierId,
          callType: 'oracle_injunction',
          provider: generated.usage.provider,
          model: generated.usage.model,
          promptTokens: generated.usage.promptTokens,
          candidatesTokens: generated.usage.candidatesTokens,
          thoughtsTokens: generated.usage.thoughtsTokens,
          totalTokens: generated.usage.totalTokens,
          costUsd: generated.usage.costUsd,
          durationMs: generated.usage.durationMs,
          status: 'error',
          errorMessage: 'Checklist items were unreadable — none could be filed.',
        });
        throw new Error('Injunction checklist had no usable actions');
      }
      checklist = generated.checklist;
      source = 'gemini';
      await repositories.logApiCall({
        dossierId,
        callType: 'oracle_injunction',
        provider: generated.usage.provider,
        model: generated.usage.model,
        promptTokens: generated.usage.promptTokens,
        candidatesTokens: generated.usage.candidatesTokens,
        thoughtsTokens: generated.usage.thoughtsTokens,
        totalTokens: generated.usage.totalTokens,
        costUsd: generated.usage.costUsd,
        durationMs: generated.usage.durationMs,
        status: 'success',
      });
    } else {
      checklist = generateSimulatedInjunctionChecklist(record);
      source = 'simulated';
    }
    await repositories.saveCachedInjunction(dossierId, hash, JSON.stringify(checklist));
  }

  const items = checklist?.items ?? [];
  // Collapse repeated actions within one checklist (the model — and the offline
  // simulation — can offer the same action twice), so the count we report is the
  // count the citizen sees. The unique (user, dossier, action) key remains as the
  // guard for a *retried* issuance.
  const seen = new Set<string>();
  const actions = items.filter((item) => {
    const key = item.action.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (actions.length > 0) {
    // Filed whole or not at all (transaction inside), then flagged: the flag is
    // written last so "filed" can never describe a half-committed checklist.
    await repositories.addInjunctionTasks(userId, dossierId, actions);
  }
  // A checklist with no actions is a filing too — the Arbiter required nothing.
  await repositories.markInjunctionFiled(dossierId);

  return { status: actions.length > 0 ? 'filed' : 'empty', issued: actions.length, source };
}
