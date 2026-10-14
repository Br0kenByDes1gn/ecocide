import { describe, expect, it } from 'vitest';
import {
  getFaceTriangles,
  calculateTriangleNormal,
  getThermalColor,
  getFaceSpotPosition,
  getSpotIntensity,
  triangleCentroid,
  transformLandmarksToFitFrame,
  POLYGON_PORTRAIT_STYLES,
  type PolygonPortraitStyle,
} from './polygon-portrait';
import type { Landmark3D } from './face-geometry';

describe('polygon-portrait engine', () => {
  it('extracts exactly 852 triangles from FaceLandmarker tessellation', () => {
    const triangles = getFaceTriangles();
    expect(triangles.length).toBe(852);

    for (let i = 0; i < triangles.length; i++) {
      const [i0, i1, i2] = triangles[i];
      expect(i0).toBeGreaterThanOrEqual(0);
      expect(i0).toBeLessThanOrEqual(467);
      expect(i1).toBeGreaterThanOrEqual(0);
      expect(i1).toBeLessThanOrEqual(467);
      expect(i2).toBeGreaterThanOrEqual(0);
      expect(i2).toBeLessThanOrEqual(467);
      // Triangles must not have all identical vertices
      expect(i0 === i1 && i1 === i2).toBe(false);
    }
  });

  it('defines all 4 required polygon portrait styles with labels and descriptions', () => {
    expect(POLYGON_PORTRAIT_STYLES.length).toBe(4);
    const expectedIds: PolygonPortraitStyle[] = [
      'faceted-poly',
      'surveillance-wireframe',
      'neon-hologram',
      'thermal-scan',
    ];

    const actualIds = POLYGON_PORTRAIT_STYLES.map((s) => s.id);
    expect(actualIds).toEqual(expectedIds);

    for (const style of POLYGON_PORTRAIT_STYLES) {
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.subtitle.length).toBeGreaterThan(0);
      expect(style.description.length).toBeGreaterThan(0);
    }
  });

  it('calculates unit surface normal vectors without NaN or zero division', () => {
    const p0: Landmark3D = { x: 0.5, y: 0.5, z: 0.0 };
    const p1: Landmark3D = { x: 0.6, y: 0.5, z: 0.1 };
    const p2: Landmark3D = { x: 0.5, y: 0.6, z: 0.05 };

    const normal = calculateTriangleNormal(p0, p1, p2);
    expect(Number.isFinite(normal.nx)).toBe(true);
    expect(Number.isFinite(normal.ny)).toBe(true);
    expect(Number.isFinite(normal.nz)).toBe(true);

    const length = Math.hypot(normal.nx, normal.ny, normal.nz);
    expect(length).toBeCloseTo(1.0, 4);
  });

  it('handles degenerate / collinear triangles gracefully without throwing', () => {
    const p0: Landmark3D = { x: 0.5, y: 0.5, z: 0.0 };
    const p1: Landmark3D = { x: 0.5, y: 0.5, z: 0.0 };
    const p2: Landmark3D = { x: 0.5, y: 0.5, z: 0.0 };

    const normal = calculateTriangleNormal(p0, p1, p2);
    expect(Number.isFinite(normal.nx)).toBe(true);
    expect(Number.isFinite(normal.ny)).toBe(true);
    expect(Number.isFinite(normal.nz)).toBe(true);
  });

  it('computes carbon heat-map colors across entire spectrum and clamps bounds', () => {
    const negligible = getThermalColor(0.0);
    expect(negligible).toBe('rgb(5, 46, 22)');

    const low = getThermalColor(0.25);
    expect(low).toBe('rgb(34, 197, 94)');

    const moderate = getThermalColor(0.5);
    expect(moderate).toBe('rgb(250, 204, 21)');

    const high = getThermalColor(0.75);
    expect(high).toBe('rgb(249, 115, 22)');

    const severe = getThermalColor(1.0);
    expect(severe).toBe('rgb(255, 0, 85)');

    // Clamps out-of-range inputs
    expect(getThermalColor(-0.5)).toBe(negligible);
    expect(getThermalColor(1.5)).toBe(severe);
  });

  it('centers an off-center face to exact middle of the canvas and scales to fill frame', () => {
    // Face located in top-right corner of image: x: [0.70, 0.90], y: [0.10, 0.50]
    const offCenterLandmarks: Landmark3D[] = [
      { x: 0.70, y: 0.10, z: 0.0 }, // top-left
      { x: 0.90, y: 0.10, z: 0.0 }, // top-right
      { x: 0.80, y: 0.30, z: 0.1 }, // nose
      { x: 0.70, y: 0.50, z: 0.0 }, // bottom-left
      { x: 0.90, y: 0.50, z: 0.0 }, // bottom-right
    ];

    const w = 480;
    const h = 480;
    const result = transformLandmarksToFitFrame(offCenterLandmarks, w, h, 0.90);

    // Bounding box of original: width = 0.20, height = 0.40
    expect(result.faceBounds.width).toBeCloseTo(0.20, 4);
    expect(result.faceBounds.height).toBeCloseTo(0.40, 4);

    // Original center was at (0.80, 0.30)
    expect(result.center.x).toBeCloseTo(0.80, 4);
    expect(result.center.y).toBeCloseTo(0.30, 4);

    // Compute bounding box of transformed points
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pt of result.transformedPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const transformedCenterX = (minX + maxX) / 2;
    const transformedCenterY = (minY + maxY) / 2;
    const transformedHeight = maxY - minY;

    // Must be centered exactly at (240, 240)
    expect(transformedCenterX).toBeCloseTo(240, 2);
    expect(transformedCenterY).toBeCloseTo(240, 2);

    // Largest dimension (height) must fill 90% of frame: 480 * 0.90 = 432px
    expect(transformedHeight).toBeCloseTo(432, 2);
    // Margins should be equal on top and bottom: (480 - 432) / 2 = 24px
    expect(minY).toBeCloseTo(24, 2);
    expect(maxY).toBeCloseTo(456, 2);
  });

  it('handles empty or degenerate landmark lists without NaN', () => {
    const emptyResult = transformLandmarksToFitFrame([], 480, 480, 0.90);
    expect(emptyResult.transformedPoints.length).toBe(0);
    expect(Number.isFinite(emptyResult.scale)).toBe(true);

    const singleResult = transformLandmarksToFitFrame([{ x: 0.5, y: 0.5, z: 0.0 }], 480, 480, 0.90);
    expect(singleResult.transformedPoints.length).toBe(1);
    expect(singleResult.transformedPoints[0].x).toBe(240);
    expect(singleResult.transformedPoints[0].y).toBe(240);
  });
});

