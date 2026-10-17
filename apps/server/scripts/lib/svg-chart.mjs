// ---------------------------------------------------------------------------
// Dependency-free SVG chart primitives for the ECOCIDE performance report.
//
// Why hand-rolled: the repo ships no chart library, and mermaid's xychart-beta
// cannot express percentile groupings (p50/p95/p99 per series) — which is the
// point of a latency chart. These primitives emit a standalone static SVG that
// GitHub renders inline, with no runtime, no chart lib and no headless browser.
//
// Every chart is deterministic: same numbers in, byte-identical SVG out, so a
// committed chart can be regenerated and diffed.
// ---------------------------------------------------------------------------

/** Series palette — readable on the light card the charts draw for themselves. */
const PALETTE = ['#15803d', '#b45309', '#1d4ed8', '#b91c1c', '#7c3aed', '#0f766e'];

/** Colour for series index `i` (wraps, negatives safe). */
export function seriesColor(i) {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const INK = '#0f172a';
const MUTED = '#64748b';
const GRID = '#e2e8f0';
const AXIS = '#cbd5e1';
const CARD = '#f8fafc';

/** Round to 2dp for compact, stable SVG coordinates. */
function r(n) {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Default number formatter (compact, unit-free). */
export function fmtNumber(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1) return String(Number(v.toFixed(3)));
  if (a < 100) return String(Number(v.toFixed(2)));
  if (a < 10000) return String(Math.round(v));
  if (a < 1e6) return `${(v / 1e3).toFixed(1)}k`;
  return `${(v / 1e6).toFixed(1)}M`;
}

/** "Nice" axis ticks from 0 to at least `max`, roughly `count` steps. */
export function niceTicks(max, count = 5) {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  // Step until the last tick is at or above the max — never below it, or the
  // tallest bar would overflow the plot.
  const steps = Math.ceil(max / step);
  const ticks = [];
  for (let i = 0; i <= steps; i++) ticks.push(Number((i * step).toFixed(10)));
  if (ticks.length < 2) ticks.push(Number(step.toFixed(10)));
  return ticks;
}

const PAD = { top: 84, right: 22, bottom: 76, left: 86 };

function openSvg(width, height) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" font-family="${FONT}">`
  );
}

function wrap(width, height, parts) {
  return `${openSvg(width, height)}${parts.join('')}</svg>\n`;
}

/** Chart card + title + y-gridlines + axis lines. Returns SVG fragments. */
function frame({ width, height, pad, plotW, plotH, title, yTicks, yMax, format, yLabel, note }) {
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${CARD}"/>`);
  parts.push(
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${GRID}"/>`
  );
  parts.push(
    `<text x="${pad.left}" y="27" font-size="15" font-weight="700" fill="${INK}">${esc(title)}</text>`
  );

  const yOf = (v) => pad.top + plotH - (v / yMax) * plotH;

  for (const tick of yTicks) {
    const y = yOf(tick);
    parts.push(
      `<line x1="${pad.left}" y1="${r(y)}" x2="${pad.left + plotW}" y2="${r(y)}" stroke="${GRID}"/>`
    );
    parts.push(
      `<text x="${pad.left - 10}" y="${r(y + 4)}" font-size="11" fill="${MUTED}" text-anchor="end">` +
        `${esc(format(tick))}</text>`
    );
  }

  // Axes.
  parts.push(
    `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="${AXIS}"/>`
  );
  parts.push(
    `<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="${AXIS}"/>`
  );

  if (yLabel) {
    const cy = pad.top + plotH / 2;
    parts.push(
      `<text x="16" y="${r(cy)}" font-size="11" fill="${MUTED}" text-anchor="middle" ` +
        `transform="rotate(-90 16 ${r(cy)})">${esc(yLabel)}</text>`
    );
  }
  if (note) {
    parts.push(
      `<text x="${width / 2}" y="${height - 12}" font-size="10.5" fill="${MUTED}" text-anchor="middle">` +
        `${esc(note)}</text>`
    );
  }
  return { parts, yOf };
}

function legend(series, x, y, maxX) {
  const parts = [];
  let cx = x;
  let cy = y;
  series.forEach((s, i) => {
    const itemWidth = 16 + String(s.name).length * 7.1 + 22;
    // Wrap to a second line rather than running off the card.
    if (cx > x && cx + itemWidth > maxX) {
      cx = x;
      cy += 18;
    }
    parts.push(
      `<rect x="${r(cx)}" y="${r(cy - 9)}" width="11" height="11" rx="2" fill="${s.color || seriesColor(i)}"/>`
    );
    parts.push(
      `<text x="${r(cx + 16)}" y="${r(cy)}" font-size="11.5" fill="${INK}">${esc(s.name)}</text>`
    );
    cx += itemWidth;
  });
  return parts.join('');
}

/** Long category names would overrun the plot when rotated, so shorten them. */
function truncate(text, max = 22) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function xTickLabel(cx, y, text, rotate) {
  const label = truncate(text);
  if (rotate) {
    return (
      `<text x="${r(cx)}" y="${r(y)}" font-size="11" fill="${MUTED}" text-anchor="end" ` +
      `transform="rotate(-26 ${r(cx)} ${r(y)})">${esc(label)}</text>`
    );
  }
  return `<text x="${r(cx)}" y="${r(y)}" font-size="11" fill="${MUTED}" text-anchor="middle">${esc(label)}</text>`;
}

/**
 * Grouped bar chart: one group per category, one bar per series.
 *
 * @param {{title: string, categories: string[], series: {name: string, values: number[], color?: string}[], format?: (n: number) => string, yLabel?: string, note?: string, rotateX?: boolean, width?: number, height?: number}} opts
 */
