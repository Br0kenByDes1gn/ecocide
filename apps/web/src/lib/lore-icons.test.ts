// ---------------------------------------------------------------------------
// The pack can only name glyphs; the drawing is the web's job. Lore cannot
// import lucide, so nothing upstream catches a key that does not exist — a typo
// would silently fall back to a default glyph. This walks every key the pack
// actually uses and fails when one of them stops resolving.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { FACTIONS } from '@ecocide/lore';
import { loreIcon } from './lore-icons';

describe('lore icon keys resolve', () => {
  it('draws every disposition glyph the tiers ask for', () => {
    for (const faction of FACTIONS) {
      const { icons } = faction.disposition;
      expect(icons.length, `${faction.id} has glyphs`).toBeGreaterThan(0);
      for (const key of icons) {
        expect(loreIcon(key), `${faction.id} → "${key}" is not in the icon map`).toBeTruthy();
      }
    }
  });

  it('draws every verdict paragraph topic icon the tiers ask for', () => {
    for (const faction of FACTIONS) {
      for (const topic of [faction.topics.p2, faction.topics.p3]) {
        expect(
          loreIcon(topic.icon),
          `${faction.id} topic "${topic.label}" → "${topic.icon}" is not in the icon map`
        ).toBeTruthy();
      }
    }
  });

  // The map is a vocabulary, not a mirror of today's copy: it keeps keys no tier
  // currently names (and the pack may name a key before a tier uses it), so only
  // the direction above is an invariant.
  it('returns null for an unknown key so callers can fall back', () => {
    expect(loreIcon('no-such-glyph')).toBeNull();
    expect(loreIcon(undefined)).toBeNull();
  });
});
