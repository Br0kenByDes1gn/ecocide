// ---------------------------------------------------------------------------
// Registry roll-up (cross-assessment) — the citizen-level carbon record.
//
// A household audit files ONE `householdRatio`. A citizen's registry holds
// many, so the standing pools every item ever audited and takes the same
// size-and-quantity-weighted mean the household roll-up uses. Because
// `householdRatio` is itself an item-weighted mean, pooling the items is
// mathematically identical to "item-weighted mean of the assessment indices" —
// one weighting scheme, no parallel math.
//
// The tier for a standing is NOT computed here: the 90/75/60/40/20/0 bands are
// the taxonomy and live in the lore pack (`getFactionFromScore`).
// ---------------------------------------------------------------------------

import {
  hardFailCount,
  itemSi,
  itemWeight,
  sanitizeCount,
  topOffender,
  dominantMaterialFamily,
  type MaterialFamily,
  type RatedItem,
} from './math.js';

/** One archived assessment as the registry sees it (already scored items). */
export interface RegistryAssessment {
  /** Archive timestamp (ISO 8601); orders the record and its trend. */
  createdAt: string;
  items: readonly RatedItem[];
}

/** The citizen-level roll-up of every archived assessment. */
export interface RegistryStanding {
  /**
   * Pooled item-weighted index across every assessment (0–100 integer
   * percent). Mirrors `biocarbon_ratio`'s integer convention. An empty record
   * is neutral (50) so consumers never divide by zero — the UI gates the
   * empty state on `assessmentCount` instead of trusting this number.
   */
  index: number;
  /** Number of archived assessments on record. */
  assessmentCount: number;
  /** Objects audited across the whole record (Σ item counts). */
  objectCount: number;
  /** Items hit by at least one Step-5 override across the whole record. */
  hardFailCount: number;
  /** The worst item ever filed (lowest SI), null when the record is empty. */
  topOffenderLabel: string | null;
  /** Size-and-quantity-weighted dominant material family across the record. */
  dominantMaterialFamily: MaterialFamily | null;
  /**
   * Pooled index over every assessment EXCEPT the newest — the standing the
   * newest audit landed on. Null while only one assessment is on file.
   */
  baselineIndex: number | null;
  /** `index − baselineIndex`: what the newest audit did to the record. */
  delta: number | null;
  /** ISO timestamp of the oldest assessment (null when empty). */
  firstAuditAt: string | null;
  /** ISO timestamp of the newest assessment (null when empty). */
  lastAuditAt: string | null;
}

/** Objects audited by one assessment (quantity only, no size weighting). */
export function objectCount(items: readonly RatedItem[]): number {
  return items.reduce((n, item) => n + sanitizeCount(item.count), 0);
}

/**
 * Pooled item-weighted index over any number of assessments: the size-and-
 * quantity-weighted mean of every item's SI. Identical to the weighted mean of
 * the per-assessment `householdRatio` values, rounded once at the end.
 * Empty input is neutral (50).
 */
export function pooledIndex(assessments: readonly (readonly RatedItem[])[]): number {
  let total = 0;
  let weighted = 0;
  for (const items of assessments) {
    for (const item of items) {
      const w = itemWeight(item);
      total += w;
      weighted += itemSi(item) * w;
    }
  }
  if (total === 0) return 50;
  return Math.round(weighted / total);
}

/**
 * The citizen's standing: the pooled index plus the record's texture (objects,
 * hard fails, worst offender, dominant family) and the trend the newest audit
 * introduced. Assessments are ordered by `createdAt` internally so callers can
 * pass rows in any order. Deterministic: same record in, same standing out.
 */
export function registryStanding(assessments: readonly RegistryAssessment[]): RegistryStanding {
  const ordered = [...assessments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pooled = ordered.flatMap((a) => a.items);

  const index = pooledIndex(ordered.map((a) => a.items));
  const baselineIndex =
    ordered.length > 1 ? pooledIndex(ordered.slice(0, -1).map((a) => a.items)) : null;

  return {
    index,
    assessmentCount: ordered.length,
    objectCount: objectCount(pooled),
    hardFailCount: hardFailCount(pooled),
    topOffenderLabel: topOffender(pooled)?.label ?? null,
    dominantMaterialFamily: dominantMaterialFamily(pooled),
    baselineIndex,
    delta: baselineIndex === null ? null : index - baselineIndex,
    firstAuditAt: ordered[0]?.createdAt ?? null,
    lastAuditAt: ordered[ordered.length - 1]?.createdAt ?? null,
  };
}
