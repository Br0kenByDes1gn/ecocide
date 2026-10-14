import { FaceLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark3D } from './face-geometry';

export type PolygonPortraitStyle =
  | 'faceted-poly'
  | 'surveillance-wireframe'
  | 'neon-hologram'
  | 'thermal-scan';

export interface PolygonStyleOption {
  id: PolygonPortraitStyle;
  label: string;
  subtitle: string;
  description: string;
}

export const POLYGON_PORTRAIT_STYLES: readonly PolygonStyleOption[] = [
  {
    id: 'faceted-poly',
    label: 'INSPECTION HUD',
    subtitle: 'CRT TELEMETRY WASH',
    description: 'Cold CRT wash with status-colored bounding facets and telemetry',
  },
  {
    id: 'surveillance-wireframe',
    label: 'EVIDENCE PHOTO',
    subtitle: 'CASE-FILE SNAPSHOT',
    description: 'Warm evidence grade with inspection tags and audit telemetry',
  },
  {
    id: 'neon-hologram',
    label: 'NEON OUTLINE',
    subtitle: 'TOXIC LIME AUDIT MESH',
    description: 'Darkened void with glowing Toxic Lime (#b4ff39) inspection contours',
  },
  {
    id: 'thermal-scan',
    label: 'CARBON HEAT MAP',
    subtitle: '5-STOP IMPACT MAP',
    description: 'False-color environmental harm gradient from negligible to severe',
  },
] as const;

// Cached 852 triangles grouped from FaceLandmarker.FACE_LANDMARKS_TESSELATION
let cachedTriangles: readonly [number, number, number][] | null = null;

/**
 * Extracts and caches the 852 triangles from FaceLandmarker.FACE_LANDMARKS_TESSELATION.
 * Each triangle consists of [index0, index1, index2].
 */
export function getFaceTriangles(): readonly [number, number, number][] {
  if (cachedTriangles) return cachedTriangles;

  const tess = FaceLandmarker?.FACE_LANDMARKS_TESSELATION || [];
  const triangles: [number, number, number][] = [];

  for (let i = 0; i < tess.length; i += 3) {
    const e1 = tess[i];
    const e2 = tess[i + 1];
    const e3 = tess[i + 2];
    if (e1 && e2 && e3) {
      triangles.push([e1.start, e2.start, e3.start]);
    }
  }

  cachedTriangles = triangles;
  return cachedTriangles;
}

/**
 * Calculates a 3D unit normal vector for a triangle using cross-product.
 */
export function calculateTriangleNormal(
  p0: Landmark3D,
  p1: Landmark3D,
  p2: Landmark3D,
  depthScale: number = 3.5
): { nx: number; ny: number; nz: number } {
  const ux = p1.x - p0.x;
  const uy = p1.y - p0.y;
  const uz = ((p1.z ?? 0) - (p0.z ?? 0)) * depthScale;

  const vx = p2.x - p0.x;
  const vy = p2.y - p0.y;
  const vz = ((p2.z ?? 0) - (p0.z ?? 0)) * depthScale;

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  const len = Math.hypot(nx, ny, nz) || 1;
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

/**
 * Maps a normalized scalar t (0..1) to the Carbon Heat Map 5-stop gradient
 * (art_directions.md §9.4): negligible -> low -> moderate -> high -> severe.
 */
export function getThermalColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // 5 stops (§9.4):
  // 0.00: [5, 46, 22]    (#052e16 deep green-black / negligible)
  // 0.25: [34, 197, 94]  (#22c55e green / low)
  // 0.50: [250, 204, 21] (#facc15 yellow / moderate)
  // 0.75: [249, 115, 22] (#f97316 orange / high)
  // 1.00: [255, 0, 85]   (#ff0055 crimson / severe)
  let r = 0, g = 0, b = 0;

  if (clamped < 0.25) {
    const s = clamped / 0.25;
    r = Math.round(5 + (34 - 5) * s);
    g = Math.round(46 + (197 - 46) * s);
    b = Math.round(22 + (94 - 22) * s);
  } else if (clamped < 0.5) {
    const s = (clamped - 0.25) / 0.25;
    r = Math.round(34 + (250 - 34) * s);
    g = Math.round(197 + (204 - 197) * s);
    b = Math.round(94 + (21 - 94) * s);
  } else if (clamped < 0.75) {
    const s = (clamped - 0.5) / 0.25;
    r = Math.round(250 + (249 - 250) * s);
    g = Math.round(204 + (115 - 204) * s);
    b = Math.round(21 + (22 - 21) * s);
  } else {
    const s = (clamped - 0.75) / 0.25;
    r = Math.round(249 + (255 - 249) * s);
    g = Math.round(115 + (0 - 115) * s);
    b = Math.round(22 + (85 - 22) * s);
  }

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Directional diffuse lighting vector pointing toward subject from top-front-left.
 */
const LIGHT_DIR = (() => {
  const lx = -0.35, ly = -0.55, lz = 0.75;
  const l = Math.hypot(lx, ly, lz);
  return { x: lx / l, y: ly / l, z: lz / l };
})();

/**
 * Draws a futuristic cyberpunk background grid with subtle vignettes.
 */
function drawCyberGrid(ctx: CanvasRenderingContext2D, w: number, h: number, tintColor: string = '#b4ff39') {
  // Dark void fill
  ctx.fillStyle = '#070a08';
  ctx.fillRect(0, 0, w, h);

  // Radial backlight gradient behind head
  const radGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
  radGrad.addColorStop(0, 'rgba(12, 26, 20, 0.65)');
  radGrad.addColorStop(1, 'rgba(7, 10, 8, 0.95)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle isometric or orthogonal grid
  ctx.save();
  ctx.strokeStyle = tintColor;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.08;
  const step = 32;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws subtle CRT scanlines across the canvas.
 */
function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number = 0.22) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.globalAlpha = alpha;
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1.8);
  }
  ctx.restore();
}

