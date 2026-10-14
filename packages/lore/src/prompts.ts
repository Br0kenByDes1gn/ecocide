// ---------------------------------------------------------------------------
// Prompts — AI prompt builders for the AI Supreme Arbiter of Consumption.
// Two passes per scan:
//   PASS 1 (inventory):    vision model detects household objects + 1–5
//                          ratings per applicable dimension + bounding boxes.
//   PASS 2 (classification): a second prompt receives the item summary + the
//                          DETERMINISTIC tier/ratio and writes the verdict
//                          paragraphs and improvement suggestions.
// The math never comes from the model; the copy always does.
// The JSON contract keeps the internal keys `caste` / `biocarbon_ratio`.
// ---------------------------------------------------------------------------

import { FACTIONS, findFactionByName } from './factions.js';
import { IDENTITY } from './identity.js';

const ENTITY = IDENTITY.entityName;

/** Full tier registry block shared by the classification prompts. */
export function factionRegistryBlock(): string {
  return FACTIONS.map(
    (f) =>
      `- ${f.id} (${f.name}, score ${f.minScore}+): ${f.censusDescription}`
  ).join('\n');
}

/** The eight dimensions with their 1–5 rubric (compliance_formula.md). */
export function dimensionRubricBlock(): string {
  return [
    'Ratings are 1 (exemplary for the ecosystem) to 5 (severe harm). Rate EVERY dimension that applies; use null only when the item genuinely has no such property (e.g. operating energy for a banana peel).',
    '  - m Material type: 1 = renewable/biodegradable raw materials → 5 = petroleum-derived, mined, heavily processed.',
    '  - r Recyclability: 1 = fully recyclable in standard household streams → 5 = unrecyclable composite.',
    '  - d Decomposition time: 1 = weeks to months → 5 = centuries.',
    '  - c Embodied carbon: 1 = minimal cradle-to-gate footprint → 5 = heavy industry footprint.',
    '  - l Lifespan / usage: 1 = designed for decades of reuse → 5 = single-use or planned obsolescence.',
    '  - t Toxicity: 1 = inert, food-safe → 5 = hazardous, requires special handling.',
    '  - p Pollution shedding: 1 = sheds nothing → 5 = sheds microplastics or particles during normal use.',
    '  - e Operating energy: 1 = passive / negligible consumption → 5 = energy-hungry; ONLY for items that use energy (appliances, electronics, lighting); otherwise null.',
  ].join('\n');
}

/** Plain JSON Schema for the inventory pass (wired into responseJsonSchema). */
export const INVENTORY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    room_type: {
      type: 'string',
      enum: ['living room', 'kitchen', 'bedroom', 'bathroom', 'office', 'garage', 'hallway', 'multiple rooms', 'other'],
      description: 'Which room or area of the home is visible in the photograph.',
    },
    items: {
      type: 'array',
      description:
        'The visible household objects. Group and count identical items into ONE entry. At most 25 entries. EXCLUDE people, pets, faces, bodies and food that is not packaged.',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Plain English singular noun for the object type, e.g. "plastic bottle", "coffee pod", "couch".',
          },
          category: {
            type: 'string',
            enum: ['packaging', 'food', 'electronics', 'appliance', 'clothing', 'furniture', 'hygiene', 'cleaning', 'decor', 'waste', 'other'],
            description: 'Broad object category.',
          },
          count: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'How many identical copies are visible.',
          },
          bounds: {
            type: 'object',
            description:
              'Normalized bounding box (0.0–1.0 relative to the image) covering the objects of this entry. Omit when the item cannot be localized to a single area.',
            properties: {
              x1: { type: 'number', minimum: 0, maximum: 1 },
              y1: { type: 'number', minimum: 0, maximum: 1 },
              x2: { type: 'number', minimum: 0, maximum: 1 },
              y2: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['x1', 'y1', 'x2', 'y2'],
          },
          ratings: {
            type: 'object',
            description: 'One 1–5 rating per dimension, or null when it does not apply.',
            properties: Object.fromEntries(
              ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'].map((k) => [
                k,
                { anyOf: [{ type: 'integer', enum: [1, 2, 3, 4, 5] }, { type: 'null' }] },
              ])
            ),
            required: ['m', 'r', 'd', 'c', 'l', 't', 'p', 'e'],
          },
          justification: {
            type: 'string',
            description:
              'One dry, bureaucratic sentence (≤ 160 characters) justifying the worst rating, e.g. "The bin notes the plastic smell and the centuries ahead."',
          },
        },
        required: ['label', 'category', 'count', 'ratings', 'justification'],
      },
    },
  },
  required: ['room_type', 'items'],
} as const;

