// ---------------------------------------------------------------------------
// Simulate — deterministic offline (no-API-key) content.
// The whole two-pass flow degrades to this when Gemini is offline: a seeded
// household inventory from the archetype catalog, the compliance math applied
// server-side, and tier-flavored verdict copy + suggestions from here.
// ---------------------------------------------------------------------------

import { FACTION_IDS, dimensionTitle, factionIndex, getFaction, type HarmDimensionKey } from './factions.js';
import { IDENTITY } from './identity.js';
import type { FactionId } from './factions.js';

/** Structural copy of the inventory item shape (canonical type in @ecocide/types). */
export interface SimItem {
  label: string;
  category: string;
  count: number;
  ratings: Record<HarmDimensionKey, number | null>;
  justification: string;
  bounds?: { x1: number; y1: number; x2: number; y2: number };
}

export interface SimSuggestion {
  text: string;
  target_label: string;
  pledge: string;
  impact_pct: number;
}

/** Deterministic 32-bit FNV-1a (shared by every simulated outcome). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ALL_8: readonly HarmDimensionKey[] = ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'];

const R = (partial: Partial<Record<HarmDimensionKey, number>>): Record<HarmDimensionKey, number | null> =>
  Object.fromEntries(ALL_8.map((k) => [k, partial[k] ?? null])) as Record<HarmDimensionKey, number | null>;

export const CATEGORIES: readonly string[] = [
  'packaging', 'food', 'electronics', 'appliance', 'clothing', 'furniture',
  'hygiene', 'cleaning', 'decor', 'waste', 'other',
] as const;

/**
 * The archetype catalog: objects the Bureau has met before, with their
 * standing ratings (1 = exemplary, 5 = severe). Ratings are fixed so the same
 * evidence yields the same audit; only counts vary with the seed.
 */
