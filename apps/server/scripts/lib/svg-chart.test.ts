import { describe, expect, it } from 'vitest';
import {
  fmtNumber,
  groupedBarChart,
  lineChart,
  niceTicks,
  seriesColor,
  stackedBarChart,
} from './svg-chart.mjs';

/**
 * The charts are committed artifacts, so the guarantees that matter are:
 * deterministic output (regenerable + diffable), one mark per datum, and
 * labels escaped. A malformed SVG would silently render as nothing on GitHub.
 */

const countOf = (svg: string, needle: string) => svg.split(needle).length - 1;

describe('niceTicks', () => {
  it('covers the max with round steps', () => {
    const ticks = niceTicks(97);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(97);
    expect(ticks[1] - ticks[0]).toBe(ticks[2] - ticks[1]);
  });

  it('falls back to 0..1 for a zero or invalid max', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });
});

describe('fmtNumber', () => {
  it('compacts large values and keeps small ones readable', () => {
    expect(fmtNumber(0)).toBe('0');
    expect(fmtNumber(0.5)).toBe('0.5');
    expect(fmtNumber(12.345)).toBe('12.35');
    expect(fmtNumber(1234)).toBe('1234');
    expect(fmtNumber(12_345)).toBe('12.3k');
    expect(fmtNumber(2_500_000)).toBe('2.5M');
  });
});

describe('seriesColor', () => {
  it('wraps around the palette', () => {
    expect(seriesColor(0)).toBe(seriesColor(6));
    expect(seriesColor(0)).not.toBe(seriesColor(1));
  });
});

describe('chart output', () => {
  const series = [
    { name: 'p50', values: [10, 20] },
    { name: 'p95', values: [30, 40] },
  ];
  const categories = ['alpha', 'beta'];

  it('emits a well-formed svg with one mark per datum', () => {
    const svg = groupedBarChart({ title: 'T', categories, series });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(countOf(svg, '<title>')).toBe(4); // 2 categories × 2 series
    expect(svg).toContain('>alpha<');
    expect(svg).toContain('>beta<');
  });

  it('is deterministic for the same input', () => {
    expect(groupedBarChart({ title: 'T', categories, series })).toBe(
      groupedBarChart({ title: 'T', categories, series })
    );
  });

  it('escapes labels so a stray angle bracket cannot break the document', () => {
    const svg = groupedBarChart({
      title: '<script>',
      categories: ['a & b'],
      series: [{ name: 'x<y', values: [1] }],
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('a &amp; b');
  });

  it('renders lines and stacked bars', () => {
    const line = lineChart({ title: 'L', xValues: [1, 2, 3], series: [{ name: 's', values: [1, 2, 3] }] });
    expect(countOf(line, '<circle')).toBe(3);
    expect(line).toContain('<polyline');

    const stacked = stackedBarChart({ title: 'S', categories, series });
    expect(countOf(stacked, '<title>')).toBe(4);
  });

  it('survives empty series without throwing', () => {
    expect(() => groupedBarChart({ title: 'E', categories: [], series: [] })).not.toThrow();
    expect(() => lineChart({ title: 'E', xValues: [], series: [] })).not.toThrow();
  });
});
