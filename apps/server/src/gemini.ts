import type {
  AppealVerdict,
  AuditItem,
  Caste,
  CitizenAppeal,
  CitizenRecord,
  OraclePayload,
  Prophecy,
  Suggestion,
} from '@ecocide/types';
import { enrichAuditItems, MATERIAL_FAMILIES } from '@ecocide/types';
import {
  buildAppealPrompt as buildLoreAppealPrompt,
  buildInventoryPrompt as buildLoreInventoryPrompt,
  buildReArbitrationPrompt as buildLoreReArbitrationPrompt,
  buildVerdictPrompt as buildLoreVerdictPrompt,
  generateSimulatedAppealRuling,
  generateSimulatedReArbitrationCopy,
  getFaction,
  householdTitle,
  INVENTORY_JSON_SCHEMA,
  VERDICT_JSON_SCHEMA,
} from '@ecocide/lore';
import type { ItemRatings, MaterialFamily, RatedItem } from '@ecocide/compliance';
import {
  clampRating,
  dedupeItems,
  dominantDimension,
  dominantMaterialFamily,
  hardFailCount,
  sanitizeCount,
  topOffender,
} from '@ecocide/compliance';
import { calculateApiCost } from './cost.js';
import { createGeminiClient, getGeminiModel } from './gemini/config.js';

/** Token/cost usage for a single model call (logged per scan). */
export interface ApiCallUsage {
  model: string;
  provider: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// PASS 1 — household inventory (vision + structured JSON with bounding boxes)
// ---------------------------------------------------------------------------

export interface InventoryResult {
  items: AuditItem[];
  roomType: string | null;
  usage: ApiCallUsage;
}

/** Coerce + clamp a raw model item into a scorable rated item. */
function toRatedItem(raw: any): RatedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (!label) return null;

  const ratings: ItemRatings = {};
  const rawRatings = raw.ratings ?? {};
  for (const key of ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'] as const) {
    const clamped = clampRating(rawRatings[key]);
    if (clamped !== null) ratings[key] = clamped;
  }

  const materialFamily =
    typeof raw.material_family === 'string' && (MATERIAL_FAMILIES as readonly string[]).includes(raw.material_family)
      ? (raw.material_family as MaterialFamily)
      : null;
  const size = raw.size === 'small' || raw.size === 'medium' || raw.size === 'large' ? raw.size : null;

  const b = raw.bounds;
  const bounds =
    b && typeof b === 'object'
      ? {
          x1: Math.min(Math.max(Number(b.x1) || 0, 0), 1),
          y1: Math.min(Math.max(Number(b.y1) || 0, 0), 1),
          x2: Math.min(Math.max(Number(b.x2) || 0, 0), 1),
          y2: Math.min(Math.max(Number(b.y2) || 0, 0), 1),
        }
      : undefined;

  return {
    label,
    category: typeof raw.category === 'string' ? raw.category : null,
    count: sanitizeCount(raw.count),
    ratings,
    materialFamily,
    size,
    justification: typeof raw.justification === 'string' ? raw.justification.slice(0, 300) : null,
    ...(bounds && bounds.x2 > bounds.x1 && bounds.y2 > bounds.y1 ? { bounds } : {}),
  };
}

/**
 * Normalize a raw inventory response: clamp ratings, sanitize counts, drop
 * unlabeled entries, merge near-duplicates into one row, score everything.
 */
export function normalizeInventory(rawItems: unknown, rawRoomType: unknown): { items: AuditItem[]; roomType: string | null } {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const rated = dedupeItems(list.map(toRatedItem).filter((item): item is RatedItem => item !== null));
  return {
    items: enrichAuditItems(rated),
    roomType: typeof rawRoomType === 'string' && rawRoomType ? rawRoomType : null,
  };
}

