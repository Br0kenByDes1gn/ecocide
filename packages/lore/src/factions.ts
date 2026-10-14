// ---------------------------------------------------------------------------
// Factions — the classification taxonomy, fully data-driven.
// Driven by art_directions.md and caste.md.
// ---------------------------------------------------------------------------

import { IDENTITY } from './identity.js';

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

/** The four formal life stages every classification uses (mechanics). */
export type LifeStageKey = 'youth' | 'youngAdult' | 'adult' | 'senior';
export const LIFE_STAGE_KEYS: readonly LifeStageKey[] = ['youth', 'youngAdult', 'adult', 'senior'] as const;

export interface FactionTopic {
  /** Icon key the web app maps to an icon component (lucide names). */
  icon: string;
  label: string;
}

/** Per-faction prompt instruction blocks for the verdict paragraphs. */
export interface FactionPromptBlocks {
  /** paragraph_2 instruction (assigned duties). */
  occupation: string;
  /** paragraph_3 instruction (official assessment). */
  appraisal: string;
}

/** Offline (simulation) verdict copy for one faction. */
export interface FactionSimulated {
  title: string;
  occupation: string;
  notice: string;
  energy: string;
}

export interface FactionDef {
  /** Stable internal id, persisted in the DB (e.g. `class-i`). */
  id: string;
  /** Display name used across the UI and prompts (e.g. `Carbon Neutral Legend`). */
  name: string;
  /** Singular member designation (e.g. `Carbon Neutral Legend`). */
  memberTitle: string;
  /** Share of the world population in percent. All shares must sum to 100. */
  quotaPct: number;
  /** Optional: exact-remainder bucket. Defaults to the LAST faction in order. */
  isOverflow?: boolean;
  /** Faction color scheme (UI + canvas). */
  colors: FactionColorConfig;
  censusDescription: string;
  /** Formal-stage → per-faction title. */
  lifeStageTitles: Record<LifeStageKey, string>;
  /** Paragraph topics shown on the dossier (icon key + label). */
  topics: { p2: FactionTopic; p3: FactionTopic };
  promptBlocks: FactionPromptBlocks;
  /** Art direction prompt used by the avatar synthesis providers. */
  stylePrompt: string;
  simulated: FactionSimulated;
}

/** Wealth tiers used by the prompt and profile normalization. */
export interface WealthTierDef {
  label: string;
  hints?: readonly string[];
}
export const WEALTH_TIERS: readonly WealthTierDef[] = [
  { label: 'Abundant', hints: ['luxury', 'designer', 'pristine', 'wealthy', 'elite'] },
  { label: 'Comfortable', hints: ['stylish', 'sharp', 'executive', 'tailored', 'techwear'] },
  { label: 'Stable', hints: ['clean', 'branded', 'crisp', 'well-kept'] },
  { label: 'Baseline', hints: ['ordinary', 'average', 'functional', 'neutral', 'standard'] },
  { label: 'Worn', hints: ['faded', 'thrifted', 'washed-out'] },
  { label: 'Threadbare', hints: ['tattered', 'frayed', 'grease-stained', 'scavenged'] },
  { label: 'Depleted', hints: ['rags', 'dilapidated', 'deficit', 'salvage'] },
] as const;
export const DEFAULT_WEALTH_TIER = 'Baseline';

/**
 * The classification taxonomy, ordered from the highest score band
 * to the lowest. The LAST faction is the overflow bucket.
 */
