// ---------------------------------------------------------------------------
// @ecocide/lore — the entire story + artwork surface of the project.
// A dependency-free package: plain data, string templates, and deterministic
// content builders. Everything that is "the world" lives here; everything
// that is mechanics lives in @ecocide/compliance, @ecocide/types and the apps.
// ---------------------------------------------------------------------------

export { IDENTITY } from './identity.js';
export { REGISTRY_COPY, INJUNCTION_STAMP, DISPOSITION_COPY, REMEDIATION_COPY, INFORMANT_COPY, standingTrendLabel } from './surfaces.js';
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
  FactionDisposition,
  FactionTariff,
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
  INJUNCTION_JSON_SCHEMA,
  INJUNCTION_CATEGORIES,
  INJUNCTION_IMPACTS,
  INJUNCTION_EFFORTS,
  buildInventoryPrompt,
  buildVerdictPrompt,
  buildAppealPrompt,
  buildReArbitrationPrompt,
  buildInjunctionPrompt,
} from './prompts.js';
export type {
  VerdictPromptInput,
  AppealPromptDossier,
  ReArbitrationPromptDossier,
  ReArbitrationPromptAppeal,
  InjunctionCategory,
  InjunctionImpact,
  InjunctionEffort,
  InjunctionPromptItem,
  InjunctionPromptInput,
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
  generateSimulatedInjunction,
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
  SimScoredItem,
  SimInjunctionItem,
  SimInjunctionChecklist,
} from './simulate.js';