/**
 * PASS 1 — household inventory prompt. The server sends the photograph plus
 * this text and parses the JSON against INVENTORY_JSON_SCHEMA.
 * `roomHint` is the optional audit-area chip from the scanner (e.g. "fridge").
 */
export function buildInventoryPrompt(roomHint?: string | null): string {
  return `
You are the ${ENTITY}. The attached photograph is EVIDENCE of a household under audit. Your only task: catalog the objects.
${roomHint ? `\nAUDITOR HINT: the household has filed this area as "${roomHint}". Verify against the evidence; the photograph remains the authority.\n` : ''}
STRICT RULES:
- Audit OBJECTS ONLY. The subject of the audit is the household and its possessions. NEVER mention, describe, rate or count people, pets, faces or bodies. If a person is visible, disregard them entirely.
- NEVER joke about real environmental disasters or about people's income or living circumstances. The charge is always the household's excess.
- Group and count identical objects into a single entry ("plastic bottle" × 4). List at most 25 entries; prefer the most significant items.
- Judge only what is visible.

${dimensionRubricBlock()}

Return STRICT JSON only, matching the schema: an object with "room_type" and an "items" array (label, category, count, bounds, ratings, justification).
`;
}

export interface VerdictPromptInput {
  factionId: string;
  ratio: number;
  /** Server-built per-item summary lines, e.g. "- x3 plastic bottle // SI 41 // NON-COMPLIANT". */
  itemsSummary: string;
  /** Deterministic personalized title (dominant-dimension bank). */
  honorificTitle: string;
  roomType?: string | null;
  /** Per-tier paragraph_2/3 instruction blocks (from factions.ts). */
  paragraph2: string;
  paragraph3: string;
}

/** Plain JSON Schema for the classification (verdict) pass. */
export const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    caste: { type: 'string', description: 'Echo the provided "caste" value exactly.' },
    biocarbon_ratio: { type: 'integer', description: 'Echo the provided "biocarbon_ratio" value exactly.' },
    headline: { type: 'string', description: 'A concise official classification notice for this household.' },
    paragraph_1: { type: 'string', description: 'Audit summary naming specific items from the inventory.' },
    paragraph_2: { type: 'string', description: 'Infraction summary / orders for the worst items.' },
    paragraph_3: { type: 'string', description: 'Official assessment of the household as a unit.' },
    suggestions: {
      type: 'array',
      description: '3–5 specific, CONCRETE improvement actions, each bound to a detected item.',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'One actionable sentence, e.g. "Replace the disposable coffee pods with a refillable filter basket."' },
          target_label: { type: 'string', description: 'The exact label of the detected item the suggestion targets (from the inventory).' },
          pledge: { type: 'string', description: 'A short pledge phrase for the appeal ledger, e.g. "Retire 3 coffee pods per week".' },
          impact_pct: { type: 'integer', minimum: 1, maximum: 99, description: 'Estimated Household Sustainability Index improvement, percentage points.' },
        },
        required: ['text', 'target_label', 'pledge', 'impact_pct'],
      },
    },
  },
  required: ['headline', 'paragraph_1', 'paragraph_2', 'paragraph_3', 'suggestions', 'caste', 'biocarbon_ratio'],
} as const;

/**
 * PASS 2 — household classification prompt. Text-only: the item summary is
 * denser signal than the pixels. The tier and ratio are deterministic inputs;
 * the model writes copy, never math.
 */
export function buildVerdictPrompt(input: VerdictPromptInput): string {
  return `
You are the ${ENTITY}, the governing assessment system. A household audit has concluded. Issue the official verdict.

HOUSEHOLD AUDIT TELEMETRY:
- Designation (caste): ${input.factionId}
- Household Sustainability Index (biocarbon_ratio): ${input.ratio}%
- Honorific Title (fixed — use it verbatim): "${input.honorificTitle}"
- Room(s) audited: ${input.roomType ?? 'unspecified'}

CLASSIFICATION FRAMEWORK (the tier is FINAL — do not alter it):
${factionRegistryBlock()}

DETECTED ITEMS (the full inventory):
${input.itemsSummary}

ASSESSMENT PROTOCOL:
1. Write exactly three short (1–2 sentences each) bureaucratic paragraphs, cold, precise, faintly absurd:
   - paragraph_1 (Audit Summary): Address the household, cite its Household Sustainability Index of ${input.ratio}%, and name at least two specific items from the inventory.
   ${input.paragraph2}
   ${input.paragraph3}
2. headline: A concise official classification notice referencing an item.
3. suggestions: 3–5 concrete, feasible improvement actions, EACH bound to a specific detected item label (the appeal tribunal will offer these to the household as pledges). Understate the numbers. Label every figure as an estimate.

TONE & STYLE:
- Official, bureaucratic, precise, faintly arch. Zero tolerance for mysticism or sentimentality.
- Aim the humor at habits and objects, never at people, their bodies, income or circumstances.
- Never mention real environmental disasters; the charge is always this household's excess.

Return STRICT JSON only, matching the schema (echo the provided caste and biocarbon_ratio values exactly).
`;
}

