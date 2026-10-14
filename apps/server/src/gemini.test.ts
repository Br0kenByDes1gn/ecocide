import { describe, it, expect } from 'vitest';
import {
  buildAppealPrompt,
  buildInventoryPrompt,
  buildReArbitrationPrompt,
  buildVerdictPrompt,
  generateSimulatedAppealVerdict,
  generateSimulatedReArbitration,
  normalizeInventory,
} from './gemini.js';
import type { CitizenAppeal, CitizenRecord, VerdictInput } from './gemini.js';
import { FACTIONS, buildInventoryPrompt } from '@ecocide/lore';

function makeRecord(caste = 'high-impact-offender', ratio = 42): CitizenRecord {
  return {
    id: 'appeal-test-1',
    createdAt: '2026-10-02T00:00:00.000Z',
    profile: { caste: caste as CitizenRecord['profile']['caste'], biocarbon_ratio: ratio, honorific_title: 'Single-Use Regent' },
    prophecy: {
      headline: 'HOUSEHOLD AUDIT COMPLETE',
      paragraph_1: 'O1',
      paragraph_2: 'O2',
      paragraph_3: 'O3',
    },
    audit: {
      roomType: 'kitchen',
      items: [
        {
          label: 'coffee pod',
          category: 'packaging',
          count: 3,
          ratings: { m: 5, r: 1, l: 5 },
          materialFamily: 'plastic',
          size: 'small',
          overrides: ['single-use-plastic'],
          si: 21.3,
          status: 'non-compliant',
        },
        {
          label: 'compost bin',
          category: 'waste',
          count: 1,
          ratings: { m: 1 },
          materialFamily: 'organic',
          size: 'medium',
          si: 100,
          status: 'compliant',
        },
      ],
      ratio,
      hardFails: 1,
      topOffenderLabel: 'coffee pod',
    },
    suggestions: [{ text: 'retire the pod', target_label: 'coffee pod', pledge: 'retire', impact_pct: 8 }],
  };
}

function makeVerdictInput(): VerdictInput {
  const record = makeRecord();
  return {
    items: record.audit.items,
    roomType: record.audit.roomType,
    ratio: record.audit.ratio,
    caste: record.profile.caste,
  };
}