describe('animated projector-spot helpers', () => {
  const faceLandmarks: Landmark3D[] = [
    { x: 0.70, y: 0.10, z: 0.0 }, // top-left
    { x: 0.90, y: 0.10, z: 0.0 }, // top-right
    { x: 0.80, y: 0.30, z: 0.1 }, // nose
    { x: 0.70, y: 0.50, z: 0.0 }, // bottom-left
    { x: 0.90, y: 0.50, z: 0.0 }, // bottom-right
  ];
  const w = 480;
  const h = 480;
  const transform = transformLandmarksToFitFrame(faceLandmarks, w, h, 0.90);
  const faceWPx = transform.faceBounds.width * transform.scale;
  const faceHPx = transform.faceBounds.height * transform.scale;

  it('triangles within the spot light up strongest at the center and decay with distance', () => {
    const spot = { x: 240, y: 240, radius: 50 };
    expect(getSpotIntensity(240, 240, spot)).toBeCloseTo(1.0, 6);
    expect(getSpotIntensity(240 + 50, 240, spot)).toBeCloseTo(Math.exp(-0.5), 4);
    // Far outside the spot, intensity is effectively zero
    expect(getSpotIntensity(240 + 150, 240, spot)).toBeLessThan(0.02);
    // No spot at all → 0
    expect(getSpotIntensity(240, 240, null)).toBe(0);
    expect(getSpotIntensity(240, 240, undefined)).toBe(0);
  });

  it('wanders as a small searchlight that stays inside the face region over time', () => {
    for (const timeMs of [0, 1000, 2500, 5000, 10000, 30000]) {
      const spot = getFaceSpotPosition(timeMs, transform, w, h);
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.y)).toBe(true);
      // Amplitude is capped at half of the face half-extent in each axis
      expect(Math.abs(spot.x - w / 2)).toBeLessThanOrEqual(faceWPx * 0.26);
      expect(Math.abs(spot.y - h / 2)).toBeLessThanOrEqual(faceHPx * 0.26);
    }
  });

  it('keeps the projector spot proportionally small (12–30% of the face width)', () => {
    for (const timeMs of [0, 3000, 9000, 17000]) {
      const spot = getFaceSpotPosition(timeMs, transform, w, h);
      const ratio = spot.radius / Math.max(faceWPx, faceHPx);
      expect(ratio).toBeGreaterThanOrEqual(0.12);
      expect(ratio).toBeLessThanOrEqual(0.3);
      expect(spot.radius).toBeGreaterThan(0);
    }
  });

  it('computes triangle centroids as the vertex midpoint', () => {
    const centroid = triangleCentroid({ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 60 });
    expect(centroid).toEqual({ x: 10, y: 20 });
  });
});
