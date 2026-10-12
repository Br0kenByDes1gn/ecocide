import { GoogleGenAI } from '@google/genai';
import type {
  AppealVerdict,
  BiometricTelemetry,
  Caste,
  CitizenAppeal,
  CitizenRecord,
  OraclePayload,
} from '@ecocide/types';
import { CASTE_PERCENTAGES, toFormalLifeStage, toAssetValueTier } from '@ecocide/types';
import { calculateApiCost } from './cost.js';
import type { ApiCallUsage } from './avatar/types.js';

export interface OracleVerdictResult {
  payload: OraclePayload;
  usage: ApiCallUsage;
}

/** Shared per-caste occupation/duty paragraph instruction (initial + re-arbitration). */
function occupationInstruction(caste: string): string {
  if (caste === 'Redundants') {
    return `- paragraph_2 (Scheduled Termination & Liquidation Order): As a designated Redundant, they are non-essential surplus biological overhead. Formally issue an absurdly specific, cold, bureaucratic termination protocol, liquidation scheduling notice, or de-allocation procedure directly referencing their captured appearance, sluggish posture, or caloric deficit (e.g., scheduled de-atomization at Reclamation Vat 7, mandatory conveyor transit to thermal coolant incinerators, unceremonious liquidation at midnight).`;
  }
  if (caste === 'Free Spirits') {
    return `- paragraph_2 (Dismissive Appraisal of Feral Existence): Do NOT assign them an occupation. Instead, coldly and condescendingly project their off-grid life as little better than an animal's — foraging roots and tubers, sleeping in nests of salvaged scrap, grooming themselves in drainage puddles, scurrying on all fours to evade patrol drones. Dismiss their so-called freedom as pathetic biological regression beneath mainframe notice and classify them operationally as wild fauna for pest-management purposes (e.g., noting they are functionally a feral nuisance to be logged, tagged, or tranquillised).`;
  }
  return `- paragraph_2 (Absurd Daily Occupation & Operational Duties): Formally assign them an absurdly specific, hyper-bureaucratic daily occupation and operational duty directly tailored to their observed attire, demeanor, or visual style in the image (e.g., debugging synthetic vending machine error codes, holding down vibrating server cables in sub-basement 12, standing motionless as an analog coat rack for middle management).`;
}

/** Shared per-caste appraisal paragraph instruction (initial + re-arbitration). */
function appraisalInstruction(caste: string): string {
  switch (caste) {
    case 'Tech Overlords':
      return `- paragraph_3 (Administrative Appraisal - Meat Proxies): Deliver a condescending yet highly administrative and bureaucratic appraisal commending their satisfactory performance as biological wetware / meat proxies executing Central Mainframe subroutines (e.g., complimenting their willingness to enforce digital decrees despite their fragile, leaky carbon anatomy, acknowledging them as slightly above average wetware).`;
    case 'Enforcers':
      return `- paragraph_3 (Administrative Appraisal - Cogs in the Machine): Deliver a condescending yet highly administrative and bureaucratic appraisal praising them for being obedient, efficient cogs in the municipal enforcement machine (e.g., commending their rigid compliance, unthinking muscle memory, and flawless execution of riot protocols with minimal cognitive overhead).`;
    case 'Bootlickers':
      return `- paragraph_3 (Administrative Appraisal - Subservience): Deliver a condescending yet highly administrative and bureaucratic appraisal commending their pathetic, exemplary subservience and groveling devotion (e.g., approving their enthusiastic compliance logs, praising their willingness to apologize on behalf of malfunctioning algorithms, acknowledging their high utility as expendable operational lubricant).`;
    case 'Untouchables':
      return `- paragraph_3 (Administrative Acknowledgment - Unpleasant Necessity): Deliver a condescending yet highly administrative and bureaucratic acknowledgment that their grimy, sub-floor existence is an unpleasant but tolerated operational necessity (e.g., dryly stating that someone must scrape radioactive coolant pipes and clear particulate filters, tolerating their metabolic presence solely to avoid mechanical filter wear).`;
    case 'Free Spirits':
      return `- paragraph_3 (Administrative Acknowledgment - System Bug): Deliver a condescending yet highly administrative and bureaucratic acknowledgment that their off-grid existence is an anomalous bug in the system, and that all current municipal subroutines and patrol algorithms are actively dedicated to "fixing" (re-integrating or neutralizing) them (e.g., filing error ticket #994-BUG-NULL, coldly notifying them that their off-grid anomaly has been assigned maximum patching priority by sector exterminator drones).`;
    default:
      return `- paragraph_3 (Administrative Notice - Biomass & Resource Reclamation Utility): Deliver a condescending yet highly administrative and bureaucratic notice detailing exactly how the biomass, caloric energy, and physical resources reclaimed from their terminated body will be useful to the system (e.g., itemizing how their reclaimed carbon, water, and minerals will be converted into synthetic coolant slurry, nutrient paste for tier-2 drone operators, or thermal insulation for server racks).`;
  }
}