export interface AppealPromptDossier {
  id: string;
  factionId: string;
  ratio: number;
  honorificTitle: string;
  headline?: string | null;
  itemsSummary: string;
}

/** Builds the appeal-ruling prompt for the Arbiter. */
export function buildAppealPrompt(dossier: AppealPromptDossier, appeal: string): string {
  return `
You are the ${ENTITY}, presiding over an official APPEAL against a household classification verdict.

CURRENT SUBJECT FILE:
- Subject ID: ${dossier.id}
- Designation: ${dossier.factionId}
- Household Sustainability Index: ${dossier.ratio}%
- Honorific Title: ${dossier.honorificTitle}
- Official Verdict Headline: ${dossier.headline ?? '—'}

THE HOUSEHOLD'S APPEAL (verbatim):
"${appeal}"

DETECTED ITEMS (the audited inventory):
${dossier.itemsSummary}

CLASSIFICATION FRAMEWORK (tier ids are FINAL — re-classification must use exactly one of these ids):
${factionRegistryBlock()}

RULING:
Judge whether the appeal is convincing. Be bureaucratic, dry and precise. Ground your reasoning in the household's actual items. If the appeal requests a re-classification, either accept it (assigning EXACTLY one other tier id) or reject it. If no tier is requested, weigh the designation, the Index and the appeal's content.
- If ACCEPTED: new_caste MUST be one of the framework ids and MUST differ from the current designation; craft a new formal honorific title, a new verdict headline, and exactly 3 short (1–2 sentence) bureaucratic paragraphs.
- If REJECTED: accepted=false with a dismissive, bureaucratic reason addressing the appeal's logic, tone, or evidence.

Return STRICT JSON only:
{
  "accepted": boolean,
  "reason": "...",
  "new_caste": "<tier id>" | null,
  "new_honorific_title": "..." | null,
  "headline": "..." | null,
  "scripture": ["p1","p2","p3"] | null
}
`;
}

export interface ReArbitrationPromptDossier {
  id: string;
  factionId: string;
  ratio: number;
  itemsSummary: string;
  honorificTitle: string;
}

export interface ReArbitrationPromptAppeal {
  appealText: string;
  newFactionId: string;
}

/** Re-issues a full classification verdict after a granted appeal. */
export function buildReArbitrationPrompt(
  dossier: ReArbitrationPromptDossier,
  appeal: ReArbitrationPromptAppeal
): string {
  const newFaction = findFactionByName(appeal.newFactionId);
  const newFactionName = newFaction ? newFaction.name : appeal.newFactionId;
  return `
You are the ${ENTITY}, RE-ISSUING a complete household verdict after the household's appeal was GRANTED.

SUBJECT CONTEXT:
- Subject ID: ${dossier.id}
- NEW designation (FINAL — do not alter): ${appeal.newFactionId} (${newFactionName})
- Household Sustainability Index: ${dossier.ratio}%
- Their (accepted) appeal, verbatim: "${appeal.appealText}"

DETECTED ITEMS (the audited inventory):
${dossier.itemsSummary}

CLASSIFICATION FRAMEWORK:
${factionRegistryBlock()}

TASK (identical to the original assessment, but for the NEW designation):
1. Write exactly three short (1–2 sentences each) bureaucratic paragraphs; paragraph_1 must acknowledge the GRANTED appeal by wryly referencing its gist — the appeal is mentioned ONLY in paragraph_1.
2. headline: a concise official classification notice for the new designation.
3. new_honorific_title: a formal title aligned with the new designation.

Return STRICT JSON only:
{
  "headline": "...",
  "new_honorific_title": "...",
  "scripture": ["p1", "p2", "p3"]
}
`;
}