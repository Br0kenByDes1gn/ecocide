// ---------------------------------------------------------------------------
// Invariant tests for the compliance formula (compliance_formula.md +
// sustainability_scoring_framework.md): steps 2–5, the size-weighted
// household roll-up and the input sanitizers. Given the same items, the math
// is 100% deterministic and every boundary is pinned down.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  DIMENSION_KEYS,
  DIMENSION_ORDER,
  DIMENSION_TOTAL_WEIGHT,
  DIMENSION_WEIGHTS,
  SIZE_FACTORS,
  baseItemStatus,
  clampRating,
  dedupeItems,
  dominantDimension,
  dominantMaterialFamily,
  evaluateOverrides,
  hardFailCount,
  harmScore,
  householdRatio,
  itemOverrides,
  itemStamp,
  itemStatus,
  itemSi,
  itemWeight,
  normalizeLabel,
  roundSi,
  sanitizeCount,
  siFromHarm,
  sizeFactor,
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
    expect(harmScore({ t: 4 })).toBeCloseTo(4, 10);
    expect(harmScore({ m: 3, c: 1 })).toBeCloseTo(2, 10);
  });

  it('skips operating energy (denominator 95) — the formula rebalances', () => {
    const energyItem: ItemRatings = { ...all(1), e: 5 };
    expect(harmScore(energyItem)).toBeCloseTo(1.2, 10);
    const passiveItem: ItemRatings = { ...all(1) };
    delete passiveItem.e;
    expect(harmScore(passiveItem)).toBeCloseTo(1, 10);
    expect(harmScore({ e: 5 })).toBeCloseTo(5, 10);
    expect(harmScore({})).toBe(5);
  });

  it('treats an unrated item as a liability (H 5 → SI 0)', () => {
    const item: RatedItem = { label: 'unclassifiable', count: 1, ratings: {} };
    expect(itemSi(item)).toBe(0);
    expect(baseItemStatus(itemSi(item))).toBe('non-compliant');
  });

  it('rounds SI to one decimal for display only', () => {
    expect(roundSi(51.4444)).toBe(51.4);
  });
});

describe('item status (Step 4)', () => {
  it('maps the formula thresholds exactly (≥75, ≥60, ≥40, <40)', () => {
    expect(baseItemStatus(100)).toBe('compliant');
    expect(baseItemStatus(75)).toBe('compliant');
    expect(baseItemStatus(74.9)).toBe('acceptable');
    expect(baseItemStatus(60)).toBe('acceptable');
    expect(baseItemStatus(59.9)).toBe('needs-improvement');
    expect(baseItemStatus(40)).toBe('needs-improvement');
    expect(baseItemStatus(39.9)).toBe('non-compliant');
    expect(baseItemStatus(0)).toBe('non-compliant');
  });

  it('stamps match the formula table', () => {
    expect(itemStamp(75)).toBe('APPROVED');
    expect(itemStamp(60)).toBe('ACCEPTED');
    expect(itemStamp(55)).toBe('IMPROVE');
    expect(itemStamp(10)).toBe('DENIED');
    expect(itemStamp(75, ['hazardous'])).toBe('DENIED');
  });
});

describe('override rules (Step 5)', () => {
  it('single-use plastic: L=5 + plastic family', () => {
    const ratings: ItemRatings = { m: 5, r: 1, d: 5, c: 4, l: 5, t: 2, p: 4 };
    expect(evaluateOverrides(ratings, 'plastic')).toContain('single-use-plastic');
    expect(evaluateOverrides(ratings, 'paper')).not.toContain('single-use-plastic');
    // L=5 alone (e.g. paper plates) does NOT fire the plastic rule
    expect(evaluateOverrides({ l: 5 }, 'paper')).toEqual([]);
  });

  it('hazardous: T=5 fires regardless of material', () => {
    expect(evaluateOverrides({ t: 5 }, 'glass')).toContain('hazardous');
    expect(evaluateOverrides({ t: 4 }, 'glass')).not.toContain('hazardous');
  });

  it('landfill trap: R=5 and D≥4 and L≥4', () => {
    expect(evaluateOverrides({ r: 5, d: 4, l: 4 }, null)).toContain('landfill-trap');
    expect(evaluateOverrides({ r: 5, d: 4, l: 3 }, null)).not.toContain('landfill-trap');
    expect(evaluateOverrides({ r: 5, d: 3, l: 5 }, null)).not.toContain('landfill-trap');
    expect(evaluateOverrides({ r: 4, d: 5, l: 5 }, null)).not.toContain('landfill-trap');
  });

  it('status: forced non-compliance wins; hazardous cannot be approved/held', () => {
    // A high-SI plastic bottle is still DENIED
    expect(itemStatus(85, ['single-use-plastic'])).toBe('non-compliant');
    expect(itemStatus(85, ['landfill-trap'])).toBe('non-compliant');
    // A high-SI hazardous item becomes non-compliant (DENIED), not APPROVED
    expect(itemStatus(85, ['hazardous'])).toBe('non-compliant');
    expect(itemStatus(55, ['hazardous'])).toBe('non-compliant');
    // Already-failing hazardous items stay non-compliant
    expect(itemStatus(20, ['hazardous'])).toBe('non-compliant');
    // No overrides → base status
    expect(itemStatus(85, [])).toBe('compliant');
  });

  it('itemOverrides reads material family from the item', () => {
    const bottle: RatedItem = { label: 'bottle', count: 1, ratings: { l: 5, t: 2 }, materialFamily: 'plastic' };
    expect(itemOverrides(bottle)).toEqual(['single-use-plastic']);
  });
});

