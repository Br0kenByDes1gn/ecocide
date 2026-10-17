// ---------------------------------------------------------------------------
// Percentile + summary helpers shared by the benchmark runner and the report
// renderer. Kept dependency-free and pure so they are trivially testable.
// ---------------------------------------------------------------------------

/** Linear-interpolated percentile of an ALREADY-SORTED ascending array. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Summarise a sample: count/min/max/mean plus p50/p90/p95/p99.
 * Non-finite values are dropped so a failed request cannot poison the stats.
 */
export function summarize(values, digits = 2) {
  const clean = values
    .filter((v) => Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  if (!clean.length) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0, sum: 0 };
  }
  const sum = clean.reduce((a, b) => a + b, 0);
  const round = (n) => Number(n.toFixed(digits));
  return {
    count: clean.length,
    min: round(clean[0]),
    max: round(clean[clean.length - 1]),
    mean: round(sum / clean.length),
    p50: round(percentile(clean, 50)),
    p90: round(percentile(clean, 90)),
    p95: round(percentile(clean, 95)),
    p99: round(percentile(clean, 99)),
    sum: round(sum),
  };
}

/** Arithmetic mean of a numeric list (0 for an empty list). */
export function mean(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/** Group `items` by the key returned by `keyOf`. */
export function groupBy(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
