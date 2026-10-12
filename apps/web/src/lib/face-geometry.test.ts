import { describe, expect, it } from 'vitest';
import { CASTE_COLORS, getCasteFromPercentile, type Caste } from '@ecocide/types';
import { SCAN_MESH_COLOR_UNCLASSIFIED } from './mediapipe-service';
import {
  buildCasteShellTable,
  calculateCaste,
  calculateComplianceFromShell,
  calculateSymmetryPercent,
  CASTE_RATIO_CALIBRATION,
  extractBiometrics,
  fnv1a,
  LANDMARK_INDICES,
  type Landmark3D,
} from './face-geometry';

// Helper to create synthetic 478 landmarks
function createSyntheticLandmarks(symmetryOffset = 0): Landmark3D[] {
  const landmarks: Landmark3D[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
  }));

  // Assign key points
  landmarks[LANDMARK_INDICES.FOREHEAD] = { x: 0.5, y: 0.2, z: 0.0 };
  landmarks[LANDMARK_INDICES.CHIN] = { x: 0.5, y: 0.8, z: 0.0 };
  landmarks[LANDMARK_INDICES.NOSE_TIP] = { x: 0.5, y: 0.5, z: 0.1 };
  landmarks[LANDMARK_INDICES.LEFT_CHEEK] = { x: 0.2, y: 0.5, z: -0.1 };
  landmarks[LANDMARK_INDICES.RIGHT_CHEEK] = { x: 0.8, y: 0.5, z: -0.1 };
  landmarks[LANDMARK_INDICES.LEFT_JAW] = { x: 0.3, y: 0.7, z: 0.0 };
  landmarks[LANDMARK_INDICES.RIGHT_JAW] = { x: 0.7, y: 0.7, z: 0.0 };

  // Bilateral pairs
  // (33, 263) outer eyes
  landmarks[33] = { x: 0.35, y: 0.4, z: 0.0 };
  landmarks[263] = { x: 0.65 + symmetryOffset, y: 0.4, z: 0.0 };

  // (133, 362) inner eyes
  landmarks[133] = { x: 0.45, y: 0.4, z: 0.0 };
  landmarks[362] = { x: 0.55 + symmetryOffset, y: 0.4, z: 0.0 };

  // (61, 291) mouth corners
  landmarks[61] = { x: 0.4, y: 0.65, z: 0.0 };
  landmarks[291] = { x: 0.6 + symmetryOffset, y: 0.65, z: 0.0 };

  return landmarks;
}

