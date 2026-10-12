import { describe, it, expect } from 'vitest';
import {
  buildAppealPrompt,
  buildOraclePrompt,
  buildReArbitrationPrompt,
  generateSimulatedAppealVerdict,
  generateSimulatedReArbitration,
} from './gemini.js';
import type { BiometricTelemetry, CitizenAppeal, CitizenRecord } from '@ecocide/types';

describe('buildOraclePrompt caste paragraph differentiation', () => {
  const baseTelemetry: Omit<BiometricTelemetry, 'caste' | 'castePercentile'> = {
    biocarbonRatio: 84,
    facialAspectRatio: 1.35,
    jawTaperRatio: 0.72,
    symmetryVariance: 0.02,
  };

  it('generates meat proxy appraisal for Tech Overlords in paragraph 3 and daily duty in paragraph 2', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Tech Overlords',
      castePercentile: 99.5,
    });

    expect(prompt).toContain('Biocarbon Compliance Ratio of 84%');
    expect(prompt).toContain('paragraph_1 (Biometric Audit & Roasting)');
    expect(prompt).toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
    expect(prompt).toContain('paragraph_3 (Administrative Appraisal - Meat Proxies)');
    expect(prompt).toContain('biological wetware / meat proxies');
  });

  it('generates cog in the machine appraisal for Enforcers in paragraph 3', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Enforcers',
      castePercentile: 97.5,
    });

    expect(prompt).toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
    expect(prompt).toContain('paragraph_3 (Administrative Appraisal - Cogs in the Machine)');
    expect(prompt).toContain('cogs in the municipal enforcement machine');
  });

  it('generates subservience appraisal for Bootlickers in paragraph 3', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Bootlickers',
      castePercentile: 93.0,
    });

    expect(prompt).toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
    expect(prompt).toContain('paragraph_3 (Administrative Appraisal - Subservience)');
    expect(prompt).toContain('pathetic, exemplary subservience');
  });

  it('generates unpleasant necessity acknowledgment for Untouchables in paragraph 3', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Untouchables',
      castePercentile: 89.0,
    });

    expect(prompt).toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
    expect(prompt).toContain('paragraph_3 (Administrative Acknowledgment - Unpleasant Necessity)');
    expect(prompt).toContain('unpleasant but tolerated operational necessity');
  });

  it('generates system bug acknowledgment for Free Spirits in paragraph 3', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Free Spirits',
      castePercentile: 85.0,
    });

    expect(prompt).toContain('paragraph_3 (Administrative Acknowledgment - System Bug)');
    expect(prompt).toContain('anomalous bug in the system');
    expect(prompt).toContain('"fixing"');
  });

  it('projects Free Spirits paragraph_2 as a dismissive feral/wildling existence instead of an occupation', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Free Spirits',
      castePercentile: 85.0,
    });

    expect(prompt).toMatch(/paragraph_2 \(Dismissive Appraisal of Feral Existence\)/);
    expect(prompt).toMatch(/forge roots|foraging roots/i);
    expect(prompt).toMatch(/wild fauna|feral/i);
    expect(prompt).not.toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
  });

  it('generates scheduled termination in paragraph 2 and biomass reclamation notice in paragraph 3 for Redundants', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: 'Redundants',
      castePercentile: 42.0,
    });

    expect(prompt).toContain('paragraph_1 (Biometric Audit & Roasting)');
    expect(prompt).toContain('paragraph_2 (Scheduled Termination & Liquidation Order)');
    expect(prompt).not.toContain('paragraph_2 (Absurd Daily Occupation & Operational Duties)');
    expect(prompt).toContain('paragraph_3 (Administrative Notice - Biomass & Resource Reclamation Utility)');
    expect(prompt).toContain('biomass, caloric energy, and physical resources reclaimed from their terminated body');
  });
});

