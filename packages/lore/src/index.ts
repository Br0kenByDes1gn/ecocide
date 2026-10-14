// ---------------------------------------------------------------------------
// @ecocide/lore — the entire story + artwork surface of the project.
// A dependency-free package: plain data, string templates, and deterministic
// content builders. Everything that is "the world" lives here; everything
// that is mechanics lives in @ecocide/compliance, @ecocide/types and the apps.
// ---------------------------------------------------------------------------

export { IDENTITY } from './identity.js';
export { REGISTRY_COPY, standingTrendLabel } from './surfaces.js';
export { PALETTE, CONFETTI_COLORS } from './art.js';
export {
  FACTIONS,
  FACTION_IDS,
  HARM_DIMENSION_KEYS,
  HOUSEHOLD_TITLES,
  householdTitle,
  factionIndex,
  getFaction,
  findFactionByName,
  scoreThresholds,
  getFactionFromScore,
} from './factions.js';
export type {
  FactionId,
  FactionDef,
  FactionColorConfig,
  FactionTopic,
  FactionPromptBlocks,
  FactionSimulated,
  HarmDimensionKey,
  MaterialFamilyKey,
  HouseholdTitleInput,
} from './factions.js';
export {
  factionRegistryBlock,
  dimensionRubricBlock,
  INVENTORY_JSON_SCHEMA,
  VERDICT_JSON_SCHEMA,
  buildInventoryPrompt,
  buildVerdictPrompt,
  buildAppealPrompt,
  buildReArbitrationPrompt,
} from './prompts.js';
export type {
  VerdictPromptInput,
  AppealPromptDossier,
  ReArbitrationPromptDossier,
  ReArbitrationPromptAppeal,
} from './prompts.js';
export {
  fnv1a,
  CATEGORIES,
  ITEM_ARCHETYPES,
  SIMULATED_ROOMS,
  generateSimulatedInventory,
  buildSimulatedRoom,
  generateSimulatedVerdictContent,
  generateSimulatedSuggestions,
  generateSimulatedAppealRuling,
  generateSimulatedReArbitrationCopy,
} from './simulate.js';
export type {
  SimItem,
  SimSuggestion,
  SimRoomTemplate,
  SimVerdictInput,
  SimVerdictContent,
  SimAppealInput,
  SimAppealRuling,
  SimReArbitrationInput,
  SimReArbitrationCopy,
} from './simulate.js';