/**
 * Draws high-tech corner surveillance targeting reticles.
 */
function drawSurveillanceHUD(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  casteColor: string,
  styleLabel: string
) {
  ctx.save();
  ctx.strokeStyle = casteColor;
  ctx.fillStyle = casteColor;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.65;

  const bracket = 24;
  const pad = 16;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(pad, pad + bracket);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + bracket, pad);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - pad - bracket, pad);
  ctx.lineTo(w - pad, pad);
  ctx.lineTo(w - pad, pad + bracket);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(pad, h - pad - bracket);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(pad + bracket, h - pad);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - pad - bracket, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(w - pad, h - pad - bracket);
  ctx.stroke();

  // Header telemetry stamps
  ctx.font = '9px monospace';
  ctx.fillText(`BIOMETRIC PROTOCOL // ${styleLabel}`, pad + 4, pad + 12);
  ctx.fillText('MESH: 852 POLYS // 478 NODES', pad + 4, h - pad - 6);

  // Targeting center crosshair markings
  const cx = w / 2;
  const cy = h / 2;
  ctx.globalAlpha = 0.25;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy + 20);
  ctx.stroke();

  ctx.restore();
}

export interface CenteredLandmarkTransform {
  transformedPoints: Array<{ x: number; y: number; z: number }>;
  faceBounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  center: { x: number; y: number };
  scale: number;
}

/**
 * Normalizes, centers, and scales facial landmarks to fill the target canvas frame.
 * @param landmarks Raw 3D landmarks in normalized coordinate space [0..1]
 * @param width Target canvas width in pixels
 * @param height Target canvas height in pixels
 * @param targetCoverage Fractional dimension of the frame the face should fill (e.g. 0.90 = 90%)
 */
export function transformLandmarksToFitFrame(
  landmarks: Landmark3D[],
  width: number,
  height: number,
  targetCoverage: number = 0.90
): CenteredLandmarkTransform {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of landmarks) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Gracefully handle empty or degenerate landmarks
  if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX || minY >= maxY) {
    minX = 0;
    maxX = 1;
    minY = 0;
    maxY = 1;
  }

  const faceW = Math.max(0.001, maxX - minX);
  const faceH = Math.max(0.001, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Scale so the largest face dimension fills targetCoverage of canvas
  const targetSize = Math.min(width, height) * targetCoverage;
  const scale = targetSize / Math.max(faceW, faceH);

  const transformedPoints = landmarks.map((pt) => ({
    x: width / 2 + (pt.x - centerX) * scale,
    y: height / 2 + (pt.y - centerY) * scale,
    z: pt.z ?? 0,
  }));

  return {
    transformedPoints,
    faceBounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: faceW,
      height: faceH,
    },
    center: { x: centerX, y: centerY },
    scale,
  };
}

/** A 2D "projector spot" highlight region in canvas pixel space. */
export interface FaceSpot {
  x: number;
  y: number;
  radius: number;
}

export interface DrawFaceFrameOptions {
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
  landmarks: Landmark3D[];
  style: PolygonPortraitStyle;
  casteColor: string;
  /** Moving projector-spot highlight; null/undefined = static render (identical to legacy output). */
  spot?: FaceSpot | null;
}

