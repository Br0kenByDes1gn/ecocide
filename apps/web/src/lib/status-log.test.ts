import { describe, expect, it } from 'vitest';
import { GRID_COPY } from '@ecocide/lore';
import {
  GRID_LOG_TOKENS,
  formatClock,
  formatCoords,
  formatLat,
  formatLon,
  makeGridLogLine,
} from './status-log';

/**
 * The grid log's two promises: every template can be filled (no `{token}` ever
 * leaks onto the page), and the formatter's vocabulary matches the pack exactly,
 * so a typo in a template fails here instead of rendering a literal brace.
 */

const fixedRand = () => 0.5;

describe('grid log formatting', () => {
  it('formats coordinates with a hemisphere', () => {
    expect(formatLat(51.5074)).toBe('51.507° N');
    expect(formatLat(-33.8688)).toBe('33.869° S');
    expect(formatLat(0)).toBe('0.000° N');
    expect(formatLon(-0.1276)).toBe('0.128° W');
    expect(formatLon(151.2093)).toBe('151.209° E');
    expect(formatCoords(51.5074, -0.1276)).toBe('51.507° N, 0.128° W');
  });

  it('stamps a zero-padded UTC clock', () => {
    expect(formatClock(new Date(Date.UTC(2026, 9, 17, 4, 7, 3)))).toBe('04:07:03Z');
  });
});

describe('the grid log templates', () => {
  it('uses exactly the tokens the formatter knows', () => {
    const used = new Set<string>();
    for (const template of GRID_COPY.log.templates) {
      for (const match of template.text.matchAll(/\{(\w+)\}/g)) used.add(match[1]);
    }
    expect([...used].sort()).toEqual([...GRID_LOG_TOKENS].sort());
  });

  it('offers the full set of predefined messages', () => {
    expect(GRID_COPY.log.templates.length).toBeGreaterThanOrEqual(30);
  });
});

describe('makeGridLogLine', () => {
  it('fills every token, leaving no placeholder behind', () => {
    const now = new Date(Date.UTC(2026, 9, 17, 12, 0, 0));
    for (let i = 0; i < GRID_COPY.log.templates.length; i++) {
      const line = makeGridLogLine({ now, rand: fixedRand, index: i });
      expect(line.text).not.toMatch(/[{}]/);
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.time).toBe('12:00:00Z');
      expect(['nominal', 'notice', 'alert']).toContain(line.level);
    }
  });

  it('walks the templates in order and wraps around', () => {
    const now = new Date();
    const count = GRID_COPY.log.templates.length;
    const first = makeGridLogLine({ now, rand: fixedRand, index: 0 });
    const wrapped = makeGridLogLine({ now, rand: fixedRand, index: count });
    const last = makeGridLogLine({ now, rand: fixedRand, index: count - 1 });
    expect(wrapped.text).toBe(first.text);
    expect(wrapped.level).toBe(first.level);
    expect(last.text).not.toBe(first.text);
  });

  it('carries the template level through', () => {
    const now = new Date();
    for (let i = 0; i < GRID_COPY.log.templates.length; i++) {
      const line = makeGridLogLine({ now, rand: fixedRand, index: i });
      expect(line.level).toBe(GRID_COPY.log.templates[i].level);
    }
  });

  it('gives each sweep a unique key', () => {
    const now = new Date();
    expect(makeGridLogLine({ now, rand: fixedRand, index: 3 }).id).not.toBe(
      makeGridLogLine({ now, rand: fixedRand, index: 4 }).id
    );
  });
});
