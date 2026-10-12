// ---------------------------------------------------------------------------
// Identity — the project's placeholder world identity.
// TODO-LORE: replace every string here with the real project identity.
// The in-world decision entity is named "Carbon Minded AI".
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
  entityShortName: 'the Carbon Minded AI',
  /** One-line pitch shown on the intro page. TODO-LORE. */
  tagline: 'A provisional world awaits its story — replace the lore pack.',
  /** Population the classification quotas are applied to. */
  worldPopulation: 8_300_000_000,
} as const;