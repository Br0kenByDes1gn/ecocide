// ---------------------------------------------------------------------------
// Art — shared visual tokens for the placeholder theme.
// PLACEHOLDER PACK: provisional palette only (TODO-LORE: replace with the
// real art direction). Per-faction colors live in factions.ts; per-faction
// badge/avatar prompts live in factions.ts (stylePrompt). The four polygon
// portrait render styles live in the web app (apps/web/src/lib/polygon-portrait.ts)
// and keep their own engine palettes until the real artwork replaces them.
// ---------------------------------------------------------------------------

export const PALETTE = {
  /** Primary accent (UI chrome, scan HUD). */
  accent: '#00f3ff',
  /** Secondary accent (success / verified states). */
  secondary: '#00ff66',
  /** Tertiary accent (alerts / climax states). */
  tertiary: '#ff007f',
  /** Warning accent. */
  warning: '#ffb703',
  /** Base background. */
  dark: '#0a0b10',
  /** Panel background. */
  panel: '#11141e',
} as const;

/** Confetti burst colors shown when a verdict is revealed. */
export const CONFETTI_COLORS: readonly string[] = [
  PALETTE.accent,
  PALETTE.secondary,
  PALETTE.tertiary,
] as const;