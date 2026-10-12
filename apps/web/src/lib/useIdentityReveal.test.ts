import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@ecocide/types';
import {
  buildIdentityRevealSteps,
  fullIdentityReveal,
  COMPLIANCE_COUNT_STEPS,
} from './useIdentityReveal';

const firstClassProfile: UserProfile = {
  caste: 'class-i',
  biocarbon_ratio: 98,
  life_stage: 'Adult',
  equipped_wealth: 'Baseline',
  energy_level: 'Peak Output',
  apparent_presentation: 'Masculine',
  honorific_title: 'Class I Member #1234',
};

describe('useIdentityReveal helpers', () => {
  it('fills the stats in the mandated order: title, presentation, utility grade, asset value, energy level', () => {
    const steps = buildIdentityRevealSteps(firstClassProfile);
    expect(steps.map((s) => s.phase)).toEqual([
      'title',
      'presentation',
      'utility',
      'asset',
      'energy',
    ]);
  });

  it('maps each reveal step to the exact dossier stat value', () => {
    const steps = buildIdentityRevealSteps(firstClassProfile);
    expect(steps[0].value).toBe('Class I Member #1234'); // title
    expect(steps[1].value).toBe('Masculine'); // presentation
    expect(steps[2].value).toBe('Adult'); // utility grade (Adult)
    expect(steps[3].value).toBe('Baseline'); // asset value
    expect(steps[4].value).toBe('Peak Output'); // energy level
  });

  it('keeps the Biocarbon Compliance Ratio count-up as a bounded step count', () => {
    expect(COMPLIANCE_COUNT_STEPS).toBeGreaterThanOrEqual(10);
    expect(COMPLIANCE_COUNT_STEPS).toBeLessThanOrEqual(100);
  });

  it('fullIdentityReveal reveals every stat immediately with formatted values', () => {
    const reveal = fullIdentityReveal(firstClassProfile);
    expect(reveal.isComplete).toBe(true);
    expect(reveal.phase).toBe('done');
    expect(reveal.meshVisible).toBe(true);
    expect(reveal.titleText).toBe('Class I Member #1234');
    expect(reveal.presentationText).toBe('Masculine');
    expect(reveal.utilityText).toBe('Adult');
    expect(reveal.assetText).toBe('Baseline');
    expect(reveal.energyText).toBe('Peak Output');
    expect(reveal.complianceText).toBe('98%');
  });

  it('fullIdentityReveal resolves the caste life stage title from legacy stages too', () => {
    const legacyProfile: UserProfile = {
      ...firstClassProfile,
      life_stage: 'Champion',
    };
    const reveal = fullIdentityReveal(legacyProfile);
    expect(reveal.utilityText).toBe('Adult');
  });
});