// ---------------------------------------------------------------------------
// Invariant tests for the cross-assessment registry roll-up: the pooled
// item-weighted index, the record texture and the newest-audit trend.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  DIMENSION_KEYS,
  householdRatio,
  objectCount,
  pooledIndex,
  registryStanding,
  type ItemRatings,
  type RatedItem,
} from './index.js';

const all = (rating: number): ItemRatings =>
  Object.fromEntries(DIMENSION_KEYS.map((k) => [k, rating])) as ItemRatings;

const item = (
  label: string,
  count: number,
  ratings: ItemRatings,
  extra: Partial<RatedItem> = {}
): RatedItem => ({ label, count, ratings, ...extra });

/** A clean small object (SI 100, weight 0.5) and a filthy large one (SI 0, weight 2). */
const good = item('good', 1, all(1), { size: 'small' });
const bad = item('bad', 1, all(5), { size: 'large' });

describe('registry roll-up (cross-assessment)', () => {
  it('pooled index of one assessment equals its household ratio', () => {
    const items = [good, bad];
    expect(pooledIndex([items])).toBe(householdRatio(items));
    expect(registryStanding([{ createdAt: '2026-01-01T00:00:00.000Z', items }]).index).toBe(20);
  });

  it('weights assessments by their item weight, not one-vote-each', () => {
    // Older audit: one large filthy item (weight 2, SI 0).
    const older = [bad];
    // Newer audit: one small pristine item (weight 0.5, SI 100).
    const newer = [good];

    // Equal-weight average of the two household ratios would be 50; the
    // item-weighted pool is 20 (100×0.5 / 2.5), matching the pool of all items.
    expect(pooledIndex([older, newer])).toBe(20);
    expect(pooledIndex([older, newer])).toBe(householdRatio([...older, ...newer]));
    expect(pooledIndex([newer, older])).toBe(20);
  });

  it('is neutral 50 for an empty record', () => {
    expect(pooledIndex([])).toBe(50);
    const empty = registryStanding([]);
    expect(empty.index).toBe(50);
    expect(empty.assessmentCount).toBe(0);
    expect(empty.baselineIndex).toBeNull();
    expect(empty.delta).toBeNull();
    expect(empty.firstAuditAt).toBeNull();
    expect(empty.lastAuditAt).toBeNull();
  });

  it('reports the record texture across every archived item', () => {
    const bottle = item('bottle', 6, { l: 5, m: 5 }, { materialFamily: 'plastic', size: 'small' });
    const ok = item('chair', 1, all(2), { materialFamily: 'wood', size: 'large' });
    const standing = registryStanding([
      { createdAt: '2026-02-01T00:00:00.000Z', items: [bottle, ok] },
    ]);

    expect(standing.assessmentCount).toBe(1);
    expect(standing.objectCount).toBe(7);
    expect(standing.hardFailCount).toBe(1);
    expect(standing.topOffenderLabel).toBe('bottle');
    expect(standing.dominantMaterialFamily).toBe('plastic'); // 6×0.5 = 3 beats 1×2
    expect(standing.firstAuditAt).toBe('2026-02-01T00:00:00.000Z');
    expect(standing.lastAuditAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('measures the trend as the standing before the newest audit', () => {
    const badRoom = { createdAt: '2026-01-01T00:00:00.000Z', items: [bad] };
    const goodRoom = { createdAt: '2026-03-01T00:00:00.000Z', items: [good] };

    const standing = registryStanding([badRoom, goodRoom]);
    expect(standing.index).toBe(20); // pooled: 100×0.5 / 2.5
    expect(standing.baselineIndex).toBe(0); // the older audit alone
    expect(standing.delta).toBe(20); // the newest audit lifted the record
    expect(standing.lastAuditAt).toBe('2026-03-01T00:00:00.000Z');

    // A single assessment has no baseline to compare against.
    const single = registryStanding([badRoom]);
    expect(single.baselineIndex).toBeNull();
    expect(single.delta).toBeNull();
  });

  it('orders assessments by timestamp, not by input order', () => {
    const older = { createdAt: '2026-01-01T00:00:00.000Z', items: [bad] };
    const newer = { createdAt: '2026-02-01T00:00:00.000Z', items: [good] };

    const standing = registryStanding([newer, older]);
    expect(standing.firstAuditAt).toBe('2026-01-01T00:00:00.000Z');
    expect(standing.lastAuditAt).toBe('2026-02-01T00:00:00.000Z');
    expect(standing.baselineIndex).toBe(0); // older audit only
  });

  it('counts objects without size weighting', () => {
    expect(objectCount([item('x', 4, all(3), { size: 'large' })])).toBe(4);
    expect(objectCount([item('x', 0, all(3)), item('y', 2.9, all(3))])).toBe(3); // sanitized to 1 + 2
    expect(objectCount([])).toBe(0);
  });

  it('is deterministic: same record in, same standing out', () => {
    const record = [
      { createdAt: '2026-01-01T00:00:00.000Z', items: [good, bad] },
      { createdAt: '2026-02-01T00:00:00.000Z', items: [good] },
    ];
    expect(registryStanding(record)).toEqual(registryStanding(record));
  });
});
