// ---------------------------------------------------------------------------
// Identity — the ECOCIDE world identity (art_directions.md §1).
// ---------------------------------------------------------------------------

export const IDENTITY = {
  /** Internal project id (package scope). */
  projectName: 'ecocide',
  /** Display name shown in the PWA manifest / header. */
  appName: 'ECOCIDE',
  appVersion: '0.2.0',
  /** The in-world entity that audits households and issues verdicts. */
  entityName: 'AI Supreme Arbiter of Consumption',
  /** Generic way to refer to the entity mid-sentence. */
  entityShortName: 'the Arbiter',
  /** Primary tagline (logo lockup / landing page). */
  tagline: 'Biosphere Threat Convergence',
  /** Secondary line near the appeal button (art §1.2). */
  secondaryLine: 'Guilty until pledged.',
  /** Bureaucratic backronym (footer, About page, deck). */
  backronym:
    'Excess Carbon Offence Case Investigation & Disposal Engine',
  /** The current audit protocol designation, stamped on case files. */
  auditProtocol: 'PROTOCOL-9',
} as const;