// ---------------------------------------------------------------------------
// Taxonomy invariants for the new ECOCIDE tiers (art_directions.md §7).
// The tier bands are the shared truth between lore, types, server and web.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  FACTIONS,
  FACTION_IDS,
  dimensionTitle,
  factionIndex,
  generateSimulatedInventory,
  getFaction,
  getFactionFromScore,
  scoreThresholds,
} from './index.js';

describe('tier taxonomy (art §7)', () => {
  it('defines exactly six tiers with the mandated names, in order', () => {
    expect(FACTIONS.map((f) => f.name)).toEqual([
      'Carbon Neutral Legend',
      'Marginally Acceptable Human',
      'Statistically Average Polluter',
      'High-Impact Habitual Offender',
      'Power Grid Liability',
      'Environmental Disaster Zone',
    ]);
  });

  it('bands are 90 / 75 / 60 / 40 / 20 / 0, monotonic descending', () => {
    const thresholds = scoreThresholds();
    const values = FACTION_IDS.map((id) => thresholds[id]);
    expect(values).toEqual([90, 75, 60, 40, 20, 0]);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it('maps scores deterministically with inclusive lower bounds', () => {
    expect(getFactionFromScore(100)).toBe('carbon-neutral-legend');
    expect(getFactionFromScore(90)).toBe('carbon-neutral-legend');
    expect(getFactionFromScore(89)).toBe('marginally-acceptable-human');
    expect(getFactionFromScore(75)).toBe('marginally-acceptable-human');
    expect(getFactionFromScore(74)).toBe('statistically-average-polluter');
    expect(getFactionFromScore(60)).toBe('statistically-average-polluter');
    expect(getFactionFromScore(59)).toBe('high-impact-offender');
    expect(getFactionFromScore(40)).toBe('high-impact-offender');
    expect(getFactionFromScore(39)).toBe('power-grid-liability');
    expect(getFactionFromScore(20)).toBe('power-grid-liability');
    expect(getFactionFromScore(19)).toBe('disaster-zone');
    expect(getFactionFromScore(0)).toBe('disaster-zone');
  });

  it('every tier has a stamp, a verdict line and colors', () => {
    for (const f of FACTIONS) {
      expect(f.stampText.length).toBeGreaterThan(0);
      expect(f.verdictLine.length).toBeGreaterThan(0);
      expect(f.colors.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(f.stampInk).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('dimension titles are deterministic and bounded by ratio severity', () => {
    expect(dimensionTitle('c', 20)).toBe('Embodied Carbon Baron');
    expect(dimensionTitle('c', 75)).toBe('Carbon-Curious');
    expect(dimensionTitle('e', 10)).toBe('Phantom Load Keeper');
    expect(dimensionTitle('m', 90)).toBe('Plastic-Curious');
    // unknown dimension falls back to the material bank
    expect(dimensionTitle('x' as never, 30)).toBe('Petroleum Hoarder');
  });
});

describe('simulated inventory', () => {
  it('is deterministic for the same seed', () => {
    const a = generateSimulatedInventory('evidence-hash');
    const b = generateSimulatedInventory('evidence-hash');
    expect(a.map((i) => `${i.label}:${i.count}`)).toEqual(b.map((i) => `${i.label}:${i.count}`));
    expect(a).toHaveLength(b.length);
  });

  it('emits 8–14 items with 1–5 ratings and valid bounds', () => {
    const items = generateSimulatedInventory('room-photo');
    expect(items.length).toBeGreaterThanOrEqual(8);
    expect(items.length).toBeLessThanOrEqual(14);
    for (const item of items) {
      expect(item.count).toBeGreaterThanOrEqual(1);
      for (const value of Object.values(item.ratings)) {
        if (value !== null) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(5);
        }
      }
      if (item.bounds) {
        expect(item.bounds.x1).toBeGreaterThanOrEqual(0);
        expect(item.bounds.x2).toBeLessThanOrEqual(1);
        expect(item.bounds.x2).toBeGreaterThan(item.bounds.x1);
        expect(item.bounds.y2).toBeGreaterThan(item.bounds.y1);
      }
    }
  });

  it('never repeats the same archetype twice in one audit', () => {
    const labels = generateSimulatedInventory('busy-kitchen').map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('resolves every faction id through the index helpers', () => {
    for (const id of FACTION_IDS) {
      expect(factionIndex(id)).toBeGreaterThanOrEqual(0);
      expect(getFaction(id).id).toBe(id);
    }
    expect(getFaction('bogus').id).toBe('disaster-zone'); // unknown → worst tier
  });
});