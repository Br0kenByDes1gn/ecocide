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
    /** The two components the hero names: measured verdicts, honored chores. */
    fromVerdicts: 'from verdicts',
    fromOrders: 'from honored orders',
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

  /** The demoted carbon account panel on the registry page. */
  account: {
    title: 'Carbon Account',
    balance: 'Available balance',
    credited: 'Credited',
    spent: 'Spent',
    transactions: 'Transactions',
    /**
     * The allowance is one year of an average citizen's footprint (the real
     * average is about 6.6 tonnes; the Bureau rounds up).
     */
    allowance: 'Yearly allowance',
    allowanceNote: 'One year of an average citizen footprint, rounded up',
    /** What the balance is denominated in: one credit is one tonne of CO₂e. */
    unit: 'carbon credits',
    unitRate: '1 credit = 1 tonne CO₂e',
    openAccount: 'Open account',
    ledgerTitle: 'Transaction Ledger',
    ledgerEmpty: 'No transactions logged.',
    loadOlder: 'Load older transactions',
    /** Ledger reason labels (keyed by the stored reason). */
    reasons: {
      seed: 'Universal Basic Allowance',
      claim_fee: 'Verdict Certification Fee',
      appeal_fee: 'Appeal Filing Fee',
      /** Paid to the citizen when a completed order is confirmed. */
      injunction_reward: 'Compliance Credit',
      /** Paid to a citizen for submitting a verdict against another household. */
      informant_reward: 'Informant Bounty',
      adjustment: 'System Adjustment',
    },
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
    /** The fee line is quoted in credits, with the tonne equivalent beneath. */
    feeNote: 'One credit is one tonne of CO₂e',
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

/**
 * The informant submission screen (route `/inform/:id`) — the third act on a
 * verdict, beside claiming and appealing: surrender evidence of *another*
 * household's consumption offences. The verdict is issued in the accused's name
 * and only the holder of the accused address may claim or appeal it; the
 * informant is paid a flat bounty for their vigilance.
 *
 * World strings only; the mechanical chrome (validation, button states) stays
 * inline in the component, the way STORY.md §8 describes.
 */
export const INFORMANT_COPY = {
  /** Page name (the route is `/inform/:id`). */
  name: 'Informant Submission',

  /** The Arbiter's static address atop the form. */
  title: 'SURRENDER EVIDENCE',
  address: [
    'The Arbiter does not inspect every household itself. It relies on the vigilance of its citizens.',
    'If you hold photographic evidence of another household’s consumption offences, surrender it here. A verdict will be issued in their name, and only they may answer for it.',
  ],
  anonymity:
    'Submissions are anonymous. The accused household will never learn who informed on them.',

  /** Target-address field. */
  emailLabel: 'Email of the accused household',
  emailPlaceholder: 'offender@sector-9.net',
  submit: 'Submit as evidence',
  submitting: 'Filing your evidence...',

  /** Shown above the registry unlock — the bounty needs a wallet to land in. */
  unlockNote: 'The Bureau pays its informants. Unlock your registry — the bounty lands in its wallet.',

  /** Refusals surfaced by the server. */
  errorSelf: 'The Bureau does not accept self-informing. Name another household.',
  errorInvalid:
    'That is not a valid address. The Bureau cannot serve a verdict on a typo.',
  errorGeneric: 'FILING REJECTED. THE ARBITER IS INDISPOSED — TRY AGAIN.',

  /** The reward view after a successful filing ("you were a good informant"). */
  success: {
    title: 'A DILIGENT CITIZEN IS REWARDED',
    body: 'Your vigilance has been noted. A verdict has been issued against the accused household, and only they may claim or appeal it. For your civic contribution the Bureau awards you:',
    rewardLabel: 'Informant bounty',
    balanceLabel: 'New balance',
    done: 'Return to the dossier',
  },

  /** The notification delivered to the accused household. */
  email: {
    subject: 'ANONYMOUS TIP RECEIVED // VERDICT ISSUED AGAINST YOUR HOUSEHOLD',
    heading: 'ANONYMOUS TIP RECEIVED',
    preheader: 'A verdict has been issued against your household',
    intro:
      'The AI Supreme Arbiter of Consumption has received an anonymous tip concerning the consumption habits of this household. A forensic audit of the submitted evidence is complete, and a verdict has been issued in your name.',
    note:
      'Only the holder of this address may claim or appeal the ruling. Every other citizen has been locked out of the file.',
    footerNote: 'You are receiving this because a fellow citizen informed on you.',
  },
} as const;