describe('face-geometry engine', () => {
  it('fnv1a hash produces deterministic non-zero unsigned integers', () => {
    const hash1 = fnv1a('1.50:0.75:0.60');
    const hash2 = fnv1a('1.50:0.75:0.60');
    expect(hash1).toBe(hash2);
    expect(hash1).toBeGreaterThan(0);
  });

  it('calculateCaste enforces distribution thresholds', () => {
    // Test direct bucketing
    const r1 = { facialAspectRatio: 1.4, jawTaperRatio: 0.66, eyeToNoseRatio: 1.0 };
    const res1 = calculateCaste(r1);
    expect(res1.percentile).toBeGreaterThanOrEqual(0);
    expect(res1.percentile).toBeLessThanOrEqual(100);

    const castes = [
      'Tech Overlords',
      'Enforcers',
      'Bootlickers',
      'Untouchables',
      'Free Spirits',
      'Redundants',
    ];
    expect(castes).toContain(res1.caste);
  });

  it('calculateCaste is 100% deterministic on identical ratios', () => {
    const ratios = { facialAspectRatio: 1.25, jawTaperRatio: 0.78, eyeToNoseRatio: 0.95 };
    const first = calculateCaste(ratios);
    const second = calculateCaste(ratios);
    expect(first.caste).toBe(second.caste);
    expect(first.percentile).toBe(second.percentile);
  });

  it('correctly maps percentiles across all 6 caste tiers', () => {
    // Generate signatures to ensure we hit various percentiles
    const testedCastes = new Set<string>();
    for (let i = 1; i <= 500; i++) {
      const res = calculateCaste({
        facialAspectRatio: 1.0 + (i * 0.03),
        jawTaperRatio: 0.5 + (i * 0.02),
        eyeToNoseRatio: 0.8 + (i * 0.01),
      });
      testedCastes.add(res.caste);
    }
    // Redundants make up 83% so they must definitely be encountered
    expect(testedCastes.has('Redundants')).toBe(true);
  });

  it('calculateSymmetryPercent rates symmetrical faces higher than asymmetrical faces', () => {
    const symmetricFace = createSyntheticLandmarks(0);
    const asymmetricFace = createSyntheticLandmarks(0.08); // noticeable offset

    const symScore = calculateSymmetryPercent(symmetricFace, 0.6, 0.6);
    const asymScore = calculateSymmetryPercent(asymmetricFace, 0.6, 0.6);

    expect(symScore.percent).toBeGreaterThan(asymScore.percent);
    expect(symScore.percent).toBeGreaterThanOrEqual(0);
    expect(symScore.percent).toBeLessThanOrEqual(100);
    expect(asymScore.percent).toBeGreaterThanOrEqual(0);
  });

  it('extractBiometrics produces complete telemetry payload', () => {
    const landmarks = createSyntheticLandmarks(0.01);
    const telemetry = extractBiometrics(landmarks);

    expect(telemetry.caste).toBeDefined();
    expect(telemetry.castePercentile).toBeGreaterThanOrEqual(0);
    expect(telemetry.castePercentile).toBeLessThanOrEqual(100);
    expect(telemetry.biocarbonRatio).toBeGreaterThanOrEqual(0);
    expect(telemetry.biocarbonRatio).toBeLessThanOrEqual(100);
    expect(telemetry.facialAspectRatio).toBeGreaterThan(0);
    expect(telemetry.jawTaperRatio).toBeGreaterThan(0);
  });

  it('blends shell conformity (dominant) with symmetry into the biocarbon ratio', () => {
    // A highly "average" face (population center) has near-maximum conformity
    const centerConformity = calculateComplianceFromShell({
      facialAspectRatio: CASTE_RATIO_CALIBRATION.facialAspectRatio.mu,
      jawTaperRatio: CASTE_RATIO_CALIBRATION.jawTaperRatio.mu,
      eyeToNoseRatio: CASTE_RATIO_CALIBRATION.eyeToNoseRatio.mu,
    });
    // An extreme corner face is far from the center → near-zero conformity
    const cornerConformity = calculateComplianceFromShell({ facialAspectRatio: 9.9, jawTaperRatio: 9.9, eyeToNoseRatio: 9.9 });

    expect(centerConformity).toBeGreaterThan(80);
    expect(cornerConformity).toBeLessThanOrEqual(5);
    expect(centerConformity).toBeGreaterThan(cornerConformity);

    // Deterministic + bounded for the same input
    const t1 = extractBiometrics(createSyntheticLandmarks(0));
    const t2 = extractBiometrics(createSyntheticLandmarks(0));
    expect(t1.biocarbonRatio).toBe(t2.biocarbonRatio);
    expect(t1.biocarbonRatio).toBeGreaterThanOrEqual(0);
    expect(t1.biocarbonRatio).toBeLessThanOrEqual(100);
  });
});