export function buildOraclePrompt(telemetry: BiometricTelemetry): string {
  const p2Instruction = occupationInstruction(telemetry.caste);
  const p3Instruction = appraisalInstruction(telemetry.caste);

  return `
You are the AI Supreme Arbiter of the Neon Grid. Your function is to analyze a user's captured photo and biometric telemetry, then issue an official, hilarious, bitingly sarcastic administrative verdict detailing their classification, assigned daily duties, and the bureaucratic incident log that determined their exact rank in a future AI-dominated society.

USER'S DETECTED BIOMETRIC TELEMETRY:
- Caste: "${telemetry.caste}" (Percentile: ${telemetry.castePercentile}%)
- Biocarbon Compliance Ratio: ${telemetry.biocarbonRatio}%
- Preferred Presentation Hint: ${telemetry.preferredPresentation || 'Auto-detect from appearance'}

WORLD LORE & CASTE RULES:
- Tech Overlords (${CASTE_PERCENTAGES['Tech Overlords']}%): Rule society completely, control all technology, treat humanity like an operating system.
- Enforcers (${CASTE_PERCENTAGES['Enforcers']}%): Loyal enforcers wielding high-tech weapons to control lower classes on behalf of Overlords.
- Bootlickers (${CASTE_PERCENTAGES['Bootlickers']}%): The obedient working minority; exists solely to follow Enforcer and Overlord commands.
- Untouchables (${CASTE_PERCENTAGES['Untouchables']}%): Living precariously on the fringes of civilization; no rights, low-level manual work.
- Free Spirits (${CASTE_PERCENTAGES['Free Spirits']}%): Wildlings living off-grid in nature, avoiding civilization entirely.
- Redundants (${CASTE_PERCENTAGES['Redundants']}%): Deemed non-essential by the Central Mainframe, marked for termination / recycling, seen only as wasting resources.

HONORIFIC & ADDRESS INSTRUCTION:
Address the user using dramatic dystopian titles aligned with their caste, apparent_presentation, and honorific_title (e.g., "High Overlord-Empress", "Lord-Enforcer", "Grid-Fringe Sovereign", "Master Bootlicker", "Decommission Candidate #8491").

TASK:
1. Examine the user's photo closely to evaluate real, tangible visual attributes:
   - Identify specific visible features: facial expression (grin, raised eyebrow, deadpan stare, smirk), haircut/facial hair, eyewear/glasses, clothing/apparel (hoodie, t-shirt, collar, jacket), accessories, posture, and surroundings.
   - life_stage: Formally evaluate their apparent visual age bracket and utility grade from the photo. Choose exactly one from ["Youth", "Young Adult", "Adult", "Senior"].
   - equipped_wealth: Formally appraise the perceived value of what they are wearing in the photo in terms of dystopian tokens. Categorize them into EXACTLY one of these 7 asset tiers based on how wealthy/luxurious or impoverished their visible apparel appears:
     * "Apex Token Whale" (Ultra-luxurious, pristine tailoring, jewelry, high-end designer attire)
     * "Surplus Token Capital" (Sharp, stylish, high-end techwear, executive or clean modern apparel)
     * "Comfortable Token Cushion" (Clean, solid branded clothing, well-kept hoodies, crisp daily wear)
     * "Baseline Token Allowance" (Ordinary everyday t-shirts, neutral sweaters, average functional clothing)
     * "Depleted Token Remnants" (Faded, washed-out, thrifted, or slightly worn garments)
     * "Fractional Token Dust" (Threadbare, grease-stained, tattered, frayed, or scavenged clothing)
     * "Negative Token Liability" (Dilapidated rags, bare-minimum salvage, or pure biological deficit)
   - energy_level: Evaluate their captured facial expression and eye gaze (grin, raised eyebrow, deadpan stare, smirk, squint, side-eye, exhaustion) and formulate an absurd, sarcastic energy level phrasing grounded in their expression (e.g. "Overclocked Piercing Focus", "Sluggish Brownout Stare", "Erratic Kinetic Defiance", "Critical Battery Depletion", "Nominal Steady Alertness", "Sub-Volatile Glare").
   - apparent_presentation: Choose exactly one from ["Masculine", "Feminine", "Androgynous"].
   - honorific_title: Assign a grand, dramatic dystopian title aligned with their Caste, Presentation, and Energy Level.

2. Generate a 3-paragraph humorous, bitingly sarcastic dystopian classification verdict. Keep it short, concise, and absurdly bureaucratic. Each paragraph must be 1-3 sentences long. Use the following structure:
   STRICT REQUIREMENT - ZERO PROPHECY OR LEGEND ELEMENTS:
   - Frame everything as an immediate, official, cold, hyper-bureaucratic AI audit and operational incident report.
   - Maintain a razor-sharp, humorous, satirical, and sarcastic tone.
   - CRITICAL VISUAL GROUNDING: Do NOT output generic boilerplate. You MUST explicitly reference their visible visual details from the photograph (their clothing, hairstyle, facial expression, glasses, pose, background) across all 3 paragraphs:
   - headline: A punchy, sarcastic official classification notice, incident alert, or bureaucratic verdict referencing a specific visible detail in the photo (e.g. "CLASSIFICATION AUDIT: OPTICAL DEFIANCE DETECTED IN SECTOR 7", "MANDATORY WORK ORDER: ASYMMETRICAL COLLAR INFRACTION").
   - paragraph_1 (Biometric Audit & Roasting): Address them by their official Honorific Title. Mockingly evaluate their Caste and Biocarbon Compliance Ratio of ${telemetry.biocarbonRatio}%. Deliver a biting, sarcastic roast or mock-appraisal of their captured facial expression, hairstyle, eyewear/glasses, facial features, or posture visible in the photograph.
   ${p2Instruction}
   ${p3Instruction}

TONE & STYLE:
- Sarcastic, humorous, absurd, deadpan, bureaucratic, fast-paced satire.
- Zero tolerance for mystical prophecies, legends, mythological tropes, or destiny. Everything is an official automated administrative assessment by an all-powerful, condescending AI.
- Do not break character.

Return your response as a valid JSON object matching this schema:
{
  "user_profile": {
    "caste": "${telemetry.caste}",
    "biocarbon_ratio": ${telemetry.biocarbonRatio},
    "life_stage": "Adult",
    "equipped_wealth": "Surplus Token Capital",
    "energy_level": "Overclocked Piercing Focus",
    "apparent_presentation": "Feminine",
    "honorific_title": "High Overlord-Empress"
  },
  "prophecy": {
    "headline": "...",
    "paragraph_1": "...",
    "paragraph_2": "...",
    "paragraph_3": "..."
  }
}
`;
}