describe('inventory prompt (PASS 1)', () => {
  it('instructs the model to audit objects only and never mention people', () => {
    const prompt = buildInventoryPrompt();
    expect(prompt).toContain('OBJECTS ONLY');
    expect(prompt).toContain('NEVER mention, describe, rate or count people');
    expect(prompt).toContain('AI Supreme Arbiter of Consumption');
  });

  it('embeds the eight-dimension rubric with 1–5 ratings', () => {
    const prompt = buildInventoryPrompt();
    for (const [key, name] of [
      ['m', 'Material type'],
      ['r', 'Recyclability'],
      ['d', 'Decomposition time'],
      ['c', 'Embodied carbon'],
      ['l', 'Lifespan / usage'],
      ['t', 'Toxicity'],
      ['p', 'Pollution shedding'],
      ['e', 'Operating energy'],
    ] as const) {
      expect(prompt).toContain(key);
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain('1 (exemplary for the ecosystem) to 5 (severe harm)');
  });

  it('normalizes raw model output: clamps ratings, dedupes, scores', () => {
    const raw = {
      room_type: 'kitchen',
      items: [
        { label: 'PET Bottles', category: 'packaging', count: 2, ratings: { m: 9, r: 1 }, justification: 'x' },
        { label: 'pet bottle', category: 'packaging', count: 1, ratings: { m: 0, r: null }, justification: 'y' },
        { label: '   ', count: 1, ratings: {} },
        { label: 'compost bin', category: 'waste', count: 1, ratings: { m: 1, r: 4, d: 1, c: 1, l: 1, t: 1, p: 1, e: null } },
      ],
    };
    const { items, roomType } = normalizeInventory(raw.items, raw.room_type);
    expect(roomType).toBe('kitchen');
    expect(items).toHaveLength(2);
    const bottle = items.find((i) => i.label === 'PET Bottles')!;
    expect(bottle.count).toBe(3); // merged
    expect(bottle.ratings.m).toBe(5); // clamped from 9
    expect(bottle.si).toBeTypeOf('number');
    expect(bottle.status).toBeDefined();
    const bin = items.find((i) => i.label === 'compost bin')!;
    expect(bin.status).toBe('compliant');
  });

  it('degrades to an empty list when the model returns garbage', () => {
    const { items, roomType } = normalizeInventory('not-an-array', null);
    expect(items).toEqual([]);
    expect(roomType).toBeNull();
  });
});

describe('verdict prompt (PASS 2)', () => {
  it('pins the deterministic tier, ratio and honorific title', () => {
    const input = makeVerdictInput();
    const prompt = buildVerdictPrompt(input);
    expect(prompt).toContain('high-impact-offender');
    expect(prompt).toContain('Household Sustainability Index (biocarbon_ratio): 42%');
    // Dominant dimension of the inventory is material (m), ratio 42 < 60 → major bank
    expect(prompt).toContain('"Petroleum Hoarder"');
  });

  it('enumerates the full tier registry with score bounds', () => {
    const prompt = buildVerdictPrompt(makeVerdictInput());
    for (const faction of FACTIONS) {
      expect(prompt).toContain(`${faction.id} (${faction.name}, score ${faction.minScore}+)`);
      expect(prompt).toContain(faction.censusDescription);
    }
  });

  it('includes the per-tier paragraph instruction blocks and the inventory summary', () => {
    const prompt = buildVerdictPrompt(makeVerdictInput());
    expect(prompt).toContain('paragraph_2 (Infraction Summary)');
    expect(prompt).toContain('paragraph_3 (Official Assessment)');
    expect(prompt).toContain('- x3 coffee pod // SI 21.3 // NON-COMPLIANT');
    expect(prompt).toContain('- x1 compost bin // SI 100.0 // COMPLIANT');
    // Step-5 override flags ride along in the summary
    expect(prompt).toContain('SINGLE-USE-PLASTIC');
  });
});

describe('appeal arbitration', () => {
  it('embeds the dossier, inventory and verbatim appeal in the ruling prompt', () => {
    const record = makeRecord();
    const prompt = buildAppealPrompt(record, 'I am NOT an offender! The bins were full.');

    expect(prompt).toContain('I am NOT an offender! The bins were full.');
    expect(prompt).toContain('High-Impact Habitual Offender');
    expect(prompt).toContain('- x3 coffee pod // SI 21.3 // NON-COMPLIANT');
    expect(prompt).toContain('AI Supreme Arbiter of Consumption');
  });

  it('simulated appeal rule is deterministic and never reclassifies onto the same tier', () => {
    const record = makeRecord('disaster-zone', 12);
    const first = generateSimulatedAppealVerdict(record, 'Please reconsider my file.');
    const second = generateSimulatedAppealVerdict(record, 'Please reconsider my file.');
    expect(first).toEqual(second);

    if (first.accepted) {
      expect(first.newCaste).toBeDefined();
      expect(first.newCaste).not.toBe('disaster-zone');
      expect(first.scripture).toHaveLength(3);
      expect(first.reason.length).toBeGreaterThan(10);
    } else {
      expect(first.reason.length).toBeGreaterThan(10);
    }
  });

  it('simulated appeal can reject unpersuasive cases deterministically', () => {
    const record = makeRecord('disaster-zone', 12);
    let accepted = false;
    let rejected = false;
    for (let i = 0; i < 20; i++) {
      const v = generateSimulatedAppealVerdict(record, `case-${i} grovel grovel`);
      if (v.accepted) accepted = true;
      else rejected = true;
      if (accepted && rejected) break;
    }
    expect(accepted).toBe(true);
    expect(rejected).toBe(true);
  });
});

describe('re-arbitration', () => {
  const appeal: CitizenAppeal = {
    id: 'appeal-2',
    dossierId: 'appeal-test-1',
    appealText: 'I hereby petition for re-classification as Marginally Acceptable Human.',
    accepted: true,
    newCaste: 'marginally-acceptable-human',
    newHonorificTitle: 'Re-Assigned Household',
    headline: 'GRANTED',
    reason: 'accepted',
    scripture: ['a', 'b', 'c'],
    casteBefore: 'high-impact-offender',
    casteAfter: 'marginally-acceptable-human',
    createdAt: '2026-10-02T00:00:00.000Z',
  };

  it('builds a text-only prompt pinned to the new tier with the appeal in paragraph 1 only', () => {
    const prompt = buildReArbitrationPrompt(makeRecord(), appeal);

    expect(prompt).toContain('Marginally Acceptable Human');
    expect(prompt).toContain('I hereby petition for re-classification as Marginally Acceptable Human.');
    expect(prompt).toContain('paragraph_1 must acknowledge the GRANTED appeal');
    expect(prompt).toContain('- x3 coffee pod // SI 21.3 // NON-COMPLIANT');
    expect(prompt).not.toContain('inlineData');
  });

  it('simulated re-arbitration is deterministic, mentions the appeal in p1 only, and pins the new tier', () => {
    const first = generateSimulatedReArbitration(makeRecord(), appeal);
    const second = generateSimulatedReArbitration(makeRecord(), appeal);
    expect(first).toEqual(second);
    expect(first.headline).toContain('MARGINALLY ACCEPTABLE HUMAN');
    expect(first.scripture[0]).toContain('I hereby petition for re-classification');
    expect(first.scripture[1]).not.toContain('petition');
    expect(first.scripture[2]).not.toContain('petition');
  });
});