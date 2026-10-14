// ---------------------------------------------------------------------------
// Invariant tests for the compliance formula (compliance_formula.md).
// These replace the old face-geometry invariants: given the same items, the
// math is 100% deterministic and every boundary is pinned down.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  DIMENSION_KEYS,
  DIMENSION_ORDER,
  DIMENSION_TOTAL_WEIGHT,
  DIMENSION_WEIGHTS,
  clampRating,
  dedupeItems,
  dominantDimension,
  hardFailCount,
  harmScore,
  householdRatio,
  itemStamp,
  itemStatus,
  itemSi,
  normalizeLabel,
  roundSi,
  sanitizeCount,
  siFromHarm,
  topOffender,
  type ItemRatings,
  type RatedItem,
} from './index.js';

const all = (rating: number): ItemRatings =>
  Object.fromEntries(DIMENSION_KEYS.map((k) => [k, rating])) as ItemRatings;

describe('dimension weights (Step 1)', () => {
  it('lists exactly eight dimensions in the formula-table order', () => {
    expect(DIMENSION_ORDER).toEqual(['m', 'r', 'd', 'c', 'l', 't', 'p', 'e']);
  });

  it('weights match the formula and sum to exactly 100', () => {
    expect(DIMENSION_WEIGHTS).toEqual({ m: 20, r: 15, d: 10, c: 20, l: 15, t: 10, p: 5, e: 5 });
    const sum = DIMENSION_KEYS.reduce((s, k) => s + DIMENSION_WEIGHTS[k], 0);
    expect(sum).toBe(DIMENSION_TOTAL_WEIGHT);
    expect(sum).toBe(100);
  });
});

describe('harm score & SI (Steps 2–3)', () => {
  it('all-1 ratings → H 1.0 → SI 100; all-3 → H 3.0 → SI 50; all-5 → H 5.0 → SI 0', () => {
    expect(harmScore(all(1))).toBeCloseTo(1, 10);
    expect(siFromHarm(harmScore(all(1)))).toBeCloseTo(100, 10);
    expect(harmScore(all(3))).toBeCloseTo(3, 10);
    expect(siFromHarm(harmScore(all(3)))).toBeCloseTo(50, 10);
    expect(harmScore(all(5))).toBeCloseTo(5, 10);
    expect(siFromHarm(harmScore(all(5)))).toBeCloseTo(0, 10);
  });

  it('is the weighted mean over applicable dimensions only', () => {
    // Single dimension rated: H equals that rating; weight is irrelevant.
    expect(harmScore({ t: 4 })).toBeCloseTo(4, 10);
    // m=3 (20), c=1 (20) → (60 + 20) / 40 = 2.0
    expect(harmScore({ m: 3, c: 1 })).toBeCloseTo(2, 10);
  });

  it('skips operating energy (denominator 95) — the formula rebalances', () => {
    // Item with all non-energy dims at 1 and e at 5: (95×1 + 5×5)/100 = 1.2.
    // The same passive item (brightness: e not applicable): all 7 dims at 1 →
    // denominator rebalances to 95 and H returns to exactly 1.
    const energyItem: ItemRatings = { ...all(1), e: 5 };
    expect(harmScore(energyItem)).toBeCloseTo(1.2, 10);
    const passiveItem: ItemRatings = { ...all(1) };
    delete passiveItem.e;
    expect(harmScore(passiveItem)).toBeCloseTo(1, 10);
    // e only → H 5
    expect(harmScore({ e: 5 })).toBeCloseTo(5, 10);
    expect(harmScore({})).toBe(5);
  });

  it('treats an unrated item as a liability (H 5 → SI 0)', () => {
    expect(harmScore({})).toBe(5);
    const item: RatedItem = { label: 'unclassifiable', count: 1, ratings: {} };
    expect(itemSi(item)).toBe(0);
    expect(itemStatus(itemSi(item))).toBe('non-compliant');
  });

  it('rounds SI to one decimal for display only', () => {
    expect(roundSi(51.4444)).toBe(51.4);
  });
});

