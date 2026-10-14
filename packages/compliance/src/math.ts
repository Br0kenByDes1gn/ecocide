// ---------------------------------------------------------------------------
// The compliance math (steps 2–4 of compliance_formula.md) plus the household
// roll-up and the input sanitizers used at the server boundary (model output
// is clamped and deduped BEFORE any scoring).
// ---------------------------------------------------------------------------

import { DIMENSION_KEYS, DIMENSION_WEIGHTS, type DimensionKey } from './dimensions.js';

export type DimensionRating = 1 | 2 | 3 | 4 | 5;

/**
 * Per-dimension 1–5 ratings. A dimension the item does not have (most often
 * operating energy `e`) is simply ABSENT — the weighted mean denominator
 * rebalances automatically per the formula.
 */
export type ItemRatings = Partial<Record<DimensionKey, DimensionRating>>;

/** Minimal scored input: label + repeat count + ratings. */
export interface RatedItem {
  label: string;
  category?: string | null;
  count: number;
  ratings: ItemRatings;
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
 * lowercase, collapse whitespace, drop leading articles and a trailing plural
 * "s" ("PET bottles" → "pet bottle"). English-only by design — the inventory
 * prompt instructs the model to emit plain English labels.
 */
export function normalizeLabel(label: string): string {
  let l = (label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  l = l.replace(/^(a|an|the)\s+/, '');
  if (l.length > 1 && l.endsWith('s') && !l.endsWith('ss')) l = l.slice(0, -1);
  return l;
}

/**
 * Group detected items by normalized label. Counts merge; when a dimension is
 * rated differently across copies, the WORST rating wins (the audit keeps the
 * most incriminating copy on file).
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
        justification: item.justification ?? null,
        bounds: item.bounds ?? null,
      });
      continue;
    }
    existing.count += sanitizeCount(item.count);
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

/** Step 4 — compliance status. Boundaries: ≥60 / ≥40 / <40. */
export type ItemStatus = 'compliant' | 'borderline' | 'non-compliant';

export function itemStatus(si: number): ItemStatus {
  if (si >= 60) return 'compliant';
  if (si >= 40) return 'borderline';
  return 'non-compliant';
}

/** Stamp label per item status (from compliance_formula.md Step 4). */
export const ITEM_STAMPS: Readonly<Record<ItemStatus, string>> = {
  compliant: 'APPROVED',
  borderline: 'PENDING REVIEW',
  'non-compliant': 'DENIED',
};

export function itemStamp(si: number): string {
  return ITEM_STAMPS[itemStatus(si)];
}

/** Full item → SI shortcut. */
export function itemSi(item: RatedItem): number {
  return siFromHarm(harmScore(item.ratings));
}

/**
 * Household Sustainability Index: count-weighted mean of every item's SI,
 * rounded to an integer percent (mirrors the integer `biocarbon_ratio`).
 * An empty audit is neutral (50) so the flow never divides by zero.
 */
export function householdRatio(items: readonly RatedItem[]): number {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return 50;
  const weighted = items.reduce((sum, item) => sum + item.count * itemSi(item), 0);
  return Math.round(weighted / total);
}

/** Items the audit flags as hard fails (SI < 40 → DENIED). */
export function hardFailCount(items: readonly RatedItem[]): number {
  return items.reduce((n, item) => (itemSi(item) < 40 ? n + 1 : n), 0);
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