export function groupedBarChart(opts) {
  const {
    title,
    categories,
    series,
    format = fmtNumber,
    yLabel = '',
    note = '',
    rotateX = false,
    width = 760,
    height = 380,
  } = opts;
  const pad = rotateX ? { ...PAD, bottom: 104 } : PAD;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const yTicks = niceTicks(max);
  const yMax = yTicks[yTicks.length - 1] || 1;

  const { parts, yOf } = frame({
    width, height, pad, plotW, plotH, title, yTicks, yMax, format, yLabel, note,
  });

  const groupW = plotW / Math.max(1, categories.length);
  const barsW = groupW * 0.72;
  const gap = 3;
  const barW = Math.max(2, (barsW - gap * (series.length - 1)) / series.length);

  categories.forEach((cat, ci) => {
    const gx = pad.left + groupW * ci + (groupW - barsW) / 2;
    series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const y = yOf(v);
      const h = Math.max(0, pad.top + plotH - y);
      const x = gx + si * (barW + gap);
      parts.push(
        `<rect x="${r(x)}" y="${r(y)}" width="${r(barW)}" height="${r(h)}" rx="2" ` +
          `fill="${s.color || seriesColor(si)}"><title>${esc(`${cat} · ${s.name}: ${format(v)}`)}</title></rect>`
      );
    });
    parts.push(xTickLabel(pad.left + groupW * ci + groupW / 2, pad.top + plotH + 18, cat, rotateX));
  });

  parts.push(legend(series, pad.left, 50, width - pad.right));
  return wrap(width, height, parts);
}

/**
 * Line chart over evenly spaced x values, one polyline per series.
 *
 * @param {{title: string, xValues: (string|number)[], series: {name: string, values: number[], color?: string}[], format?: (n: number) => string, yLabel?: string, xLabel?: string, note?: string, width?: number, height?: number}} opts
 */
export function lineChart(opts) {
  const {
    title,
    xValues,
    series,
    format = fmtNumber,
    yLabel = '',
    xLabel = '',
    note = '',
    width = 760,
    height = 380,
  } = opts;
  const pad = PAD;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const yTicks = niceTicks(max);
  const yMax = yTicks[yTicks.length - 1] || 1;

  const { parts, yOf } = frame({
    width, height, pad, plotW, plotH, title, yTicks, yMax, format, yLabel, note,
  });

  const n = Math.max(1, xValues.length - 1);
  const xOf = (i) => pad.left + (plotW * i) / n;

  xValues.forEach((xv, i) => {
    parts.push(xTickLabel(xOf(i), pad.top + plotH + 18, String(xv), false));
  });
  if (xLabel) {
    parts.push(
      `<text x="${r(pad.left + plotW / 2)}" y="${height - 30}" font-size="11" fill="${MUTED}" text-anchor="middle">${esc(xLabel)}</text>`
    );
  }

  series.forEach((s, si) => {
    const color = s.color || seriesColor(si);
    const pts = s.values.map((v, i) => `${r(xOf(i))},${r(yOf(v))}`).join(' ');
    parts.push(
      `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`
    );
    s.values.forEach((v, i) => {
      parts.push(
        `<circle cx="${r(xOf(i))}" cy="${r(yOf(v))}" r="3.6" fill="${color}">` +
          `<title>${esc(`${s.name} @ ${xValues[i]}: ${format(v)}`)}</title></circle>`
      );
    });
  });

  parts.push(legend(series, pad.left, 50, width - pad.right));
  return wrap(width, height, parts);
}

/**
 * Stacked bar chart: one bar per category, segments stacked per series.
 *
 * @param {{title: string, categories: string[], series: {name: string, values: number[], color?: string}[], format?: (n: number) => string, yLabel?: string, note?: string, rotateX?: boolean, width?: number, height?: number}} opts
 */
export function stackedBarChart(opts) {
  const {
    title,
    categories,
    series,
    format = fmtNumber,
    yLabel = '',
    note = '',
    rotateX = false,
    width = 760,
    height = 380,
  } = opts;
  const pad = rotateX ? { ...PAD, bottom: 104 } : PAD;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const totals = categories.map((_, ci) =>
    series.reduce((sum, s) => sum + (s.values[ci] ?? 0), 0)
  );
  const yTicks = niceTicks(Math.max(0, ...totals));
  const yMax = yTicks[yTicks.length - 1] || 1;

  const { parts, yOf } = frame({
    width, height, pad, plotW, plotH, title, yTicks, yMax, format, yLabel, note,
  });

  const groupW = plotW / Math.max(1, categories.length);
  const barW = groupW * 0.52;

  categories.forEach((cat, ci) => {
    const x = pad.left + groupW * ci + (groupW - barW) / 2;
    let acc = 0;
    series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const yTop = yOf(acc + v);
      const yBottom = yOf(acc);
      const h = Math.max(0, yBottom - yTop);
      parts.push(
        `<rect x="${r(x)}" y="${r(yTop)}" width="${r(barW)}" height="${r(h)}" ` +
          `fill="${s.color || seriesColor(si)}"><title>${esc(`${cat} · ${s.name}: ${format(v)}`)}</title></rect>`
      );
      acc += v;
    });
    parts.push(
      `<text x="${r(x + barW / 2)}" y="${r(yOf(acc) - 6)}" font-size="10.5" fill="${INK}" text-anchor="middle">` +
        `${esc(format(acc))}</text>`
    );
    parts.push(xTickLabel(pad.left + groupW * ci + groupW / 2, pad.top + plotH + 18, cat, rotateX));
  });

  parts.push(legend(series, pad.left, 50, width - pad.right));
  return wrap(width, height, parts);
}