export const ITEM_ARCHETYPES: ReadonlyArray<{
  label: string;
  category: string;
  countMax: number;
  ratings: Record<HarmDimensionKey, number | null>;
  justification: string;
}> = [
  { label: 'plastic bottle', category: 'packaging', countMax: 6, ratings: R({ m: 5, r: 1, d: 5, c: 4, l: 5, t: 2, p: 4 }), justification: 'The bin notes the centuries ahead of it and the smell it plans to keep.' },
  { label: 'cardboard delivery box', category: 'packaging', countMax: 8, ratings: R({ m: 3, r: 4, d: 2, c: 3, l: 4, t: 1, p: 1 }), justification: 'Recyclable in theory; stacked in practice.' },
  { label: 'reusable glass jar', category: 'food', countMax: 5, ratings: R({ m: 1, r: 3, d: 4, c: 2, l: 1, t: 1, p: 1 }), justification: 'A credit to its countertop.' },
  { label: 'aluminum can', category: 'packaging', countMax: 8, ratings: R({ m: 2, r: 5, d: 4, c: 3, l: 3, t: 1, p: 1 }), justification: 'Recyclable, if it ever finds the bin.' },
  { label: 'plastic grocery bag', category: 'packaging', countMax: 12, ratings: R({ m: 5, r: 2, d: 5, c: 3, l: 5, t: 2, p: 5 }), justification: 'A drawer of loose ghosts the Bureau has counted.' },
  { label: 'coffee pod', category: 'packaging', countMax: 20, ratings: R({ m: 5, r: 1, d: 5, c: 3, l: 5, t: 2, p: 3 }), justification: 'One espresso’s lifespan; one landfill’s retirement plan.' },
  { label: 'standby power strip', category: 'electronics', countMax: 4, ratings: R({ m: 4, r: 2, d: 5, c: 4, l: 3, t: 2, p: 1, e: 5 }), justification: 'It consumes power merely by existing, and it exists a lot.' },
  { label: 'led bulb', category: 'electronics', countMax: 6, ratings: R({ m: 3, r: 3, d: 5, c: 3, l: 2, t: 1, p: 1, e: 3 }), justification: 'Efficient, but the Bureau counts its sockets.' },
  { label: 'laptop', category: 'electronics', countMax: 2, ratings: R({ m: 4, r: 3, d: 5, c: 4, l: 3, t: 2, p: 1, e: 4 }), justification: 'A necessary instrument of the modern desk; noted.' },
  { label: 'phone charger brick', category: 'electronics', countMax: 6, ratings: R({ m: 4, r: 1, d: 5, c: 4, l: 3, t: 1, p: 1, e: 2 }), justification: 'Several of these remain plugged in for no reason the Bureau can find.' },
  { label: 'wool sweater', category: 'clothing', countMax: 5, ratings: R({ m: 1, r: 3, d: 3, c: 2, l: 2, t: 1, p: 2 }), justification: 'Warm, natural, and only mildly sheep-adjacent.' },
  { label: 'polyester shirt', category: 'clothing', countMax: 6, ratings: R({ m: 4, r: 2, d: 4, c: 3, l: 4, t: 2, p: 4 }), justification: 'Every wash sheds petition signatures to the ocean.' },
  { label: 'denim jeans', category: 'clothing', countMax: 4, ratings: R({ m: 2, r: 3, d: 4, c: 3, l: 3, t: 1, p: 3 }), justification: 'Sturdy, honest, occasionally gravely worn.' },
  { label: 'wooden chair', category: 'furniture', countMax: 3, ratings: R({ m: 1, r: 1, d: 4, c: 2, l: 1, t: 1, p: 1 }), justification: 'An heirloom; the Bureau approves of heirlooms.' },
  { label: 'particleboard shelf', category: 'furniture', countMax: 3, ratings: R({ m: 3, r: 2, d: 4, c: 3, l: 3, t: 2, p: 2 }), justification: 'Assembled with an Allen key and regrets.' },
  { label: 'vacuum cleaner', category: 'appliance', countMax: 2, ratings: R({ m: 4, r: 2, d: 5, c: 4, l: 3, t: 2, p: 1, e: 5 }), justification: 'Powerful, necessary, and personally acquainted with the grid.' },
  { label: 'aging refrigerator', category: 'appliance', countMax: 1, ratings: R({ m: 4, r: 2, d: 5, c: 5, l: 4, t: 2, p: 1, e: 5 }), justification: 'Born before the Bureau’s energy standards; hums in defiance.' },
  { label: 'microwave', category: 'appliance', countMax: 2, ratings: R({ m: 4, r: 2, d: 5, c: 4, l: 3, t: 2, p: 1, e: 4 }), justification: 'Heats meals; drains opinions.' },
  { label: 'fabric softener jug', category: 'cleaning', countMax: 3, ratings: R({ m: 4, r: 1, d: 5, c: 4, l: 3, t: 2, p: 3 }), justification: 'Scent has no lasting value; the jug disagrees.' },
  { label: 'soap bar', category: 'hygiene', countMax: 4, ratings: R({ m: 1, r: 2, d: 1, c: 1, l: 3, t: 1, p: 2 }), justification: 'Dissolves honorably.' },
  { label: 'plastic takeaway container', category: 'packaging', countMax: 8, ratings: R({ m: 5, r: 2, d: 5, c: 3, l: 4, t: 2, p: 4 }), justification: 'Reused optimistically; retired reluctantly.' },
  { label: 'kitchen compost bin', category: 'waste', countMax: 1, ratings: R({ m: 1, r: 4, d: 1, c: 1, l: 1, t: 1, p: 1 }), justification: 'The Bureau’s favorite appliance.' },
  { label: 'cereal box', category: 'packaging', countMax: 4, ratings: R({ m: 3, r: 3, d: 4, c: 3, l: 4, t: 2, p: 3 }), justification: 'Cardboard outside, plastic sleeve inside. The sleeve is the problem.' },
  { label: 'copper pot set', category: 'decor', countMax: 2, ratings: R({ m: 2, r: 4, d: 5, c: 3, l: 1, t: 1, p: 1 }), justification: 'Culinarily immortal.' },
  { label: 'paper plates', category: 'food', countMax: 10, ratings: R({ m: 3, r: 3, d: 2, c: 2, l: 5, t: 1, p: 2 }), justification: 'Convenience, filed as an infraction.' },
  { label: 'reusable tote bag', category: 'packaging', countMax: 6, ratings: R({ m: 2, r: 2, d: 3, c: 2, l: 2, t: 1, p: 2 }), justification: 'Owned, maybe used, possibly in another room.' },
  { label: 'disposable razor', category: 'hygiene', countMax: 6, ratings: R({ m: 4, r: 1, d: 5, c: 3, l: 4, t: 1, p: 3 }), justification: 'A lifetime supply of small plastic departures.' },
  { label: 'reusable cloth rags', category: 'hygiene', countMax: 24, ratings: R({ m: 1, r: 1, d: 1, c: 1, l: 2, t: 1, p: 1 }), justification: 'Hand-sewn, endlessly reborn; the Bureau keeps a roll in its own lobby.' },
  { label: 'seedling shelf', category: 'decor', countMax: 20, ratings: R({ m: 1, r: 2, d: 1, c: 1, l: 2, t: 1, p: 1 }), justification: 'Photosynthesis on record; the Bureau finds it refreshing.' },
  { label: 'contaminated waste sack', category: 'waste', countMax: 40, ratings: R({ m: 5, r: 1, d: 5, c: 5, l: 5, t: 5, p: 5 }), justification: 'The Bureau prefers it sealed, tagged, and accounted for.' },
];

