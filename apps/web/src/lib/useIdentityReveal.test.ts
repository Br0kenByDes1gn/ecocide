import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@ecocide/types';
import {
  buildIdentityRevealSteps,
  fullIdentityReveal,
  COMPLIANCE_COUNT_STEPS,
} from './useIdentityReveal';

const techOverlordProfile: UserProfile = {
  caste: 'Tech Overlords',
  biocarbon_ratio: 98,
  life_stage: 'Adult',
  equipped_wealth: 'Apex Token Whale',
  energy_level: 'Overclocked Neural Dominance',
  apparent_presentation: 'Masculine',
  honorific_title: 'Grand Overlord-Imperator',
};

describe('useIdentityReveal helpers', () => {
  it('fills the stats in the mandated order: title, presentation, utility grade, asset value, energy level', () => {
    const steps = buildIdentityRevealSteps(techOverlordProfile);
    expect(steps.map((s) => s.phase)).toEqual([
      'title',
      'presentation',
      'utility',
      'asset',
      'energy',
    ]);
  });

  it('maps each reveal step to the exact dossier stat value', () => {
    const steps = buildIdentityRevealSteps(techOverlordProfile);
    expect(steps[0].value).toBe('Grand Overlord-Imperator'); // title
    expect(steps[1].value).toBe('Masculine'); // presentation
    expect(steps[2].value).toBe('Production Root'); // utility grade (Adult)
    expect(steps[3].value).toBe('Apex Token Whale'); // asset value
    expect(steps[4].value).toBe('Overclocked Neural Dominance'); // energy level
  });

  it('keeps the Biocarbon Compliance Ratio count-up as a bounded step count', () => {
    expect(COMPLIANCE_COUNT_STEPS).toBeGreaterThanOrEqual(10);
    expect(COMPLIANCE_COUNT_STEPS).toBeLessThanOrEqual(100);
  });

  it('fullIdentityReveal reveals every stat immediately with formatted values', () => {
    const reveal = fullIdentityReveal(techOverlordProfile);
    expect(reveal.isComplete).toBe(true);
    expect(reveal.phase).toBe('done');
    expect(reveal.meshVisible).toBe(true);
    expect(reveal.titleText).toBe('Grand Overlord-Imperator');
    expect(reveal.presentationText).toBe('Masculine');
    expect(reveal.utilityText).toBe('Production Root');
    expect(reveal.assetText).toBe('Apex Token Whale');
    expect(reveal.energyText).toBe('Overclocked Neural Dominance');
    expect(reveal.complianceText).toBe('98%');
  });

  it('fullIdentityReveal resolves the caste life stage title from legacy stages too', () => {
    const legacyProfile: UserProfile = {
      ...techOverlordProfile,
      life_stage: 'Champion',
    };
    const reveal = fullIdentityReveal(legacyProfile);
    expect(reveal.utilityText).toBe('Production Root');
  });
});