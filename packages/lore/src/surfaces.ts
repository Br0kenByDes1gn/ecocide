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

  /** The payment terminal used by the claim and appeal flows. */
  terminal: {
    title: 'Planetary Carbon Bank',
    secChannel: 'SEC-CHANNEL : 9',
    drawnFrom: 'Drawn from your registry account',
    unlocked: 'Registry unlocked',
    authorize: 'Authorize carbon debit',
    binding: 'Binding assessment to your registry...',
    debiting: 'Debiting registry ledger...',
    paid: 'Carbon transfer authorized',
    /** The terminal's footer: what this institution actually settles in. */
    settlement: 'Settled in carbon credits — the only currency that matters',
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

/**
 * The Adjudicators — the project's credits page (route `/adjudicators`).
 *
 * An in-world personnel file: the humans behind the Arbiter, drawn on the
 * Bureau's paper. The team is also the studio that built the thing (Broken By
 * Design), so its names, roles and links are data here and the component stays
 * purely presentational.
 */
export const ADJUDICATORS_COPY = {
  /** Page name + document title (the route is `/adjudicators`). */
  name: 'The Adjudicators',
  title: 'THE ADJUDICATORS',
  subtitle: 'Bureau personnel — the hands behind the Arbiter',
  intro:
    'The Arbiter is unyielding, but it is not unstaffed. Every verdict, stamp and injunction is the work of two citizens, filed here for the record.',

  /** The studio the project was made by; its mark sits above the credits line. */
  studio: {
    name: 'Broken By Design',
    logo: '/broken-by-design-logo.svg',
    alt: 'Broken By Design',
    url: 'https://broken-by-design.art/',
  },

  /** The credits line: `Made with ❤️ by Broken By Design`. */
  madeWith: {
    prefix: 'Made with',
    heart: '❤️',
    by: 'by',
  },

  /** The adjudicators, in the order filed. */
  team: [
    {
      name: 'Svetlozar Argirov',
      roles: 'Original idea · Technical design · Programming',
      github: 'https://github.com/zaro/',
      avatar: '/team/zaro.jpg',
    },
    {
      name: 'Bhumika Sharma',
      roles: 'Idea · Visual design · Story · Programming',
      github: 'https://github.com/schmithvillers',
      avatar: '/team/schmithvillers.jpg',
    },
  ],

  /** Label over each adjudicator's link to their public record. */
  recordLabel: 'Personnel record',
  /** The mark laid on the file (archive ink, like the injunction stamp). */
  stamp: 'Broken By Design',
} as const;

/**
 * The Planetary Grid (route `/grid`) — the system-status page: the Arbiter's
 * live oversight of the planet, a rotating earth and a streaming activity log.
 *
 * The log's message templates are story (kept here so the screen holds no
 * prose); `apps/web/src/lib/status-log.ts` fills the `{tokens}` from the
 * vocabularies below plus the clock. Tokens: `{lat} {lon} {time} {sector}
 * {region} {code} {object} {household} {count} {fail} {pct}`.
 */
export const GRID_COPY = {
  /** Page name + document title (the route is `/grid`). */
  name: 'Planetary Grid',
  title: 'PLANETARY GRID',
  subtitle: 'Live oversight of every household, object and offence on record',
  intro:
    'The Arbiter does not sleep and does not blink. This is the grid it watches: sweeps, sightings and rulings, streaming in from every sector on the planet.',

  /** Fixed readout tiles (label + world value). */
  readouts: [
    { label: 'Uplink', value: 'NOMINAL' },
    { label: 'Orbital pass', value: 'PASS 4471' },
    { label: 'Regions monitored', value: '214' },
    { label: 'Households on file', value: '8,431,209' },
    { label: 'Objects catalogued', value: '1.9B' },
    { label: 'Compliance coverage', value: '99.7%' },
  ],

  /** The one readout the screen keeps ticking (its label; the value is computed). */
  liveLabel: 'Telemetry events / min',

  log: {
    title: 'Grid activity',
    /** The pulsing "live" marker on the log header. */
    live: 'Live',
    /** First line, before any transmission has arrived. */
    empty: 'Awaiting first transmission…',
    /** Line levels → the short marker shown in the gutter. */
    levels: {
      nominal: 'OK',
      notice: 'NOTE',
      alert: 'ALERT',
    },
    /** Vocabularies the templates draw from. */
    sectors: [
      'SECTOR-01',
      'SECTOR-07',
      'SECTOR-12',
      'SECTOR-19',
      'SECTOR-23',
      'SECTOR-31',
      'SECTOR-44',
      'SECTOR-58',
    ],
    regions: [
      'NORTH ATLANTIC CELL',
      'BALTIC CELL',
      'AMAZON BASIN NODE',
      'SAHARA MIRROR',
      'GANGES DELTA WATCH',
      'PACIFIC DEBRIS FIELD',
      'SIBERIAN SINK',
      'ARAL REMEDIATION ZONE',
      'ANDES RUNOFF LINE',
      'MEKONG DELTA NODE',
      'ARCTIC METHANE LINE',
      'NILE UPSTREAM CELL',
    ],
    codes: ['GX-4471', 'GX-2210', 'ORB-0909', 'ORB-3312', 'NODE-77', 'NODE-104', 'TLM-556', 'TLM-812'],
    /**
     * The predefined messages. Every sweep appends the next one, so all of them
     * are seen in order; the parameters vary each time.
     */
    templates: [
      { level: 'nominal', text: 'AUDIT SWEEP COMPLETE :: {lat}, {lon} — {count} objects catalogued, {fail} hard fails' },
      { level: 'nominal', text: 'ORBITAL PASS OVER {lat}, {lon} — imaging nominal, cloud cover {pct}%' },
      { level: 'notice', text: 'OBJECT SIGNATURE MATCHED :: {object} ({count} units) at {lat}, {lon}' },
      { level: 'notice', text: 'SECTOR {sector} RECLASSIFIED — index {pct}%, ruling filed' },
      { level: 'nominal', text: 'UPLINK ACQUIRED :: {region} NODE {code} @ {time}' },
      { level: 'alert', text: 'WASTE-PLASMA TRACE ABOVE THRESHOLD at {lat}, {lon} — {object} implicated' },
      { level: 'nominal', text: 'ARBITER SYNC {pct}% — {time}' },
      { level: 'notice', text: 'INJUNCTION DISPATCHED :: household {household} ({lat}, {lon})' },
      { level: 'nominal', text: 'CENSUS TALLY UPDATED :: {count} households in {sector}' },
      { level: 'alert', text: 'CONTAINMENT BREACH :: {region} — {count} contaminated sacks flagged' },
      { level: 'nominal', text: 'GRID INTEGRITY {pct}% — no drift detected' },
      { level: 'notice', text: 'TIP RECEIVED :: {region} — evidence queued for forensic audit' },
      { level: 'nominal', text: 'SATELLITE {code} HANDOFF COMPLETE @ {time}' },
      { level: 'alert', text: 'SINGLE-USE PLASTIC SURGE at {lat}, {lon} — {count} signatures confirmed' },
      { level: 'nominal', text: 'SECTOR {sector} SWEEP {pct}% COMPLETE' },
      { level: 'notice', text: 'APPEAL FILED :: household {household} contests the ruling on {object}' },
      { level: 'nominal', text: 'LEDGER RECONCILED — {count} carbon credits drawn in {sector}' },
      { level: 'alert', text: 'LANDFILL TRAP DETECTED at {lat}, {lon} — {object} present' },
      { level: 'nominal', text: 'MICROPLASTIC BASELINE NOMINAL for {region} @ {time}' },
      { level: 'notice', text: 'RE-ARBITRATION APPLIED :: {sector} — new index {pct}%' },
      { level: 'nominal', text: 'ORBITAL IMAGERY ARCHIVED — tile {code}' },
      { level: 'notice', text: 'NEW HOUSEHOLD REGISTERED :: {household} ({lat}, {lon})' },
      { level: 'alert', text: 'DEFORESTATION ECHO DETECTED :: {region} — grid confidence {pct}%' },
      { level: 'nominal', text: 'COMPLIANCE COVERAGE {pct}% across {region}' },
      { level: 'notice', text: 'HAZARDOUS ITEM FLAGGED :: {object} — special handling ordered' },
      { level: 'nominal', text: 'GRID CLOCK RESYNC @ {time} — drift 0.00s' },
      { level: 'alert', text: 'UNAUTHORISED BURN DETECTED at {lat}, {lon} — {object} suspected' },
      { level: 'nominal', text: 'SECTOR {sector} CALIBRATION COMPLETE — reference room re-scored' },
      { level: 'notice', text: 'APPEAL GRANTED :: household {household} lifted to {pct}%' },
      { level: 'nominal', text: 'TELEMETRY HEARTBEAT :: {region} @ {time} — all meters green' },
    ],
  },

  /** The operator strip's link to the credits page. */
  staffOnDuty: 'Current Staff on Duty',
} as const;