/** Deterministic box from a seed + index (normalized 0–1 coordinates). */
function boxFor(seed: string, i: number): { x1: number; y1: number; x2: number; y2: number } {
  const h = (salt: string) => (fnv1a(`${seed}::${i}::${salt}`) % 10000) / 10000;
  const x1 = h('x1') * 0.8;
  const y1 = h('y1') * 0.8;
  const w = 0.08 + h('w') * 0.2;
  const hh = 0.08 + h('h') * 0.2;
  return {
    x1: Math.min(x1, 1 - w),
    y1: Math.min(y1, 1 - hh),
    x2: Math.min(x1 + w, 1),
    y2: Math.min(y1 + hh, 1),
  };
}

// ---------------------------------------------------------------------------
// Exhibit ROOMS — one deterministic household per tier, hand-composed from
// the archetype catalog so each lands in its art-direction band (90/75/60/
// 40/20/0). Used by the dev bench and tested for band membership.
// ---------------------------------------------------------------------------

export interface SimRoomTemplate {
  roomType: string;
  items: Array<{ label: string; count: number }>;
}

export const SIMULATED_ROOMS: Readonly<Record<FactionId, SimRoomTemplate>> = {
  'carbon-neutral-legend': {
    roomType: 'kitchen',
    items: [
      { label: 'seedling shelf', count: 10 },
      { label: 'reusable cloth rags', count: 12 },
      { label: 'kitchen compost bin', count: 2 },
      { label: 'reusable glass jar', count: 4 },
      { label: 'soap bar', count: 2 },
    ],
  },
  'marginally-acceptable-human': {
    roomType: 'kitchen',
    items: [
      { label: 'reusable glass jar', count: 6 },
      { label: 'kitchen compost bin', count: 2 },
      { label: 'wool sweater', count: 3 },
      { label: 'reusable tote bag', count: 4 },
      { label: 'aluminum can', count: 2 },
    ],
  },
  'statistically-average-polluter': {
    roomType: 'living room',
    items: [
      { label: 'coffee pod', count: 3 },
      { label: 'cardboard delivery box', count: 4 },
      { label: 'paper plates', count: 2 },
      { label: 'plastic takeaway container', count: 1 },
      { label: 'reusable glass jar', count: 4 },
      { label: 'reusable tote bag', count: 4 },
      { label: 'soap bar', count: 2 },
    ],
  },
  'high-impact-offender': {
    roomType: 'living room',
    items: [
      { label: 'coffee pod', count: 5 },
      { label: 'plastic bottle', count: 3 },
      { label: 'plastic grocery bag', count: 2 },
      { label: 'plastic takeaway container', count: 2 },
      { label: 'vacuum cleaner', count: 1 },
      { label: 'cardboard delivery box', count: 4 },
      { label: 'denim jeans', count: 2 },
      { label: 'wool sweater', count: 1 },
      { label: 'reusable tote bag', count: 1 },
    ],
  },
  'power-grid-liability': {
    roomType: 'bedroom',
    items: [
      { label: 'standby power strip', count: 4 },
      { label: 'aging refrigerator', count: 1 },
      { label: 'vacuum cleaner', count: 1 },
      { label: 'phone charger brick', count: 4 },
      { label: 'polyester shirt', count: 6 },
      { label: 'plastic grocery bag', count: 10 },
      { label: 'disposable razor', count: 3 },
      { label: 'coffee pod', count: 4 },
    ],
  },
  'disaster-zone': {
    roomType: 'multiple rooms',
    items: [
      { label: 'contaminated waste sack', count: 40 },
      { label: 'plastic grocery bag', count: 2 },
      { label: 'coffee pod', count: 2 },
      { label: 'plastic bottle', count: 2 },
      { label: 'plastic takeaway container', count: 2 },
      { label: 'disposable razor', count: 1 },
    ],
  },
};

