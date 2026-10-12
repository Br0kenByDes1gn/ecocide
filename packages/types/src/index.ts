// ---------------------------------------------------------------------------
// @ecocide/types — pure technical contracts.
// Story content lives in @ecocide/lore; this package derives the classification
// taxonomy (Caste = FactionId) from the lore pack so the web app, the server
// and the DB agree by construction.
// NOTE: internal storage names (caste, biocarbon_ratio) are deliberately kept
// even though the user-facing vocabulary changed — see AGENTS.md.
// ---------------------------------------------------------------------------

import {
  FACTIONS,
  OVERFLOW_ID,
  WEALTH_TIERS,
  LIFE_STAGE_KEYS,
  IDENTITY,
  factionIndex,
  factionPercentages,
  factionPopulations,
  factionThresholds,
  factionBounds,
  getFactionFromPercentile,
  normalizeWealthTier,
  generateSimulatedVerdictContent,
  getFaction,
  type FactionId,
  type FactionColorConfig,
  type LifeStageKey,
} from '@ecocide/lore';

/** Internal class id (persisted). Display names come from the lore pack. */
export type Caste = FactionId;

/** world population the caste census is computed against. */
export const TOTAL_WORLD_POPULATION = IDENTITY.worldPopulation;

/** Classification order: largest percentile band first, overflow last. */
export const CASTE_ORDER: readonly Caste[] = FACTIONS.map((f) => f.id) as readonly Caste[];

/** The overflow (exact-remainder) caste. */
export const CASTE_OVERFLOW: Caste = OVERFLOW_ID;

/** Canonical caste demographic allocation percentages (must sum exactly 100). */
export const CASTE_PERCENTAGES: Record<Caste, number> = factionPercentages();

/** Exact caste populations based on TOTAL_WORLD_POPULATION and CASTE_PERCENTAGES. */
export const CASTE_POPULATIONS: Record<Caste, number> = factionPopulations(TOTAL_WORLD_POPULATION);

/** Percentile cutoffs (0-100) mapping percentile scores into castes. */
export const CASTE_PERCENTILE_THRESHOLDS: Record<Caste, number> = factionThresholds();

/** Display percentile band per caste (inside which its ranks are spread). */
export const CASTE_PERCENTILE_BANDS: Record<Caste, { low: number; high: number }> = factionBounds();

/** Deterministically resolve a caste from a 0.0-100.0 percentile score. */
export function getCasteFromPercentile(percentile: number): Caste {
  return getFactionFromPercentile(percentile);
}

/** Whether a caste is the exact-remainder (overflow) bucket. */
export function isOverflowCaste(caste: Caste | string): boolean {
  return getFaction(caste).isOverflow ?? factionIndex(caste) === CASTE_ORDER.length - 1;
}

// ---------------------------------------------------------------------------
// Canonical theme configuration and designated styling for each caste.
// ---------------------------------------------------------------------------

export type CasteColorConfig = FactionColorConfig;

/** Canonical color config per caste (data from the lore pack). */
export const CASTE_COLORS: Record<Caste, CasteColorConfig> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.colors])
) as Record<Caste, CasteColorConfig>;

/** Aliases for backwards compatibility. */
export const CASTE_THEMES = CASTE_COLORS;
export const CASTE_COLOR_CONFIG = CASTE_COLORS;

export interface CasteCensusInfo {
  memberTitle: string;
  percentage: number;
  population: number;
  description: string;
  color: CasteColorConfig;
}

export const CASTE_CENSUS_DATA: Record<Caste, CasteCensusInfo> = Object.fromEntries(
  FACTIONS.map((f) => [
    f.id,
    {
      memberTitle: f.memberTitle,
      percentage: f.quotaPct,
      population: Math.round((TOTAL_WORLD_POPULATION * f.quotaPct) / 100),
      description: f.censusDescription,
      color: f.colors,
    },
  ])
) as Record<Caste, CasteCensusInfo>;

export function getCasteMemberTitle(caste: Caste | string): string {
  return getFaction(caste).memberTitle;
}

export type FormalLifeStage = "Youth" | "Young Adult" | "Adult" | "Senior";
export type LegacyLifeStage = "Initiate" | "Aspirant" | "Champion" | "Venerable";
export type LifeStage = FormalLifeStage | LegacyLifeStage;

