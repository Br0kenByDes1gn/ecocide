import { GoogleGenAI } from '@google/genai';
import type {
  AppealVerdict,
  BiometricTelemetry,
  CitizenAppeal,
  CitizenRecord,
  OraclePayload,
} from '@ecocide/types';
import { toFormalLifeStage, toAssetValueTier, getFaction } from '@ecocide/types';
import {
  buildAppealPrompt as buildLoreAppealPrompt,
  buildOraclePrompt as buildLoreOraclePrompt,
  buildReArbitrationPrompt as buildLoreReArbitrationPrompt,
  generateSimulatedAppealRuling,
  generateSimulatedReArbitrationCopy,
} from '@ecocide/lore';
import { calculateApiCost } from './cost.js';
import type { ApiCallUsage } from './avatar/types.js';

export interface OracleVerdictResult {
  payload: OraclePayload;
  usage: ApiCallUsage;
}

/** Prompts are assembled from the lore pack (world copy + per-faction blocks). */
export function buildOraclePrompt(telemetry: BiometricTelemetry): string {
  return buildLoreOraclePrompt({
    factionId: telemetry.caste,
    percentile: telemetry.castePercentile,
    complianceRatio: telemetry.biocarbonRatio,
    presentation: telemetry.preferredPresentation,
  });
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

  const baseFactionName = getFaction(telemetry.caste).memberTitle;

  const payload: OraclePayload = {
    user_profile: {
      caste: telemetry.caste,
      biocarbon_ratio: telemetry.biocarbonRatio,
      life_stage: toFormalLifeStage(parsed.user_profile?.life_stage || 'Adult'),
      equipped_wealth: toAssetValueTier(parsed.user_profile?.equipped_wealth || undefined),
      energy_level: parsed.user_profile?.energy_level || 'Nominal',
      apparent_presentation:
        parsed.user_profile?.apparent_presentation ||
        (telemetry.preferredPresentation || 'Androgynous'),
      honorific_title: parsed.user_profile?.honorific_title || `${baseFactionName} #${Math.floor(Math.random() * 9000) + 1000}`,
    },
    prophecy: {
      headline: parsed.prophecy?.headline || 'CLASSIFICATION RECORD: PROVISIONAL',
      paragraph_1: parsed.prophecy?.paragraph_1 || 'Biometric parameters analyzed and recorded.',
      paragraph_2: parsed.prophecy?.paragraph_2 || 'Assigned duties will be registered on your file.',
      paragraph_3: parsed.prophecy?.paragraph_3 || 'Assessment filed in the registry.',
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

/** Builds the compact appeal-ruling prompt (copy from the lore pack). */
export function buildAppealPrompt(dossier: CitizenRecord, appeal: string): string {
  const profile = dossier.user_profile || dossier.profile;
  return buildLoreAppealPrompt(
    {
      id: dossier.id,
      factionId: profile.caste,
      complianceRatio: profile.biocarbon_ratio,
      honorificTitle: profile.honorific_title,
      headline: dossier.prophecy?.headline ?? null,
    },
    appeal
  );
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
    newCaste: parsed.accepted ? (parsed.new_caste as AppealVerdict['newCaste']) : undefined,
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

/**
 * Simulation fallback used when no GEMINI_API_KEY is configured: a
 * deterministic, hashed accept/reject ruling with a new caste when accepted.
 */
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

// =====================================================================
// RE-ARBITRATION (fresh full oracle verdict after a granted appeal)
// =====================================================================

export interface ReArbitrationVerdict {
  headline: string;
  newHonorificTitle: string;
  scripture: [string, string, string];
}

/** Builds the oracle-style re-arbitration prompt (copy from the lore pack). */
export function buildReArbitrationPrompt(dossier: CitizenRecord, appeal: CitizenAppeal): string {
  const profile = dossier.user_profile || dossier.profile;
  const newCaste = appeal.newCaste || profile.caste;
  return buildLoreReArbitrationPrompt(
    {
      id: dossier.id,
      factionId: profile.caste,
      complianceRatio: profile.biocarbon_ratio,
    },
    {
      appealText: appeal.appealText,
      prevFactionId: appeal.casteBefore,
      newFactionId: newCaste,
    }
  );
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
    newHonorificTitle: (parsed.new_honorific_title as string) || `${getFaction(finalCaste).memberTitle} #${Math.floor(Math.random() * 9000) + 1000}`,
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
  });
}