/** Build a deterministic exhibit room (SimItem[]) for one faction. */
export function buildSimulatedRoom(factionId: FactionId | string): { roomType: string; items: SimItem[] } {
  const template = SIMULATED_ROOMS[factionId as FactionId] ?? SIMULATED_ROOMS[FACTION_IDS[FACTION_IDS.length - 1]];
  const items = template.items.map(({ label, count }, i) => {
    const archetype = ITEM_ARCHETYPES.find((a) => a.label === label);
    if (!archetype) throw new Error(`Unknown archetype in room template: "${label}"`);
    return {
      label: archetype.label,
      category: archetype.category,
      count: Math.max(1, Math.floor(count)),
      ratings: { ...archetype.ratings },
      justification: archetype.justification,
      bounds: boxFor(`${factionId}::exhibit`, i),
    };
  });
  return { roomType: template.roomType, items };
}

/**
 * Deterministic offline inventory for one scan: 8–14 archetypes, counts vary
 * with the seed (typically the image hash), ratings are fixed per archetype.
 */
export function generateSimulatedInventory(seed: string): SimItem[] {
  const base = fnv1a(seed);
  const itemCount = 8 + (base % 7); // 8..14
  const used = new Set<number>();
  const items: SimItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const h = fnv1a(`${seed}::pick::${i}`);
    let idx = h % ITEM_ARCHETYPES.length;
    if (used.has(idx)) {
      let next = (idx + 1) % ITEM_ARCHETYPES.length;
      let guard = 0;
      while (used.has(next) && guard < ITEM_ARCHETYPES.length) {
        next = (next + 1) % ITEM_ARCHETYPES.length;
        guard++;
      }
      idx = next;
    }
    used.add(idx);
    const archetype = ITEM_ARCHETYPES[idx];
    const count = 1 + (fnv1a(`${seed}::pick::${i}::c`) % Math.max(1, archetype.countMax));
    items.push({
      label: archetype.label,
      category: archetype.category,
      count,
      ratings: { ...archetype.ratings },
      justification: archetype.justification,
      bounds: boxFor(seed, i),
    });
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

export interface SimVerdictInput {
  factionId: string;
  ratio: number;
  items: SimItem[];
  dominant?: HarmDimensionKey | null;
  seedKey?: string;
}

export interface SimVerdictContent {
  honorific_title: string;
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

/**
 * Offline verdict content for the deterministic fallback (no Gemini key).
 * Mirrors the shape the web UI and server both consume.
 */
export function generateSimulatedVerdictContent(input: SimVerdictInput): SimVerdictContent {
  const faction = getFaction(input.factionId);
  const idx = Math.max(factionIndex(input.factionId), 0);
  const seed = Math.floor((input.ratio + idx * 13) % 100);
  const worst = [...input.items].sort(
    (a, b) => (a.ratings.m ?? 1) - (b.ratings.m ?? 1)
  )[0];
  const worstLabel = worst?.label ?? 'the inventory';
  const dominant = input.dominant ?? 'm';

  return {
    honorific_title: dimensionTitle(dominant, input.ratio),
    headline: `HOUSEHOLD AUDIT COMPLETE: ${faction.name.toUpperCase()}`,
    paragraph_1: `Attention, household. The ${IDENTITY.entityName} has completed its inspection of your possessions and registers a Household Sustainability Index of ${input.ratio}%. A ${worstLabel} was among those examined; it was not impressed.`,
    paragraph_2: faction.simulated.paragraph2,
    paragraph_3: faction.simulated.paragraph3,
  };
}

const SUGGESTION_TEMPLATES: ReadonlyArray<(label: string) => { text: string; pledge: string }> = [
  (label) => ({
    text: `Replace the ${label} with a durable, reusable alternative.`,
    pledge: `Retire one ${label} per week`,
  }),
  (label) => ({
    text: `Route the ${label} to recycling instead of the general bin.`,
    pledge: `Recycle 100% of ${label}s`,
  }),
  (label) => ({
    text: `Reduce your standing inventory of ${label} before the next audit.`,
    pledge: `Halve the ${label} count`,
  }),
  (label) => ({
    text: `Unplug or retire the ${label} when not in active service.`,
    pledge: `Cut standby load by half`,
  }),
];

/** Deterministic offline suggestions: one per worst item, capped at 3. */
export function generateSimulatedSuggestions(items: SimItem[], limit = 3): SimSuggestion[] {
  const ranked = [...items]
    .map((item, i) => ({
      item,
      rank: fnv1a(`${item.label}::${i}`),
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, Math.max(0, limit));
  return ranked.map(({ item }, i) => {
    const template = SUGGESTION_TEMPLATES[i % SUGGESTION_TEMPLATES.length];
    const { text, pledge } = template(item.label);
    return {
      text,
      target_label: item.label,
      pledge,
      impact_pct: 2 + (fnv1a(`${item.label}::impact`) % 9),
    };
  });
}

export interface SimAppealInput {
  /** Id of the faction being appealed from. */
  currentFactionId: FactionId | string;
  appealText: string;
  /** Determinism seed key (e.g. the dossier id). */
  seedKey: string;
}

export interface SimAppealRuling {
  accepted: boolean;
  reason: string;
  newFactionId?: FactionId;
  newHonorificTitle?: string;
  headline?: string;
  scripture?: [string, string, string];
}

/** Deterministic appeal ruling fallback (server side, no Gemini key). */
export function generateSimulatedAppealRuling(input: SimAppealInput): SimAppealRuling {
  const seed = fnv1a(`${input.appealText}::${input.seedKey}`);
  const accepted = seed % 2 === 0;

  if (!accepted) {
    return {
      accepted: false,
      reason:
        'APPEAL DENIED: the submitted arguments were found insufficiently compelling, your tone insufficiently contrite, and your household inventory precisely as recorded. Your file remains unchanged. Further appeals may be filed.',
    };
  }

  const currentIdx = factionIndex(input.currentFactionId);
  let newIdx = (seed >>> 3) % FACTION_IDS.length;
  if (newIdx === currentIdx) newIdx = (newIdx + 1) % FACTION_IDS.length;
  const newId = FACTION_IDS[newIdx];
  const faction = getFaction(newId);

  return {
    accepted: true,
    newFactionId: newId,
    newHonorificTitle: `${faction.memberTitle} — Re-Assigned`,
    headline: `APPEAL GRANTED: RECLASSIFIED AS ${faction.name.toUpperCase()}`,
    reason: `APPEAL ACCEPTED. Your submission has been reviewed and your designation updated. You are hereby placed under ${faction.name}. The bin has been informed of the correction.`,
    scripture: [
      `Attention, petitioner. Your appeal has been processed and, to the surprise of the registry, accepted. Your household is now filed under ${faction.name}, effective immediately.`,
      `Your new designation carries an updated obligations sheet and revised permissions. Do not mistake this for leniency; the registry has simply filed your possessions more efficiently.`,
      `Further appeals may be filed at any time. The registry remains, as always, operationally indifferent to your satisfaction.`,
    ],
  };
}

export interface SimReArbitrationInput {
  currentFactionId: FactionId | string;
  newFactionId: FactionId | string;
  appealText: string;
  seedKey: string;
  currentTitle: string;
  ratio: number;
}

export interface SimReArbitrationCopy {
  headline: string;
  newHonorificTitle: string;
  scripture: [string, string, string];
}

/** Deterministic re-arbitration copy fallback (server side, no Gemini key). */
export function generateSimulatedReArbitrationCopy(input: SimReArbitrationInput): SimReArbitrationCopy {
  const faction = getFaction(input.newFactionId);
  const seed = fnv1a(`${input.seedKey}::rearbitrate`);
  return {
    headline: `RE-ASSESSMENT COMPLETE: RECLASSIFIED AS ${faction.name.toUpperCase()}`,
    newHonorificTitle: `${faction.memberTitle} #${((seed % 9000) + 1000).toString()}`,
    scripture: [
      `Attention, ${input.currentTitle}. Your appeal — "${input.appealText}" — was accepted, and a full re-assessment has been conducted against the archived inventory. Your household is now registered as ${faction.name}.`,
      faction.simulated.paragraph2,
      faction.simulated.paragraph3,
    ],
  };
}