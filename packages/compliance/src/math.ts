// ---------------------------------------------------------------------------
// The compliance math (steps 2–5 of the sustainability scoring framework)
// plus the household roll-up and the input sanitizers used at the server
// boundary (model output is clamped and deduped BEFORE any scoring).
//
//   Step 2  Harm H       weighted mean over applicable dimensions
//   Step 3  SI           100 × (5 − H) / 4
//   Step 4  Status       ≥60 Compliant · 40–59.9 Borderline · <40 Non-Compliant
//   Step 5  Overrides    single-use plastic · hazardous · landfill trap
// ---------------------------------------------------------------------------

import { DIMENSION_KEYS, DIMENSION_WEIGHTS, type DimensionKey } from './dimensions.js';

export type DimensionRating = 1 | 2 | 3 | 4 | 5;

/**
 * Per-dimension 1–5 ratings. A dimension the item does not have (most often
 * operating energy `e`) is simply ABSENT — the weighted mean denominator
 * rebalances automatically per the formula.
 */
export type ItemRatings = Partial<Record<DimensionKey, DimensionRating>>;

/**
 * Material family reported by the auditor (drives the single-use-plastic
 * override and the household title driver).
 */
export type MaterialFamily =
  | 'plastic'
  | 'bio-based'
  | 'metal'
  | 'glass'
  | 'paper'
  | 'wood'
  | 'textile'
  | 'rubber'
  | 'ceramic'
  | 'chemical'
  | 'electronic'
  | 'organic'
  | 'mixed'
  | 'other';

export const MATERIAL_FAMILIES: readonly MaterialFamily[] = [
  'plastic',
  'bio-based',
  'metal',
  'glass',
  'paper',
  'wood',
  'textile',
  'rubber',
  'ceramic',
  'chemical',
  'electronic',
  'organic',
  'mixed',
  'other',
] as const;

/** Relative size of an item in the household roll-up (framework §6). */
export type ItemSize = 'small' | 'medium' | 'large';

export const SIZE_FACTORS: Readonly<Record<ItemSize, number>> = {
  small: 0.5,
  medium: 1,
  large: 2,
};

export function sizeFactor(size?: ItemSize | null): number {
  return SIZE_FACTORS[size ?? 'medium'] ?? 1;
}

/** Minimal scored input: label + repeat count + ratings (+ optional metadata). */
export interface RatedItem {
  label: string;
  category?: string | null;
  count: number;
  ratings: ItemRatings;
  /** Material family (drives overrides + titles). */
  materialFamily?: MaterialFamily | null;
  /** Relative size (drives the size-weighted household roll-up). */
  size?: ItemSize | null;
  /** Free-form note preserved through dedupe (kept from the first copy). */
  justification?: string | null;
  /** Normalized bounding box preserved through dedupe (first copy wins). */
  bounds?: { x1: number; y1: number; x2: number; y2: number } | null;
}

/** Weight display order (same as the formula table). */
export const DIMENSION_ORDER: readonly DimensionKey[] = DIMENSION_KEYS;

/** Coerce an arbitrary model value into a 1–5 rating, or `null` when invalid. */
export function clampRating(value: unknown): DimensionRating | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return Math.round(n) as DimensionRating;
}

/** Coerce a model count into a positive integer (defaults to 1). */
export function sanitizeCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Normalize a detected-object label so near-duplicates group together:
 * lowercase, collapse whitespace, drop leading articles and simple English
 * plurals ("PET bottles" → "pet bottle", "boxes" → "box"). English-only by
 * design — the inventory prompt instructs the model to emit plain English
 * labels.
 */