export const FACTIONS = [
  {
    id: 'class-i',
    name: 'Carbon Neutral Legend',
    memberTitle: 'Carbon Neutral Legend',
    quotaPct: 10,
    colors: {
      name: 'lime',
      hex: '#84cc16',
      glowHex: 'rgba(132, 204, 22, 0.4)',
      text: 'text-lime-400',
      color: 'text-lime-400',
      bg: 'bg-lime-950/25',
      border: 'border-lime-500/70',
      badge: 'bg-lime-500 text-black font-black',
      barColor: 'bg-lime-400',
      dotColor: 'bg-lime-400',
      glow: 'shadow-[0_0_20px_rgba(132,204,22,0.4)]',
    },
    censusDescription: 'SOVEREIGN GREEN clearance. Immaculate household audit; single seedling growing in an inspection jar. Stamp: EXEMPLARY.',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'leaf', label: 'Ecosystem Alignment' },
      p3: { icon: 'shield-check', label: 'Audit Verification' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Detail their flawless zero-waste stewardship and meticulous resource regeneration. Note the Bureau’s suspicious admiration.',
      appraisal: '- paragraph_3 (Official Assessment): “Suspiciously perfect. The Bureau is double-checking.” Re-inspect every clean border.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Clean sharp outlines, bold ink-stamp lettering, slightly worn edges, minimalist recycling-arrow and government-seal details. Dark moss-black background with toxic lime accent and soft neon glow. No faces, no people.',
    simulated: {
      title: 'Carbon Neutral Legend',
      occupation: 'Carbon Neutral Legend duties: Zero-waste stewardship, meticulous circular usage, and domestic carbon elimination.',
      notice: 'Carbon Neutral Legend assessment: Suspiciously perfect. The Bureau is double-checking.',
      energy: 'Peak Output',
    },
  },
  {
    id: 'class-ii',
    name: 'Marginally Acceptable Human',
    memberTitle: 'Marginally Acceptable Human',
    quotaPct: 15,
    colors: {
      name: 'green',
      hex: '#22c55e',
      glowHex: 'rgba(34, 197, 94, 0.4)',
      text: 'text-green-400',
      color: 'text-green-400',
      bg: 'bg-green-950/20',
      border: 'border-green-500/60',
      badge: 'bg-green-500 text-black font-bold',
      barColor: 'bg-green-400',
      dotColor: 'bg-green-400',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.4)]',
    },
    censusDescription: 'PROVISIONAL APPROVAL. Neatly sorted bins, active reuse habits, and a single ink smudge on an otherwise tidy consumption ledger. Stamp: APPROVED.',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'recycle', label: 'Domestic Protocols' },
      p3: { icon: 'check-circle', label: 'Compliance Clearance' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Describe their consistent sorting routines and dependable reuse habits.',
      appraisal: '- paragraph_3 (Official Assessment): “Good habits. Keep going.” Clear with provisional status.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Clean sharp outlines, green checkmark with tiny asterisk, government seal on moss-black background. No faces, no people.',
    simulated: {
      title: 'Marginally Acceptable Human',
      occupation: 'Marginally Acceptable Human duties: Routine bin sorting, reusable vessel maintenance, and compliant resource rotation.',
      notice: 'Marginally Acceptable Human assessment: Good habits. Keep going.',
      energy: 'Sustained Operation',
    },
  },
  {
    id: 'class-iii',
    name: 'Statistically Average Polluter',
    memberTitle: 'Statistically Average Polluter',
    quotaPct: 15,
    colors: {
      name: 'yellow',
      hex: '#facc15',
      glowHex: 'rgba(250, 204, 21, 0.4)',
      text: 'text-yellow-400',
      color: 'text-yellow-400',
      bg: 'bg-yellow-950/20',
      border: 'border-yellow-500/60',
      badge: 'bg-yellow-400 text-black font-bold',
      barColor: 'bg-yellow-400',
      dotColor: 'bg-yellow-400',
      glow: 'shadow-[0_0_20px_rgba(250,204,21,0.4)]',
    },
    censusDescription: 'AVERAGE CLEARANCE. Half-sorted bins, a reusable tote sitting next to a plastic bag. Visuals split between tidy and messy. Stamp: APPROVED (GRUDGINGLY).',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'scale', label: 'Household Balance' },
      p3: { icon: 'alert-circle', label: 'Bureaucratic Status' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Note the balanced mix of good intentions and single-use lapses in their daily routine.',
      appraisal: '- paragraph_3 (Official Assessment): “Some good choices, some bad ones. Acceptable.” Stamp grudgingly.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Split tidy/messy iconography in hazard yellow on dark moss-black background. APPROVED (GRUDGINGLY) stamp. No faces, no people.',
    simulated: {
      title: 'Statistically Average Polluter',
      occupation: 'Statistically Average Polluter duties: Standard domestic consumption, municipal waste handover, and baseline recycling compliance.',
      notice: 'Statistically Average Polluter assessment: Some good choices, some bad ones. Acceptable.',
      energy: 'Nominal Output',
    },
  },
  {
    id: 'class-iv',
    name: 'High-Impact Habitual Offender',
    memberTitle: 'High-Impact Habitual Offender',
    quotaPct: 20,
    colors: {
      name: 'amber',
      hex: '#f59e0b',
      glowHex: 'rgba(245, 158, 11, 0.4)',
      text: 'text-amber-400',
      color: 'text-amber-400',
      bg: 'bg-amber-950/20',
      border: 'border-amber-500/60',
      badge: 'bg-amber-500 text-black font-bold',
      barColor: 'bg-amber-400',
      dotColor: 'bg-amber-400',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    },
    censusDescription: 'UNDER OBSERVATION. Overflowing bin, stacked delivery boxes, loose bubble wrap; caution tape half applied. Stamp: PENDING REVIEW.',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'package', label: 'Packaging Inflow' },
      p3: { icon: 'clock', label: 'Review Docket' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Call out chronic unboxing, excess packaging accumulation, and deferred sorting.',
      appraisal: '- paragraph_3 (Official Assessment): “You know better, and the bin knows it.” Mark as pending review.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Amber warning notches, delivery carton silhouette, caution tape motif. PENDING REVIEW stamp. No faces, no people.',
    simulated: {
      title: 'High-Impact Habitual Offender',
      occupation: 'High-Impact Habitual Offender duties: High-frequency parcel unboxing, deferred recycling sorting, and packaging accumulation.',
      notice: 'High-Impact Habitual Offender assessment: You know better, and the bin knows it.',
      energy: 'Reduced Output',
    },
  },
  {
    id: 'class-v',
    name: 'Power Grid Liability',
    memberTitle: 'Power Grid Liability',
    quotaPct: 20,
    colors: {
      name: 'orange',
      hex: '#f97316',
      glowHex: 'rgba(249, 115, 22, 0.4)',
      text: 'text-orange-400',
      color: 'text-orange-400',
      bg: 'bg-orange-950/25',
      border: 'border-orange-500/60',
      badge: 'bg-orange-500 text-black font-bold',
      barColor: 'bg-orange-500',
      dotColor: 'bg-orange-400',
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]',
    },
    censusDescription: 'GRID STRAIN NOTICE. Tangled extension cords, rows of standby LEDs, overloaded power strips, meter needle in the red zone. Stamp: DENIED.',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'zap', label: 'Vampire Draw' },
      p3: { icon: 'alert-triangle', label: 'Grid Citation' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Detail constant standby loads, inefficient appliances, and severe domestic power consumption.',
      appraisal: '- paragraph_3 (Official Assessment): “A lot of waste. Review pending.” Deny clearance due to grid drag.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Voltage spike zigzag, tangled cord motifs in rust orange on dark void. DENIED stamp. No faces, no people.',
    simulated: {
      title: 'Power Grid Liability',
      occupation: 'Power Grid Liability duties: Continuous vampire-power draw, appliance hoarding, and chronic thermal inefficiency.',
      notice: 'Power Grid Liability assessment: A lot of waste. Review pending.',
      energy: 'Intermittent Operation',
    },
  },
  {
    id: 'class-vi',
    name: 'Environmental Disaster Zone',
    memberTitle: 'Environmental Disaster Zone',
    quotaPct: 20,
    isOverflow: true,
    colors: {
      name: 'red',
      hex: '#ef4444',
      glowHex: 'rgba(239, 68, 68, 0.6)',
      text: 'text-red-400',
      color: 'text-red-400',
      bg: 'bg-red-950/30',
      border: 'border-red-500/70',
      badge: 'bg-red-600 text-white font-black shadow-lg shadow-red-600/50',
      barColor: 'bg-red-600',
      dotColor: 'bg-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]',
    },
    censusDescription: 'FINAL NOTICE. Mountain of mixed waste, hazard-striped quarantine tape, cracked terminal screen with glitching noise. Stamp: FINAL NOTICE.',
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'flame', label: 'Severe Degradation' },
      p3: { icon: 'skull', label: 'Final Sentence' },
    },
    promptBlocks: {
      occupation: '- paragraph_2 (Assigned Duties): Describe severe environmental burden and uncontrolled mixed waste disposal.',
      appraisal: '- paragraph_3 (Official Assessment): “Termination notice issued. Appeals accepted in pledges.” Immediate remediation required.',
    },
    stylePrompt: 'Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Hazard stripes, barcode condemnation mark, cracked terminal screen in alert red on landfill black. FINAL NOTICE stamp. No faces, no people.',
    simulated: {
      title: 'Environmental Disaster Zone',
      occupation: 'Environmental Disaster Zone duties: Uncontrolled landfill feeding, single-use saturation, and comprehensive environmental liability.',
      notice: 'Environmental Disaster Zone assessment: Termination notice issued. Appeals accepted in pledges.',
      energy: 'Standby',
    },
  },
] as const satisfies readonly FactionDef[];