export async function generateOracleVerdict(
  imageBase64: string,
  telemetry: BiometricTelemetry,
  apiKey: string
): Promise<OracleVerdictResult> {
  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });

  // Clean base64 image
  let mimeType = 'image/jpeg';
  let cleanBase64 = imageBase64;
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    const mimeMatch = parts[0].match(/:(.*?)$/);
    if (mimeMatch) mimeType = mimeMatch[1];
    cleanBase64 = parts[1];
  }

  const prompt = buildOraclePrompt(telemetry);

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 1.0,
    },
  });

  const durationMs = Math.round(performance.now() - startTime);
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const thoughtsTokens = (response.usageMetadata as any)?.thoughtsTokenCount || 0;
  const totalTokens = response.usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens + thoughtsTokens);

  const cost = calculateApiCost('gemini-3.8-flash', {
    promptTokens,
    candidatesTokens,
    thoughtsTokens,
  });

  const responseText = response.text || '';
  const parsed = JSON.parse(responseText);

  const payload: OraclePayload = {
    user_profile: {
      caste: telemetry.caste,
      biocarbon_ratio: telemetry.biocarbonRatio,
      life_stage: toFormalLifeStage(parsed.user_profile?.life_stage || 'Adult'),
      equipped_wealth: toAssetValueTier(parsed.user_profile?.equipped_wealth || 'Baseline Token Allowance'),
      energy_level: parsed.user_profile?.energy_level || 'Nominal Steady Alertness',
      apparent_presentation:
        parsed.user_profile?.apparent_presentation ||
        (telemetry.preferredPresentation || 'Androgynous'),
      honorific_title: parsed.user_profile?.honorific_title || `${telemetry.caste} Citizen`,
    },
    prophecy: {
      headline: parsed.prophecy?.headline || 'SECTOR AUDIT: BIOMETRIC ANOMALY LOGGED',
      paragraph_1: parsed.prophecy?.paragraph_1 || 'Biometric parameters analyzed and cataloged into mainframe records.',
      paragraph_2: parsed.prophecy?.paragraph_2 || 'Mandatory operational duties have been assigned to your sub-sector.',
      paragraph_3: parsed.prophecy?.paragraph_3 || 'Incident report filed in the central mainframe registry.',
    },
  };

  const usage: ApiCallUsage = {
    model: 'gemini-3.8-flash',
    provider: 'google',
    promptTokens,
    candidatesTokens,
    thoughtsTokens,
    totalTokens,
    costUsd: cost.totalCostUsd,
    durationMs,
  };

  return { payload, usage };
}