describe('household roll-up (Step 6)', () => {
  const item = (label: string, count: number, ratings: ItemRatings, extra: Partial<RatedItem> = {}): RatedItem => ({
    label,
    count,
    ratings,
    ...extra,
  });

  it('size factors are 0.5 / 1 / 2 (medium default)', () => {
    expect(SIZE_FACTORS).toEqual({ small: 0.5, medium: 1, large: 2 });
    expect(sizeFactor('small')).toBe(0.5);
    expect(sizeFactor('large')).toBe(2);
    expect(sizeFactor(null)).toBe(1);
    expect(sizeFactor(undefined)).toBe(1);
  });

  it('weights items by quantity × size factor', () => {
    expect(itemWeight(item('x', 4, all(1), { size: 'small' }))).toBe(2);
    expect(itemWeight(item('x', 4, all(1), { size: 'large' }))).toBe(8);

    const goodSmall = item('good', 1, all(1), { size: 'small' }); // SI 100, weight 0.5
    const badLarge = item('bad', 1, all(5), { size: 'large' }); // SI 0, weight 2
    expect(householdRatio([goodSmall, badLarge])).toBe(20); // 100×0.5 / 2.5
    // Same items without sizes → plain quantity weighting
    expect(householdRatio([item('good', 1, all(1)), item('bad', 1, all(5))])).toBe(50);
  });

  it('neutral 50 for an empty audit', () => {
    expect(householdRatio([])).toBe(50);
  });

  it('hard fails count items hit by at least one override rule', () => {
    const bottle = item('bottle', 1, { l: 5, m: 5, t: 2 }, { materialFamily: 'plastic' }); // override
    const battery = item('battery', 1, { t: 5 }, { materialFamily: 'electronic' }); // override
    const ok = item('ok', 1, all(2)); // no override
    expect(hardFailCount([bottle, battery, ok])).toBe(2);
    // A low-SI item with NO override does not count as a hard fail
    const merelyBad = item('merely bad', 1, all(4));
    expect(hardFailCount([merelyBad])).toBe(0);
  });

  it('picks the lowest-SI item as top offender', () => {
    const bad = item('bad', 1, all(5));
    const meh = item('meh', 1, all(4));
    expect(topOffender([meh, bad])?.label).toBe('bad');
    expect(topOffender([])).toBeNull();
  });

  it('finds the dominant (worst) dimension across the household', () => {
    const items = [item('a', 1, { m: 1, c: 5 }), item('b', 1, { m: 3, c: 4 })];
    expect(dominantDimension(items)).toBe('c');
    expect(dominantDimension([item('x', 1, {})])).toBeNull();
  });

  it('finds the size-and-quantity-weighted dominant material family', () => {
    const items = [
      item('bottles', 6, all(3), { materialFamily: 'plastic', size: 'small' }), // 3
      item('couch', 1, all(2), { materialFamily: 'textile', size: 'large' }), // 2
    ];
    expect(dominantMaterialFamily(items)).toBe('plastic');
    // Without sizes the couch (1) loses to 6 bottles either way; a large
    // metal appliance (weight 2) beats two small plastic cups (weight 1).
    const items2 = [
      item('cups', 2, all(3), { materialFamily: 'plastic', size: 'small' }),
      item('fridge', 1, all(4), { materialFamily: 'metal', size: 'large' }),
    ];
    expect(dominantMaterialFamily(items2)).toBe('metal');
    expect(dominantMaterialFamily([item('x', 1, all(1))])).toBeNull();
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
    expect(normalizeLabel('glass')).toBe('glass');
    expect(normalizeLabel('kiss')).toBe('kiss');
  });

  it('merges duplicates: counts sum, worst ratings win, largest size wins', () => {
    const a: RatedItem = { label: 'PET Bottles', count: 2, ratings: { m: 5, c: 3 }, size: 'small' };
    const b: RatedItem = { label: 'pet bottle', count: 1, ratings: { m: 4 }, size: 'large' };
    const merged = dedupeItems([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('PET Bottles');
    expect(merged[0].count).toBe(3);
    expect(merged[0].ratings.m).toBe(5);
    expect(merged[0].ratings.c).toBe(3);
    expect(merged[0].size).toBe('large');
  });

  it('keeps the first non-null material family when merging', () => {
    const a: RatedItem = { label: 'box', count: 1, ratings: {}, materialFamily: null };
    const b: RatedItem = { label: 'boxes', count: 1, ratings: {}, materialFamily: 'paper' };
    expect(dedupeItems([a, b])[0].materialFamily).toBe('paper');
  });

  it('drops empty labels when deduping', () => {
    expect(dedupeItems([{ label: '   ', count: 1, ratings: {} }])).toHaveLength(0);
  });
});