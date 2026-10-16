import { createHash } from 'node:crypto';
import type { InjunctionChecklist } from '@ecocide/types';
import type { Repositories } from './db/repositories.js';
import {
  buildInjunctionPromptInput,
  generateInjunctionChecklist,
  generateSimulatedInjunctionChecklist,
} from './gemini.js';
import { geminiConfigured } from './gemini/config.js';

/**
 * Issuing the environmental injunction.
 *
 * The injunction is issued **when a verdict is accepted** — the "ACCEPT VERDICT"
 * action (the Carbon Registry claim), which is also the moment appeals close. So
 * the checklist is always derived from the final ruling, including any granted
 * appeal, and it is issued exactly once per accepted verdict.
 *
 * The actions themselves stay exactly as they were when this ran at scan time:
 * a text-only Gemini checklist built from the stored dossier's items, with the
 * deterministic simulation as the offline fallback (no AI credentials).
 *
 * `injunction_hash` / `injunction_json` on the dossier are the cache: the prompt
 * input is hashed and, when unchanged, the stored checklist is reused instead of
 * paying for a second model call on a retried issuance.
 */

export type InjunctionSource = 'cache' | 'gemini' | 'simulated' | 'skipped';

export interface IssueInjunctionResult {
  /**
   * How many actions were issued for this verdict — the deterministic count
   * after collapsing repeated actions within one checklist. (A *retried* issue
   * reports the same number; the rows themselves are not duplicated.)
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
 * Whether issuance should be backgrounded by the caller.
 *
 * Only a model call is worth not waiting for. With the engine offline the
 * checklist is local arithmetic, so awaiting it costs nothing — and it keeps the
 * acceptance path deterministic (the actions exist by the time the caller
 * responds) instead of racing.
 */
export function injunctionRunsInBackground(): boolean {
  return geminiConfigured();
}

export async function issueInjunction(
  options: IssueInjunctionOptions
): Promise<IssueInjunctionResult> {
  const { repositories, userId, dossierId } = options;

  const record = await repositories.getDossier(dossierId);
  if (!record) return { issued: 0, source: 'skipped' };

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
      checklist = (await generateInjunctionChecklist(record)).checklist;
      source = 'gemini';
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
  if (actions.length === 0) return { issued: 0, source };

  await repositories.addInjunctionTasks(userId, dossierId, actions);
  return { issued: actions.length, source };
}
