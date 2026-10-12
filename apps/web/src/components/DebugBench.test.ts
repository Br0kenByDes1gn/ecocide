import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@ecocide/types';
import {
  FACTIONS,
  CASTE_ORDER,
  CASTE_OVERFLOW,
  CASTE_CENSUS_DATA,
  TOTAL_WORLD_POPULATION,
  CASTE_PERCENTAGES,
  CASTE_POPULATIONS,
  CASTE_PERCENTILE_THRESHOLDS,
  CASTE_PERCENTILE_BANDS,
  getCasteFromPercentile,
  calculateCasteUnitId,
  getCasteMemberTitle,
  CASTE_COLORS,
  CASTE_THEMES,
  CASTE_COLOR_CONFIG,
  FORMAL_LIFE_STAGES,
  CASTE_LIFE_STAGES,
  toFormalLifeStage,
  getCasteLifeStageTitle,
  ASSET_VALUE_TIERS,
  toAssetValueTier,
  generateSimulatedVerdict,
} from '@ecocide/types';

describe('DebugBench Configuration & Presets', () => {
  it('covers every registered classification for manual testing', () => {
    expect(CASTE_ORDER.length).toBe(FACTIONS.length);
    expect(CASTE_ORDER.length).toBeGreaterThanOrEqual(2);
  });

  it('quota shares sum to exactly 100 and populations are consistent', () => {
    const totalPercentage = CASTE_ORDER.reduce((sum, c) => sum + CASTE_PERCENTAGES[c], 0);
    expect(totalPercentage).toBe(100);

    expect(TOTAL_WORLD_POPULATION).toBe(8_300_000_000);

    let totalPopulation = 0;
    for (const caste of CASTE_ORDER) {
      const data = CASTE_CENSUS_DATA[caste];
      expect(data).toBeDefined();
      expect(data.population).toBe(Math.round((TOTAL_WORLD_POPULATION * data.percentage) / 100));
      expect(CASTE_POPULATIONS[caste]).toBe(data.population);
      totalPopulation += data.population;
    }
    // Rounding keeps the census within a whisker of the world population.
    expect(Math.abs(totalPopulation - TOTAL_WORLD_POPULATION)).toBeLessThanOrEqual(CASTE_ORDER.length);
  });

  it('derives monotonic percentile thresholds and resolves boundary percentiles', () => {
    let previous = 100;
    for (const caste of CASTE_ORDER) {
      const threshold = CASTE_PERCENTILE_THRESHOLDS[caste];
      expect(threshold).toBeLessThan(previous);
      previous = threshold;
    }
    // The overflow band reaches 0.
    expect(CASTE_PERCENTILE_THRESHOLDS[CASTE_OVERFLOW]).toBe(0);

    // Boundary percentile always lands in the (higher) owning band.
    for (const caste of CASTE_ORDER) {
      const band = CASTE_PERCENTILE_BANDS[caste];
      expect(getCasteFromPercentile(band.low)).toBe(caste);
      expect(getCasteFromPercentile(band.high)).toBe(caste);
    }
    expect(getCasteFromPercentile(100.0)).toBe(CASTE_ORDER[0]);
    expect(getCasteFromPercentile(0.0)).toBe(CASTE_OVERFLOW);
  });

  it('deterministically calculates unit numeric IDs bounded by caste population', () => {
    const mockProfile: UserProfile = {
      caste: CASTE_ORDER[0],
      biocarbon_ratio: 98,
      life_stage: 'Champion',
      equipped_wealth: 'Baseline',
      energy_level: 'Nominal',
      apparent_presentation: 'Masculine',
      honorific_title: 'Provisional Subject #1',
    };

    const unit1 = calculateCasteUnitId(mockProfile, CASTE_CENSUS_DATA[CASTE_ORDER[0]].population);
    const unit2 = calculateCasteUnitId(mockProfile, CASTE_CENSUS_DATA[CASTE_ORDER[0]].population);
    expect(unit1).toBe(unit2);
    expect(unit1).toBeGreaterThanOrEqual(1);
    expect(unit1).toBeLessThanOrEqual(CASTE_CENSUS_DATA[CASTE_ORDER[0]].population);

    const overflowProfile: UserProfile = { ...mockProfile, caste: CASTE_OVERFLOW };
    const overflowUnit = calculateCasteUnitId(overflowProfile, CASTE_CENSUS_DATA[CASTE_OVERFLOW].population);
    expect(overflowUnit).toBeGreaterThanOrEqual(1);
    expect(overflowUnit).toBeLessThanOrEqual(CASTE_CENSUS_DATA[CASTE_OVERFLOW].population);
  });

  it('provides a census description and member title for every classification', () => {
    for (const caste of CASTE_ORDER) {
      const info = CASTE_CENSUS_DATA[caste];
      expect(info.description).toBeDefined();
      expect(info.description.length).toBeGreaterThan(20);
      expect(info.memberTitle).toBe(getCasteMemberTitle(caste));
    }
  });

  it('maintains the ordered tab sequence of all registered classifications', async () => {
    expect(CASTE_ORDER).toEqual(FACTIONS.map((f) => f.id));
  });

  it('provides designated colors and themes for each classification', () => {
    expect(CASTE_THEMES).toBe(CASTE_COLORS);
    expect(CASTE_COLOR_CONFIG).toBe(CASTE_COLORS);

    for (const caste of CASTE_ORDER) {
      const color = CASTE_COLORS[caste];
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.glowHex).toContain('rgba(');
      expect(color.text).toBeDefined();
      expect(color.color).toBe(color.text);
      expect(color.border).toBeDefined();
      expect(color.bg).toBeDefined();
      expect(color.badge).toBeDefined();
      expect(color.barColor).toBeDefined();
      expect(color.dotColor).toBeDefined();
      expect(color.glow).toBeDefined();

      // Ensure CASTE_CENSUS_DATA links to the exact color config
      expect(CASTE_CENSUS_DATA[caste].color).toEqual(color);
      // The overflow classification carries a distinct (hazard) hue family.
      if (caste === CASTE_OVERFLOW) {
        expect(color.name).toBe('red');
      }
    }
  });

  it('translates formal life stages into per-classification titles from the lore pack', () => {
    expect(FORMAL_LIFE_STAGES).toEqual(['Youth', 'Young Adult', 'Adult', 'Senior']);
    const faction = FACTIONS[0];
    expect(CASTE_LIFE_STAGES[faction.id].Youth).toBe(faction.lifeStageTitles.youth);
    expect(CASTE_LIFE_STAGES[faction.id].Adult).toBe(faction.lifeStageTitles.adult);
    expect(getCasteLifeStageTitle(faction.id, 'Youth')).toBe(faction.lifeStageTitles.youth);
    expect(getCasteLifeStageTitle(faction.id, 'Senior')).toBe(faction.lifeStageTitles.senior);

    // Backward-compatibility: legacy stages normalize cleanly
    expect(toFormalLifeStage('Initiate')).toBe('Youth');
    expect(toFormalLifeStage('Aspirant')).toBe('Young Adult');
    expect(toFormalLifeStage('Champion')).toBe('Adult');
    expect(toFormalLifeStage('Venerable')).toBe('Senior');
  });

  it('categorizes apparel into discrete wealth tiers and normalizes cleanly', () => {
    expect(ASSET_VALUE_TIERS.length).toBeGreaterThanOrEqual(5);

    const [first] = ASSET_VALUE_TIERS;
    const [_, , , defaultTier] = ASSET_VALUE_TIERS;

    // Exact matches (case-insensitive / trimmed)
    expect(toAssetValueTier(first)).toBe(first);
    expect(toAssetValueTier(`  ${first.toLowerCase()}  `)).toBe(first);

    // Hints normalize toward the owning tier; unknown input → default tier.
    expect(toAssetValueTier('Luxury Regalia')).toBe(first);
    expect(toAssetValueTier('Completely Unknown Clothing')).toBe(defaultTier);
    expect(toAssetValueTier(null)).toBe(defaultTier);
    expect(toAssetValueTier(undefined)).toBe(defaultTier);
  });

  it('generates deterministic simulated verdicts with per-classification copy', () => {
    const faction = FACTIONS[0];
    const input = {
      caste: faction.id,
      castePercentile: 50,
      biocarbonRatio: 85,
      facialAspectRatio: 1.4,
      jawTaperRatio: 0.8,
      eyeToNoseRatio: 1.1,
      symmetryVariance: 0.02,
    };
    const verdict = generateSimulatedVerdict(input);

    expect(verdict.user_profile.energy_level).toBe(faction.simulated.energy);
    expect(verdict.user_profile.caste).toBe(faction.id);
    expect(verdict.prophecy.headline).toContain(faction.name.toUpperCase());
    expect(verdict.prophecy.paragraph_2).toContain(faction.name);
    expect(verdict.prophecy.paragraph_3).toContain(faction.name);
    expect((verdict.user_profile as any).gaze_energy).toBeUndefined();

    // Deterministic across calls with identical input
    expect(generateSimulatedVerdict(input)).toEqual(verdict);
  });

  it('marks the overflow classification distinctly in simulated copy', () => {
    const overflow = getFactionLikeOverflow();
    const verdict = generateSimulatedVerdict({
      caste: CASTE_OVERFLOW,
      castePercentile: 5,
      biocarbonRatio: 12,
      facialAspectRatio: 1.2,
      jawTaperRatio: 0.6,
      eyeToNoseRatio: 0.9,
      symmetryVariance: 0.15,
    });
    expect(verdict.user_profile.energy_level).toBe(overflow.simulated.energy);
    expect(verdict.prophecy.headline).toContain(overflow.name.toUpperCase());
  });
});

function getFactionLikeOverflow() {
  return FACTIONS.find((f) => f.id === CASTE_OVERFLOW) ?? FACTIONS[FACTIONS.length - 1];
}