// ---------------------------------------------------------------------------
// Simulate — deterministic offline (no-API-key) content.
// PLACEHOLDER PACK: neutral by design. TODO-LORE.
// ---------------------------------------------------------------------------

import { FACTION_IDS, WEALTH_TIERS, factionIndex, getFaction } from './factions.js';
import { IDENTITY } from './identity.js';
import type { FactionId } from './factions.js';

export type Presentation = 'Masculine' | 'Feminine' | 'Androgynous';

export interface SimVerdictInput {
  factionId: string;
  percentile: number;
  complianceRatio: number;
  preferredPresentation?: Presentation;
}

export interface SimVerdictContent {
  honorific_title: string;
  energy_level: string;
  equipped_wealth: string;
  life_stage: 'Youth' | 'Young Adult' | 'Adult' | 'Senior';
  apparent_presentation: Presentation;
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

/** Deterministic 32-bit FNV-1a (shared by every simulated outcome). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Offline verdict content for the deterministic fallback (no Gemini key).
 * Mirrors the shape the web UI and server both consume.
 */
export function generateSimulatedVerdictContent(input: SimVerdictInput): SimVerdictContent {
  const faction = getFaction(input.factionId);
  const idx = Math.max(factionIndex(input.factionId), 0);
  const seed = Math.floor((input.complianceRatio + input.percentile * 7 + idx * 13) % 100);
  const presentation: Presentation =
    input.preferredPresentation || (seed % 2 === 0 ? 'Feminine' : 'Masculine');
  const title = `${faction.simulated.title} #${((seed * 73) % 9000) + 1000}`;
  const wealth = WEALTH_TIERS[Math.min(idx, WEALTH_TIERS.length - 1)].label;
  const lifeStage = seed % 4 === 0 ? 'Senior' : seed % 3 === 0 ? 'Youth' : seed % 2 === 0 ? 'Young Adult' : 'Adult';

  return {
    honorific_title: title,
    energy_level: faction.simulated.energy,
    equipped_wealth: wealth,
    life_stage: lifeStage,
    apparent_presentation: presentation,
    headline: `CLASSIFICATION RECORD: ${faction.name.toUpperCase()} — PROVISIONAL`,
    paragraph_1: `Attention ${title}. The ${IDENTITY.entityName} registers your Compliance Ratio at ${input.complianceRatio}% and places you under ${faction.name}, bearing an energy level of ${faction.simulated.energy.toLowerCase()}.`,
    paragraph_2: faction.simulated.occupation,
    paragraph_3: faction.simulated.notice,
  };
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
        'APPEAL DENIED: the submitted arguments were found insufficiently compelling, your tone insufficiently contrite, and your standing precisely as recorded. Your file remains unchanged. Further appeals may be filed.',
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
    reason: `APPEAL ACCEPTED. Your submission has been reviewed and your designation updated. You are hereby placed under ${faction.name}. Rest assured this can be appealed again.`,
    scripture: [
      `Attention, petitioner. Your appeal has been processed and, to the surprise of the registry, accepted. You are now registered as ${faction.name}, effective immediately.`,
      `Your new designation carries an updated obligations sheet and revised permissions. Do not mistake this for leniency; the registry has simply filed you more efficiently.`,
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
    newHonorificTitle: `${faction.memberTitle} #${(seed % 9000) + 1000}`,
    scripture: [
      `Attention, ${input.currentTitle}. Your appeal — "${input.appealText}" — was accepted, and a full re-assessment has been conducted. You are now registered as ${faction.name}.`,
      faction.simulated.occupation,
      faction.simulated.notice,
    ],
  };
}