/** Run PASS 1: vision model detects objects + ratings + boxes. */
export async function generateHouseholdInventory(
  imageBase64: string,
  roomHint?: string | null
): Promise<InventoryResult> {
  const startTime = performance.now();
  const ai = createGeminiClient();
  const model = getGeminiModel();

  const [head, cleanBase64] = splitDataUrl(imageBase64);
  const mimeType = head.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: buildLoreInventoryPrompt(roomHint) },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: INVENTORY_JSON_SCHEMA,
      temperature: 0,
    },
  });

  const usage = usageFrom(response as any, model, startTime);
  let parsed: any = {};
  try {
    parsed = JSON.parse(response.text || '{}');
  } catch (err) {
    console.warn('[Gemini] Inventory JSON parse failed, degrading to an empty audit:', err);
  }

  const { items, roomType } = normalizeInventory(parsed.items, parsed.room_type);
  if (items.length === 0) {
    throw new Error('The Arbiter could not identify any household objects in the photograph.');
  }
  return { items, roomType, usage };
}

// ---------------------------------------------------------------------------
// PASS 2 — household classification (text-only verdict + suggestions)
// ---------------------------------------------------------------------------

export interface VerdictResult {
  payload: OraclePayload;
  usage: ApiCallUsage;
}

export interface VerdictInput {
  items: AuditItem[];
  roomType: string | null;
  ratio: number;
  caste: Caste;
}

/** Per-item inventory summary lines fed to the classification prompt. */
export function buildItemsSummary(items: AuditItem[]): string {
  return items
    .map((item) => {
      const overrides = item.overrides?.length
        ? ` // ${item.overrides.map((o) => o.toUpperCase()).join(' + ')}`
        : '';
      return `- x${item.count} ${item.label} // SI ${item.si?.toFixed(1) ?? '?'} // ${(item.status ?? 'unknown').toUpperCase()}${overrides}`;
    })
    .join('\n');
}

/** Deterministic personalized title for a household (lore title driver table). */
export function householdTitleFor(items: AuditItem[], ratio: number): string {
  return householdTitle({
    ratio,
    dominant: dominantDimension(items),
    dominantMaterial: dominantMaterialFamily(items),
  });
}

export function buildVerdictPrompt(input: VerdictInput): string {
  const faction = getFaction(input.caste);
  const honorificTitle = householdTitleFor(input.items, input.ratio);
  return buildLoreVerdictPrompt({
    factionId: input.caste,
    ratio: input.ratio,
    itemsSummary: buildItemsSummary(input.items),
    honorificTitle,
    roomType: input.roomType,
    paragraph2: faction.promptBlocks.paragraph2,
    paragraph3: faction.promptBlocks.paragraph3,
  });
}

function sanitizeSuggestions(raw: unknown): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: Suggestion[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const text = typeof s.text === 'string' ? s.text.trim() : '';
    if (!text) continue;
    const impact = Number(s.impact_pct);
    out.push({
      text,
      target_label: typeof s.target_label === 'string' ? s.target_label : '',
      pledge: typeof s.pledge === 'string' && s.pledge ? s.pledge : text,
      impact_pct: Number.isFinite(impact) ? Math.min(99, Math.max(1, Math.round(impact))) : 5,
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** Run PASS 2: the model writes the verdict copy + suggestions (never math). */
export async function generateHouseholdVerdict(input: VerdictInput): Promise<VerdictResult> {
  const startTime = performance.now();
  const ai = createGeminiClient();
  const model = getGeminiModel();
  const prompt = buildVerdictPrompt(input);

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: VERDICT_JSON_SCHEMA,
      temperature: 0.9,
    },
  });

  const usage = usageFrom(response as any, model, startTime);
  let parsed: any = {};
  try {
    parsed = JSON.parse(response.text || '{}');
  } catch (err) {
    console.warn('[Gemini] Verdict JSON parse failed, falling back to default copy:', err);
  }

  const faction = getFaction(input.caste);
  const honorificTitle = householdTitleFor(input.items, input.ratio);
  const worst = topOffender(input.items);
  const prophecy: Prophecy = {
    headline: parsed.headline || `HOUSEHOLD AUDIT COMPLETE: ${faction.name.toUpperCase()}`,
    paragraph_1: parsed.paragraph_1 || `The ${faction.name} classification is registered. The Bureau has examined your possessions.`,
    paragraph_2: parsed.paragraph_2 || faction.simulated.paragraph2,
    paragraph_3: parsed.paragraph_3 || faction.simulated.paragraph3,
  };

  const payload: OraclePayload = {
    user_profile: {
      caste: input.caste,
      biocarbon_ratio: input.ratio,
      honorific_title: honorificTitle,
    },
    prophecy,
    audit: {
      roomType: input.roomType,
      items: input.items,
      ratio: input.ratio,
      hardFails: hardFailCount(input.items),
      topOffenderLabel: worst?.label ?? null,
    },
    suggestions: sanitizeSuggestions(parsed.suggestions),
  };

  return { payload, usage };
}