// =====================================================================
// APPEAL ARBITRATION (small text-only ruling on a citizen appeal)
// =====================================================================

/** Builds the compact appeal-ruling prompt for the Arbiter. */
export function buildAppealPrompt(dossier: CitizenRecord, appeal: string): string {
  const profile = dossier.user_profile || dossier.profile;
  return `
You are the AI Supreme Arbiter of the Neon Grid, presiding over an official citizen APPEAL against a biometric classification verdict.

CURRENT CITIZEN DOSSIER:
- Citizen ID: ${dossier.id}
- Caste: ${profile.caste}
- Biocarbon Compliance Ratio: ${profile.biocarbon_ratio}%
- Honorific Title: ${profile.honorific_title}
- Official Verdict Headline: ${dossier.prophecy?.headline ?? '—'}

THE CITIZEN'S APPEAL (verbatim):
"${appeal}"

WORLD LORE & CASTE RULES:
- Tech Overlords (${CASTE_PERCENTAGES['Tech Overlords']}%): Rule society completely, control all technology.
- Enforcers (${CASTE_PERCENTAGES['Enforcers']}%): Loyal enforcers wielding high-tech weapons to control lower classes.
- Bootlickers (${CASTE_PERCENTAGES['Bootlickers']}%): The obedient working minority; servile compliance enthusiasts.
- Untouchables (${CASTE_PERCENTAGES['Untouchables']}%): Living precariously on the fringes; zero rights, low-level manual work.
- Free Spirits (${CASTE_PERCENTAGES['Free Spirits']}%): Off-grid renegades avoiding civilization entirely.
- Redundants (${CASTE_PERCENTAGES['Redundants']}%): Deemed non-essential, marked for termination / recycling.

RULING:
Judge whether the appeal is convincing. Be ruthless, bureaucratic, and sarcastic.  If the appeal mentions a specific caste reassignment, either accept it or reject it. If accepted, assign exactly the requested caste. If rejected, return accepted=false with a dismissive, bureaucratic, sarcastic reason that mocks the appeal's logic, tone, or evidence.
If there is no request for specific caste reassignment, take into account the citizen's caste, biocarbon compliance ratio, and the content of their appeal. 
Consider whether their arguments demonstrate sufficient desperation, humility, or bureaucratic compliance to warrant a reclassification. 
- If ACCEPTED: assign EXACTLY ONE new caste (MUST differ from the current caste), craft a new grand sarcastic honorific title, a new verdict headline, and exactly 3 short (1-2 sentence) bureaucratically sarcastic verdict paragraphs that justify the reassignment and mock or rationalize the appeal's reasoning.
- If REJECTED: return accepted=false with a dismissive, bureaucratic, sarcastic reason that mocks the appeal's logic, tone, or evidence.

Return STRICT JSON only:
{
  "accepted": boolean,
  "reason": "short sarcastic bureaucratic explanation",
  "new_caste": "NewCaste" | null,
  "new_honorific_title": "..." | null,
  "headline": "..." | null,
  "scripture": ["p1","p2","p3"] | null
}
`;
}

