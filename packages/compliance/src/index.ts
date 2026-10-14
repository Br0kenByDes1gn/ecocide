// ---------------------------------------------------------------------------
// @ecocide/compliance — the Household Sustainability Index math.
// Pure, dependency-free implementation of compliance_formula.md:
//
//   Step 1  Weights:   M 20 · R 15 · D 10 · C 20 · L 15 · T 10 · P 5 · E 5 (sum 100)
//   Step 2  Harm H:    ( Σ wᵢ × rᵢ ) / ( Σ wᵢ )  over applicable dimensions only
//                      (operating energy `e` is skipped for non-energy items;
//                      the denominator auto-rebalances, e.g. to 95).
//   Step 3  SI:        100 × (5 − H) / 4          → 0..100, higher is better
//   Step 4  Status:    ≥60 Compliant · 40–59.9 Borderline · <40 Non-Compliant
//
// The tier bands (90/75/60/40/20) are the TAXONOMY and live in the lore pack
// (factions.ts minScore), not here. This package owns the item-level formula
// and the household roll-up only.
// ---------------------------------------------------------------------------

export {
  DIMENSION_KEYS,
  DIMENSION_WEIGHTS,
  DIMENSION_TOTAL_WEIGHT,
  DIMENSION_LABELS,
  type DimensionKey,
  type DimensionMeta,
} from './dimensions.js';

export {
  clampRating,
  sanitizeCount,
  normalizeLabel,
  dedupeItems,
  harmScore,
  siFromHarm,
  roundSi,
  itemStatus,
  itemStamp,
  itemSi,
  householdRatio,
  hardFailCount,
  topOffender,
  dominantDimension,
  DIMENSION_ORDER,
} from './math.js';

export type {
  DimensionRating,
  ItemRatings,
  RatedItem,
  ItemStatus,
} from './math.js';