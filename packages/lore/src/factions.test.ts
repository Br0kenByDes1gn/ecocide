// ---------------------------------------------------------------------------
// Taxonomy invariants for the new ECOCIDE tiers (art_directions.md §7).
// The tier bands are the shared truth between lore, types, server and web.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  FACTIONS,
  FACTION_IDS,
  householdTitle,
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

  // The disposition mark is the second stamp on a dossier (opposite the
  // injunction's): a short stamped phrase, line-icon glyph keys, and the file
  // detail it opens. A tier without one would render an empty mark in the UI.
  it('every tier carries a unique disposition mark (label, icon keys, detail)', () => {
    const labels = new Set<string>();
    for (const f of FACTIONS) {
      const { label, icons, detail } = f.disposition;
      expect(label.length, `${f.id} disposition label`).toBeGreaterThan(0);
      // Stamped like `stampText`, so it is authored in caps in the pack.
      expect(label, `${f.id} disposition label is stamped`).toBe(label.toUpperCase());
      expect(detail.length, `${f.id} disposition detail`).toBeGreaterThan(40);
      // Keys, not components — the web resolves them (`lib/lore-icons.ts`).
      expect(icons.length, `${f.id} disposition icons`).toBeGreaterThan(0);
      for (const key of icons) {
        expect(key, `${f.id} icon key is a kebab-case key`).toMatch(/^[a-z][a-z-]*$/);
      }
      // The mark is a stamp, not a poster: one glyph, or two at most.
      expect(icons.length, `${f.id} has at most two glyphs`).toBeLessThanOrEqual(2);
      labels.add(label);
    }
    // Distinct marks, or the stamp stops telling tiers apart.
    expect(labels.size).toBe(FACTIONS.length);
  });

  it('marks the two handled tiers with the recycling sign, worst with a skull', () => {
    // The Bureau stops grading these households and starts handling them.
    expect(getFaction('power-grid-liability').disposition.icons).toEqual(['recycle']);
    expect(getFaction('disaster-zone').disposition.icons).toEqual(['skull', 'recycle']);
  });

  it('household titles are deterministic and driven by material / dimension / ratio', () => {
    // Plastic material or shedding dominates
    expect(householdTitle({ ratio: 20, dominant: 'm', dominantMaterial: 'plastic' })).toBe('Petroleum Hoarder');
    expect(householdTitle({ ratio: 75, dominant: 'p', dominantMaterial: 'glass' })).toBe('Petroleum Hoarder');
    // Textiles / electronics dominate by material family
    expect(householdTitle({ ratio: 30, dominant: 'm', dominantMaterial: 'textile' })).toBe('Fast-Fashion Collector');
    expect(householdTitle({ ratio: 30, dominant: 'e', dominantMaterial: 'electronic' })).toBe('Gadget Graveyard Keeper');
    // Dimension drivers
    expect(householdTitle({ ratio: 30, dominant: 'l', dominantMaterial: 'paper' })).toBe('Disposable Enthusiast');
    expect(householdTitle({ ratio: 30, dominant: 'e', dominantMaterial: 'metal' })).toBe('Watt Wizard');
    // Compliant households with no worse driver
    expect(householdTitle({ ratio: 91, dominant: 'm', dominantMaterial: 'organic' })).toBe('Model Citizen (grudgingly)');
    // Dimension fallbacks below the compliant threshold
    expect(householdTitle({ ratio: 30, dominant: 'c', dominantMaterial: 'glass' })).toBe('Embodied Carbon Baron');
    expect(householdTitle({ ratio: 30, dominant: 'r', dominantMaterial: 'metal' })).toBe('Bin Protocol Violator');
    expect(householdTitle({ ratio: 30, dominant: null, dominantMaterial: null })).toBe('Model Citizen (grudgingly)');
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