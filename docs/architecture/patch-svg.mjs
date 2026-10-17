/**
 * Post-render fix-up for the architecture SVGs.
 *
 * Mermaid writes a multi-word label as adjacent tspans, with the separator
 * space living at the START of the second one:
 *
 *   <tspan>GitHub</tspan><tspan> Actions</tspan>
 *
 * SVG's default whitespace handling (xml:space="default") tells a renderer to
 * strip that leading space, so spec-compliant renderers — librsvg (GNOME image
 * viewers, ImageMagick), Inkscape's SVG import, most PDF converters — draw
 * "GitHubActions". Chrome is lenient and keeps the space, which is why the
 * defect is invisible in a browser and in screenshot-based checks.
 *
 * Marking the text elements xml:space="preserve" makes every renderer agree.
 * Safe here because Mermaid positions each tspan with explicit x/y, and emits
 * no whitespace between adjacent tspans, so nothing can reflow.
 *
 * It also enlarges the arrowheads. Those are <marker> elements sized by
 * markerWidth/markerHeight, which CSS cannot set — and because Mermaid emits
 * markerUnits="userSpaceOnUse", the head does NOT grow when diagram.css thickens
 * the line. So the head is scaled here by editing the attributes, and only the
 * visible markers' stroke-width is raised: the "-margin" markers are invisible
 * hit areas whose inline stroke-width:0 must stay 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Arrowhead scale factor. 1.4 takes the default 8x8 head to ~11x11. */
const ARROW_SCALE = 1.4;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node patch-svg.mjs <file.svg> [file.svg ...]');
  process.exit(1);
}

/** Scale markerWidth/markerHeight on every <marker>, leaving refX/refY alone
 * (those are in viewBox units, so the tip keeps landing on the same point). */
function scaleMarkers(svg) {
  let count = 0;
  const out = svg.replace(/<marker\b[^>]*>/g, (tag) => {
    count += 1;
    return tag.replace(
      /\b(markerWidth|markerHeight)="([\d.]+)"/g,
      (_, attr, value) => `${attr}="${(Number(value) * ARROW_SCALE).toFixed(2)}"`,
    );
  });
  return { svg: out, count };
}

/** Thicken only the visible arrowhead rims (inline stroke-width: 1 -> 2). */
function thickenMarkerRims(svg) {
  return svg.replace(
    /(class="arrowMarkerPath"\s+style="stroke-width:\s*)1(;)/g,
    '$12$2',
  );
}

let failed = false;
for (const file of files) {
  let svg = readFileSync(file, 'utf8');
  svg = svg.replaceAll('<text ', '<text xml:space="preserve" ');
  const markers = scaleMarkers(svg);
  svg = thickenMarkerRims(markers.svg);
  writeFileSync(file, svg);

  const textTags = (svg.match(/<text /g) ?? []).length;
  const foreignObjects = (svg.match(/foreignObject/g) ?? []).length;
  console.log(
    `${file}: ${textTags} text elements marked, ${foreignObjects} foreignObject, ${markers.count} arrowheads scaled`,
  );

  // A foreignObject label is invisible outside a browser, and Mermaid reports a
  // parse failure by emitting a valid SVG containing "Syntax error" — so both
  // are checked here rather than trusted.
  if (svg.includes('Syntax error')) {
    console.error(`  !! ${file} contains a Mermaid syntax error`);
    failed = true;
  }
  if (foreignObjects > 0) {
    console.error(`  !! ${file} still has foreignObject labels (check htmlLabels in mermaid-config.json)`);
    failed = true;
  }
  if (textTags === 0) {
    console.error(`  !! ${file} has no text elements`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