export function normalizeLabel(label: string): string {
  let l = (label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  l = l.replace(/^(a|an|the)\s+/, '');
  const esPlural = /(ch|sh|[sxz])es$/;
  if (l.length > 2 && esPlural.test(l)) l = l.slice(0, -2);
  else if (l.length > 2 && /[^s]s$/.test(l)) l = l.slice(0, -1);
  return l;
}

/**
 * Group detected items by normalized label. Counts merge; when a dimension is
 * rated differently across copies, the WORST rating wins (the audit keeps the
 * most incriminating copy on file). Sizes merge toward the LARGER factor; the
 * first non-null material family wins.
 */
export function dedupeItems(items: readonly RatedItem[]): RatedItem[] {
  const map = new Map<string, RatedItem>();
  for (const item of items) {
    const key = normalizeLabel(item.label);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        label: item.label.trim(),
        category: item.category ?? null,
        count: sanitizeCount(item.count),
        ratings: { ...item.ratings },
        materialFamily: item.materialFamily ?? null,
        size: item.size ?? null,
        justification: item.justification ?? null,
        bounds: item.bounds ?? null,
      });
      continue;
    }
    existing.count += sanitizeCount(item.count);
    if (sizeFactor(item.size) > sizeFactor(existing.size)) existing.size = item.size ?? existing.size;
    if (!existing.materialFamily && item.materialFamily) existing.materialFamily = item.materialFamily;
    for (const k of DIMENSION_KEYS) {
      const a = clampRating(existing.ratings[k]);
      const b = clampRating(item.ratings[k]);
      if (a === null && b !== null) existing.ratings[k] = b;
      else if (a !== null && b !== null && b > a) existing.ratings[k] = b;
    }
  }
  return [...map.values()];
}

/**
 * Step 2 — Harm Score: weighted mean of the applicable ratings
 * (1.0 best → 5.0 worst). Unrated items (no applicable dimensions) score
 * the worst case 5: an object the audit cannot classify is a liability.
 */
export function harmScore(ratings: ItemRatings): number {
  let weightSum = 0;
  let weighted = 0;
  for (const key of DIMENSION_KEYS) {
    const rating = clampRating(ratings[key]);
    if (rating === null) continue;
    const w = DIMENSION_WEIGHTS[key];
    weightSum += w;
    weighted += w * rating;
  }
  if (weightSum === 0) return 5;
  return weighted / weightSum;
}

/** Step 3 — Sustainability Index: 100 × (5 − H) / 4 (0..100, higher is better). */
export function siFromHarm(h: number): number {
  const clamped = Math.min(5, Math.max(1, h));
  return (100 * (5 - clamped)) / 4;
}

/** Round an SI for display (one decimal). Status is decided on the raw SI. */
export function roundSi(si: number): number {
  return Math.round(si * 10) / 10;
}

// ---------------------------------------------------------------------------
// Step 5 — override rules. A single severe property must not be hidden by
// good scores elsewhere, so these fire AFTER the SI status is computed.
// ---------------------------------------------------------------------------

export type OverrideRuleId = 'single-use-plastic' | 'hazardous' | 'landfill-trap';

/** Human labels for the override rules (shown on item cards / explain panel). */
export const OVERRIDE_RULES: Readonly<Record<OverrideRuleId, string>> = {
  'single-use-plastic': 'Single-use plastic',
  hazardous: 'Hazardous material',
  'landfill-trap': 'Landfill trap',
};

/**
 * Evaluate the framework's override rules against an item:
 *   1. single-use plastic  — L = 5 and the material family is plastic
 *   2. hazardous           — T = 5 (cannot be Compliant; needs special disposal)
 *   3. landfill trap       — R = 5 and D ≥ 4 and L ≥ 4
 */
export function evaluateOverrides(
  ratings: ItemRatings,
  materialFamily?: MaterialFamily | null
): OverrideRuleId[] {
  const rules: OverrideRuleId[] = [];
  const r = (key: DimensionKey) => clampRating(ratings[key]);
  if (r('l') === 5 && materialFamily === 'plastic') rules.push('single-use-plastic');
  if (r('t') === 5) rules.push('hazardous');
  if (r('r') === 5 && (r('d') ?? 0) >= 4 && (r('l') ?? 0) >= 4) rules.push('landfill-trap');
  return rules;
}

/** Step 4 — compliance status (extended by the Step-5 overrides). */
export type ItemStatus = 'compliant' | 'acceptable' | 'needs-improvement' | 'non-compliant';

/** Base status from the SI alone. Boundaries: ≥75 / ≥60 / ≥40 / <40. */
export function baseItemStatus(si: number): ItemStatus {
  if (si >= 75) return 'compliant';
  if (si >= 60) return 'acceptable';
  if (si >= 40) return 'needs-improvement';
  return 'non-compliant';
}

/**
 * Status with overrides applied: forced non-compliance (single-use plastic /
 * landfill trap) wins; hazardous items cannot be approved or held — they
 * become Special Handling Required unless the SI already fails.
 */
