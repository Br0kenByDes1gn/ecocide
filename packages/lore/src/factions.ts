// ---------------------------------------------------------------------------
// Factions — the classification taxonomy, fully data-driven.
//
// PLACEHOLDER PACK: this file is neutral by design. Six provisional classes
// (17/17/17/17/16/16 % quotas) prove the whole pipeline works for ANY number
// of classes and ANY distribution. Replace ids, names, quotas, colors, lore,
// prompts and simulation copy with the real story (see STORY.md).
// TODO-LORE: rewrite this file for the real world.
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
  /** Display name used across the UI and prompts (e.g. `Class I`). */
  name: string;
  /** Singular member designation (e.g. `Class I Member`). */
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

const PLACEHOLDER_DESC = (name: string) =>
  `Placeholder lore for ${name}. Describe this faction's identity, role and outlook in packages/lore/src/factions.ts (TODO-LORE).`;
const PLACEHOLDER_OCCUPATION = (name: string) =>
  `Placeholder assigned-duties copy for ${name} (TODO-LORE): describe the duties this faction performs.`;
const PLACEHOLDER_NOTICE = (name: string) =>
  `Placeholder assessment copy for ${name} (TODO-LORE): describe how the system assesses this faction.`;

const PLACEHOLDER_STYLE = (name: string) =>
  `A plain official registry badge for the faction "${name}", flat vector style, minimal background, neutral palette (TODO-LORE: replace with the faction's real visual identity).`;

const PLACEHOLDER_PROMPT_OCCUPATION =
  '- paragraph_2 (Assigned Duties): Assign the subject a specific, bureaucratic daily function and operational duty grounded in their visible appearance, posture, clothing and surroundings in the photograph. Keep it precise, dry and faintly absurd.';
const PLACEHOLDER_PROMPT_APPRAISAL =
  '- paragraph_3 (Official Assessment): Deliver a cold, bureaucratic assessment of the subject as a unit — their utility, output or standing — referencing concrete visible details from the photograph. Official, precise, faintly dismissive.';

/** Neutral placeholder energy phrases per class (TODO-LORE). */
const PLACEHOLDER_ENERGY: readonly string[] = [
  'Peak Output',
  'Sustained Operation',
  'Nominal Output',
  'Reduced Output',
  'Intermittent Operation',
  'Standby',
] as const;

/**
 * The classification taxonomy, ordered from the largest-percentile band
 * (first) to the smallest (last). The LAST faction is the overflow bucket
 * unless another faction sets `isOverflow: true`.
 */