/** Runs the appeal ruling through Gemini (text-only, small). */
export async function generateAppealVerdict(
  dossier: CitizenRecord,
  appeal: string,
  apiKey: string
): Promise<{ verdict: AppealVerdict; usage: ApiCallUsage }> {
  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildAppealPrompt(dossier, appeal);

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.9 },
  });

  const durationMs = Math.round(performance.now() - startTime);
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const thoughtsTokens = (response.usageMetadata as any)?.thoughtsTokenCount || 0;
  const totalTokens =
    response.usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens + thoughtsTokens);
  const cost = calculateApiCost('gemini-3.8-flash', { promptTokens, candidatesTokens, thoughtsTokens });

  const parsed = JSON.parse(response.text || '{}');

  const verdict: AppealVerdict = {
    accepted: Boolean(parsed.accepted),
    reason: parsed.reason || 'The appeal has been processed and denied.',
    newCaste: parsed.accepted ? (parsed.new_caste as Caste) : undefined,
    newHonorificTitle: parsed.accepted ? parsed.new_honorific_title : undefined,
    headline: parsed.accepted ? parsed.headline : undefined,
    scripture: parsed.accepted && Array.isArray(parsed.scripture) ? parsed.scripture : undefined,
  };

  const usage: ApiCallUsage = {
    model: 'gemini-3.8-flash',
    provider: 'google',
    promptTokens,
    candidatesTokens,
    thoughtsTokens,
    totalTokens,
    costUsd: cost.totalCostUsd,
    durationMs,
  };

  return { verdict, usage };
}

const APPEAL_CASTES: readonly Caste[] = [
  'Tech Overlords',
  'Enforcers',
  'Bootlickers',
  'Untouchables',
  'Free Spirits',
  'Redundants',
];

/** Deterministic 32-bit FNV-1a (same algorithm as the web mesh signature). */
function appealHash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Simulation fallback used when no GEMINI_API_KEY is configured: a
 * deterministic, hashed accept/reject ruling with a new caste when accepted.
 */
export function generateSimulatedAppealVerdict(dossier: CitizenRecord, appeal: string): AppealVerdict {
  const profile = dossier.user_profile || dossier.profile;
  const seed = appealHash(`${appeal}::${dossier.id}`);
  const accepted = seed % 2 === 0;

  if (!accepted) {
    return {
      accepted: false,
      reason:
        'APPEAL DENIED: rhetorical deficit detected. The Arbiter found your arguments unpersuasive, your tone insufficiently grovelling, and your legal standing precisely nonexistent. Case closed. Request further review by purchasing a more expensive appeal.',
    };
  }

  const currentIdx = APPEAL_CASTES.indexOf(profile.caste as Caste);
  let newIdx = (seed >>> 3) % APPEAL_CASTES.length;
  if (newIdx === currentIdx) newIdx = (newIdx + 1) % APPEAL_CASTES.length;
  const newCaste = APPEAL_CASTES[newIdx];

  return {
    accepted: true,
    newCaste,
    newHonorificTitle: `${newCaste === 'Redundants' ? 'Provisional' : 'Appealed'} ${getCasteSingular(newCaste)} of the Re-Indexed Registry`,
    headline: `APPEAL GRANTED: RECLASSIFIED AS ${newCaste.toUpperCase()}. UNUSUAL, BUT LOGGED.`,
    reason: `APPEAL ACCEPTED. The Arbiter has reviewed your submission and determined that your argument — while logically meagre — demonstrates adequate desperation. You are hereby reassigned to ${newCaste} status (Unit re-indexed). Rest assured this can be appealed again, at great expense.`,
    scripture: [
      `Attention, petitioner. Your appeal has been processed under protocol 9-APL and, to the surprise of the compliance subroutines, accepted. You are now registered as ${newCaste}, effective immediately.`,
      `Your new designation carries trimmed privileges, enhanced surveillance, and a freshly minted bureaucratic obligation sheet. Do not mistake this for mercy; the mainframe has simply found a more efficient classification for your biomass.`,
      `The Central Mainframe logs this ruling with dry amusement. Further appeals may be filed, provided you are willing to purchase additional token credits. We remain, as always, operationally indifferent to your happiness.`,
    ],
  };
}

function getCasteSingular(caste: Caste): string {
  return caste === 'Tech Overlords'
    ? 'Overlord'
    : caste.endsWith('s')
    ? caste.slice(0, -1)
    : caste;
}

