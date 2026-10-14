import { describe, it, expect } from 'vitest';
import {
  buildAppealPrompt,
  buildOraclePrompt,
  buildReArbitrationPrompt,
  generateSimulatedAppealVerdict,
  generateSimulatedReArbitration,
} from './gemini.js';
import type { BiometricTelemetry, CitizenAppeal, CitizenRecord } from '@ecocide/types';
import { FACTIONS, getFaction } from '@ecocide/lore';

describe('buildOraclePrompt (placeholder lore pack)', () => {
  const baseTelemetry: Omit<BiometricTelemetry, 'caste' | 'castePercentile'> = {
    biocarbonRatio: 84,
    facialAspectRatio: 1.35,
    jawTaperRatio: 0.72,
    symmetryVariance: 0.02,
  };
  const firstFaction = FACTIONS[0];

  it('addresses the Carbon Minded AI and embeds the telemetry', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: firstFaction.id,
      castePercentile: 90,
    });

    expect(prompt).toContain('Carbon Minded AI');
    expect(prompt).toContain('Compliance Ratio of 84%');
    expect(prompt).toContain(`Designation: "${firstFaction.name}"`);
  });

  it('enumerates the entire faction registry with quotas', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: firstFaction.id,
      castePercentile: 90,
    });

    for (const faction of FACTIONS) {
      expect(prompt).toContain(`${faction.name} (${faction.quotaPct}%`);
      expect(prompt).toContain(faction.censusDescription);
    }
  });

  it('includes the per-faction paragraph instruction blocks', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: firstFaction.id,
      castePercentile: 90,
    });

    expect(prompt).toContain('paragraph_1 (Biometric Audit)');
    expect(prompt).toContain('paragraph_2 (Assigned Duties)');
    expect(prompt).toContain('paragraph_3 (Official Assessment)');

    // The overflow faction follows the same structural protocol.
    const overflow = FACTIONS[FACTIONS.length - 1];
    const overflowPrompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: overflow.id,
      castePercentile: 5,
    });
    expect(overflowPrompt).toContain('paragraph_2 (Assigned Duties)');
    expect(overflowPrompt).toContain('paragraph_3 (Official Assessment)');
    expect(overflowPrompt).toContain(overflow.name);
  });

  it('enumerates the wealth tiers in the assessment protocol', () => {
    const prompt = buildOraclePrompt({
      ...baseTelemetry,
      caste: firstFaction.id,
      castePercentile: 90,
    });

    expect(prompt).toContain('"Abundant"');
    expect(prompt).toContain('"Depleted"');
    expect(prompt).toContain('"Baseline"');
  });
});

describe('appeal arbitration', () => {
  const appealDossier: CitizenRecord = {
    id: 'appeal-test-1',
    createdAt: '2026-10-02T00:00:00.000Z',
    profile: {
      caste: 'class-vi',
      biocarbon_ratio: 27,
      life_stage: 'Adult',
      equipped_wealth: 'Baseline',
      energy_level: 'Standby',
      apparent_presentation: 'Androgynous',
      honorific_title: 'Class VI Member #404',
    },
    prophecy: {
      headline: 'PROVISIONAL',
      paragraph_1: 'O1',
      paragraph_2: 'O2',
      paragraph_3: 'O3',
    },
  };

  it('embeds the current dossier and the verbatim appeal in the ruling prompt', () => {
    const prompt = buildAppealPrompt(appealDossier, 'I am NOT class-vi! This is a clerical error.');

    expect(prompt).toContain('I am NOT class-vi! This is a clerical error.');
    expect(prompt).toContain('Class VI');
    expect(prompt).toContain('Class VI Member #404');
    expect(prompt).toContain('Carbon Minded AI');
  });

  it('simulated appeal rule is deterministic and never reclassifies onto the same faction', () => {
    const first = generateSimulatedAppealVerdict(appealDossier, 'Please reconsider my file.');
    const second = generateSimulatedAppealVerdict(appealDossier, 'Please reconsider my file.');
    expect(first).toEqual(second);

    if (first.accepted) {
      expect(first.newCaste).toBeDefined();
      expect(first.newCaste).not.toBe('class-vi');
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
      caste: 'class-iv',
      biocarbon_ratio: 22,
      life_stage: 'Adult',
      equipped_wealth: 'Baseline',
      energy_level: 'Reduced Output',
      apparent_presentation: 'Androgynous',
      honorific_title: 'Provisional Class IV Member',
    },
    prophecy: {
      headline: 'PROVISIONAL',
      paragraph_1: 'O1',
      paragraph_2: 'O2',
      paragraph_3: 'O3',
    },
  };

  const appeal: CitizenAppeal = {
    id: 'appeal-2',
    dossierId: 'appeal-test-1',
    appealText: 'I hereby petition for re-classification as Class II.',
    accepted: true,
    newCaste: 'class-ii',
    newHonorificTitle: 'Re-Assigned Class II Member',
    headline: 'GRANTED',
    reason: 'accepted',
    scripture: ['a', 'b', 'c'],
    casteBefore: 'class-iv',
    casteAfter: 'class-ii',
    createdAt: '2026-10-02T00:00:00.000Z',
  };

  it('builds an oracle-style prompt pinned to the new faction with the appeal in paragraph 1 only', () => {
    const prompt = buildReArbitrationPrompt(dossier, appeal);

    expect(prompt).toContain('Class II');
    expect(prompt).toContain('I hereby petition for re-classification as Class II.');
    expect(prompt).toContain('paragraph_1 (Biometric Audit & Appeal Acknowledgment)');
    expect(prompt).toMatch(/paragraph_2 \(Assigned Duties/);
    expect(prompt).toMatch(/paragraph_3 \(Official Assessment/);
  });

  it('simulated re-arbitration is deterministic, mentions the appeal in p1 only, and pins the new faction', () => {
    const first = generateSimulatedReArbitration(dossier, appeal);
    const second = generateSimulatedReArbitration(dossier, appeal);
    expect(first).toEqual(second);
    expect(first.headline).toContain(getFaction('class-ii').name.toUpperCase());
    expect(first.newHonorificTitle).toContain(getFaction('class-ii').memberTitle);
    expect(first.scripture[0]).toContain('I hereby petition for re-classification as Class II.');
    // the appeal text appears only in paragraph 1
    expect(first.scripture[1]).not.toContain('petition');
    expect(first.scripture[2]).not.toContain('petition');
  });
});