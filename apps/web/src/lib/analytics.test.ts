import { describe, expect, it } from 'vitest';
import { analyticsPath } from './analytics';

/**
 * The path GA receives. Two things are load-bearing here: a permalink never
 * ships its dossier id, and the two pre-rename aliases are reported under the
 * screen they actually render. (`initAnalytics`/`trackPageView` are DOM glue —
 * the first is a no-op outside a production build, the second is a no-op
 * without the tag, so there is nothing to assert offline.)
 */

describe('analyticsPath', () => {
  it('collapses every permalink route to its id-free form', () => {
    expect(analyticsPath('/citizen/-okeQbQ6Z4')).toBe('/citizen/:id');
    expect(analyticsPath('/arbitration/-okeQbQ6Z4')).toBe('/arbitration/:id');
    expect(analyticsPath('/claim/-okeQbQ6Z4')).toBe('/claim/:id');
    expect(analyticsPath('/appeal/-okeQbQ6Z4')).toBe('/appeal/:id');
    expect(analyticsPath('/appeals/-okeQbQ6Z4')).toBe('/appeals/:id');
    expect(analyticsPath('/inform/-okeQbQ6Z4')).toBe('/inform/:id');
  });

  it('leaves the plain screens alone', () => {
    for (const path of ['/scan', '/registry', '/injunction', '/grid', '/adjudicators', '/debug']) {
      expect(analyticsPath(path)).toBe(path);
    }
  });

  it('reports the root as the root', () => {
    expect(analyticsPath('/')).toBe('/');
    expect(analyticsPath('')).toBe('/');
  });

  it('drops a trailing slash so one screen is one row', () => {
    expect(analyticsPath('/scan/')).toBe('/scan');
    expect(analyticsPath('/citizen/abc/')).toBe('/citizen/:id');
    expect(analyticsPath('//')).toBe('/');
  });

  it('reports the pre-rename aliases under the screen they render', () => {
    expect(analyticsPath('/about')).toBe('/adjudicators');
    expect(analyticsPath('/vault')).toBe('/registry');
  });

  it('keeps an unexpected path visible instead of hiding it', () => {
    // A route nobody planned for is a signal; smoothing it into a known label
    // would delete the evidence.
    expect(analyticsPath('/foo')).toBe('/foo');
    expect(analyticsPath('/foo/bar')).toBe('/foo/bar');
    expect(analyticsPath('not-a-path')).toBe('/');
  });
});
