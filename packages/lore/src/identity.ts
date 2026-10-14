// ---------------------------------------------------------------------------
// Identity — the project's world identity from art_directions.md.
// ---------------------------------------------------------------------------

export const IDENTITY = {
  /** Internal project id (package scope). */
  projectName: 'ecocide',
  /** Display name shown in the PWA manifest / header. */
  appName: 'ECOCIDE',
  appVersion: '0.1.0',
  /** The in-world entity that scans and classifies subjects. */
  entityName: 'Carbon Minded AI',
  /** Generic way to refer to the entity mid-sentence. */
  entityShortName: 'the Arbiter',
  /** Bureaucratic backronym. */
  backronym: 'Excess Carbon Offence Case Investigation & Disposal Engine',
  /** One-line pitch shown on the intro page. */
  tagline: 'Carbon Excess Eliminator',
  /** Secondary pitch near appeal button. */
  secondaryTagline: 'Guilty until pledged.',
  /** Population the classification quotas are applied to. */
  worldPopulation: 8_300_000_000,
} as const;