// ---------------------------------------------------------------------------
// APPEAL ARBITRATION (text-only ruling grounded in the audited inventory)
// ---------------------------------------------------------------------------

/** Builds the compact appeal-ruling prompt (copy from the lore pack). */
export function buildAppealPrompt(dossier: CitizenRecord, appeal: string): string {
  const profile = dossier.user_profile || dossier.profile;
  return buildLoreAppealPrompt(
    {
      id: dossier.id,
      factionId: profile.caste,
      ratio: profile.biocarbon_ratio,
      honorificTitle: profile.honorific_title,
      headline: dossier.prophecy?.headline ?? null,
      itemsSummary: buildItemsSummary(dossier.audit?.items ?? []),
    },
    appeal
  );
}

/** Runs the appeal ruling through Gemini (text-only, small). */
export async function generateAppealVerdict(
  dossier: CitizenRecord,
  appeal: string
): Promise<{ verdict: AppealVerdict; usage: ApiCallUsage }> {
  const startTime = performance.now();
  const ai = createGeminiClient();
  const model = getGeminiModel();
  const prompt = buildAppealPrompt(dossier, appeal);

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.9 },
  });

  const usage = usageFrom(response as any, model, startTime);
  const parsed = JSON.parse(response.text || '{}');

  const verdict: AppealVerdict = {
    accepted: Boolean(parsed.accepted),
    reason: parsed.reason || 'The appeal has been processed and denied.',
    newCaste: parsed.accepted ? (parsed.new_caste as AppealVerdict['newCaste']) : undefined,
    newHonorificTitle: parsed.accepted ? parsed.new_honorific_title : undefined,
    headline: parsed.accepted ? parsed.headline : undefined,
    scripture: parsed.accepted && Array.isArray(parsed.scripture) ? parsed.scripture : undefined,
  };

  return { verdict, usage };
}

/** Simulation fallback for appeal rulings (deterministic, hashed). */
export function generateSimulatedAppealVerdict(dossier: CitizenRecord, appeal: string): AppealVerdict {
  const profile = dossier.user_profile || dossier.profile;
  const content = generateSimulatedAppealRuling({
    currentFactionId: profile.caste,
    appealText: appeal,
    seedKey: dossier.id,
  });

  if (!content.accepted || !content.newFactionId) {
    return { accepted: false, reason: content.reason };
  }

  return {
    accepted: true,
    newCaste: content.newFactionId,
    newHonorificTitle: content.newHonorificTitle,
    headline: content.headline,
    reason: content.reason,
    scripture: content.scripture,
  };
}

// ---------------------------------------------------------------------------
// RE-ARBITRATION (fresh full verdict after a granted appeal, on stored items)
// ---------------------------------------------------------------------------

export interface ReArbitrationVerdict {
  headline: string;
  newHonorificTitle: string;
  scripture: [string, string, string];
}

