import { describe, expect, it } from 'vitest';
import type { Caste } from '@ecocide/types';
import {
  POLYGON_PORTRAIT_STYLES,
} from '../lib/polygon-portrait';

describe('BiometricPortraitLab Controls & Configuration', () => {
  const ALL_CASTES: Caste[] = [
    'Tech Overlords',
    'Enforcers',
    'Bootlickers',
    'Untouchables',
    'Free Spirits',
    'Redundants',
  ];

  const CASTE_ACCENT_COLORS: Record<Caste, string> = {
    'Tech Overlords': '#fbbf24',
    Enforcers: '#38bdf8',
    Bootlickers: '#00f3ff',
    Untouchables: '#00ff66',
    'Free Spirits': '#e879f9',
    Redundants: '#ef4444',
  };

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

  it('provides distinct accent colors for all dystopian castes', () => {
    for (const caste of ALL_CASTES) {
      const color = CASTE_ACCENT_COLORS[caste];
      expect(color).toBeDefined();
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('verifies that each caste color matches cyber theme expectations', () => {
    expect(CASTE_ACCENT_COLORS['Tech Overlords']).toBe('#fbbf24'); // Gold
    expect(CASTE_ACCENT_COLORS['Bootlickers']).toBe('#00f3ff');   // Cyan
    expect(CASTE_ACCENT_COLORS['Untouchables']).toBe('#00ff66');  // Labor green
    expect(CASTE_ACCENT_COLORS['Redundants']).toBe('#ef4444');    // Terminated red
    expect(CASTE_ACCENT_COLORS['Free Spirits']).toBe('#e879f9');  // Anomaly magenta
    expect(CASTE_ACCENT_COLORS['Enforcers']).toBe('#38bdf8');     // Sky blue
  });
});
