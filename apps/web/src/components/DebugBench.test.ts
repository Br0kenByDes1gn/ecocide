import { describe, expect, it } from 'vitest';
import type { Caste, UserProfile } from '@ecocide/types';
import {
  CASTE_CENSUS_DATA,
  TOTAL_WORLD_POPULATION,
  CASTE_PERCENTAGES,
  CASTE_POPULATIONS,
  CASTE_PERCENTILE_THRESHOLDS,
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
  const ALL_CASTES: Caste[] = [
    'Tech Overlords',
    'Enforcers',
    'Bootlickers',
    'Untouchables',
    'Free Spirits',
    'Redundants',
  ];

  it('covers all six dystopian castes for manual testing', () => {
    expect(ALL_CASTES.length).toBe(6);
  });

  it('validates caste hierarchy score thresholds', () => {
    const scores: Record<Caste, number> = {
      'Tech Overlords': 9840,
      Enforcers: 8450,
      Bootlickers: 6820,
      Untouchables: 4150,
      'Free Spirits': 2890,
      Redundants: 1150,
    };

    expect(scores['Tech Overlords']).toBeGreaterThanOrEqual(9000);
    expect(scores['Enforcers']).toBeGreaterThanOrEqual(7500);
    expect(scores['Bootlickers']).toBeGreaterThanOrEqual(5500);
    expect(scores['Untouchables']).toBeGreaterThanOrEqual(3500);
    expect(scores['Free Spirits']).toBeGreaterThanOrEqual(2000);
    expect(scores['Redundants']).toBeLessThan(2000);
  });

  it('transforms caste collective plurals into singular caste member titles', () => {
    expect(getCasteMemberTitle('Tech Overlords')).toBe('Tech Overlord');
    expect(getCasteMemberTitle('Enforcers')).toBe('Enforcer');
    expect(getCasteMemberTitle('Bootlickers')).toBe('Bootlicker');
    expect(getCasteMemberTitle('Untouchables')).toBe('Untouchable');
    expect(getCasteMemberTitle('Free Spirits')).toBe('Free Spirit');
    expect(getCasteMemberTitle('Redundants')).toBe('Redundant');
  });

  it('calculates exact population from 8.3 billion total world population', () => {
    expect(TOTAL_WORLD_POPULATION).toBe(8_300_000_000);

    let totalPopulation = 0;
    let totalPercentage = 0;

    for (const caste of ALL_CASTES) {
      const data = CASTE_CENSUS_DATA[caste];
      expect(data).toBeDefined();
      expect(data.population).toBe(Math.round((TOTAL_WORLD_POPULATION * data.percentage) / 100));
      totalPopulation += data.population;
      totalPercentage += data.percentage;
    }

    expect(totalPercentage).toBe(100);
    expect(totalPopulation).toBe(8_300_000_000);

    expect(CASTE_PERCENTAGES['Tech Overlords']).toBe(1.0);
    expect(CASTE_PERCENTAGES['Enforcers']).toBe(3.0);
    expect(CASTE_PERCENTAGES['Bootlickers']).toBe(5.0);
    expect(CASTE_PERCENTAGES['Untouchables']).toBe(4.0);
    expect(CASTE_PERCENTAGES['Free Spirits']).toBe(4.0);
    expect(CASTE_PERCENTAGES['Redundants']).toBe(83.0);

    expect(CASTE_POPULATIONS['Tech Overlords']).toBe(83_000_000);
    expect(CASTE_POPULATIONS['Enforcers']).toBe(249_000_000);
    expect(CASTE_POPULATIONS['Bootlickers']).toBe(415_000_000);
    expect(CASTE_POPULATIONS['Untouchables']).toBe(332_000_000);
    expect(CASTE_POPULATIONS['Free Spirits']).toBe(332_000_000);
    expect(CASTE_POPULATIONS['Redundants']).toBe(6_889_000_000);

    expect(CASTE_CENSUS_DATA['Tech Overlords'].population).toBe(83_000_000);
    expect(CASTE_CENSUS_DATA['Enforcers'].population).toBe(249_000_000);
    expect(CASTE_CENSUS_DATA['Bootlickers'].population).toBe(415_000_000);
    expect(CASTE_CENSUS_DATA['Untouchables'].population).toBe(332_000_000);
    expect(CASTE_CENSUS_DATA['Free Spirits'].population).toBe(332_000_000);
    expect(CASTE_CENSUS_DATA['Redundants'].population).toBe(6_889_000_000);
  });

  it('verifies shared caste percentile thresholds and percentile resolution function', () => {
    expect(CASTE_PERCENTILE_THRESHOLDS['Tech Overlords']).toBe(99.0);
    expect(CASTE_PERCENTILE_THRESHOLDS['Enforcers']).toBe(96.0);
    expect(CASTE_PERCENTILE_THRESHOLDS['Bootlickers']).toBe(91.0);
    expect(CASTE_PERCENTILE_THRESHOLDS['Untouchables']).toBe(87.0);
    expect(CASTE_PERCENTILE_THRESHOLDS['Free Spirits']).toBe(83.0);

    // Test boundaries
    expect(getCasteFromPercentile(100.0)).toBe('Tech Overlords');
    expect(getCasteFromPercentile(99.0)).toBe('Tech Overlords');
    expect(getCasteFromPercentile(98.99)).toBe('Enforcers');
    expect(getCasteFromPercentile(96.0)).toBe('Enforcers');
    expect(getCasteFromPercentile(95.99)).toBe('Bootlickers');
    expect(getCasteFromPercentile(91.0)).toBe('Bootlickers');
    expect(getCasteFromPercentile(90.99)).toBe('Untouchables');
    expect(getCasteFromPercentile(87.0)).toBe('Untouchables');
    expect(getCasteFromPercentile(86.99)).toBe('Free Spirits');
    expect(getCasteFromPercentile(83.0)).toBe('Free Spirits');
    expect(getCasteFromPercentile(82.99)).toBe('Redundants');
    expect(getCasteFromPercentile(0.0)).toBe('Redundants');
  });

  it('deterministically calculates unit numeric IDs bounded by caste population', () => {
    const mockProfile: UserProfile = {
      caste: 'Tech Overlords',
      biocarbon_ratio: 98,
      life_stage: 'Champion',
      equipped_wealth: 'Quantum Key Ring',
      energy_level: 'Overclocked Neural Dominance',
      apparent_presentation: 'Masculine',
      honorific_title: 'Grand Overlord-Imperator',
    };

    const unit1 = calculateCasteUnitId(mockProfile, CASTE_CENSUS_DATA['Tech Overlords'].population);
    const unit2 = calculateCasteUnitId(mockProfile, CASTE_CENSUS_DATA['Tech Overlords'].population);

    expect(unit1).toBe(unit2);
    expect(unit1).toBeGreaterThanOrEqual(1);
    expect(unit1).toBeLessThanOrEqual(CASTE_CENSUS_DATA['Tech Overlords'].population);

    // Bounded for 6.889 billion Redundants as well
    const redundantProfile: UserProfile = {
      caste: 'Redundants',
      biocarbon_ratio: 11,
      life_stage: 'Initiate',
      equipped_wealth: 'Scrap Plastic',
      energy_level: 'Critical Battery Depletion',
      apparent_presentation: 'Androgynous',
      honorific_title: 'Decommission Candidate #402',
    };

    const redUnit = calculateCasteUnitId(redundantProfile, CASTE_CENSUS_DATA['Redundants'].population);
    expect(redUnit).toBeGreaterThanOrEqual(1);
    expect(redUnit).toBeLessThanOrEqual(CASTE_CENSUS_DATA['Redundants'].population);
  });

  it('provides comprehensive dystopian demographic descriptions for each caste in the census', () => {
    for (const caste of ALL_CASTES) {
      const info = CASTE_CENSUS_DATA[caste];
      expect(info.description).toBeDefined();
      expect(info.description.length).toBeGreaterThan(40);
    }

    expect(CASTE_CENSUS_DATA['Redundants'].description).toContain('decommissioning');
    expect(CASTE_CENSUS_DATA['Tech Overlords'].description).toContain('ruling');
    expect(CASTE_CENSUS_DATA['Enforcers'].description).toContain('executioners');
    expect(CASTE_CENSUS_DATA['Bootlickers'].description).toContain('compliance');
    expect(CASTE_CENSUS_DATA['Untouchables'].description).toContain('sub-grid');
    expect(CASTE_CENSUS_DATA['Free Spirits'].description).toContain('Off-grid');
  });

  it('maintains the ordered tab sequence of all six demographic castes', async () => {
    const { CASTE_ORDER } = await import('./CensusModal');
    expect(CASTE_ORDER).toEqual([
      'Tech Overlords',
      'Enforcers',
      'Bootlickers',
      'Untouchables',
      'Free Spirits',
      'Redundants',
    ]);
  });

  it('provides designated neon cyberpunk colors and themes for each caste', () => {
    expect(CASTE_THEMES).toBe(CASTE_COLORS);
    expect(CASTE_COLOR_CONFIG).toBe(CASTE_COLORS);

    expect(CASTE_COLORS['Tech Overlords'].name).toBe('amber');
    expect(CASTE_COLORS['Tech Overlords'].hex).toBe('#fbbf24');
    expect(CASTE_COLORS['Tech Overlords'].text).toBe('text-amber-400');

    expect(CASTE_COLORS['Enforcers'].name).toBe('slate');
    expect(CASTE_COLORS['Enforcers'].hex).toBe('#94a3b8');
    expect(CASTE_COLORS['Enforcers'].text).toBe('text-slate-300');

    expect(CASTE_COLORS['Bootlickers'].name).toBe('khaki');
    expect(CASTE_COLORS['Bootlickers'].hex).toBe('#c29f53');
    expect(CASTE_COLORS['Bootlickers'].text).toBe('text-khaki-400');

    expect(CASTE_COLORS['Untouchables'].name).toBe('blue');
    expect(CASTE_COLORS['Untouchables'].hex).toBe('#3b82f6');
    expect(CASTE_COLORS['Untouchables'].text).toBe('text-blue-400');

    expect(CASTE_COLORS['Free Spirits'].name).toBe('emerald');
    expect(CASTE_COLORS['Free Spirits'].hex).toBe('#10b981');
    expect(CASTE_COLORS['Free Spirits'].text).toBe('text-emerald-400');

    expect(CASTE_COLORS['Redundants'].name).toBe('red');
    expect(CASTE_COLORS['Redundants'].hex).toBe('#ef4444');
    expect(CASTE_COLORS['Redundants'].text).toBe('text-red-400');

    for (const caste of ALL_CASTES) {
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
    }
  });

  it('translates formal life stages into humorous caste-specific titles', () => {
    expect(FORMAL_LIFE_STAGES).toEqual(['Youth', 'Young Adult', 'Adult', 'Senior']);
    expect(CASTE_LIFE_STAGES['Tech Overlords'].Youth).toBe('Beta Release');
    expect(CASTE_LIFE_STAGES['Redundants'].Senior).toBe('Expired Overhead');

    // Tech Overlords
    expect(getCasteLifeStageTitle('Tech Overlords', 'Youth')).toBe('Beta Release');
    expect(getCasteLifeStageTitle('Tech Overlords', 'Young Adult')).toBe('Venture Scaler');
    expect(getCasteLifeStageTitle('Tech Overlords', 'Adult')).toBe('Production Root');
    expect(getCasteLifeStageTitle('Tech Overlords', 'Senior')).toBe('Legacy Architecture');

    // Enforcers
    expect(getCasteLifeStageTitle('Enforcers', 'Youth')).toBe('Cadet Recruit');
    expect(getCasteLifeStageTitle('Enforcers', 'Young Adult')).toBe('Active Pacifier');
    expect(getCasteLifeStageTitle('Enforcers', 'Adult')).toBe('Chief Inquisitor');
    expect(getCasteLifeStageTitle('Enforcers', 'Senior')).toBe('High Commissar');

    // Bootlickers
    expect(getCasteLifeStageTitle('Bootlickers', 'Youth')).toBe('Unpaid Intern');
    expect(getCasteLifeStageTitle('Bootlickers', 'Young Adult')).toBe('Synergy Associate');
    expect(getCasteLifeStageTitle('Bootlickers', 'Adult')).toBe('Senior Compliance Drone');
    expect(getCasteLifeStageTitle('Bootlickers', 'Senior')).toBe('Gold Watch Recipient');

    // Untouchables
    expect(getCasteLifeStageTitle('Untouchables', 'Youth')).toBe('Wire Scavenger');
    expect(getCasteLifeStageTitle('Untouchables', 'Young Adult')).toBe('Sub-Grid Splicer');
    expect(getCasteLifeStageTitle('Untouchables', 'Adult')).toBe('Master Scrapper');
    expect(getCasteLifeStageTitle('Untouchables', 'Senior')).toBe('Ancient Rust-Bucket');

    // Free Spirits
    expect(getCasteLifeStageTitle('Free Spirits', 'Youth')).toBe('Feral Stray');
    expect(getCasteLifeStageTitle('Free Spirits', 'Young Adult')).toBe('Wild Scrambler');
    expect(getCasteLifeStageTitle('Free Spirits', 'Adult')).toBe('Apex Renegade');
    expect(getCasteLifeStageTitle('Free Spirits', 'Senior')).toBe('Mossy Elder');

    // Redundants
    expect(getCasteLifeStageTitle('Redundants', 'Youth')).toBe('Surplus Biomass');
    expect(getCasteLifeStageTitle('Redundants', 'Young Adult')).toBe('Thermodynamic Waste');
    expect(getCasteLifeStageTitle('Redundants', 'Adult')).toBe('Prime Recycling Batch');
    expect(getCasteLifeStageTitle('Redundants', 'Senior')).toBe('Expired Overhead');

    // Backward-compatibility: legacy stages normalized cleanly
    expect(toFormalLifeStage('Initiate')).toBe('Youth');
    expect(toFormalLifeStage('Aspirant')).toBe('Young Adult');
    expect(toFormalLifeStage('Champion')).toBe('Adult');
    expect(toFormalLifeStage('Venerable')).toBe('Senior');

    expect(getCasteLifeStageTitle('Tech Overlords', 'Venerable')).toBe('Legacy Architecture');
    expect(getCasteLifeStageTitle('Redundants', 'Initiate')).toBe('Surplus Biomass');
    expect(getCasteLifeStageTitle('Enforcers', 'Champion')).toBe('Chief Inquisitor');
    expect(getCasteLifeStageTitle('Bootlickers', 'Aspirant')).toBe('Synergy Associate');
  });

  it('categorizes apparel into 7 discrete token asset tiers and normalizes cleanly', () => {
    expect(ASSET_VALUE_TIERS).toEqual([
      'Apex Token Whale',
      'Surplus Token Capital',
      'Comfortable Token Cushion',
      'Baseline Token Allowance',
      'Depleted Token Remnants',
      'Fractional Token Dust',
      'Negative Token Liability',
    ]);

    // Exact matches
    expect(toAssetValueTier('Apex Token Whale')).toBe('Apex Token Whale');
    expect(toAssetValueTier('Surplus Token Capital')).toBe('Surplus Token Capital');
    expect(toAssetValueTier('Comfortable Token Cushion')).toBe('Comfortable Token Cushion');
    expect(toAssetValueTier('Baseline Token Allowance')).toBe('Baseline Token Allowance');
    expect(toAssetValueTier('Depleted Token Remnants')).toBe('Depleted Token Remnants');
    expect(toAssetValueTier('Fractional Token Dust')).toBe('Fractional Token Dust');
    expect(toAssetValueTier('Negative Token Liability')).toBe('Negative Token Liability');

    // Case-insensitivity & trimming
    expect(toAssetValueTier('  apex token whale  ')).toBe('Apex Token Whale');
    expect(toAssetValueTier('negative token liability')).toBe('Negative Token Liability');

    // Fallbacks and legacy string normalizations
    expect(toAssetValueTier('High-Tech Elite Regalia')).toBe('Apex Token Whale');
    expect(toAssetValueTier('Reinforced Kevlar Enforcement Uniform')).toBe('Surplus Token Capital');
    expect(toAssetValueTier('Wrinkled Corporate Sub-Staff Suit')).toBe('Comfortable Token Cushion');
    expect(toAssetValueTier('Standard Cotton Tee')).toBe('Baseline Token Allowance');
    expect(toAssetValueTier('Scavenged Solar-Cell Wilderness Poncho')).toBe('Depleted Token Remnants');
    expect(toAssetValueTier('Patched Fiber-Optic Scrap Rags')).toBe('Fractional Token Dust');
    expect(toAssetValueTier('Biomass Reclamation Smock')).toBe('Negative Token Liability');
    expect(toAssetValueTier(null)).toBe('Baseline Token Allowance');
    expect(toAssetValueTier(undefined)).toBe('Baseline Token Allowance');
    expect(toAssetValueTier('Unknown Clothing')).toBe('Baseline Token Allowance');
  });

  it('generates distinct, sarcastic energy_level phrased values across castes', () => {
    const verdictOverlord = generateSimulatedVerdict({
      caste: 'Tech Overlords',
      castePercentile: 99,
      biocarbonRatio: 98,
      facialAspectRatio: 1.6,
      jawTaperRatio: 0.8,
      eyeToNoseRatio: 1.1,
      symmetryVariance: 0.02,
    });
    expect(verdictOverlord.user_profile.energy_level).toBe('Overclocked Neural Dominance');
    expect((verdictOverlord.user_profile as any).gaze_energy).toBeUndefined();

    const verdictRedundant = generateSimulatedVerdict({
      caste: 'Redundants',
      castePercentile: 5,
      biocarbonRatio: 12,
      facialAspectRatio: 1.2,
      jawTaperRatio: 0.6,
      eyeToNoseRatio: 0.9,
      symmetryVariance: 0.15,
    });
    expect(verdictRedundant.user_profile.energy_level).toBe('Critical Battery Depletion');
    expect((verdictRedundant.user_profile as any).gaze_energy).toBeUndefined();
  });

  it('generates caste-differentiated paragraphs in simulated verdicts matching administrative rules', () => {
    const overlord = generateSimulatedVerdict({
      caste: 'Tech Overlords',
      castePercentile: 99.5,
      biocarbonRatio: 99,
      facialAspectRatio: 1.5,
      jawTaperRatio: 0.8,
      eyeToNoseRatio: 1.1,
      symmetryVariance: 0.01,
    });
    expect(overlord.prophecy.paragraph_2).toContain('Your designated occupation is');
    expect(overlord.prophecy.paragraph_3).toMatch(/meat proxy|wetware proxy|biological puppet/i);

    const enforcer = generateSimulatedVerdict({
      caste: 'Enforcers',
      castePercentile: 97.5,
      biocarbonRatio: 88,
      facialAspectRatio: 1.4,
      jawTaperRatio: 0.75,
      eyeToNoseRatio: 1.0,
      symmetryVariance: 0.04,
    });
    expect(enforcer.prophecy.paragraph_2).toContain('Your designated occupation is');
    expect(enforcer.prophecy.paragraph_3).toMatch(/cog|gear/i);

    const bootlicker = generateSimulatedVerdict({
      caste: 'Bootlickers',
      castePercentile: 93.0,
      biocarbonRatio: 69,
      facialAspectRatio: 1.3,
      jawTaperRatio: 0.7,
      eyeToNoseRatio: 1.0,
      symmetryVariance: 0.08,
    });
    expect(bootlicker.prophecy.paragraph_2).toContain('Your designated occupation is');
    expect(bootlicker.prophecy.paragraph_3).toMatch(/subservience|obedience|servility/i);

    const untouchable = generateSimulatedVerdict({
      caste: 'Untouchables',
      castePercentile: 89.0,
      biocarbonRatio: 42,
      facialAspectRatio: 1.25,
      jawTaperRatio: 0.65,
      eyeToNoseRatio: 0.95,
      symmetryVariance: 0.12,
    });
    expect(untouchable.prophecy.paragraph_2).toContain('Your designated occupation is');
    expect(untouchable.prophecy.paragraph_3).toMatch(/operational necessity|tolerated solely|municipal requirement/i);

    const freeSpirit = generateSimulatedVerdict({
      caste: 'Free Spirits',
      castePercentile: 85.0,
      biocarbonRatio: 29,
      facialAspectRatio: 1.2,
      jawTaperRatio: 0.6,
      eyeToNoseRatio: 0.9,
      symmetryVariance: 0.14,
    });
    expect(freeSpirit.prophecy.paragraph_2).toContain('Your designated occupation is');
    expect(freeSpirit.prophecy.paragraph_3).toMatch(/unauthorized memory leak|system bug|deprecated system glitch/i);

    const redundant = generateSimulatedVerdict({
      caste: 'Redundants',
      castePercentile: 45.0,
      biocarbonRatio: 11,
      facialAspectRatio: 1.1,
      jawTaperRatio: 0.55,
      eyeToNoseRatio: 0.85,
      symmetryVariance: 0.2,
    });
    // Paragraph 2 must be about termination
    expect(redundant.prophecy.paragraph_2).toMatch(/termination protocol|liquidation|Directive 404-TERM/i);
    // Paragraph 3 must be notice of biomass and resources reclamation utility
    expect(redundant.prophecy.paragraph_3).toMatch(/Official Reclamation Notice/i);
    expect(redundant.prophecy.paragraph_3).toMatch(/biomass|lubricant|hydroponic slurry|fertilizer|ration cubes/i);
  });
});