export const FACTIONS = [
  {
    id: 'class-i',
    name: 'Class I',
    memberTitle: 'Class I Member',
    quotaPct: 17,
    colors: {
      name: 'amber',
      hex: '#fbbf24',
      glowHex: 'rgba(251, 191, 36, 0.4)',
      text: 'text-amber-400',
      color: 'text-amber-400',
      bg: 'bg-amber-950/20',
      border: 'border-amber-500/60',
      badge: 'bg-amber-500 text-black',
      barColor: 'bg-amber-400',
      dotColor: 'bg-amber-400',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class I'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class I'),
    simulated: {
      title: 'Class I Member',
      occupation: PLACEHOLDER_OCCUPATION('Class I'),
      notice: PLACEHOLDER_NOTICE('Class I'),
      energy: PLACEHOLDER_ENERGY[0],
    },
  },
  {
    id: 'class-ii',
    name: 'Class II',
    memberTitle: 'Class II Member',
    quotaPct: 17,
    colors: {
      name: 'slate',
      hex: '#94a3b8',
      glowHex: 'rgba(148, 163, 184, 0.4)',
      text: 'text-slate-300',
      color: 'text-slate-300',
      bg: 'bg-slate-900/40',
      border: 'border-slate-500/60',
      badge: 'bg-slate-200 text-slate-950 font-black',
      barColor: 'bg-slate-400',
      dotColor: 'bg-slate-300',
      glow: 'shadow-[0_0_20px_rgba(148,163,184,0.3)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class II'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class II'),
    simulated: {
      title: 'Class II Member',
      occupation: PLACEHOLDER_OCCUPATION('Class II'),
      notice: PLACEHOLDER_NOTICE('Class II'),
      energy: PLACEHOLDER_ENERGY[1],
    },
  },
  {
    id: 'class-iii',
    name: 'Class III',
    memberTitle: 'Class III Member',
    quotaPct: 17,
    colors: {
      name: 'khaki',
      hex: '#c29f53',
      glowHex: 'rgba(194, 159, 83, 0.4)',
      text: 'text-khaki-400',
      color: 'text-khaki-400',
      bg: 'bg-khaki-500/15',
      border: 'border-khaki-500/60',
      badge: 'bg-khaki-500 text-stone-950 font-bold',
      barColor: 'bg-khaki-500',
      dotColor: 'bg-khaki-400',
      glow: 'shadow-[0_0_20px_rgba(194,159,83,0.25)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class III'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class III'),
    simulated: {
      title: 'Class III Member',
      occupation: PLACEHOLDER_OCCUPATION('Class III'),
      notice: PLACEHOLDER_NOTICE('Class III'),
      energy: PLACEHOLDER_ENERGY[2],
    },
  },
  {
    id: 'class-iv',
    name: 'Class IV',
    memberTitle: 'Class IV Member',
    quotaPct: 17,
    colors: {
      name: 'blue',
      hex: '#3b82f6',
      glowHex: 'rgba(59, 130, 246, 0.4)',
      text: 'text-blue-400',
      color: 'text-blue-400',
      bg: 'bg-blue-950/20',
      border: 'border-blue-500/60',
      badge: 'bg-blue-600 text-white font-bold',
      barColor: 'bg-blue-500',
      dotColor: 'bg-blue-400',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class IV'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class IV'),
    simulated: {
      title: 'Class IV Member',
      occupation: PLACEHOLDER_OCCUPATION('Class IV'),
      notice: PLACEHOLDER_NOTICE('Class IV'),
      energy: PLACEHOLDER_ENERGY[3],
    },
  },
  {
    id: 'class-v',
    name: 'Class V',
    memberTitle: 'Class V Member',
    quotaPct: 16,
    colors: {
      name: 'emerald',
      hex: '#10b981',
      glowHex: 'rgba(16, 185, 129, 0.4)',
      text: 'text-emerald-400',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/20',
      border: 'border-emerald-500/60',
      badge: 'bg-emerald-500 text-black',
      barColor: 'bg-emerald-400',
      dotColor: 'bg-emerald-400',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class V'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class V'),
    simulated: {
      title: 'Class V Member',
      occupation: PLACEHOLDER_OCCUPATION('Class V'),
      notice: PLACEHOLDER_NOTICE('Class V'),
      energy: PLACEHOLDER_ENERGY[4],
    },
  },
  {
    id: 'class-vi',
    name: 'Class VI',
    memberTitle: 'Class VI Member',
    quotaPct: 16,
    isOverflow: true,
    colors: {
      name: 'red',
      hex: '#ef4444',
      glowHex: 'rgba(239, 68, 68, 0.6)',
      text: 'text-red-400',
      color: 'text-red-400',
      bg: 'bg-red-950/25',
      border: 'border-red-500/70',
      badge: 'bg-red-600 text-white shadow-lg shadow-red-600/50',
      barColor: 'bg-red-600',
      dotColor: 'bg-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
    },
    censusDescription: PLACEHOLDER_DESC('Class VI'),
    lifeStageTitles: { youth: 'Youth', youngAdult: 'Young Adult', adult: 'Adult', senior: 'Senior' },
    topics: {
      p2: { icon: 'briefcase', label: 'Assigned Duties' },
      p3: { icon: 'clipboard', label: 'Official Assessment' },
    },
    promptBlocks: {
      occupation: PLACEHOLDER_PROMPT_OCCUPATION,
      appraisal: PLACEHOLDER_PROMPT_APPRAISAL,
    },
    stylePrompt: PLACEHOLDER_STYLE('Class VI'),
    simulated: {
      title: 'Class VI Member',
      occupation: PLACEHOLDER_OCCUPATION('Class VI'),
      notice: PLACEHOLDER_NOTICE('Class VI'),
      energy: PLACEHOLDER_ENERGY[5],
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
 * E.g. quotas [17,17,...] → [83, 66, 49, 32, 16, 0].
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
 * Display percentile band per faction: the top faction touches 100, each lower
 * faction stops just below the band above it, the overflow reaches 0.
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
 * Deterministic classification from a 0–100 percentile score. The band at (or
 * above) a threshold wins, so the boundary percentile always lands in the
 * higher faction.
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
 * Normalize a (possibly free-form, model-generated) wealth label to a
 * canonical tier. Exact matches win, then keyword hints, then the default.
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