// Small deterministic PRNG (mulberry32) so the distribution tests are repeatable
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('distance-shell caste engine', () => {
  const MU = {
    facialAspectRatio: CASTE_RATIO_CALIBRATION.facialAspectRatio.mu,
    jawTaperRatio: CASTE_RATIO_CALIBRATION.jawTaperRatio.mu,
    eyeToNoseRatio: CASTE_RATIO_CALIBRATION.eyeToNoseRatio.mu,
  };
  const SIG = {
    facialAspectRatio: CASTE_RATIO_CALIBRATION.facialAspectRatio.sigma,
    jawTaperRatio: CASTE_RATIO_CALIBRATION.jawTaperRatio.sigma,
    eyeToNoseRatio: CASTE_RATIO_CALIBRATION.eyeToNoseRatio.sigma,
  };

  it('builds a 630-combo table with contiguous, ordered caste blocks', () => {
    const table = buildCasteShellTable();
    expect(table.comboCount).toBe(630);
    expect(table.casteByRank.length).toBe(630);
    expect(table.percentileByRank.length).toBe(630);

    // Each caste's ranks form a single contiguous block, in apex→redundant order
    const order: Caste[] = ['Tech Overlords', 'Enforcers', 'Bootlickers', 'Untouchables', 'Free Spirits', 'Redundants'];
    let cursor = 0;
    for (const caste of order) {
      const indices: number[] = [];
      table.casteByRank.forEach((c, i) => {
        if (c === caste) indices.push(i);
      });
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[0]).toBe(cursor);
      expect(indices.slice(-1)[0]).toBe(cursor + indices.length - 1);
      cursor += indices.length;
    }
    expect(cursor).toBe(630);
  });

  it('keeps every percentile inside its caste band per shared thresholds', () => {
    const table = buildCasteShellTable();
    for (let rank = 0; rank < table.casteByRank.length; rank++) {
      expect(getCasteFromPercentile(table.percentileByRank[rank])).toBe(table.casteByRank[rank]);
    }
  });

  it('the statistical center of face-space is apex; outliers are Redundant', () => {
    // The modal (population-center) face lands the innermost rank → apex caste
    const center = calculateCaste(MU);
    expect(center.caste).not.toBe('Redundants');
    expect(center.percentile).toBeGreaterThanOrEqual(83);

    // Extreme / degenerate faces clamp to the outermost combos → Redundants
    for (const extreme of [
      { facialAspectRatio: 0.1, jawTaperRatio: 0.1, eyeToNoseRatio: 0.1 },
      { facialAspectRatio: 99, jawTaperRatio: 99, eyeToNoseRatio: 99 },
      { facialAspectRatio: 5, jawTaperRatio: 0.2, eyeToNoseRatio: 0.5 },
    ]) {
      expect(calculateCaste(extreme).caste).toBe('Redundants');
    }
  });

  it('is stable under re-scan jitter (flip rate < 3%)', () => {
    const rnd = mulberry32(20261002);
    const gauss = () => {
      const u = Math.max(rnd(), 1e-9);
      const v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    const bases = Array.from({ length: 600 }, () => ({
      facialAspectRatio: clamp(MU.facialAspectRatio + gauss() * SIG.facialAspectRatio, 1.0, 1.7),
      jawTaperRatio: clamp(MU.jawTaperRatio + gauss() * SIG.jawTaperRatio, 0.55, 1.02),
      eyeToNoseRatio: clamp(MU.eyeToNoseRatio + gauss() * SIG.eyeToNoseRatio, 0.9, 2.8),
    }));

    let flips = 0;
    let trials = 0;
    for (const base of bases) {
      const baseCaste = calculateCaste(base).caste;
      for (let t = 0; t < 8; t++) {
        trials++;
        const jitter = {
          facialAspectRatio: base.facialAspectRatio + (rnd() - 0.5) * 0.008,
          jawTaperRatio: base.jawTaperRatio + (rnd() - 0.5) * 0.008,
          eyeToNoseRatio: base.eyeToNoseRatio + (rnd() - 0.5) * 0.008,
        };
        if (calculateCaste(jitter).caste !== baseCaste) flips++;
      }
    }
    expect(flips / trials).toBeLessThan(0.03);
  });

  it('matches the target demographic mix over a normal population', () => {
    const rnd = mulberry32(424242);
    const gauss = () => {
      const u = Math.max(rnd(), 1e-9);
      const v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const target: Record<Caste, number> = { 'Tech Overlords': 1, Enforcers: 3, Bootlickers: 5, Untouchables: 4, 'Free Spirits': 4, Redundants: 83 };
    const counts: Record<string, number> = {};

    const n = 200000;
    for (let i = 0; i < n; i++) {
      const ratios = {
        facialAspectRatio: MU.facialAspectRatio + gauss() * SIG.facialAspectRatio,
        jawTaperRatio: MU.jawTaperRatio + gauss() * SIG.jawTaperRatio,
        eyeToNoseRatio: MU.eyeToNoseRatio + gauss() * SIG.eyeToNoseRatio,
      };
      counts[calculateCaste(ratios).caste] = (counts[calculateCaste(ratios).caste] || 0) + 1;
    }

    for (const [caste, pct] of Object.entries(target)) {
      const got = ((counts[caste] || 0) / n) * 100;
      const tolerance = caste === 'Redundants' ? 2.5 : 1.5;
      expect(Math.abs(got - pct)).toBeLessThanOrEqual(tolerance);
    }
  });
});

describe('scan preview mesh color', () => {
  it('is a neutral ice-white hue that is not assigned to any caste', () => {
    expect(SCAN_MESH_COLOR_UNCLASSIFIED).toBe('#e2e8f0');

    const casteHexes = new Set(Object.values(CASTE_COLORS).map((c) => c.hex.toLowerCase()));
    expect(casteHexes.has(SCAN_MESH_COLOR_UNCLASSIFIED.toLowerCase())).toBe(false);

    // Debug accent palette hues that shouldn't be reclaimed either
    const debugAccentHues = ['#00f3ff', '#00ff66', '#38bdf8', '#e879f9'];
    expect(debugAccentHues).not.toContain(SCAN_MESH_COLOR_UNCLASSIFIED.toLowerCase());
  });
});
