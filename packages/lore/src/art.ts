// ---------------------------------------------------------------------------
// Art — shared visual tokens for ECOCIDE (art_directions.md §3).
// JS-consumed hexes; `apps/web/src/index.css` mirrors the tokens for CSS —
// keep the two in sync.
// ---------------------------------------------------------------------------

export const PALETTE = {
  /** Primary system accent: toxic lime (HUD, scanner beam, Arbiter text). */
  accent: '#b4ff39',
  /** Secondary data accent: ledger teal (charts, carbon totals, links). */
  teal: '#2dd4bf',
  /** Verdict amber (verdicts, infractions, warnings, estimates). */
  warning: '#ffb703',
  /** Hazard yellow (hazard stripes, special-handling flags). */
  hazard: '#facc15',
  /** Alert red (errors, non-compliance). */
  alert: '#ef4444',
  /** Critical crimson (highest-severity states). */
  critical: '#ff0055',
  /** Pledge green (accepted pledges, success states). */
  success: '#22c55e',
  /** Rust orange (decay/corrosion accents). */
  rust: '#f97316',
  /** App background: deepest void. */
  dark: '#080b08',
  /** Moss dark: body base. */
  moss: '#0c110d',
  /** Panel surface. */
  panel: '#121a14',
  /** Panel surface (alt): item cards, ledger panels. */
  panelAlt: '#17221a',
  /** Deep modal surface. */
  modal: '#0e1510',
  /** Canvas void fill (scan view / image canvas). */
  canvas: '#070a08',
  /** Landfill black (audit-in-progress chamber). */
  landfill: '#0b0a06',
  /** Primary text: pale leaf white. */
  text: '#e6efe3',
  /** Secondary text. */
  textSecondary: '#a9b8aa',
  /** Muted text / utility gray. */
  textMuted: '#7c8b7e',
  /** Paper layer: form paper. */
  paper: '#f1ead6',
  /** Paper layer: folds, edges, ledger lines. */
  paperShadow: '#e0d6bb',
  /** Paper layer: typewriter ink. */
  paperInk: '#1f2a1f',
  /** Stamp ink red (DENIED, FINAL NOTICE). */
  stampRed: '#c2322b',
  /** Stamp ink green (APPROVED, EXEMPLARY). */
  stampGreen: '#2f7d3a',
  /** Stamp ink amber (PENDING REVIEW). */
  stampAmber: '#b45309',
  /** Compost brown (folder tabs, ledger binding). */
  compost: '#8b5a2b',
} as const;

/** Confetti burst colors shown when a verdict is revealed. */
export const CONFETTI_COLORS: readonly string[] = [
  PALETTE.accent,
  PALETTE.success,
  PALETTE.teal,
  PALETTE.warning,
] as const;