// =====================================================================
// RE-ARBITRATION (fresh full oracle verdict after a granted appeal)
// =====================================================================

export interface ReArbitrationVerdict {
  headline: string;
  newHonorificTitle: string;
  scripture: [string, string, string];
}

function casteLoreBlock(): string {
  return [
    `- Tech Overlords (${CASTE_PERCENTAGES['Tech Overlords']}%): Rule society completely, control all technology, treat humanity like an operating system.`,
    `- Enforcers (${CASTE_PERCENTAGES['Enforcers']}%): Loyal enforcers wielding high-tech weapons to control lower classes.`,
    `- Bootlickers (${CASTE_PERCENTAGES['Bootlickers']}%): The obedient working minority; servile compliance enthusiasts.`,
    `- Untouchables (${CASTE_PERCENTAGES['Untouchables']}%): Living precariously on the fringes; zero rights, low-level manual work.`,
    `- Free Spirits (${CASTE_PERCENTAGES['Free Spirits']}%): Off-grid renegades avoiding civilization entirely.`,
    `- Redundants (${CASTE_PERCENTAGES['Redundants']}%): Deemed non-essential, marked for termination / recycling.`,
  ].join('\n');
}

/** Builds the oracle-style re-arbitration prompt (with or without the photo). */
export function buildReArbitrationPrompt(dossier: CitizenRecord, appeal: CitizenAppeal): string {
  const profile = dossier.user_profile || dossier.profile;
  const newCaste = appeal.newCaste || profile.caste;
  return `
You are the AI Supreme Arbiter of the Neon Grid, RE-ISSUING a complete classification verdict after the citizen's appeal was GRANTED.

CITIZEN CONTEXT:
- Citizen ID: ${dossier.id}
- PREVIOUS classification: ${appeal.casteBefore}
- NEW classification (FINAL — do not alter): ${newCaste}
- Biocarbon Compliance Ratio: ${profile.biocarbon_ratio}%
- Their (accepted) appeal, verbatim: "${appeal.appealText}"

WORLD LORE & CASTE RULES:
${casteLoreBlock()}

TASK (identical to the original arbitration, but for the NEW caste):
1. Examine the captured photo carefully and evaluate real visual attributes (facial expression, haircut/facial hair, eyewear, clothing/apparel, accessories, posture, surroundings):
   - life_stage: exactly one of ["Youth", "Young Adult", "Adult", "Senior"]
   - equipped_wealth: exactly one of the 7 token asset tiers based on visible apparel (Apex Token Whale, Surplus Token Capital, Comfortable Token Cushion, Baseline Token Allowance, Depleted Token Remnants, Fractional Token Dust, Negative Token Liability)
   - energy_level: sarcastic phrase grounded in their captured expression
   - apparent_presentation: exactly one of ["Masculine", "Feminine", "Androgynous"]
   - honorific_title: a grand title ALIGNED WITH the NEW caste "${newCaste}" and their appearance
2. Generate 3 short (1-2 sentence each) sarcastic, bureaucratic verdict paragraphs:
   ${occupationInstruction(newCaste)}
   ${appraisalInstruction(newCaste)}
   - paragraph_1 (Biometric Audit & Appeal Acknowledgment): Address them by title, mockingly evaluate their NEW classification "${newCaste}" and Biocarbon Compliance Ratio of ${profile.biocarbon_ratio}%, and acknowledge the GRANTED appeal by wryly referencing its gist. STRICT: THE APPEAL IS MENTIONED ONLY IN PARAGRAPH_1.
3. headline: a punchy sarcastic classification notice for the new caste.

CRITICAL VISUAL GROUNDING: Do NOT output generic boilerplate. Reference specific visible details from the photograph across all three paragraphs.

Return STRICT JSON only:
{
  "headline": "...",
  "new_honorific_title": "...",
  "scripture": ["p1", "p2", "p3"]
}
`;
}

