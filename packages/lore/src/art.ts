// ---------------------------------------------------------------------------
// Art — shared visual tokens from art_directions.md.
// ---------------------------------------------------------------------------

export const PALETTE = {
  /** Primary system accent: Toxic Lime (HUD, scanner beam, buttons, reticle). */
  accent: '#b4ff39',
  /** Secondary accent (success / pledges). */
  secondary: '#22c55e',
  /** Tertiary accent (alerts / critical crimson). */
  tertiary: '#ff0055',
  /** Warning accent: Verdict Amber. */
  warning: '#ffb703',
  /** Hazard accent: Hazard Yellow. */
  hazard: '#facc15',
  /** Ledger data accent: Ledger Teal. */
  ledger: '#2dd4bf',
  /** Rust / decay accent: Rust Orange. */
  rust: '#f97316',
  /** Base background: Moss Black (deepest void). */
  dark: '#080b08',
  /** Main body base. */
  mossDark: '#0c110d',
  /** Panel surface. */
  panel: '#121a14',
  /** Panel surface (alt). */
  panelAlt: '#17221a',
  /** Deep modal surface. */
  modal: '#0e1510',
  /** Canvas void fill. */
  canvasVoid: '#070a08',
  /** Landfill black. */
  landfillBlack: '#0b0a06',
  /** Primary text: Pale leaf white. */
  textPrimary: '#e6efe3',
  /** Secondary text. */
  textSecondary: '#a9b8aa',
  /** Muted text / utility gray. */
  textMuted: '#7c8b7e',
} as const;

/** Paper layer colors (case-file dossier, explain panel, share card). */
export const PAPER_PALETTE = {
  paper: '#f1ead6',
  paperShadow: '#e0d6bb',
  typewriterInk: '#1f2a1f',
  stampRed: '#c2322b',
  stampGreen: '#2f7d3a',
  stampAmber: '#b45309',
  compostBrown: '#8b5a2b',
} as const;

/** Confetti burst colors shown when a verdict is revealed. */
export const CONFETTI_COLORS: readonly string[] = [
  PALETTE.accent,
  PALETTE.secondary,
  PALETTE.warning,
  '#84cc16',
] as const;