export function itemStatus(si: number, overrides: readonly OverrideRuleId[] = []): ItemStatus {
  const base = baseItemStatus(si);
  if (overrides.includes('single-use-plastic') || overrides.includes('landfill-trap')) {
    return 'non-compliant';
  }
  if (overrides.includes('hazardous')) {
    // Hazardous items cannot be approved; they are rejected (the Step-5 flag
    // keeps emitting the matching override badge so the hazard stays visible).
    return 'non-compliant';
  }
  return base;
}

/** Stamp label per item status (formula Step 4 + Step 5 overrides). */
export const ITEM_STAMPS: Readonly<Record<ItemStatus, string>> = {
  compliant: 'APPROVED',
  acceptable: 'ACCEPTED',
  'needs-improvement': 'IMPROVE',
  'non-compliant': 'DENIED',
};

export function itemStamp(si: number, overrides: readonly OverrideRuleId[] = []): string {
  return ITEM_STAMPS[itemStatus(si, overrides)];
}

/** Full item → SI shortcut. */
export function itemSi(item: RatedItem): number {
  return siFromHarm(harmScore(item.ratings));
}

/** Item → Step-5 override list shortcut. */
export function itemOverrides(item: RatedItem): OverrideRuleId[] {
  return evaluateOverrides(item.ratings, item.materialFamily);
}

/** Roll-up weight of one item: quantity × size factor (framework §6). */
export function itemWeight(item: RatedItem): number {
  return sanitizeCount(item.count) * sizeFactor(item.size);
}

/**
 * Household Sustainability Index: size-and-quantity-weighted mean of every
 * item's SI, rounded to an integer percent (mirrors the integer
 * `biocarbon_ratio`). An empty audit is neutral (50) so the flow never
 * divides by zero.
 */
export function householdRatio(items: readonly RatedItem[]): number {
  const total = items.reduce((sum, item) => sum + itemWeight(item), 0);
  if (total === 0) return 50;
  const weighted = items.reduce((sum, item) => sum + itemSi(item) * itemWeight(item), 0);
  return Math.round(weighted / total);
}

/** Items the audit flags as hard fails: hit by at least one override rule. */
export function hardFailCount(items: readonly RatedItem[]): number {
  return items.reduce((n, item) => (itemOverrides(item).length > 0 ? n + 1 : n), 0);
}

/**
 * How much mess an audit measured, as an index — the basis for what the Bureau
 * charges for processing it.
 *
 * Every item contributes its repeats × its size × its harm, so a room full of
 * large, high-harm things scores higher than a room of the same shape but tidier
 * contents. It is deliberately **dimensionless**: the audit has no emission
 * factors, so anything claiming this was kilograms of CO₂e would be inventing
 * data. It is a relative load, meaningful only against another audit's.
 */
export function auditLoad(items: readonly RatedItem[]): number {
  return items.reduce(
    (load, item) => load + sanitizeCount(item.count) * sizeFactor(item.size) * harmScore(item.ratings),
    0
  );
}

/** The single worst item (lowest SI; first occurrence wins ties). */
export function topOffender(items: readonly RatedItem[]): RatedItem | null {
  let worst: RatedItem | null = null;
  let worstSi = Infinity;
  for (const item of items) {
    const si = itemSi(item);
    if (si < worstSi) {
      worst = item;
      worstSi = si;
    }
  }
  return worst;
}

/**
 * The dimension where the household's habits score worst on average
 * (count-weighted). Drives the deterministic personalized title. Returns
 * `null` when nothing is rated.
 */
export function dominantDimension(items: readonly RatedItem[]): DimensionKey | null {
  let bestKey: DimensionKey | null = null;
  let bestAvg = -1;
  for (const key of DIMENSION_KEYS) {
    let total = 0;
    let count = 0;
    for (const item of items) {
      const rating = clampRating(item.ratings[key]);
      if (rating === null) continue;
      total += item.count * rating;
      count += item.count;
    }
    if (count === 0) continue;
    const avg = total / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * The household's dominant material family (size-and-quantity-weighted
 * majority). Drives the title driver for plastics / textiles / electronics.
 */
export function dominantMaterialFamily(items: readonly RatedItem[]): MaterialFamily | null {
  const totals = new Map<MaterialFamily, number>();
  for (const item of items) {
    if (!item.materialFamily) continue;
    totals.set(item.materialFamily, (totals.get(item.materialFamily) ?? 0) + itemWeight(item));
  }
  let best: MaterialFamily | null = null;
  let bestWeight = -1;
  for (const [family, weight] of totals) {
    if (weight > bestWeight) {
      best = family;
      bestWeight = weight;
    }
  }
  return best;
}