describe('item status (Step 4)', () => {
  it('maps the formula thresholds exactly (≥60, ≥40, <40)', () => {
    expect(itemStatus(100)).toBe('compliant');
    expect(itemStatus(60)).toBe('compliant');
    expect(itemStatus(59.9)).toBe('borderline');
    expect(itemStatus(40)).toBe('borderline');
    expect(itemStatus(39.9)).toBe('non-compliant');
    expect(itemStatus(0)).toBe('non-compliant');
  });

  it('stamps match the formula table', () => {
    expect(itemStamp(75)).toBe('APPROVED');
    expect(itemStamp(55)).toBe('PENDING REVIEW');
    expect(itemStamp(10)).toBe('DENIED');
  });
});

describe('household roll-up', () => {
  const item = (label: string, count: number, ratings: ItemRatings): RatedItem => ({
    label,
    count,
    ratings,
  });

  it('is the count-weighted mean of item SIs, rounded to an integer', () => {
    const good = item('good', 1, all(1)); // SI 100
    const bad = item('bad', 1, all(5)); // SI 0
    expect(householdRatio([good, bad])).toBe(50);
    expect(householdRatio([good, good, bad])).toBe(67); // (2×100 + 0)/3
  });

  it('neutral 50 for an empty audit', () => {
    expect(householdRatio([])).toBe(50);
  });

  it('counts hard fails by SI < 40', () => {
    const bad = item('bad', 1, all(5)); // 0
    const meh = item('meh', 1, all(4)); // SI 25
    const ok = item('ok', 1, all(2)); // SI 75
    expect(hardFailCount([bad, meh, ok])).toBe(2);
  });

  it('picks the lowest-SI item as top offender', () => {
    const bad = item('bad', 1, all(5));
    const meh = item('meh', 1, all(4));
    expect(topOffender([meh, bad])?.label).toBe('bad');
    expect(topOffender([])).toBeNull();
  });

  it('finds the dominant (worst) dimension across the household', () => {
    // m and c rated: c worse on average → dominant is c
    const items = [
      item('a', 1, { m: 1, c: 5 }),
      item('b', 1, { m: 3, c: 4 }),
    ];
    expect(dominantDimension(items)).toBe('c');
    expect(dominantDimension([item('x', 1, {})])).toBeNull();
  });
});

describe('input sanitization', () => {
  it('clamps ratings to the 1–5 scale', () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(9)).toBe(5);
    expect(clampRating(3.49)).toBe(3);
    expect(clampRating(2.5)).toBe(3);
    expect(clampRating('4')).toBe(4);
    expect(clampRating(null)).toBeNull();
    expect(clampRating(undefined)).toBeNull();
    expect(clampRating('hot')).toBeNull();
  });

  it('sanitizes counts to positive integers', () => {
    expect(sanitizeCount(0)).toBe(1);
    expect(sanitizeCount(-3)).toBe(1);
    expect(sanitizeCount(2.9)).toBe(2);
    expect(sanitizeCount('four')).toBe(1);
  });

  it('normalizes labels for grouping', () => {
    expect(normalizeLabel('PET Bottles')).toBe('pet bottle');
    expect(normalizeLabel('  The Glass  Jar ')).toBe('glass jar');
    expect(normalizeLabel('glass')).toBe('glass'); // ss guard
    expect(normalizeLabel('kiss')).toBe('kiss'); // ss guard
  });

  it('merges duplicates, sums counts and keeps the worst ratings', () => {
    const a: RatedItem = { label: 'PET Bottles', count: 2, ratings: { m: 5, c: 3 } };
    const b: RatedItem = { label: 'pet bottle', count: 1, ratings: { m: 4, c: null as unknown as 4 } };
    const merged = dedupeItems([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('PET Bottles');
    expect(merged[0].count).toBe(3);
    expect(merged[0].ratings.m).toBe(5); // worst wins
    expect(merged[0].ratings.c).toBe(3);
  });

  it('drops empty labels when deduping', () => {
    expect(dedupeItems([{ label: '   ', count: 1, ratings: {} }])).toHaveLength(0);
  });
});