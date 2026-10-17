import { describe, expect, it } from 'vitest';
import { mean, percentile, summarize, groupBy } from './bench-stats.mjs';

/**
 * The benchmark stats are the arithmetic behind every number in the
 * performance report, so they get their own coverage: an off-by-one in
 * `percentile` would silently misreport p95 for the whole report.
 */

describe('percentile', () => {
  it('returns the endpoints for p0 and p100', () => {
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 100)).toBe(40);
  });

  it('interpolates between ranks', () => {
    // rank = 0.5 * 3 = 1.5 → halfway between 20 and 30
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
    // rank = 0.95 * 3 = 2.85 → 30 + 0.85 * (40 - 30)
    expect(percentile([10, 20, 30, 40], 95)).toBeCloseTo(38.5, 6);
  });

  it('handles a single sample and an empty sample', () => {
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBe(0);
  });
});

describe('summarize', () => {
  it('reports count/min/max/mean/percentiles', () => {
    const s = summarize([1, 2, 3, 4]);
    expect(s.count).toBe(4);
    expect(s.min).toBe(1);
    expect(s.max).toBe(4);
    expect(s.mean).toBe(2.5);
    expect(s.p50).toBe(2.5);
    expect(s.sum).toBe(10);
  });

  it('drops non-finite values and returns a zero summary when empty', () => {
    const s = summarize([1, Number.NaN, 3, Number.POSITIVE_INFINITY]);
    expect(s.count).toBe(2);
    expect(s.mean).toBe(2);
    expect(summarize([])).toEqual({
      count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0, sum: 0,
    });
  });
});

describe('mean / groupBy', () => {
  it('averages finite values only', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it('buckets items by key, preserving order', () => {
    const groups = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? 'even' : 'odd'));
    expect(groups.get('odd')).toEqual([1, 3, 5]);
    expect(groups.get('even')).toEqual([2, 4]);
  });
});
