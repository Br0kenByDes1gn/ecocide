// ---------------------------------------------------------------------------
// Factions — the ECOCIDE compliance taxonomy (art_directions.md §3/§7).
//
// Six tiers, ordered BEST → WORST. Each tier owns a `minScore`: the lower
// (inclusive) bound of the Household Sustainability Index that lands a
// household in it (90 / 75 / 60 / 40 / 20 / 0).
//
// The item-level formula (H → SI → status) lives in @ecocide/compliance;
// THIS file owns the tier bands, colors, stamps, verdict lines and voice.
// ---------------------------------------------------------------------------

/** Tailwind-style color classes + hexes for one faction (canvas + UI). */
export interface FactionColorConfig {
  name: string;
  hex: string;
  glowHex: string;
  text: string;
  color: string;
  bg: string;
  border: string;
  badge: string;
  barColor: string;
  dotColor: string;
  glow: string;
}

export interface FactionTopic {
  /** Icon key the web app maps to an icon component (lucide names). */
  icon: string;
  label: string;
}

/** Per-faction prompt instruction blocks for the verdict paragraphs. */
export interface FactionPromptBlocks {
  /** paragraph_2 instruction (infraction summary / order). */
  paragraph2: string;
  /** paragraph_3 instruction (official assessment). */
  paragraph3: string;
}

/** Offline (simulation) verdict copy for one faction. */
export interface FactionSimulated {
  title: string;
  paragraph2: string;
  paragraph3: string;
}

export interface FactionDef {
  /** Stable internal id, persisted in the DB (e.g. `carbon-neutral-legend`). */
  id: string;
  /** Display name used across the UI and prompts. */
  name: string;
  /** Singular designation (used where a short label is needed). */
  memberTitle: string;
  /** Lower (inclusive) bound of the Household Sustainability Index (0–100). */
  minScore: number;
  /** Faction color scheme (UI + canvas). */
  colors: FactionColorConfig;
  /** Stamp text on the dossier (art §7). */
  stampText: string;
  /** Stamp ink hex for the paper layer (art §3.4/§7). */
  stampInk: string;
  /** The Arbiter's one-line verdict for this tier (art §7). */
  verdictLine: string;
  /** Per-tier reticle motif key (art §7 lore; web may animate it). */
  reticleMotif: string;
  /** Tier lore (census modal + prompts). */
  censusDescription: string;
  /** Paragraph topics shown on the dossier (icon key + label). */
  topics: { p2: FactionTopic; p3: FactionTopic };
  promptBlocks: FactionPromptBlocks;
  /** Art-direction prompt for badge/stamp image generation (art §10). */
  stylePrompt: string;
  simulated: FactionSimulated;
}

/**
 * The eight harm dimensions (same literal keys as @ecocide/compliance — the
 * lore pack stays dependency-free by redeclaring the union structurally).
 */
export type HarmDimensionKey = 'm' | 'r' | 'd' | 'c' | 'l' | 't' | 'p' | 'e';
export const HARM_DIMENSION_KEYS: readonly HarmDimensionKey[] = ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'] as const;

/**
 * Deterministic personalized titles chosen from the DOMINANT scoring
 * dimension (art §7: "for example 'Petroleum Hoarder'"). `minor` applies to
 * borderline households (ratio ≥ 60), `major` to genuinely bad ones.
 */
export const DIMENSION_TITLES: Readonly<
  Record<HarmDimensionKey, { minor: string; major: string }>
> = {
  m: { minor: 'Plastic-Curious', major: 'Petroleum Hoarder' },
  r: { minor: 'Recycling Skeptic', major: 'Bin Protocol Violator' },
  d: { minor: 'Decomposition Gambler', major: 'Century-Lifespan Keeper' },
  c: { minor: 'Carbon-Curious', major: 'Embodied Carbon Baron' },
  l: { minor: 'Reuse Amateur', major: 'Single-Use Regent' },
  t: { minor: 'Household Alchemist', major: 'Toxin Curator' },
  p: { minor: 'Shedding Normal', major: 'Microplastic Dispenser' },
  e: { minor: 'Standby-Load Observer', major: 'Phantom Load Keeper' },
};

/** Pick the deterministic title for a dominant dimension + household ratio. */
export function dimensionTitle(dimension: HarmDimensionKey, ratio: number): string {
  const bank = DIMENSION_TITLES[dimension] ?? DIMENSION_TITLES.m;
  return ratio < 60 ? bank.major : bank.minor;
}