describe('appeal arbitration', () => {
  const appealDossier: CitizenRecord = {
    id: 'appeal-test-1',
    createdAt: '2026-10-02T00:00:00.000Z',
    profile: {
      caste: 'Redundants',
      biocarbon_ratio: 27,
      life_stage: 'Adult',
      equipped_wealth: 'Scrap Rags',
      energy_level: 'Critical Battery Depletion',
      apparent_presentation: 'Androgynous',
      honorific_title: 'Decommission Candidate #404',
    },
    prophecy: {
      headline: 'RECYCLING MANDATE',
      paragraph_1: 'O1',
      paragraph_2: 'O2',
      paragraph_3: 'O3',
    },
  };

  it('embeds the current dossier and the verbatim appeal in the ruling prompt', () => {
    const prompt = buildAppealPrompt(appealDossier, 'I am NOT redundant! This is a clerical calamity.');
    expect(prompt).toContain('I am NOT redundant! This is a clerical calamity.');
    expect(prompt).toContain('Redundants');
    expect(prompt).toContain('Decommission Candidate #404');
  });

  it('simulated appeal rule is deterministic and never reclassifies onto the same caste', () => {
    const first = generateSimulatedAppealVerdict(appealDossier, 'Please reconsider my file.');
    const second = generateSimulatedAppealVerdict(appealDossier, 'Please reconsider my file.');
    expect(first).toEqual(second);

    if (first.accepted) {
      expect(first.newCaste).toBeDefined();
      expect(first.newCaste).not.toBe('Redundants');
      expect(first.scripture).toHaveLength(3);
      expect(first.reason.length).toBeGreaterThan(10);
    } else {
      expect(first.reason.length).toBeGreaterThan(10);
    }
  });

  it('simulated appeal can reject unpersuasive cases deterministically', () => {
    // sweep a few inputs to find one that is rejected and one that is accepted
    let accepted = false;
    let rejected = false;
    for (let i = 0; i < 20; i++) {
      const v = generateSimulatedAppealVerdict(appealDossier, `case-${i} grovel grovel`);
      if (v.accepted) accepted = true;
      else rejected = true;
      if (accepted && rejected) break;
    }
    expect(accepted).toBe(true);
    expect(rejected).toBe(true);
  });
});

describe('re-arbitration', () => {
  const dossier: CitizenRecord = {
    id: 'appeal-test-1',
    createdAt: '2026-10-02T00:00:00.000Z',
    profile: {
      caste: 'Untouchables',
      biocarbon_ratio: 22,
      life_stage: 'Adult',
      equipped_wealth: 'Scrap Rags',
      energy_level: 'Sluggish Brownout Exhaustion',
      apparent_presentation: 'Androgynous',
      honorific_title: 'Sub-Grid Splice Master',
    },
    prophecy: {
      headline: 'CONDUIT DUTY ASSIGNED',
      paragraph_1: 'O1',
      paragraph_2: 'O2',
      paragraph_3: 'O3',
    },
  };

  const appeal: CitizenAppeal = {
    id: 'appeal-2',
    dossierId: 'appeal-test-1',
    appealText: 'I hereby petition for re-classification as an Enforcer.',
    accepted: true,
    newCaste: 'Enforcers',
    newHonorificTitle: 'Appealed Enforcer',
    headline: 'GRANTED',
    reason: 'accepted',
    scripture: ['a', 'b', 'c'],
    casteBefore: 'Untouchables',
    casteAfter: 'Enforcers',
    createdAt: '2026-10-02T00:00:00.000Z',
  };

  it('builds an oracle-style prompt pinned to the new caste with the appeal in paragraph 1 only', () => {
    const prompt = buildReArbitrationPrompt(dossier, appeal);
    expect(prompt).toContain('Enforcers');
    expect(prompt).toContain('I hereby petition for re-classification as an Enforcer.');
    expect(prompt).toContain('paragraph_1 (Biometric Audit & Appeal Acknowledgment)');
    expect(prompt).toMatch(/paragraph_2 \(Absurd Daily Occupation/);
    expect(prompt).toMatch(/paragraph_3 \(Administrative Appraisal - Cogs in the Machine/);
  });

  it('simulated re-arbitration is deterministic, mentions the appeal in p1 only, and pins the new caste', () => {
    const first = generateSimulatedReArbitration(dossier, appeal);
    const second = generateSimulatedReArbitration(dossier, appeal);
    expect(first).toEqual(second);
    expect(first.headline).toContain('ENFORCERS');
    expect(first.newHonorificTitle).toContain('Enforcer');
    expect(first.scripture[0]).toContain('I hereby petition for re-classification as an Enforcer.');
    // the appeal text appears only in paragraph 1
    expect(first.scripture[1]).not.toContain('petition');
    expect(first.scripture[2]).not.toContain('petition');
  });

  it('simulated re-arbitration for Free Spirits uses the dismissive feral paragraph_2', () => {
    const feralAppeal: CitizenAppeal = {
      ...appeal,
      newCaste: 'Free Spirits',
      newHonorificTitle: 'Wilderness Scrambler',
      casteAfter: 'Free Spirits',
    };
    const verdict = generateSimulatedReArbitration(dossier, feralAppeal);
    expect(verdict.scripture[1]).toMatch(/feral|wild fauna|forage/);
    expect(verdict.scripture[1]).not.toContain('designated occupation');
    expect(verdict.scripture[0]).toContain('I hereby petition for re-classification as an Enforcer.');
  });
});
