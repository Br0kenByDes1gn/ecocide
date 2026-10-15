#!/usr/bin/env node
/**
 * Convert the source models in `models-src/` (Wavefront OBJ) into the compact
 * wireframe data consumed by apps/web/src/components/AssetWireframe.tsx.
 *
 * Usage: pnpm wireframes [--mode=feature|full] [--min-angle=5] [--models-dir=models-src]
 *
 * Pipeline:
 *   1. parse OBJ vertices + polygon faces (quads and n-gons stay n-gons)
 *   2. weld duplicate vertices (defensive; split-vertex exports are common)
 *   3. faces → unique undirected edges
 *   4. feature mode: keep boundary edges + creases with a fold angle above
 *      --min-angle (drops coplanar panel subdivisions); full mode: keep all
 *   5. center on the bounding-box center, scale to a unit bounding sphere
 *   6. strip unreferenced vertices, reindex, round to 4 decimals
 *   7. emit apps/web/src/lib/asset-wireframes.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const MODELS_DIR = join(root, String(args['models-dir'] ?? 'models-src'));
const OUT_FILE = join(root, 'apps/web/src/lib/asset-wireframes.ts');
const MODE = args.mode === 'full' ? 'full' : 'feature';
const MIN_ANGLE = Number(args['min-angle'] ?? 5);

const round4 = (n) => Math.round(n * 10000) / 10000;

function parseObj(text) {
  const verts = [];
  const faces = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith('f ')) {
      const parts = line.trim().split(/\s+/).slice(1);
      faces.push(parts.map((p) => Number(p.split('/')[0]) - 1));
    }
  }
  return { verts, faces };
}

/** Weld vertices that share (rounded) coordinates so shared corners merge. */
function weld(verts, faces) {
  const lookup = new Map();
  const welded = [];
  const remap = verts.map((v) => {
    const key = v.map((c) => round4(c)).join(',');
    if (!lookup.has(key)) {
      lookup.set(key, welded.length);
      welded.push(v);
    }
    return lookup.get(key);
  });
  return {
    verts: welded,
    faces: faces.map((f) => f.map((i) => remap[i])),
  };
}

/** Newell's method — robust polygon normal for quads and n-gons. */
function faceNormal(verts, face) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < face.length; i++) {
    const a = verts[face[i]];
    const b = verts[face[(i + 1) % face.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function buildEdges(verts, faces) {
  const edges = new Map(); // "a,b" -> [a, b, faceIndices]
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if (a === b) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const entry = edges.get(key);
      if (entry) entry[2].push(fi);
      else edges.set(key, [Math.min(a, b), Math.max(a, b), [fi]]);
    }
  }
  return edges;
}

function convert(name, text) {
  const raw = parseObj(text);
  const { verts, faces } = weld(raw.verts, raw.faces);
  const edges = buildEdges(verts, faces);

  const normals = faces.map((f) => faceNormal(verts, f));
  const kept = [];
  for (const [a, b, fs] of edges.values()) {
    if (MODE === 'full' || fs.length === 1) {
      kept.push([a, b]);
      continue;
    }
    let maxAngle = 0;
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const n1 = normals[fs[i]];
        const n2 = normals[fs[j]];
        const dot = Math.min(1, Math.max(-1, n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]));
        maxAngle = Math.max(maxAngle, (Math.acos(dot) * 180) / Math.PI);
      }
    }
    if (maxAngle >= MIN_ANGLE) kept.push([a, b]);
  }

  // strip unreferenced vertices, reindex
  const used = new Set();
  for (const [a, b] of kept) {
    used.add(a);
    used.add(b);
  }
  const order = [...used].sort((a, b) => a - b);
  const index = new Map(order.map((v, i) => [v, i]));
  const outVerts = order.map((v) => verts[v]);
  const outEdges = kept.map(([a, b]) => [index.get(a), index.get(b)]);

  // center on the bounding-box center, scale to a unit bounding sphere
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of outVerts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
  }
  const center = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  let maxRadius = 0;
  for (const v of outVerts) {
    maxRadius = Math.max(maxRadius, Math.hypot(v[0] - center[0], v[1] - center[1], v[2] - center[2]));
  }
  const scale = maxRadius > 0 ? 1 / maxRadius : 1;
  const finalVerts = outVerts.map((v) =>
    [0, 1, 2].map((i) => round4((v[i] - center[i]) * scale))
  );

  return {
    name,
    verts: finalVerts,
    edges: outEdges,
    stats: {
      rawVerts: raw.verts.length,
      verts: finalVerts.length,
      faces: faces.length,
      rawEdges: edges.size,
      edges: outEdges.length,
    },
  };
}

const files = readdirSync(MODELS_DIR)
  .filter((f) => f.toLowerCase().endsWith('.obj'))
  .sort();
if (files.length === 0) {
  console.error(`No .obj files found in ${MODELS_DIR}`);
  process.exit(1);
}

const models = files.map((file) => convert(file.replace(/\.obj$/i, ''), readFileSync(join(MODELS_DIR, file), 'utf8')));

const fmtVerts = (verts) => verts.map((v) => `      [${v.map(round4).join(', ')}],`).join('\n');
const fmtEdges = (edges) => {
  const chunks = [];
  for (let i = 0; i < edges.length; i += 10) {
    chunks.push(`      ${edges.slice(i, i + 10).map(([a, b]) => `[${a}, ${b}]`).join(', ')},`);
  }
  return chunks.join('\n');
};

const out = `/* AUTO-GENERATED by scripts/wireframes.mjs (pnpm wireframes) — do not edit manually.
 * Source models: models-src/*.obj — mode=${MODE}${MODE === 'feature' ? `, minAngle=${MIN_ANGLE}°` : ''}
 */

export interface WireModel {
  name: string;
  /** Y-up, centered at the origin, unit bounding sphere. */
  verts: [number, number, number][];
  /** Undirected vertex index pairs. */
  edges: [number, number][];
}

export const WIREFRAME_MODELS: WireModel[] = [
${models
  .map(
    (m) => `  {
    name: '${m.name}',
    verts: [
${fmtVerts(m.verts)}
    ],
    edges: [
${fmtEdges(m.edges)}
    ],
  },`
  )
  .join('\n')}
];
`;

writeFileSync(OUT_FILE, out);
console.log(`mode=${MODE}${MODE === 'feature' ? ` minAngle=${MIN_ANGLE}°` : ''} → ${OUT_FILE}`);
for (const m of models) {
  const s = m.stats;
  console.log(
    `  ${m.name.padEnd(18)} verts ${String(s.rawVerts).padStart(4)} → ${String(s.verts).padStart(4)}  edges ${String(s.rawEdges).padStart(4)} → ${String(s.edges).padStart(4)}  (faces ${s.faces})`
  );
}
