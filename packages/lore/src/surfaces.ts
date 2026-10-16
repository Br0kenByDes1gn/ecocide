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
    /** Signed in, but the record would not load — with a way out. */
    failed: 'Registry record unavailable',
    retry: 'Retry transmission',
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
 * The remediation-orders block on a dossier: the pledges offered against the
 * verdict, split into the ones the tribunal granted and the ones still unpledged.
 * The footer changes once acceptance has closed the file — after that there is no
 * appeal left to file, so the block must not go on offering one.
 */
export const REMEDIATION_COPY = {
  title: 'Remediation orders',
  /** Group heads. */
  pledged: 'Pledged',
  unpledged: 'Unpledged',
  /** Precedes a granted pledge's date. */
  granted: 'Granted',
  /** Footer while the verdict can still be appealed. */
  footerOpen: 'All values are estimates - source on file - file an appeal to pledge these orders',
  /** Footer once acceptance has made the ruling final. */
  footerFinal: 'All values are estimates - source on file - verdict final, pledges on file stand',
  /** Audit-card tile, before and after acceptance. */
  tileAvailable: 'Pledges available',
  tileOnFile: 'Pledges on file',
} as const;

/**
 * The disposition mark's file — what the Bureau intends to do with the household,
 * which the caste stamp on the dossier opens. The per-tier wording lives on the
 * tiers themselves (`FactionDef.disposition`); this is the chrome around it.
 */
export const DISPOSITION_COPY = {
  title: 'Bureau Disposition',
  /** Tooltip on the mark itself — says what opening it does. */
  open: "Open the Bureau's disposition for this household",
  /** Label over the household's own index + its band. */
  band: 'Assessment band',
  index: 'Index',
  /** Footer label over the tier's one-line verdict. */
  verdict: 'Standing verdict',
  close: 'Close file',
} as const;

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
  /**
   * Shown in the stamp's reserved space while the orders are being drafted —
   * issuance happens after the acceptance response, so the dossier says who is
   * working. Same register as the other in-flight lines ("Debiting registry
   * ledger...").
   */
  pending: 'The Arbiter is drafting your orders...',
  /** Archive ink — art_directions.md §3.2. */
  ink: '#8b5a2b',
} as const;
