import {
  CASTE_ORDER,
  CASTE_OVERFLOW,
  CASTE_PERCENTAGES,
  CASTE_PERCENTILE_BANDS,
  type BiometricTelemetry,
  type Caste,
} from '@ecocide/types';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

// Canonical MediaPipe 468/478 Landmark Indices
export const LANDMARK_INDICES = {
  FOREHEAD: 10,
  CHIN: 152,
  NOSE_TIP: 1,
  NASION: 168,
  LEFT_CHEEK: 234,  // Subject right
  RIGHT_CHEEK: 454, // Subject left
  LEFT_JAW: 172,
  RIGHT_JAW: 397,
  // Bilateral pairs [Left, Right]
  BILATERAL_PAIRS: [
    [33, 263],   // Outer eye corners
    [133, 362],  // Inner eye corners
    [70, 300],   // Outer eyebrow
    [105, 334],  // Eyebrow peak
    [61, 291],   // Mouth corners
    [234, 454],  // Zygomatic arches (cheeks)
    [58, 288],   // Jawline angles
    [48, 278],   // Nostril wings
  ] as const
};

/**
 * Calculates 3D Euclidean distance between two landmarks.
 */
export function euclideanDistance3D(p1: Landmark3D, p2: Landmark3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 32-bit FNV-1a Hash function for strings.
 * Deterministic, fast, uniform distribution.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by 32-bit FNV prime 0x01000193
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Computes scale-invariant geometric ratios from 3D facial landmarks.
 */
export function extractFacialRatios(landmarks: Landmark3D[]) {
  const forehead = landmarks[LANDMARK_INDICES.FOREHEAD];
  const chin = landmarks[LANDMARK_INDICES.CHIN];
  const leftCheek = landmarks[LANDMARK_INDICES.LEFT_CHEEK];
  const rightCheek = landmarks[LANDMARK_INDICES.RIGHT_CHEEK];
  const leftJaw = landmarks[LANDMARK_INDICES.LEFT_JAW];
  const rightJaw = landmarks[LANDMARK_INDICES.RIGHT_JAW];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const noseTip = landmarks[LANDMARK_INDICES.NOSE_TIP];

  if (!forehead || !chin || !leftCheek || !rightCheek || !leftJaw || !rightJaw || !leftEyeOuter || !rightEyeOuter || !noseTip) {
    throw new Error('Incomplete facial landmarks detected');
  }

  const faceHeight = euclideanDistance3D(forehead, chin);
  const faceWidth = euclideanDistance3D(leftCheek, rightCheek) || 0.0001;
  const jawWidth = euclideanDistance3D(leftJaw, rightJaw);
  const eyeDistance = euclideanDistance3D(leftEyeOuter, rightEyeOuter);
  const noseToChin = euclideanDistance3D(noseTip, chin) || 0.0001;

  const facialAspectRatio = faceHeight / faceWidth;
  const jawTaperRatio = jawWidth / faceWidth;
  const eyeToNoseRatio = eyeDistance / noseToChin;

  return {
    facialAspectRatio,
    jawTaperRatio,
    eyeToNoseRatio,
    faceHeight,
    faceWidth,
  };
}

/**
 * 100% Deterministic Caste Calculator based on anatomical bone geometry.
 *
 * The assignment uses a "distance shell" over face-geometry space: the three
 * ratios are binned into equal-probability (equal-mass) quantile bins built
 * from a normal population model, and each of the 630 face-type combos is
 * ranked by its z-distance from the population center. Quota bands over that
 * distance-ordered rank axis (taken from the lore pack's faction distribution)
 * assign castes — the statistically most average faces live at the center
 * (highest bands) and the statistical outliers are marked into the overflow
 * faction. This is stable under re-scan noise (bins are far wider than
 * measurement jitter) and exact per face-type by construction.
 */

/** Population-model calibration for each facial ratio (independent normals). */
export const CASTE_RATIO_CALIBRATION = {
  facialAspectRatio: { mu: 1.32, sigma: 0.09, bins: 7 },
  jawTaperRatio: { mu: 0.80, sigma: 0.07, bins: 5 },
  eyeToNoseRatio: { mu: 1.85, sigma: 0.30, bins: 18 },
} as const;

/** Tail clamping distance (in sigma) for bin edges / representatives. */
const CALIBRATION_TAIL_SIGMA = 3.5;

/**
 * Inverse standard-normal CDF (Peter J. Acklam's rational approximation,
 * public-domain). Used to derive equal-probability bin edges from the model.
 */
export function normalQuantile(p: number): number {
  // Coefficients from Acklam's approximation
  const a = [
    -3.969683028665376e01,
    2.209460984245205e02,
    -2.759285104469687e02,
    1.38357751867269e02,
    -3.066479806614716e01,
    2.506628277459239e00,
  ];
  const b = [
    -5.447609879822406e01,
    1.615858368580409e02,
    -1.556989798598866e02,
    6.680131188771972e01,
    -1.328068155288572e01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e00,
    -2.549732539343734e00,
    4.374664141464968e00,
    2.938163982698783e00,
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e00,
    3.754408661907416e00,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  const x = Math.max(1e-12, Math.min(1 - 1e-12, p));

  // Horner evaluation helpers (balanced parens)
  const poly6 = (co: readonly number[], q: number) =>
    ((((((co[0] * q + co[1]) * q + co[2]) * q + co[3]) * q + co[4]) * q + co[5]));
  const poly5Plus1 = (co: readonly number[], q: number) =>
    (((((co[0] * q + co[1]) * q + co[2]) * q + co[3]) * q + co[4]) * q + 1);
  const poly4Plus1 = (co: readonly number[], q: number) =>
    ((((co[0] * q + co[1]) * q + co[2]) * q + co[3]) * q + 1);

  if (x < pLow) {
    const q = Math.sqrt(-2 * Math.log(x));
    return poly6(c, q) / poly4Plus1(d, q);
  }
  if (x <= pHigh) {
    const q = x - 0.5;
    const r = q * q;
    return (poly6(a, r) * q) / poly5Plus1(b, r);
  }
  const q = Math.sqrt(-2 * Math.log(1 - x));
  return -poly6(c, q) / poly4Plus1(d, q);
}

interface CalibratedAxis {
  mu: number;
  sigma: number;
  bins: number;
  /** Equal-probability bin edges (bins+1 entries); extremes clamped to μ±tail·σ. */
  edges: number[];
}

function calibrateAxis(axis: { mu: number; sigma: number; bins: number }): CalibratedAxis {
  const edges: number[] = [axis.mu - CALIBRATION_TAIL_SIGMA * axis.sigma];
  for (let i = 1; i < axis.bins; i++) {
    edges.push(axis.mu + axis.sigma * normalQuantile(i / axis.bins));
  }
  edges.push(axis.mu + CALIBRATION_TAIL_SIGMA * axis.sigma);
  return { ...axis, edges };
}

/**
 * Canonic quota bands and shares come from the lore pack via @ecocide/types:
 * CASTE_ORDER (largest percentile band first, overflow last),
 * CASTE_PERCENTAGES (shares that sum to 100) and CASTE_PERCENTILE_BANDS
 * (display percentile range per caste). The overflow caste takes the exact
 * remainder of the 630 combos.
 */

export interface CasteShellTable {
  /** Combo key ("f-j-e") → distance rank (0 = statistical center of face-space). */
  rankOf: Map<string, number>;
  /** Caste for each rank (quota blocks, innermost → apex, outermost → overflow). */
  casteByRank: readonly Caste[];
  /** Display percentile for each rank (inside its caste's threshold band). */
  percentileByRank: readonly number[];
  /** 0–100 "template conformity" per rank (linear in z-distance: 0 = extreme outlier, 100 = perfectly average). */
  conformityPercentByRank: readonly number[];
  /** Number of face-type combos (= φ(bins)). */
  comboCount: number;
}

let cachedShell: CasteShellTable | null = null;
let cachedAxes: CalibratedAxes | null = null;

interface CalibratedAxes {
  facialAspectRatio: CalibratedAxis;
  jawTaperRatio: CalibratedAxis;
  eyeToNoseRatio: CalibratedAxis;
}

/** Lazily built (once) calibrated axes for the canonical population model. */
function getCalibratedAxes(): CalibratedAxes {
  if (cachedAxes) return cachedAxes;
  cachedAxes = {
    facialAspectRatio: calibrateAxis(CASTE_RATIO_CALIBRATION.facialAspectRatio),
    jawTaperRatio: calibrateAxis(CASTE_RATIO_CALIBRATION.jawTaperRatio),
    eyeToNoseRatio: calibrateAxis(CASTE_RATIO_CALIBRATION.eyeToNoseRatio),
  };
  return cachedAxes;
}

/** Combo representative (bin-center ratio) z-distance from the population center. */
function comboZDistance(
  axes: Pick<CalibratedAxes, 'facialAspectRatio' | 'jawTaperRatio' | 'eyeToNoseRatio'>,
  f: number,
  j: number,
  e: number
): number {
  const z = (axis: CalibratedAxis, i: number) => ((axis.edges[i] + axis.edges[i + 1]) / 2 - axis.mu) / axis.sigma;
  const zf = z(axes.facialAspectRatio, f);
  const zj = z(axes.jawTaperRatio, j);
  const ze = z(axes.eyeToNoseRatio, e);
  return Math.sqrt(zf * zf + zj * zj + ze * ze);
}

/**
 * Builds (once, cached) the distance-shell caste table: the 630 face-type
 * combos ordered by distance from the population center, split into quota
 * bands sized to the lore pack's faction distribution.
 */
export function buildCasteShellTable(
  calibration: {
    facialAspectRatio: { mu: number; sigma: number; bins: number };
    jawTaperRatio: { mu: number; sigma: number; bins: number };
    eyeToNoseRatio: { mu: number; sigma: number; bins: number };
  } = CASTE_RATIO_CALIBRATION
): CasteShellTable {
  if (cachedShell) return cachedShell;

  const axes: CalibratedAxes =
    calibration === CASTE_RATIO_CALIBRATION
      ? getCalibratedAxes()
      : {
          facialAspectRatio: calibrateAxis(calibration.facialAspectRatio),
          jawTaperRatio: calibrateAxis(calibration.jawTaperRatio),
          eyeToNoseRatio: calibrateAxis(calibration.eyeToNoseRatio),
        };

  // Enumerate every combo and rank by z-distance from the population center
  interface Combo { key: string; f: number; j: number; e: number; distance: number }
  const combos: Combo[] = [];
  for (let f = 0; f < axes.facialAspectRatio.bins; f++) {
    for (let j = 0; j < axes.jawTaperRatio.bins; j++) {
      for (let e = 0; e < axes.eyeToNoseRatio.bins; e++) {
        combos.push({ key: `${f}-${j}-${e}`, f, j, e, distance: comboZDistance(axes, f, j, e) });
      }
    }
  }
  combos.sort((a, b) => a.distance - b.distance);

  const n = combos.length;
  const casteByRank: Caste[] = new Array<Caste>(n);
  const percentileByRank: number[] = new Array<number>(n);
  const rankOf = new Map<string, number>();

  let rank = 0;
  for (const caste of CASTE_ORDER) {
    const band = CASTE_PERCENTILE_BANDS[caste];
    let count: number;
    if (caste === CASTE_OVERFLOW) {
      count = n - rank; // overflow bucket takes the exact remainder
    } else {
      count = Math.round((n * CASTE_PERCENTAGES[caste]) / 100);
    }
    for (let i = 0; i < count; i++) {
      const percentile =
        count === 1
          ? band.low
          : Number((band.low + (i / (count - 1)) * (band.high - band.low)).toFixed(2));
      casteByRank[rank] = caste;
      percentileByRank[rank] = percentile;
      rank++;
    }
  }

  // Fill rank map from the distance-sorted combo order
  combos.forEach((combo, i) => rankOf.set(combo.key, i));

  // 0–100 template-conformity percent (linear in z-distance), cached per rank
  const dmax = combos[combos.length - 1].distance || 1;
  const conformityPercentByRank: number[] = new Array<number>(n);
  combos.forEach((combo, i) => {
    conformityPercentByRank[i] = Math.max(0, Math.min(100, Math.round(100 - (combo.distance / dmax) * 100)));
  });

  cachedShell = { rankOf, casteByRank, percentileByRank, conformityPercentByRank, comboCount: n };
  return cachedShell;
}

/** Maps ratios → combo key via the calibrated equal-probability bin edges. */
function comboKeyFor(
  ratios: { facialAspectRatio: number; jawTaperRatio: number; eyeToNoseRatio: number },
  axes: { facialAspectRatio: CalibratedAxis; jawTaperRatio: CalibratedAxis; eyeToNoseRatio: CalibratedAxis }
): string {
  const binIndex = (value: number, axis: CalibratedAxis): number => {
    const edges = axis.edges;
    const v = Math.min(edges[edges.length - 1], Math.max(edges[0], value));
    for (let i = 0; i < edges.length - 1; i++) {
      if (v < edges[i + 1]) return i;
    }
    return axis.bins - 1;
  };
  return `${binIndex(ratios.facialAspectRatio, axes.facialAspectRatio)}-${binIndex(
    ratios.jawTaperRatio,
    axes.jawTaperRatio
  )}-${binIndex(ratios.eyeToNoseRatio, axes.eyeToNoseRatio)}`;
}

export function calculateCaste(ratios: {
  facialAspectRatio: number;
  jawTaperRatio: number;
  eyeToNoseRatio: number;
}): { caste: Caste; percentile: number } {
  const table = buildCasteShellTable();
  const key = comboKeyFor(ratios, getCalibratedAxes());
  const rank = table.rankOf.get(key);

  // Unreachable via clamped binning; defensive fallback keeps determinism.
  if (rank === undefined) {
    const overflowBand = CASTE_PERCENTILE_BANDS[CASTE_OVERFLOW];
    const fallbackPercentile = Number(((overflowBand.low + overflowBand.high) / 2).toFixed(2));
    return { caste: CASTE_OVERFLOW, percentile: fallbackPercentile };
  }

  return { caste: table.casteByRank[rank], percentile: table.percentileByRank[rank] };
}

/**
 * 0–100 facial symmetry percent. Compares bilateral landmark pairs across the
 * vertical symmetry midline. Secondary component of the Biocarbon Compliance
 * Ratio (the primary component is shell conformity).
 */
export function calculateSymmetryPercent(
  landmarks: Landmark3D[],
  faceWidth: number,
  faceHeight: number
): { percent: number; variance: number } {
  const midlineTop = landmarks[LANDMARK_INDICES.FOREHEAD];
  const midlineBottom = landmarks[LANDMARK_INDICES.CHIN];

  if (!midlineTop || !midlineBottom || faceWidth <= 0 || faceHeight <= 0) {
    return { percent: 50, variance: 0.05 };
  }

  let totalAsymmetry = 0;
  const pairs = LANDMARK_INDICES.BILATERAL_PAIRS;

  for (const [leftIdx, rightIdx] of pairs) {
    const left = landmarks[leftIdx];
    const right = landmarks[rightIdx];
    if (!left || !right) continue;

    // Midline x estimated between left & right or central axis
    const midX = (midlineTop.x + midlineBottom.x) / 2;
    const leftDistToMid = Math.abs(left.x - midX);
    const rightDistToMid = Math.abs(right.x - midX);

    // Lateral asymmetry delta
    const lateralDelta = Math.abs(leftDistToMid - rightDistToMid) / faceWidth;
    // Vertical tilt delta
    const verticalDelta = Math.abs(left.y - right.y) / faceHeight;

    totalAsymmetry += lateralDelta * 0.7 + verticalDelta * 0.3;
  }

  const meanVariance = totalAsymmetry / pairs.length;

  // Typical meanVariance ranges from 0.005 (near-perfect) to 0.08 (noticeable tilt/asymmetry)
  const percent = Math.max(0, Math.min(100, Math.round(100 - meanVariance * 1100)));

  return { percent, variance: meanVariance };
}

/** Blend weights for the Biocarbon Compliance Ratio (conformity dominates, symmetry nudges). */
export const COMPLIANCE_CONFORMITY_WEIGHT = 0.85;
export const COMPLIANCE_SYMMETRY_WEIGHT = 0.15;

/**
 * 0–100 template conformity from the distance shell: how close this face's
 * geometry sits to the statistical population center (0 = extreme outlier,
 * 100 = perfectly average / mainframe-approved template).
 */
export function calculateComplianceFromShell(ratios: {
  facialAspectRatio: number;
  jawTaperRatio: number;
  eyeToNoseRatio: number;
}): number {
  const table = buildCasteShellTable();
  const key = comboKeyFor(ratios, getCalibratedAxes());
  const rank = table.rankOf.get(key);
  if (rank === undefined) return 50; // defensive (unreachable via clamped binning)
  return table.conformityPercentByRank[rank];
}

/**
 * Full telemetry extraction from MediaPipe landmarks.
 */
export function extractBiometrics(landmarks: Landmark3D[]): BiometricTelemetry {
  const ratios = extractFacialRatios(landmarks);
  const { caste, percentile } = calculateCaste(ratios);
  const { percent: symmetryPercent, variance } = calculateSymmetryPercent(
    landmarks,
    ratios.faceWidth,
    ratios.faceHeight
  );
  const conformityPercent = calculateComplianceFromShell(ratios);

  const biocarbonRatio = Math.max(
    0,
    Math.min(
      100,
      Math.round(COMPLIANCE_CONFORMITY_WEIGHT * conformityPercent + COMPLIANCE_SYMMETRY_WEIGHT * symmetryPercent)
    )
  );

  return {
    caste,
    castePercentile: percentile,
    biocarbonRatio,
    facialAspectRatio: Number(ratios.facialAspectRatio.toFixed(3)),
    jawTaperRatio: Number(ratios.jawTaperRatio.toFixed(3)),
    eyeToNoseRatio: Number(ratios.eyeToNoseRatio.toFixed(3)),
    symmetryVariance: Number(variance.toFixed(4)),
  };
}
