import { describe, expect, it } from 'vitest';
import {
  CASTE_COLORS,
  CASTE_ORDER,
  FACTIONS,
  getCasteFromScore,
  simulateTierRoom,
} from '@ecocide/types';
import { SIMULATED_ROOMS } from '@ecocide/lore';

describe('DebugBench Configuration & Presets', () => {
  it('covers every registered tier for manual testing', () => {
    expect(CASTE_ORDER.length).toBe(FACTIONS.length);
    expect(CASTE_ORDER.length).toBeGreaterThanOrEqual(2);
    expect(CASTE_ORDER).toEqual(FACTIONS.map((f) => f.id));
    expect(Object.keys(SIMULATED_ROOMS)).toEqual(CASTE_ORDER);
  });

  it('provides designated colors for every tier', () => {
    for (const caste of CASTE_ORDER) {
      const color = CASTE_COLORS[caste];
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.glowHex).toContain('rgba(');
      expect(color.text).toBeDefined();
      expect(color.badge).toBeDefined();
      expect(color.barColor).toBeDefined();
    }
  });

  it('every exhibit room lands EXACTLY in its own tier band', () => {
    for (const caste of CASTE_ORDER) {
      const scan = simulateTierRoom(caste);
      expect(scan.caste).toBe(caste);
      expect(getCasteFromScore(scan.ratio)).toBe(caste);
    }
  });

  it('produce self-consistent simulated payloads for every tier', () => {
    for (const caste of CASTE_ORDER) {
      const scan = simulateTierRoom(caste);
      const { payload } = scan;

      expect(payload.user_profile.caste).toBe(caste);
      expect(payload.user_profile.biocarbon_ratio).toBe(scan.ratio);
      expect(payload.audit.ratio).toBe(scan.ratio);
      expect(payload.audit.roomType).toBe(SIMULATED_ROOMS[caste].roomType);

      // Inventory consistency.
      expect(payload.audit.items.length).toBeGreaterThan(0);
      expect(payload.audit.hardFails).toBe(
        payload.audit.items.filter((i) => (i.overrides?.length ?? 0) > 0).length
      );
      expect(payload.audit.topOffenderLabel).not.toBeNull();

      // Copy is non-empty and honors the tier.
      expect(payload.user_profile.honorific_title.length).toBeGreaterThan(0);
      const factionName = FACTIONS.find((f) => f.id === caste)!.name.toUpperCase();
      expect(payload.prophecy.headline).toContain(factionName);
    }
  });

  it('dedupes merged items so counts include every copy', () => {
    const scan = simulateTierRoom('statistically-average-polluter');
    const total = scan.audit.items.reduce((sum, i) => sum + i.count, 0);
    expect(total).toBeGreaterThan(0);
    const labels = scan.audit.items.map((i) => i.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('simulated exhibits are deterministic for the same tier', () => {
    const a = simulateTierRoom('disaster-zone');
    const b = simulateTierRoom('disaster-zone');
    expect(a.payload).toEqual(b.payload);
    expect(a.items.map((i) => `${i.label}:${i.count}`)).toEqual(b.items.map((i) => `${i.label}:${i.count}`));
  });
});