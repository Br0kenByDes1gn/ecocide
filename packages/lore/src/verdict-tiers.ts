// ---------------------------------------------------------------------------
// Verdict tiers — the score-band classification table.
//
// Maps a 0–100 compliance score (the persisted `biocarbon_ratio`) to a tier
// label, compliance status, one-line verdict and assigned accent color.
//
// The tier vocabulary mirrors the faction canon (the same names, hexes and
// appraisal lines as FACTIONS), but these bands are keyed on the compliance
// score, not on the census percentile that assigns factions — the two can
// legitimately disagree for one dossier. The table is spelled out explicitly
// so the exact ranges, labels, statuses and colors stay reviewable in one
// place.
// ---------------------------------------------------------------------------

export type VerdictStatus = 'Compliant' | 'Borderline' | 'Non-Compliant';

export interface VerdictTier {
  /** Tier label (e.g. `Carbon Neutral Legend`). */
  label: string;
  status: VerdictStatus;
  /** One-line verdict the Bureau issues for the band. */
  verdictLine: string;
  /** Assigned accent color (hex). */
  color: string;
  /** Inclusive lower bound of the score band. */
  minScore: number;
  /** Inclusive upper bound of the score band. */
  maxScore: number;
}

/**
 * The six verdict tiers, ordered from the highest score band to the lowest.
 * Ranges are inclusive on both ends and together cover 0–100 exactly.
 */
export const VERDICT_TIERS: readonly VerdictTier[] = [
  {
    label: 'Carbon Neutral Legend',
    status: 'Compliant',
    verdictLine: 'Suspiciously perfect. The Bureau is double-checking.',
    color: '#84cc16',
    minScore: 90,
    maxScore: 100,
  },
  {
    label: 'Marginally Acceptable Human',
    status: 'Compliant',
    verdictLine: 'Good habits. Keep going.',
    color: '#22c55e',
    minScore: 75,
    maxScore: 89,
  },
  {
    label: 'Statistically Average Polluter',
    status: 'Compliant',
    verdictLine: 'Some good choices, some bad ones. Acceptable.',
    color: '#facc15',
    minScore: 60,
    maxScore: 74,
  },
  {
    label: 'High-Impact Habitual Offender',
    status: 'Borderline',
    verdictLine: 'You know better, and the bin knows it.',
    color: '#f59e0b',
    minScore: 40,
    maxScore: 59,
  },
  {
    label: 'Power Grid Liability',
    status: 'Non-Compliant',
    verdictLine: 'A lot of waste. Review pending.',
    color: '#f97316',
    minScore: 20,
    maxScore: 39,
  },
  {
    label: 'Environmental Disaster Zone',
    status: 'Non-Compliant',
    verdictLine: 'Termination notice issued. Appeals accepted in pledges.',
    color: '#ef4444',
    minScore: 0,
    maxScore: 19,
  },
];

/**
 * Resolve the verdict tier for a 0–100 compliance score. Scores outside the
 * range are clamped; boundary values (0 and 100) resolve to the lowest and
 * highest tiers respectively.
 */
export function getVerdictTier(score: number): VerdictTier {
  const clamped = Math.max(0, Math.min(100, score));
  const found = VERDICT_TIERS.find(
    (tier) => clamped >= tier.minScore && clamped <= tier.maxScore
  );
  return found ?? VERDICT_TIERS[VERDICT_TIERS.length - 1];
}