export type FactionId = (typeof FACTIONS)[number]['id'];

export const FACTION_IDS: readonly FactionId[] = FACTIONS.map((f) => f.id) as readonly FactionId[];

/** The overflow faction (exact-remainder bucket). */
export const OVERFLOW_ID: FactionId = (
  (FACTIONS as readonly FactionDef[]).find((f) => f.isOverflow) ?? FACTIONS[FACTIONS.length - 1]
).id as FactionId;

export function factionIndex(id: FactionId | string): number {
  return FACTION_IDS.indexOf(id as FactionId);
}

/** Lookup a faction by id; unknown ids resolve to the overflow faction. */
export function getFaction(id: FactionId | string): FactionDef {
  const found = (FACTIONS as readonly FactionDef[]).find((f) => f.id === id);
  return (found ?? (FACTIONS as readonly FactionDef[]).find((f) => f.id === OVERFLOW_ID) ?? FACTIONS[0]) as FactionDef;
}

export function isOverflowFaction(id: FactionId | string): boolean {
  return (getFaction(id).isOverflow ?? factionIndex(id) === FACTION_IDS.length - 1) === true;
}

/** Percentage share per faction (must sum to 100). */
export function factionPercentages(): Record<FactionId, number> {
  return Object.fromEntries(FACTIONS.map((f) => [f.id, f.quotaPct])) as Record<FactionId, number>;
}