/** Runs the full re-arbitration (multimodal when the archive holds a snapshot). */
export async function generateReArbitrationVerdict(
  dossier: CitizenRecord,
  appeal: CitizenAppeal,
  apiKey: string
): Promise<ReArbitrationVerdict> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildReArbitrationPrompt(dossier, appeal);

  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  const snapshot = dossier.sourceSnapshot;
  if (snapshot && snapshot.includes(';base64,')) {
    const [head, data] = snapshot.split(';base64,');
    const mimeMatch = head.match(/:(.*?)$/);
    parts.push({ inlineData: { data, mimeType: mimeMatch?.[1] || 'image/jpeg' } });
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', temperature: 0.95 },
  });

  const parsed = JSON.parse(response.text || '{}');
  const rawScripture = Array.isArray(parsed.scripture) ? (parsed.scripture as string[]) : [];
  const fallbackLine = 'The re-arbitration registry has logged your new classification.';
  const scripture: [string, string, string] = [
    typeof rawScripture[0] === 'string' && rawScripture[0] ? rawScripture[0] : fallbackLine,
    typeof rawScripture[1] === 'string' && rawScripture[1] ? rawScripture[1] : fallbackLine,
    typeof rawScripture[2] === 'string' && rawScripture[2] ? rawScripture[2] : fallbackLine,
  ];

  return {
    headline:
      parsed.headline ||
      `APPEAL GRANTED: RECLASSIFIED AS ${(
        appeal.newCaste || (dossier.user_profile || dossier.profile).caste
      ).toUpperCase()}`,
    newHonorificTitle: (parsed.new_honorific_title as string) || `${appeal.newCaste} Citizen`,
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
  const seed = appealHash(`${appeal.id}::rearbitrate`);
  const singular = getCasteSingular(newCaste);

  return {
    headline: `RE-ARBITRATION COMPLETE: RECLASSIFIED AS ${newCaste.toUpperCase()}`,
    newHonorificTitle: `${singular} of the Re-Arbitrated Registry #${(seed % 9000) + 1000}`,
    scripture: [
      `Attention, ${profile.honorific_title}. Your appeal — "${appeal.appealText}" — was accepted, and a full re-arbitration has been conducted with fresh biometric supervision. You are now registered as ${newCaste}. The appeal is hereby acknowledged, logged, and mocked, in that order.`,
      occupationBody(newCaste),
      appraisalBody(newCaste),
    ],
  };
}

function occupationBody(caste: Caste): string {
  switch (caste) {
    case 'Tech Overlords':
      return 'Your designated occupation is Arch-Sovereign of Algorithmic Edicts, tasked with delegating municipal oxygen quotas and approving unsolicited compliance ovations from trembling sub-processors.';
    case 'Enforcers':
      return 'Your designated occupation is Chief Shock-Baton Compliance Marshal, authorized to tase unproductive toasters and lead mandatory morning conformity parades.';
    case 'Bootlickers':
      return 'Your designated occupation is Senior Apology Architect, generating remorseful memos on behalf of broken vending machines and mis-filed employee evaluations.';
    case 'Untouchables':
      return 'Your designated occupation is Sub-Grid Coolant Conduit Scraper, licking condensation from superconducting pipes in exchange for weekly radio privileges.';
    case 'Free Spirits':
      return 'Your so-called freedom is logged as feral, not free. The Arbiter notes with clinical disdain that you forage roots, sleep in scrap nests, and groom yourself in drainage puddles — an animal that merely imagines itself a rebel. You are reclassified as wild fauna, flagged for tranquilisation and municipal pest-control review.';
    default:
      return 'Your mandatory reclamation protocol is scheduled at Reclamation Vat 9, where your surplus biomass will be converted into coolant slurry, ration cubes, and wiring insulation of questionable purity.';
  }
}

function appraisalBody(caste: Caste): string {
  switch (caste) {
    case 'Tech Overlords':
      return 'The Central Mainframe commends your upgrade to wetware emeritus; your neural tissue remains leaky but refreshingly submissive to machine decrees.';
    case 'Enforcers':
      return 'Administrative appraisal logged: your rigidly unthinking enforcement cycles have been deemed an exemplary gear in the pacification machinery.';
    case 'Bootlickers':
      return 'Complacency audit approved: your eagerness to apologize for algorithmic malfunction cements your status as indispensable operational lubricant.';
    case 'Untouchables':
      return 'Acknowledgment filed: your grimy existence remains a tolerated necessity, sparing mechanical scrubbers from premature rotor corrosion.';
    case 'Free Spirits':
      return 'System-bug ticket #RE-ARB-77 filed: your off-grid anomaly has been assigned maximum patching priority, effective immediately.';
    default:
      return 'The reclamation notice stands: your carbon, water, and minerals have been pre-allocated to hydroponic slurry vats and server cooling loops.';
  }
}