/** Builds the re-arbitration prompt (items + appeal, no vision re-call). */
export function buildReArbitrationPrompt(dossier: CitizenRecord, appeal: CitizenAppeal): string {
  const profile = dossier.user_profile || dossier.profile;
  const newCaste = appeal.newCaste || profile.caste;
  return buildLoreReArbitrationPrompt(
    {
      id: dossier.id,
      factionId: profile.caste,
      ratio: profile.biocarbon_ratio,
      honorificTitle: profile.honorific_title,
      itemsSummary: buildItemsSummary(dossier.audit?.items ?? []),
    },
    {
      appealText: appeal.appealText,
      newFactionId: newCaste,
    }
  );
}

/** Runs the full re-arbitration (text-only; the archive items are the evidence). */
export async function generateReArbitrationVerdict(
  dossier: CitizenRecord,
  appeal: CitizenAppeal
): Promise<ReArbitrationVerdict> {
  const startTime = performance.now();
  const ai = createGeminiClient();
  const model = getGeminiModel();
  const prompt = buildReArbitrationPrompt(dossier, appeal);

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.9 },
  });

  const usage = usageFrom(response as any, model, startTime);
  void usage; // re-arbitration usage is not persisted today

  const parsed = JSON.parse(response.text || '{}');
  const rawScripture = Array.isArray(parsed.scripture) ? (parsed.scripture as string[]) : [];
  const fallbackLine = 'The re-assessment registry has logged your new classification.';
  const scripture: [string, string, string] = [
    typeof rawScripture[0] === 'string' && rawScripture[0] ? rawScripture[0] : fallbackLine,
    typeof rawScripture[1] === 'string' && rawScripture[1] ? rawScripture[1] : fallbackLine,
    typeof rawScripture[2] === 'string' && rawScripture[2] ? rawScripture[2] : fallbackLine,
  ];

  const finalCaste = appeal.newCaste || (dossier.user_profile || dossier.profile).caste;

  return {
    headline:
      parsed.headline || `APPEAL GRANTED: RECLASSIFIED AS ${getFaction(finalCaste).name.toUpperCase()}`,
    newHonorificTitle:
      (parsed.new_honorific_title as string) ||
      `${getFaction(finalCaste).memberTitle} #${Math.floor(Math.random() * 9000) + 1000}`,
    scripture,
  };
}

/** Deterministic simulation fallback for a fresh re-arbitration verdict. */
export function generateSimulatedReArbitration(
  dossier: CitizenRecord,
  appeal: CitizenAppeal
): ReArbitrationVerdict {
  const profile = dossier.user_profile || dossier.profile;
  const newCaste = appeal.newCaste || profile.caste;
  return generateSimulatedReArbitrationCopy({
    currentFactionId: profile.caste,
    newFactionId: newCaste,
    appealText: appeal.appealText,
    seedKey: appeal.id,
    currentTitle: profile.honorific_title || getFaction(newCaste).memberTitle,
    ratio: profile.biocarbon_ratio,
  });
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/** Split a data URL ("data:image/jpeg;base64,....") into [head, base64data]. */
function splitDataUrl(image: string): [string, string] {
  const idx = image.indexOf(';base64,');
  if (idx !== -1) return [image.slice(0, idx), image.slice(idx + 8)];
  if (image.startsWith('data:')) {
    const comma = image.indexOf(',');
    if (comma !== -1) return [image.slice(0, comma), image.slice(comma + 1)];
  }
  return ['', image];
}

function usageFrom(response: any, model: string, startTime: number): ApiCallUsage {
  const durationMs = Math.round(performance.now() - startTime);
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const thoughtsTokens = response.usageMetadata?.thoughtsTokenCount || 0;
  const totalTokens =
    response.usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens + thoughtsTokens);
  const cost = calculateApiCost(model, { promptTokens, candidatesTokens, thoughtsTokens });
  return {
    model,
    provider: 'google',
    promptTokens,
    candidatesTokens,
    thoughtsTokens,
    totalTokens,
    costUsd: cost.totalCostUsd,
    durationMs,
  };
}