// ---------------------------------------------------------------------------
// The eight audit dimensions from compliance_formula.md (Step 1 weights).
// Keys are the compact internal identifiers used in API payloads and prompts
// (`m/r/d/c/l/t/p/e`); they are storage names, not display copy.
// ---------------------------------------------------------------------------

export const DIMENSION_KEYS = ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

/** Step 1 weights — must sum to 100 (enforced by the invariant tests). */
export const DIMENSION_WEIGHTS: Readonly<Record<DimensionKey, number>> = {
  m: 20, // Material type
  r: 15, // Recyclability
  d: 10, // Decomposition time
  c: 20, // Embodied carbon
  l: 15, // Lifespan / usage
  t: 10, // Toxicity
  p: 5,  // Pollution shedding
  e: 5,  // Operating energy
};

export const DIMENSION_TOTAL_WEIGHT = 100;

/** Technical labels for item cards / logs. Display copy lives in lore. */
export const DIMENSION_LABELS: Readonly<Record<DimensionKey, string>> = {
  m: 'Material type',
  r: 'Recyclability',
  d: 'Decomposition time',
  c: 'Embodied carbon',
  l: 'Lifespan / usage',
  t: 'Toxicity',
  p: 'Pollution shedding',
  e: 'Operating energy',
};

export interface DimensionMeta {
  key: DimensionKey;
  label: string;
  weight: number;
}

export const DIMENSION_META: readonly DimensionMeta[] = DIMENSION_KEYS.map((key) => ({
  key,
  label: DIMENSION_LABELS[key],
  weight: DIMENSION_WEIGHTS[key],
}));