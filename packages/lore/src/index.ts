// ---------------------------------------------------------------------------
// @ecocide/lore — the entire story + artwork surface of the project.
// A dependency-free package: plain data, string templates, and deterministic
// content builders. Everything that is "the world" lives here; everything
// that is mechanics lives in @ecocide/types and the apps.
// ---------------------------------------------------------------------------

export { IDENTITY } from './identity.js';
export { PALETTE, CONFETTI_COLORS } from './art.js';
export {
  FACTIONS,
  FACTION_IDS,
  OVERFLOW_ID,
  WEALTH_TIERS,
  DEFAULT_WEALTH_TIER,
  LIFE_STAGE_KEYS,
  factionIndex,
  getFaction,
  isOverflowFaction,
  factionPercentages,
  factionThresholds,
  factionBounds,
  factionPopulations,
  getFactionFromPercentile,
  wealthTierLabels,
  normalizeWealthTier,
} from './factions.js';
export type {
  FactionId,
  FactionDef,
  FactionColorConfig,
  FactionTopic,
  FactionPromptBlocks,
  FactionSimulated,
  LifeStageKey,
  WealthTierDef,
} from './factions.js';
export {
  factionRegistryBlock,
  wealthTierBlock,
  buildOraclePrompt,
  buildAppealPrompt,
  buildReArbitrationPrompt,
} from './prompts.js';
export type {
  OraclePromptInput,
  AppealPromptDossier,
  ReArbitrationPromptDossier,
  ReArbitrationPromptAppeal,
} from './prompts.js';
export {
  generateSimulatedVerdictContent,
  generateSimulatedAppealRuling,
  generateSimulatedReArbitrationCopy,
} from './simulate.js';
export type {
  Presentation,
  SimVerdictInput,
  SimVerdictContent,
  SimAppealInput,
  SimAppealRuling,
  SimReArbitrationInput,
  SimReArbitrationCopy,
} from './simulate.js';
export { VERDICT_TIERS, getVerdictTier } from './verdict-tiers.js';
export type { VerdictTier, VerdictStatus } from './verdict-tiers.js';