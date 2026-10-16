import type { AcceptedPledge, Suggestion } from '@ecocide/types';

/** The remediation block's two groups, in the order they are shown. */
export interface PledgeGroups {
  /** Pledges the tribunal granted — these are on the household's file. */
  pledged: AcceptedPledge[];
  /** The verdict's current suggestions that were never granted. */
  unpledged: Suggestion[];
}

/** Match key for a pledge phrase (case and spacing are not the citizen's fault). */
function phraseKey(phrase: string): string {
  return (phrase || '').trim().toLowerCase();
}

/**
 * Split a verdict's suggestions into what was pledged and what was not.
 *
 * The two groups come from different sources on purpose. `unpledged` is the
 * current verdict's suggestion list, but `pledged` is the record of what the
 * tribunal granted — applying a granted appeal re-arbitrates the dossier and
 * replaces its suggestions, so an accepted pledge may not appear in that list at
 * all. Matching by phrase only stops the same commitment being listed twice.
 */
export function splitPledges(
  suggestions: Suggestion[],
  acceptedPledges: AcceptedPledge[] | undefined
): PledgeGroups {
  const granted = new Set((acceptedPledges ?? []).map((p) => phraseKey(p.pledge)));
  return {
    pledged: acceptedPledges ?? [],
    unpledged: suggestions.filter((s) => !granted.has(phraseKey(s.pledge))),
  };
}