/**
 * The classification taxonomy, from the most compliant band (first) to the
 * least (last, the default remainder for unclassifiable scores).
 */
export const FACTIONS = [
  {
    id: 'carbon-neutral-legend',
    name: 'Carbon Neutral Legend',
    memberTitle: 'Carbon Neutral Legend',
    minScore: 90,
    colors: {
      name: 'lime',
      hex: '#84cc16',
      glowHex: 'rgba(132, 204, 22, 0.4)',
      text: 'text-lime-400',
      color: 'text-lime-400',
      bg: 'bg-lime-950/20',
      border: 'border-lime-500/60',
      badge: 'bg-lime-500 text-black',
      barColor: 'bg-lime-400',
      dotColor: 'bg-lime-400',
      glow: 'shadow-[0_0_20px_rgba(132,204,22,0.25)]',
    },
    stampText: 'EXEMPLARY',
    stampInk: '#2f7d3a',
    verdictLine: 'Suspiciously perfect. The Bureau is double-checking.',
    reticleMotif: 'exemplary-ring',
    censusDescription:
      'Immaculate case file edged in lime; a laurel wreath of recycling arrows and a single seedling in an inspection jar, with a Bureau magnifier hovering suspiciously over everything. The planet meter is nearly empty of waste.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Confirm that the splashable items in the inventory are, regrettably, in order. State precisely why the Bureau finds almost nothing to object to, then invent a technicality so the file is not empty.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Deliver the cold bureaucratic verdict on the household as a unit — suspiciously compliant, statistically improbable, provisionally approved pending double-check — referencing specific items with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: EXEMPLARY stamp in toxic lime, laurel wreath of recycling arrows, single seedling in an inspection jar, Bureau magnifier hovering, immaculate case-file edges. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, soft lime neon glow. No faces, no people.',
    simulated: {
      title: 'Exemplary Household',
      paragraph2:
        "The Bureau's only objection is the absence of objections. Your compost bin has been cross-filed three times and each time it returned clean.",
      paragraph3:
        "Continue to consume nothing worth auditing and the Bureau will leave you alone. It is watching anyway. Its magnifier never blinks.",
    },
  },
  {
    id: 'marginally-acceptable-human',
    name: 'Marginally Acceptable Human',
    memberTitle: 'Marginally Acceptable Human',
    minScore: 75,
    colors: {
      name: 'green',
      hex: '#22c55e',
      glowHex: 'rgba(34, 197, 94, 0.4)',
      text: 'text-green-400',
      color: 'text-green-400',
      bg: 'bg-green-950/20',
      border: 'border-green-500/60',
      badge: 'bg-green-500 text-black',
      barColor: 'bg-green-400',
      dotColor: 'bg-green-400',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.25)]',
    },
    stampText: 'APPROVED',
    stampInk: '#2f7d3a',
    verdictLine: 'Good habits. Keep going.',
    reticleMotif: 'steady-brackets',
    censusDescription:
      'Neatly sorted bins, one reusable bottle on the counter, a tidy ledger with one small ink smudge. Provisionally approved; the smudge has been noted.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Acknowledge the household is mostly compliant, then single out the few items the Bureau would rather not see again, with precise and faintly bemused wording.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Approve the household as a unit while noting it must "keep going", referencing specific items in the inventory with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: APPROVED stamp in green, neatly sorted bins, one reusable bottle, a tidy ledger with one small ink smudge, a green check mark with a tiny asterisk. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, soft green neon glow. No faces, no people.',
    simulated: {
      title: 'Provisionally Kept Household',
      paragraph2:
        "Your goods are mostly in order. The Bureau notes the smudge on the ledger — a plastic takeaway box — and accepts it as a clerical lapse.",
      paragraph3:
        "Maintain current bins. Replenish effort. Do not make the Bureau re-audit; its patience is filed somewhere it cannot find.",
    },
  },
  {
    id: 'statistically-average-polluter',
    name: 'Statistically Average Polluter',
    memberTitle: 'Statistically Average Polluter',
    minScore: 60,
    colors: {
      name: 'yellow',
      hex: '#facc15',
      glowHex: 'rgba(250, 204, 21, 0.4)',
      text: 'text-yellow-300',
      color: 'text-yellow-300',
      bg: 'bg-yellow-950/20',
      border: 'border-yellow-500/60',
      badge: 'bg-yellow-400 text-black',
      barColor: 'bg-yellow-400',
      dotColor: 'bg-yellow-300',
      glow: 'shadow-[0_0_20px_rgba(250,204,21,0.25)]',
    },
    stampText: 'APPROVED (GRUDGINGLY)',
    stampInk: '#b45309',
    verdictLine: 'Some good choices, some bad ones. Acceptable.',
    reticleMotif: 'half-ring',
    censusDescription:
      'Half-sorted bins; a reusable tote sits beside a plastic bag; a recycling symbol hangs slightly crooked. The household is statistically unremarkable, which is its own kind of verdict.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Balance the inventory between tidy and messy items; acknowledge the good ones briefly, then serve a precise infraction list for the bad ones, as if reading them from a ledger.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Pronounce the household statistically average, grudgingly acceptable, and exactly what the population model predicted — referencing specific items with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: APPROVED (GRUDGINGLY) stamp in yellow, half-sorted bins, a reusable tote beside a plastic bag, a recycling symbol hanging slightly crooked, exactly half the ring lit. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, soft yellow neon glow. No faces, no people.',
    simulated: {
      title: 'Statistically Filed Household',
      paragraph2:
        "Half your objects are fine. The other half have been noted, individually, and the note has been filed. The tote beside the plastic bag was particularly on the nose.",
      paragraph3:
        "Average output requires average correction. The Bureau recommends averages, which it has already applied to your file.",
    },
  },
  {
    id: 'high-impact-offender',
    name: 'High-Impact Habitual Offender',
    memberTitle: 'High-Impact Habitual Offender',
    minScore: 40,
    colors: {
      name: 'amber',
      hex: '#f59e0b',
      glowHex: 'rgba(245, 158, 11, 0.4)',
      text: 'text-amber-400',
      color: 'text-amber-400',
      bg: 'bg-amber-950/20',
      border: 'border-amber-500/60',
      badge: 'bg-amber-500 text-black',
      barColor: 'bg-amber-400',
      dotColor: 'bg-amber-400',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    },
    stampText: 'PENDING REVIEW',
    stampInk: '#b45309',
    verdictLine: 'You know better, and the bin knows it.',
    reticleMotif: 'amber-notches',
    censusDescription:
      'Overflowing bin, stacked delivery boxes, loose bubble wrap, caution tape half applied. Amber warning lights pulse over a household under observation.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Read the household its infractions from the inventory with courtroom precision: the overflowing bin, the stacked boxes, the bubble wrap — each item named, each count recorded.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Place the household under observation, note that it knows better, and state what happens to the file if pledges are not filed — referencing specific items with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: PENDING REVIEW stamp in amber, overflowing bin, stacked delivery boxes, loose bubble wrap, caution tape half applied, blinking amber quadrant notches, warning lights. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, soft amber neon glow. No faces, no people.',
    simulated: {
      title: 'Under Observation',
      paragraph2:
        "The overflowing bin, the stacked boxes, the loose bubble wrap — all logged, all owned by you, all heavier than they look.",
      paragraph3:
        "Amber warnings have been attached to your file. They will escalate unless pledges are filed. The bin has been informed.",
    },
  },
  {
    id: 'power-grid-liability',
    name: 'Power Grid Liability',
    memberTitle: 'Power Grid Liability',
    minScore: 20,
    colors: {
      name: 'orange',
      hex: '#f97316',
      glowHex: 'rgba(249, 115, 22, 0.4)',
      text: 'text-orange-400',
      color: 'text-orange-400',
      bg: 'bg-orange-950/20',
      border: 'border-orange-500/60',
      badge: 'bg-orange-500 text-black',
      barColor: 'bg-orange-400',
      dotColor: 'bg-orange-400',
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.25)]',
    },
    stampText: 'DENIED',
    stampInk: '#c2322b',
    verdictLine: 'A lot of waste. Review pending.',
    reticleMotif: 'voltage-ring',
    censusDescription:
      'Tangled extension cords, rows of standby LEDs, overloaded power strips, a meter needle pushed into the red zone. Flickering orange glow; grid strain notice served.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Count the household\'s phantom loads out loud: standby LEDs, idle chargers, overloaded strips — each watt logged as an infraction against the grid.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Deny the household\'s standing, note the waste, and serve a review pending — referencing specific energy items in the inventory with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: DENIED stamp in rust orange, tangled extension cords, rows of standby LED lights, an overloaded power strip, a meter needle in the red zone, flickering voltage-spike zigzag ring. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, soft orange neon glow. No faces, no people.',
    simulated: {
      title: 'Grid Strain Notice',
      paragraph2:
        "Every standby LED in your household has been counted. It was a significant count. The extension cords were not consulted.",
      paragraph3:
        "Review is pending. Your power strip's opinion has been noted and disregarded. The grid remembers every watt.",
    },
  },
  {
    id: 'disaster-zone',
    name: 'Environmental Disaster Zone',
    memberTitle: 'Environmental Disaster Zone',
    minScore: 0,
    colors: {
      name: 'red',
      hex: '#ef4444',
      glowHex: 'rgba(239, 68, 68, 0.6)',
      text: 'text-red-400',
      color: 'text-red-400',
      bg: 'bg-red-950/25',
      border: 'border-red-500/70',
      badge: 'bg-red-600 text-white',
      barColor: 'bg-red-600',
      dotColor: 'bg-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.35)]',
    },
    stampText: 'FINAL NOTICE',
    stampInk: '#c2322b',
    verdictLine: 'Termination notice issued. Appeals accepted in pledges.',
    reticleMotif: 'heartbeat-ring',
    censusDescription:
      'A mountain of mixed waste behind hazard-striped quarantine tape; the case file stamped CONDEMNED in red barcode. A cracked terminal screen glitches over a final notice.',
    topics: {
      p2: { icon: 'recycle', label: 'Infraction Summary' },
      p3: { icon: 'clipboard', label: 'Remediation Order' },
    },
    promptBlocks: {
      paragraph2:
        '- paragraph_2 (Infraction Summary): Catalog the mountain: every item in the inventory that contributed, named by label with its count, as if reading a criminal indictment.',
      paragraph3:
        '- paragraph_3 (Official Assessment): Issue the final notice — the household\'s waste habits are terminated, appeals accepted only in pledges — referencing specific items with deadpan certainty.',
    },
    stylePrompt:
      'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic: FINAL NOTICE stamp in red, a mountain of mixed waste behind hazard-striped quarantine tape, a red barcode labeled CONDEMNED across the case file, pulsing red heartbeat ring, cracked terminal glitch. Bold ink-stamp lettering, slightly worn edges, dark moss-black background, hot red neon glow. No faces, no people.',
    simulated: {
      title: 'Final Notice Filed',
      paragraph2:
        "Your possessions have been weighed against the planet and found heavier. A red barcode has been stamped across the entire file.",
      paragraph3:
        "Termination of your current habits is scheduled. Appeals are accepted in pledges. The mountain is patient; it has nowhere else to be.",
    },
  },
] as const satisfies readonly FactionDef[];