/**
 * Lower percentile boundary per faction (cumulative from the top).
 */
export function factionThresholds(): Record<FactionId, number> {
  let cumulative = 0;
  const out = {} as Record<FactionId, number>;
  for (const f of FACTIONS) {
    cumulative += f.quotaPct;
    out[f.id] = Math.max(0, 100 - cumulative);
  }
  return out;
}

/**
 * Display percentile band per faction.
 */
export function factionBounds(): Record<FactionId, { low: number; high: number }> {
  const thresholds = factionThresholds();
  const out = {} as Record<FactionId, { low: number; high: number }>;
  let previousHigh = 100;
  for (const f of FACTIONS) {
    const low = thresholds[f.id];
    out[f.id] = { low, high: previousHigh === 100 ? 100 : previousHigh - 0.01 };
    previousHigh = low;
  }
  return out;
}

/** Absolute population per faction (rounded). */
export function factionPopulations(total: number = IDENTITY.worldPopulation): Record<FactionId, number> {
  return Object.fromEntries(
    FACTIONS.map((f) => [f.id, Math.round((total * f.quotaPct) / 100)])
  ) as Record<FactionId, number>;
}

/**
 * Deterministic classification from a 0–100 percentile score.
 */
export function getFactionFromPercentile(percentile: number): FactionId {
  const thresholds = factionThresholds();
  for (const id of FACTION_IDS) {
    if (percentile >= thresholds[id]) return id;
  }
  return OVERFLOW_ID;
}

export function wealthTierLabels(): readonly string[] {
  return WEALTH_TIERS.map((t) => t.label);
}

/**
 * Normalize a wealth label.
 */
export function normalizeWealthTier(value: string | undefined | null): string {
  if (!value) return DEFAULT_WEALTH_TIER;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_WEALTH_TIER;
  const exact = WEALTH_TIERS.find((t) => t.label.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.label;
  const lower = trimmed.toLowerCase();
  const hinted = WEALTH_TIERS.find((t) => t.hints?.some((h) => lower.includes(h.toLowerCase())));
  return hinted?.label ?? DEFAULT_WEALTH_TIER;
}