export const FORMAL_LIFE_STAGES: readonly FormalLifeStage[] = [
  "Youth",
  "Young Adult",
  "Adult",
  "Senior",
] as const;

const FORMAL_TO_LIFE_KEY: Record<FormalLifeStage, LifeStageKey> = {
  Youth: 'youth',
  'Young Adult': 'youngAdult',
  Adult: 'adult',
  Senior: 'senior',
} as const;

const LIFE_KEY_TO_FORMAL: Record<LifeStageKey, FormalLifeStage> = {
  youth: 'Youth',
  youngAdult: 'Young Adult',
  adult: 'Adult',
  senior: 'Senior',
} as const;

/** Per-caste title for each formal life stage (data from the lore pack). */
export const CASTE_LIFE_STAGES: Record<Caste, Record<FormalLifeStage, string>> = Object.fromEntries(
  FACTIONS.map((f) => [
    f.id,
    Object.fromEntries(
      LIFE_STAGE_KEYS.map((k) => [LIFE_KEY_TO_FORMAL[k], f.lifeStageTitles[k]])
    ),
  ])
) as Record<Caste, Record<FormalLifeStage, string>>;

export function toFormalLifeStage(stage: LifeStage | string): FormalLifeStage {
  switch (stage) {
    case "Youth":
    case "Initiate":
      return "Youth";
    case "Young Adult":
    case "Aspirant":
      return "Young Adult";
    case "Adult":
    case "Champion":
      return "Adult";
    case "Senior":
    case "Venerable":
      return "Senior";
    default:
      return "Adult";
  }
}

export function getCasteLifeStageTitle(caste: Caste | string, stage: LifeStage | string): string {
  const key = FORMAL_TO_LIFE_KEY[toFormalLifeStage(stage)];
  return getFaction(caste).lifeStageTitles[key];
}

/** Deterministic per-caste unit number inside a faction's census population. */
export function calculateCasteUnitId(
  profile: Partial<UserProfile> & { caste: Caste },
  population?: number,
  additionalSeed?: string
): number {
  const pop = population || CASTE_CENSUS_DATA[profile.caste]?.population || 100_000_000;
  const seed = [
    profile.caste,
    profile.biocarbon_ratio ?? 50,
    profile.honorific_title ?? '',
    profile.equipped_wealth ?? '',
    profile.energy_level ?? '',
    profile.apparent_presentation ?? '',
    profile.life_stage ?? '',
    additionalSeed ?? '',
  ].join('::');

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch << 1), 0x85ebca6b);
  }

  const u1 = h1 >>> 0;
  const u2 = h2 >>> 0;
  const combined = BigInt(u1) * 0x100000000n + BigInt(u2);
  const unit = Number(combined % BigInt(pop)) + 1;
  return unit;
}

// ---------------------------------------------------------------------------
// Wealth tiers (canonical list comes from the lore pack).
// ---------------------------------------------------------------------------

export const ASSET_VALUE_TIERS: readonly string[] = WEALTH_TIERS.map((t) => t.label);

export type AssetValueTier = typeof ASSET_VALUE_TIERS[number];

/** Normalize a (possibly model-generated) wealth label to a canonical tier. */
export function toAssetValueTier(value: string | undefined | null): AssetValueTier {
  return normalizeWealthTier(value) as AssetValueTier;
}

export type ApparentPresentation = "Masculine" | "Feminine" | "Androgynous";

export interface UserProfile {
  caste: Caste;
  biocarbon_ratio: number; // 0 - 100 (percent)
  life_stage: LifeStage;
  equipped_wealth: string;
  energy_level: string;
  apparent_presentation: ApparentPresentation;
  honorific_title: string;
}