/**
 * Centroid of a transformed triangle (midpoint of its three vertices).
 */
export function triangleCentroid(
  t0: { x: number; y: number },
  t1: { x: number; y: number },
  t2: { x: number; y: number }
): { x: number; y: number } {
  return { x: (t0.x + t1.x + t2.x) / 3, y: (t0.y + t1.y + t2.y) / 3 };
}

/**
 * Gaussian falloff: 1 at the spot center, decaying with distance (~0.6 at 1r,
 * ~0.14 at 2r, ~0.01 at 3r). Returns 0 when no spot is provided.
 */
export function getSpotIntensity(x: number, y: number, spot: FaceSpot | null | undefined): number {
  if (!spot) return 0;
  const dx = x - spot.x;
  const dy = y - spot.y;
  const r = Math.max(0.001, spot.radius);
  return Math.max(0, Math.min(1, Math.exp(-(dx * dx + dy * dy) / (2 * r * r))));
}

/**
 * Computes the wandering searchlight spot position/radius for a given time.
 * Drifts on a slow Lissajous path within the face region; the spot is a small
 * "projector" highlight (~17% of the face's largest dimension).
 */
export function getFaceSpotPosition(
  timeMs: number,
  transform: CenteredLandmarkTransform,
  width: number,
  height: number
): FaceSpot {
  const { faceBounds, scale } = transform;
  const faceW = Math.max(0.001, faceBounds.width * scale);
  const faceH = Math.max(0.001, faceBounds.height * scale);
  const t = Math.max(0, timeMs) / 1000;

  // Wander within roughly half of each half-dimension so the spot stays on the face
  const ampX = (faceW / 2) * 0.5;
  const ampY = (faceH / 2) * 0.5;

  return {
    x: width / 2 + ampX * Math.sin(t * 0.9 + 0.6),
    y: height / 2 + ampY * Math.sin(t * 1.27),
    radius: Math.max(faceW, faceH) * 0.17,
  };
}

/**
 * Soft additive radial light pool under the spot, selling the "projector" feel.
 */
export function drawSpotPool(ctx: CanvasRenderingContext2D, spot: FaceSpot, color: string, alpha: number = 0.14) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  const extent = spot.radius * 2.4;
  const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, extent);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(spot.x - extent, spot.y - extent, extent * 2, extent * 2);
  ctx.restore();
}

/**
 * Renders a single frame of a stylized polygon face portrait.
 *
 * When `spot` is provided, polygons beneath the moving projector spot get a
 * subtle brightness/alpha lift; otherwise this is exactly the legacy render.
 */