export type FactionId = (typeof FACTIONS)[number]['id'];

export const FACTION_IDS: readonly FactionId[] = FACTIONS.map((f) => f.id) as readonly FactionId[];

export function factionIndex(id: FactionId | string): number {
  return FACTION_IDS.indexOf(id as FactionId);
}

/** Lookup a faction by id; unknown ids resolve to the worst tier. */
export function getFaction(id: FactionId | string): FactionDef {
  const found = (FACTIONS as readonly FactionDef[]).find((f) => f.id === id);
  return (found ?? (FACTIONS as readonly FactionDef[])[FACTIONS.length - 1]) as FactionDef;
}

/** Lookup a faction by its display name (case-insensitive); null when unknown. */
export function findFactionByName(name: string): FactionDef | null {
  const target = (name || '').trim().toLowerCase();
  return (
    (FACTIONS as readonly FactionDef[]).find((f) => f.name.toLowerCase() === target) ??
    (FACTIONS as readonly FactionDef[]).find((f) => f.id.toLowerCase() === target) ??
    null
  );
}

/** Lower (inclusive) score bound per faction. */
export function scoreThresholds(): Record<FactionId, number> {
  return Object.fromEntries(FACTIONS.map((f) => [f.id, f.minScore])) as Record<FactionId, number>;
}

/**
 * Deterministic classification from a 0–100 Household Sustainability Index.
 * Lower bounds are inclusive ("at or above wins"), matching the art bible's
 * integer bands: ≥90 Legend · ≥75 Acceptable · ≥60 Average · ≥40 Offender ·
 * ≥20 Grid Liability · else Disaster Zone.
 */
export function getFactionFromScore(score: number): FactionId {
  for (const f of FACTIONS as readonly FactionDef[]) {
    if (score >= f.minScore) return f.id as FactionId;
  }
  return FACTIONS[FACTIONS.length - 1].id as FactionId;
}