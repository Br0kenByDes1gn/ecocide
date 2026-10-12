import { describe, expect, it } from 'vitest';
import { CASTE_COLORS, CASTE_ORDER } from '@ecocide/types';
import {
  POLYGON_PORTRAIT_STYLES,
} from '../lib/polygon-portrait';

describe('BiometricPortraitLab Controls & Configuration', () => {
  it('exposes all 4 polygon biometric styles for zero-AI client experimentation', () => {
    expect(POLYGON_PORTRAIT_STYLES.length).toBe(4);
    const ids = POLYGON_PORTRAIT_STYLES.map((s) => s.id);
    expect(ids).toContain('faceted-poly');
    expect(ids).toContain('surveillance-wireframe');
    expect(ids).toContain('neon-hologram');
    expect(ids).toContain('thermal-scan');

    for (const style of POLYGON_PORTRAIT_STYLES) {
      expect(style.label).toBeTruthy();
      expect(style.subtitle).toBeTruthy();
      expect(style.description).toBeTruthy();
    }
  });

  it('provides distinct accent colors for every registered classification', () => {
    expect(CASTE_ORDER.length).toBeGreaterThanOrEqual(2);
    const seen = new Set<string>();
    for (const caste of CASTE_ORDER) {
      const color = CASTE_COLORS[caste].hex;
      expect(color).toBeDefined();
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      seen.add(color);
    }
    // Every classification carries its own accent hue.
    expect(seen.size).toBe(CASTE_ORDER.length);
  });
});