export function drawFaceFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: DrawFaceFrameOptions
): void {
  const { source, landmarks, style, casteColor, spot } = opts;
  if (!landmarks || landmarks.length === 0) return;

  const w = width;
  const h = height;

  // Prepare source image sampling canvas (only styles that sample colors use this)
  let imgData: ImageData | null = null;
  if (source) {
    try {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (srcCtx) {
        srcCtx.drawImage(source, 0, 0, w, h);
        imgData = srcCtx.getImageData(0, 0, w, h);
      }
    } catch {
      imgData = null;
    }
  }

  const triangles = getFaceTriangles();

  // Min / Max depth bounds for normalizing
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const pt of landmarks) {
    const z = pt.z ?? 0;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const zRange = Math.max(0.001, maxZ - minZ);

  // Center and scale landmarks to fill frame (90% coverage)
  const { transformedPoints, center, scale } = transformLandmarksToFitFrame(landmarks, w, h, 0.90);

  if (style === 'faceted-poly') {
    // ==========================================
    // STYLE 1: 3D LOW-POLY FACETED ORIGAMI FACE
    // ==========================================
    drawCyberGrid(ctx, w, h, casteColor);

    // Render 852 3D color-sampled, shaded facets
    for (const [i0, i1, i2] of triangles) {
      const p0 = landmarks[i0];
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      const t0 = transformedPoints[i0];
      const t1 = transformedPoints[i1];
      const t2 = transformedPoints[i2];
      if (!p0 || !p1 || !p2 || !t0 || !t1 || !t2) continue;

      const x0 = t0.x, y0 = t0.y;
      const x1 = t1.x, y1 = t1.y;
      const x2 = t2.x, y2 = t2.y;

      // Sample color from real photo using original normalized coordinates
      const origCx = Math.max(0, Math.min(w - 1, Math.round(((p0.x + p1.x + p2.x) / 3) * w)));
      const origCy = Math.max(0, Math.min(h - 1, Math.round(((p0.y + p1.y + p2.y) / 3) * h)));

      let r = 160, g = 170, b = 185;
      if (imgData) {
        const pIdx = (origCy * w + origCx) * 4;
        r = imgData.data[pIdx] ?? 160;
        g = imgData.data[pIdx + 1] ?? 170;
        b = imgData.data[pIdx + 2] ?? 185;
      }

      // Compute 3D surface normal & diffuse lighting using original 3D geometry
      const norm = calculateTriangleNormal(p0, p1, p2, 4.0);
      const diffuse = Math.max(0, norm.nx * LIGHT_DIR.x + norm.ny * LIGHT_DIR.y + norm.nz * LIGHT_DIR.z);

      // Subtle projector-spot brightness lift
      const centroid = triangleCentroid(t0, t1, t2);
      const intensity = getSpotIntensity(centroid.x, centroid.y, spot);
      const brightness = (0.52 + 0.48 * diffuse) * (1 + 0.3 * intensity);

      const finalR = Math.min(255, Math.round(r * brightness));
      const finalG = Math.min(255, Math.round(g * brightness));
      const finalB = Math.min(255, Math.round(b * brightness));

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();

      // Fill facet
      ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
      ctx.fill();

      // Delicate neon seam edge
      ctx.strokeStyle = casteColor;
      ctx.globalAlpha = 0.22 + 0.2 * intensity;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    if (spot) drawSpotPool(ctx, spot, casteColor, 0.12);
    drawScanlines(ctx, w, h, 0.16);
    drawSurveillanceHUD(ctx, w, h, casteColor, 'FACETED 3D');
  } else if (style === 'surveillance-wireframe') {
    // ====================================================
    // STYLE 2: SURVEILLANCE PHOTO + GLOWING WIREFRAME HUD
    // ====================================================
    // 1. Draw source photo scaled and centered to align with the centered wireframe
    if (source) {
      ctx.save();
      ctx.translate(w / 2 - center.x * scale, h / 2 - center.y * scale);
      ctx.drawImage(source, 0, 0, scale, scale);
      ctx.restore();
    } else {
      drawCyberGrid(ctx, w, h, casteColor);
    }

    // Apply CRT surveillance grade
    ctx.fillStyle = 'rgba(8, 16, 12, 0.35)';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw 852 glowing neon polygon wireframe lines; edges under the spot glow brighter
    ctx.save();
    ctx.strokeStyle = casteColor;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = 0.42;
    ctx.shadowColor = casteColor;
    ctx.shadowBlur = 3;

    // Batch unlit edges once for performance, then re-stroke lit edges on top
    ctx.beginPath();
    const litEdges: Array<{ i0: number; i1: number; i2: number; intensity: number }> = [];
    for (const [i0, i1, i2] of triangles) {
      const t0 = transformedPoints[i0];
      const t1 = transformedPoints[i1];
      const t2 = transformedPoints[i2];
      if (!t0 || !t1 || !t2) continue;

      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.closePath();

      const intensity = getSpotIntensity((t0.x + t1.x + t2.x) / 3, (t0.y + t1.y + t2.y) / 3, spot);
      if (intensity > 0.15) litEdges.push({ i0, i1, i2, intensity });
    }
    ctx.stroke();

    if (litEdges.length > 0) {
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (const { i0, i1, i2 } of litEdges) {
        const t0 = transformedPoints[i0];
        const t1 = transformedPoints[i1];
        const t2 = transformedPoints[i2];
        ctx.moveTo(t0.x, t0.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.restore();

    // 3. Highlight key biometric anchor nodes (eyes, nose, jawline), brighter under the spot
    ctx.save();
    ctx.fillStyle = casteColor;
    ctx.shadowColor = casteColor;
    ctx.shadowBlur = 5;
    for (let i = 0; i < transformedPoints.length; i += 6) {
      const pt = transformedPoints[i];
      const intensity = getSpotIntensity(pt.x, pt.y, spot);
      ctx.globalAlpha = 0.55 + 0.45 * intensity;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.4 + 1.4 * intensity, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();

    if (spot) drawSpotPool(ctx, spot, casteColor, 0.1);
    drawScanlines(ctx, w, h, 0.28);
    drawSurveillanceHUD(ctx, w, h, casteColor, 'SURVEILLANCE HUD');
  } else if (style === 'neon-hologram') {
    // =====================================================
    // STYLE 3: 100% PURE VECTOR NEON 3D WIREFRAME HOLOGRAM
    // =====================================================
    drawCyberGrid(ctx, w, h, casteColor);

    // Render depth-shaded polygon facets
    for (const [i0, i1, i2] of triangles) {
      const p0 = landmarks[i0];
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      const t0 = transformedPoints[i0];
      const t1 = transformedPoints[i1];
      const t2 = transformedPoints[i2];
      if (!p0 || !p1 || !p2 || !t0 || !t1 || !t2) continue;

      const avgZ = ((p0.z ?? 0) + (p1.z ?? 0) + (p2.z ?? 0)) / 3;
      const depthFactor = 1 - Math.max(0, Math.min(1, (avgZ - minZ) / zRange));
      // Subtle projector-spot alpha lift
      const centroid = triangleCentroid(t0, t1, t2);
      const intensity = getSpotIntensity(centroid.x, centroid.y, spot);
      const facetAlpha = Math.min(1, 0.08 + depthFactor * 0.38 + 0.2 * intensity);
      const edgeAlpha = Math.min(1, 0.35 + depthFactor * 0.55 + 0.25 * intensity);

      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.closePath();

      // Semi-transparent neon facet
      ctx.fillStyle = casteColor;
      ctx.globalAlpha = facetAlpha;
      ctx.fill();

      // Luminous neon vector edge
      ctx.strokeStyle = casteColor;
      ctx.globalAlpha = edgeAlpha;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Highlight contour outline with bright laser vector
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < transformedPoints.length; i += 12) {
      const pt = transformedPoints[i];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.8, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();

    if (spot) drawSpotPool(ctx, spot, casteColor, 0.14);
    drawScanlines(ctx, w, h, 0.18);
    drawSurveillanceHUD(ctx, w, h, casteColor, 'NEON HOLOGRAM');
  } else if (style === 'thermal-scan') {
    // ===========================================
    // STYLE 4: THERMAL FLIR BIOMETRIC HEATMAP
    // ===========================================
    // Dark thermal chamber background
    ctx.fillStyle = '#0b0a06';
    ctx.fillRect(0, 0, w, h);

    // Thermal facets
    for (const [i0, i1, i2] of triangles) {
      const p0 = landmarks[i0];
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      const t0 = transformedPoints[i0];
      const t1 = transformedPoints[i1];
      const t2 = transformedPoints[i2];
      if (!p0 || !p1 || !p2 || !t0 || !t1 || !t2) continue;

      const avgZ = ((p0.z ?? 0) + (p1.z ?? 0) + (p2.z ?? 0)) / 3;
      const depthFactor = 1 - Math.max(0, Math.min(1, (avgZ - minZ) / zRange));
      // The projector spot reads as a hot sensor patch (pushed toward white-hot)
      const centroid = triangleCentroid(t0, t1, t2);
      const intensity = getSpotIntensity(centroid.x, centroid.y, spot);
      const thermalT = Math.min(1, depthFactor + (1 - depthFactor) * 0.3 * intensity);
      const thermalColor = getThermalColor(thermalT);

      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.closePath();

      ctx.fillStyle = thermalColor;
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    if (spot) drawSpotPool(ctx, spot, '#ffb703', 0.16);

    // Thermal scale legend bar on side
    const barX = w - 24;
    const barY = 48;
    const barH = 140;
    const barW = 10;
    const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    grad.addColorStop(0, '#ff0055');
    grad.addColorStop(0.25, '#f97316');
    grad.addColorStop(0.5, '#facc15');
    grad.addColorStop(0.75, '#22c55e');
    grad.addColorStop(1, '#052e16');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#7c8b7e';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#ff0055';
    ctx.fillText('SEVERE', barX - 34, barY + 8);
    ctx.fillStyle = '#facc15';
    ctx.fillText('MODERATE', barX - 46, barY + barH / 2);
    ctx.fillStyle = '#22c55e';
    ctx.fillText('LOW IMPACT', barX - 48, barY + barH);

    drawScanlines(ctx, w, h, 0.2);
    drawSurveillanceHUD(ctx, w, h, '#ffb703', 'CARBON HEAT MAP');
  }
}

/**
 * Core engine to render a stylized polygon-drawn face portrait from landmarks and source image.
 * Returns a static JPEG data URL (unchanged from the legacy renderer).
 */
export function renderPolygonPortrait(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  landmarks: Landmark3D[],
  style: PolygonPortraitStyle = 'neon-hologram',
  casteColor: string = '#b4ff39'
): string {
  const w = 480;
  const h = 480;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  drawFaceFrame(ctx, w, h, { source, landmarks, style, casteColor, spot: null });

  return canvas.toDataURL('image/jpeg', 0.88);
}