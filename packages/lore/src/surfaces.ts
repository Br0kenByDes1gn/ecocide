// ---------------------------------------------------------------------------
// Surfaces — world copy for the account-side screens (art_directions.md §9.5).
//
// The carbon registry is the citizen's permanent record: their pooled carbon
// neutrality index, the archive of every claimed assessment and the token
// account that pays the certification/appeal fees. Story copy belongs here;
// purely mechanical chrome (buttons like "load older", form validation) stays
// inline in the components the way STORY.md §8 describes.
//
// Internal identifiers (`VaultState`, `/api/vault`, `wallets`) keep their
// storage names — see AGENTS.md §2. Only what the citizen READS lives here.
// ---------------------------------------------------------------------------

export const REGISTRY_COPY = {
  /** Page name + header/nav label (the route is `/registry`). */
  name: 'Carbon Registry',
  navLabel: 'Registry',

  header: {
    registeredTo: 'Registered to',
    /** Stand-in shown before the first assessment is filed. */
    sealedNotice: 'Sealed under Protocol',
  },

  status: {
    loading: 'Retrieving carbon record...',
    locked: 'Access Carbon Registry',
  },

  /** The pooled standing hero. */
  standing: {
    label: 'Carbon Neutrality Index',
    caption: 'Pooled from every assessment on file',
    /** Trend chip when nothing older exists to compare against. */
    noTrend: 'First assessment on file',
    /** Stat strip labels. */
    assessments: 'Assessments',
    objects: 'Objects audited',
    hardFails: 'Hard fails',
    dominantMaterial: 'Dominant material',
    offender: 'Worst offender',
    filedBetween: 'First / latest filing',
    /** Empty state (no claimed assessments yet). */
    emptyTitle: 'No assessments on file',
    emptyHint: 'Submit a household photo and claim the verdict to open your carbon record.',
    emptyAction: 'Begin audit',
  },

  /** The archive of previous assessments. */
  archive: {
    title: 'Assessment Archive',
    empty: 'No assessments filed yet.',
    index: 'Index',
    objects: 'Objects',
    hardFails: 'Fails',
    /** Label used when the scan carried no audit-area hint. */
    roomUnknown: 'Unspecified area',
  },

  /** The demoted token account panel on the registry page. */
  account: {
    title: 'Token Account',
    balance: 'Available balance',
    credited: 'Credited',
    spent: 'Spent',
    transactions: 'Transactions',
    allowance: 'Allocated line of credit',
    openAccount: 'Open account',
    ledgerTitle: 'Transaction Ledger',
    ledgerEmpty: 'No transactions logged.',
    loadOlder: 'Load older transactions',
  },

  /** Identity unlock (email OTP) for the registry account. */
  unlock: {
    emailLabel: 'Registry identity — email',
    emailPlaceholder: 'citizen@sector-9.net',
    sendCode: 'Unlock Carbon Registry',
    sendingCode: 'Transmitting code...',
    codeHint: 'A one-time access code will be sent to this address.',
    accessCodeLabel: 'Access code — sent to',
    verifyCode: 'Unlock registry',
    verifying: 'Verifying...',
  },

  /** The environmental injunction worksheet (route `/injunction`). */
  injunction: {
    title: 'Environmental Injunction',
    hint: 'Binding orders issued against this household. Comply, then check each item.',
    cleared: 'All orders complied with. The Bureau notes your obedience.',
    closing: 'Pledge these actions to lift your score, one habit at a time.',
    items: [
      'Halt all single-use plastic procurement within 7 days',
      'Divert compostables from landfill to the green bin',
      'Switch remaining bulbs to low-draw lighting',
      'Unplug idle electronics and chargers nightly',
      'File proof of remediation with the Bureau',
    ],
  },

  /** The simulated payment terminal used by the claim and appeal flows. */
  terminal: {
    title: 'Carbon Registry Terminal',
    secChannel: 'SEC-CHANNEL : 9',
    drawnFrom: 'Drawn from your registry account',
    unlocked: 'Registry unlocked',
    authorize: 'Authorize payment',
    binding: 'Binding assessment to your registry...',
    debiting: 'Debiting registry ledger...',
    paid: 'Payment authorized',
    simulation: 'Simulation terminal | no real charge will be made',
    balance: 'Balance',
  },
} as const;

/** Trend chip text for the standing hero: `Δ +12 VS PRIOR RECORD`. */
export function standingTrendLabel(delta: number): string {
  if (delta === 0) return 'No change vs prior record';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta)} vs prior record`;
}

/**
 * The injunction stamp — the mark placed on an accepted verdict's dossier once
 * its corrective orders have been issued (see `issueInjunction` on the server).
 *
 * Like the tier stamp, both the wording and the ink come from the pack so the
 * stamp is never wrong: the ink is the art bible's *archive* ink
 * (art_directions.md §3.2, "folder tabs, ledger binding, case-file accents"),
 * which no tier uses, so this mark never reads as a verdict.
 */
export const INJUNCTION_STAMP = {
  /** Headline of the stamp (the component uppercases it). */
  label: 'Injunction issued',
  /** Prefixed to the issuance date, e.g. "Filed 2026-10-16". */
  dated: 'Filed',
  /** Archive ink — art_directions.md §3.2. */
  ink: '#8b5a2b',
} as const;