export interface Prophecy {
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

export type AvatarStatus = 'idle' | 'synthesizing' | 'completed' | 'failed';

export type AvatarEngineId =
  | 'gemini-image-vector'
  | 'gemini-image-pixel'
  | 'gemini-text-svg'
  | (string & {});

/** A single 3D facial landmark (normalized [0..1] coordinates, MediaPipe space). */
export interface BiometricLandmark {
  x: number;
  y: number;
  z: number;
}

/** Canonical stylized portrait rendering protocols. */
export type PortraitStyle =
  | 'faceted-poly'
  | 'surveillance-wireframe'
  | 'neon-hologram'
  | 'thermal-scan';

export interface OraclePayload {
  user_profile: UserProfile;
  prophecy: Prophecy;
  id?: string;
  avatarUrl?: string;
  avatarStatus?: AvatarStatus;
  avatarEngine?: string;
  /** Archived 478-face landmark geometry used for animated mesh re-rendering. */
  landmarks?: BiometricLandmark[];
  /** Raw biometric features extracted from the source photo at scan time. */
  telemetry?: BiometricTelemetry;
  /** Portrait protocol the stored stylized portrait was rendered with. */
  portraitStyle?: PortraitStyle;
  /** Caste signature color the stored stylized portrait was rendered with. */
  portraitColor?: string;
}

export interface BiometricTelemetry {
  caste: Caste;
  castePercentile: number; // 0.0 - 100.0
  biocarbonRatio: number; // 0 - 100 (percent)
  facialAspectRatio: number;
  jawTaperRatio: number;
  eyeToNoseRatio: number;
  symmetryVariance: number;
  preferredPresentation?: ApparentPresentation;
}

export interface ScanRequest {
  image: string; // Base64 JPEG data URL or base64 string (downscaled ~360px snapshot used by the vision model)
  telemetry: BiometricTelemetry;
  stylizedPortrait?: string; // Optional client-filtered canvas portrait
  avatarEngine?: string; // Optional engine override ('gemini-image-vector', 'gemini-image-pixel', 'gemini-text-svg')
  /** 478-landmark face geometry extracted client-side, archived with the dossier. */
  landmarks?: BiometricLandmark[];
  portraitStyle?: PortraitStyle;
  portraitColor?: string;
  /** Same 360px snapshot as `image`, persisted for re-arbitration (vision truth). */
  sourceSnapshot?: string;
  /** Optional address to deliver the verdict to by email. Not persisted. */
  email?: string;
}

export interface CitizenRecord {
  id: string; // unique permalink nanoid
  createdAt: string;
  profile: UserProfile;
  user_profile?: UserProfile;
  prophecy: Prophecy;
  stylizedPortraitUrl?: string;
  avatarUrl?: string;
  avatarStatus?: AvatarStatus;
  avatarEngine?: string;
  /** Downscaled ~360px source photo snapshot (data URL), used for vision-grounded re-arbitration. */
  sourceSnapshot?: string;
  landmarks?: BiometricLandmark[];
  telemetry?: BiometricTelemetry;
  portraitStyle?: PortraitStyle;
  portraitColor?: string;
  /** Owning Asset Vault account id (null/undefined while anonymous). */
  ownerId?: string;
}

export type ApiCallType = 'oracle_verdict' | 'avatar_synthesis';

/** Appeal filing payload. */
export interface AppealRequest {
  appeal: string;
  /** Optional address to deliver the appeal ruling to by email. Not persisted. */
  email?: string;
}

/**
 * Ruling on a subject's appeal. When accepted, the archived dossier is
 * updated (new caste / title / re-issued verdict) and `record` carries the
 * refreshed archive.
 */
export interface AppealVerdict {
  accepted: boolean;
  reason: string;
  newCaste?: Caste;
  newHonorificTitle?: string;
  headline?: string;
  /** Three short re-issued verdict paragraphs when accepted. */
  scripture?: [string, string, string];
  record?: CitizenRecord;
}

/**
 * A permanently stored appeal filing + its ruling, linked to the original
 * dossier. Accepted rulings propose a re-classification (`casteAfter`) that is
 * applied to the archive only when the citizen re-arbitrates.
 */
export interface CitizenAppeal {
  id: string;
  dossierId: string;
  appealText: string;
  accepted: boolean;
  newCaste?: Caste;
  newHonorificTitle?: string;
  headline?: string;
  reason: string;
  scripture?: [string, string, string];
  casteBefore: Caste;
  casteAfter?: Caste;
  createdAt: string;
}

export interface ApiCallLog {
  id: string;
  dossierId: string;
  callType: ApiCallType;
  provider: string;
  model: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string | null;
  createdAt: string;
}

export interface ScanCostSummary {
  dossierId: string;
  createdAt: string;
  caste: Caste | string;
  biocarbonRatio: number;
  honorificTitle: string;
  headline: string;
  avatarEngine: string | null;
  avatarStatus: AvatarStatus | string;
  totalCostUsd: number;
  totalTokens: number;
  totalDurationMs: number;
  apiCalls: ApiCallLog[];
}

/**
 * Fully deterministic offline verdict (used when no GEMINI_API_KEY is set).
 * Content comes from the lore pack's simulated copy.
 */
export function generateSimulatedVerdict(telemetry: BiometricTelemetry): OraclePayload {
  const content = generateSimulatedVerdictContent({
    factionId: telemetry.caste,
    percentile: telemetry.castePercentile,
    complianceRatio: telemetry.biocarbonRatio,
    preferredPresentation: telemetry.preferredPresentation,
  });

  return {
    user_profile: {
      caste: telemetry.caste,
      biocarbon_ratio: telemetry.biocarbonRatio,
      life_stage: content.life_stage,
      equipped_wealth: content.equipped_wealth,
      energy_level: content.energy_level,
      apparent_presentation: content.apparent_presentation,
      honorific_title: content.honorific_title,
    },
    prophecy: {
      headline: content.headline,
      paragraph_1: content.paragraph_1,
      paragraph_2: content.paragraph_2,
      paragraph_3: content.paragraph_3,
    },
  };
}

// ---------------------------------------------------------------------------
// Asset Vault (account wallet, unlocked via email OTP)
// ---------------------------------------------------------------------------

/** Token allowance minted into a freshly created Asset Vault. */
export const VAULT_ALLOWANCE = 1_000_000;

/** Certification fee deducted from the vault when a dossier is claimed. */
export const VAULT_CLAIM_FEE = 250;

/** Appeal filing fee deducted from the vault. */
export const VAULT_APPEAL_FEE = 500;

/** Auditable reasons a wallet balance can move. */
export type WalletLedgerReason = 'seed' | 'claim_fee' | 'adjustment' | string;

export interface VaultUser {
  id: string;
  email: string;
  name: string;
}

/** The vault itself — the user's token wallet. */
export interface Wallet {
  id: string;
  userId: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  delta: number;
  reason: WalletLedgerReason;
  ref?: string;
  balanceAfter: number;
  createdAt: string;
}

/** Aggregate wallet activity (computed server-side over the full ledger). */
export interface VaultStats {
  /** Total credits ever added (seed + adjustments). */
  totalCredited: number;
  /** Total credits ever spent (absolute sum of debits). */
  totalSpent: number;
  /** Number of ledger entries. */
  transactionCount: number;
}

/** Lightweight dossier summary for the vault's claimed-designations list. */
export interface VaultDossierSummary {
  id: string;
  caste: Caste;
  honorificTitle: string;
  biocarbonRatio: number;
  createdAt: string;
  portraitUrl?: string;
  avatarUrl?: string;
}

/** A page of wallet ledger entries plus the total count. */
export interface VaultLedgerPage {
  entries: WalletLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Fully-hydrated vault state returned by `GET /api/vault`. */
export interface VaultState {
  user: VaultUser;
  wallet: Wallet;
  stats: VaultStats;
  /** Lightweight summaries of dossiers linked to this vault (newest first). */
  dossiers: VaultDossierSummary[];
  /** Most recent ledger page. */
  ledger: WalletLedgerEntry[];
}

/** Result of linking a freshly-scanned dossier to a vault. */
export interface VaultLinkResult {
  wallet: Wallet;
  dossier: CitizenRecord;
  linked: boolean;
}

/** Result of a generic vault charge (a fee drawn from the wallet). */
export interface VaultChargeResult {
  wallet: Wallet;
  entry: WalletLedgerEntry;
}

// ---------------------------------------------------------------------------
// Re-exports from the lore pack (convenience for consumers)
// ---------------------------------------------------------------------------

export { FACTIONS, WEALTH_TIERS, getFaction, factionIndex, isOverflowFaction } from '@ecocide/lore';
export type { FactionDef } from '@ecocide/lore';