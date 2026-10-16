// ---------------------------------------------------------------------------
// @ecocide/types — pure technical contracts.
// The taxonomy (Caste = tier id) derives from the lore pack; the item formula
// comes from @ecocide/compliance. Web, server and DB agree by construction.
// NOTE: internal storage names (caste, biocarbon_ratio) are deliberately kept
// even though the user-facing vocabulary changed — see AGENTS.md.
// ---------------------------------------------------------------------------

import {
  FACTIONS,
  FACTION_IDS,
  getFaction,
  getFactionFromScore,
  factionIndex,
  generateSimulatedInventory,
  generateSimulatedVerdictContent,
  generateSimulatedSuggestions,
  buildSimulatedRoom,
  type FactionId,
  type FactionColorConfig,
} from '@ecocide/lore';
import type { SimItem } from '@ecocide/lore';
import {
  clampRating,
  itemSi,
  itemStamp,
  itemStatus,
  itemOverrides,
  dedupeItems,
  householdRatio,
  hardFailCount,
  topOffender,
  dominantDimension,
  dominantMaterialFamily,
  type DimensionKey,
  type ItemRatings,
  type ItemSize,
  type ItemStatus,
  type MaterialFamily,
  type OverrideRuleId,
  type RatedItem,
  type RegistryStanding,
} from '@ecocide/compliance';

export { DimensionKey, ItemRatings, ItemStatus, clampRating, itemSi, itemStamp, householdRatio } from '@ecocide/compliance';
export {
  evaluateOverrides,
  itemOverrides,
  OVERRIDE_RULES,
  SIZE_FACTORS,
  sizeFactor,
  dominantMaterialFamily,
  MATERIAL_FAMILIES,
} from '@ecocide/compliance';
export type { ItemSize, MaterialFamily, OverrideRuleId } from '@ecocide/compliance';
export type { RegistryAssessment, RegistryStanding } from '@ecocide/compliance';
export { FACTIONS, getFaction, factionIndex } from '@ecocide/lore';
export type { FactionDef, FactionColorConfig } from '@ecocide/lore';

/** Internal class id (persisted). Display names come from the lore pack. */
export type Caste = FactionId;

/** Classification order: most compliant tier first, worst last. */
export const CASTE_ORDER: readonly Caste[] = FACTION_IDS as readonly Caste[];

/** Lower (inclusive) Household Sustainability Index bound per caste. */
export const CASTE_SCORE_THRESHOLDS: Record<Caste, number> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.minScore])
) as Record<Caste, number>;

/** Deterministically resolve a caste from a 0–100 household score. */
export function getCasteFromScore(score: number): Caste {
  return getFactionFromScore(score) as Caste;
}

export function getCasteMemberTitle(caste: Caste | string): string {
  return getFaction(caste).memberTitle;
}

export function isOverflowCaste(_caste: Caste | string): boolean {
  return false; // tier bands have no overflow bucket — kept for API familiarity
}

export type CasteColorConfig = FactionColorConfig;

/** Canonical color config per caste (data from the lore pack). */
export const CASTE_COLORS: Record<Caste, CasteColorConfig> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.colors])
) as Record<Caste, CasteColorConfig>;

/** Aliases for backwards compatibility. */
export const CASTE_THEMES = CASTE_COLORS;
export const CASTE_COLOR_CONFIG = CASTE_COLORS;

// ---------------------------------------------------------------------------
// The audit domain (compliance_formula.md)
// ---------------------------------------------------------------------------

/** One detected object entry (+ its per-dimension ratings). */
export interface AuditItem {
  label: string;
  category: string | null;
  count: number;
  ratings: ItemRatings;
  /** One dry bureaucratic sentence from the model. */
  justification?: string | null;
  /** Normalized bounding box (0–1 relative to the photo), when localized. */
  bounds?: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Material family reported by the auditor (drives overrides + titles). */
  materialFamily?: MaterialFamily | null;
  /** Relative size (drives the size-weighted roll-up). */
  size?: ItemSize | null;
  /** Step-5 override rules that fired for this item. */
  overrides?: OverrideRuleId[];
  /** Sustainability Index (0–100), computed server-side. */
  si?: number;
  /** Compliance status derived from `si` + overrides. */
  status?: ItemStatus;
}

/** An improvement action bound to a detected item (feeds appeal pledges). */
export interface Suggestion {
  text: string;
  target_label: string;
  pledge: string;
  impact_pct: number;
}

/**
 * A pledge a household offered with an appeal.
 *
 * Persisted on the appeal at filing (as text, not a suggestion index, so it
 * survives the re-arbitration that rewrites the dossier's suggestions).
 */
export interface PledgeRef {
  /** The remediation action it came from. */
  text: string;
  /** The short commitment phrase the tribunal reads, e.g. "Retire 1 per week". */
  pledge: string;
  impact_pct: number;
}

/** A pledge the tribunal granted, with the date it entered the file. */
export interface AcceptedPledge extends PledgeRef {
  grantedAt: string;
}

/** One corrective action on the environmental injunction checklist. */
export interface InjunctionItem {
  action: string;
  replaces: string;
  why: string;
  category: 'swap' | 'reuse' | 'repair' | 'reduce' | 'dispose_properly';
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'hard';
}

/** The environmental injunction checklist for one household. */
export interface InjunctionChecklist {
  headline: string;
  items: InjunctionItem[];
  closing_line: string;
}

/** One stored injunction task row (accumulated per citizen across scans). */
export interface InjunctionTask {
  id: string;
  action: string;
  replaces: string;
  why: string;
  category: InjunctionItem['category'];
  impact: InjunctionItem['impact'];
  effort: InjunctionItem['effort'];
  dossierId: string | null;
  createdAt: string;
  completed: boolean;
  completedAt: string | null;
  /** Standing banked at confirmation (0 while pending). */
  points: number;
  /** Credits banked at confirmation, in credit units (0 while pending). */
  rewardUnits: number;
}

/** The full household audit result. */
export interface HouseholdAudit {
  roomType: string | null;
  items: AuditItem[];
  /** Household Sustainability Index: 0–100 integer percent. */
  ratio: number;
  /** Number of hard-fail items (SI < 40). */
  hardFails: number;
  /** Label of the single worst item. */
  topOffenderLabel: string | null;
}

export interface UserProfile {
  caste: Caste;
  /** 0–100 int percent: the Household Sustainability Index (storage name kept). */
  biocarbon_ratio: number;
  /** Deterministic personalized title (dominant-dimension bank). */
  honorific_title: string;
}

export interface Prophecy {
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

export interface OraclePayload {
  user_profile: UserProfile;
  prophecy: Prophecy;
  audit: HouseholdAudit;
  suggestions: Suggestion[];
  id?: string;
  /** Served URL of the archived evidence photo (file on disk, not the DB). */
  evidenceUrl?: string;
  /** Set once the citizen accepts the verdict — acceptance is terminal. */
  acceptedAt?: string;
  /** Pledges granted on appeal, from `CitizenRecord.acceptedPledges`. */
  acceptedPledges?: AcceptedPledge[];
}

export interface CitizenRecord {
  id: string; // unique permalink nanoid
  createdAt: string;
  profile: UserProfile;
  user_profile?: UserProfile;
  prophecy: Prophecy;
  audit: HouseholdAudit;
  suggestions: Suggestion[];
  /**
   * Pledges the tribunal granted on this dossier, in the order they were granted
   * (populated by the permalink endpoint; derived from accepted appeals, so the
   * dossier never has to reconstruct them from appeal prose).
   */
  acceptedPledges?: AcceptedPledge[];
  /** Served URL of the archived evidence photo (`/api/evidence/<id>.jpg`). */
  evidenceUrl?: string;
  /** Owning Carbon Registry account id (null/undefined while anonymous). */
  ownerId?: string;
  /**
   * When the citizen accepted this verdict (ISO-8601). Acceptance is terminal:
   * it freezes the classification, closes appeals and issues the injunction.
   */
  acceptedAt?: string;
}

export interface ScanRequest {
  image: string; // Base64 JPEG data URL or base64 string (1024px household photo)
  /** Optional audit-area hint from the scanner category chips (e.g. "fridge"). */
  category?: string | null;
  /** Optional address to deliver the verdict to by email. Not persisted. */
  email?: string;
}

export type ApiCallType = 'oracle_inventory' | 'oracle_classify';

export interface AppealRequest {
  appeal: string;
  /**
   * Pledges offered with this filing. The server composes them into the stored
   * appeal text, so the prose the tribunal reads and the record of what was
   * offered can never disagree.
   */
  pledges?: PledgeRef[];
  /** Optional address to deliver the appeal ruling to by email. Not persisted. */
  email?: string;
}

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

export interface CitizenAppeal {
  id: string;
  dossierId: string;
  appealText: string;
  /** Pledges offered with this filing, in the order they were selected. */
  pledges: PledgeRef[];
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
  totalCostUsd: number;
  totalTokens: number;
  totalDurationMs: number;
  apiCalls: ApiCallLog[];
}

/** One tier's audited-household count (live census, art §7). */
export interface CensusEntry {
  caste: Caste;
  count: number;
  /** Share of audited households in this tier (percent of `total`). */
  sharePct: number;
}

export interface CensusReport {
  total: number;
  /** True only once enough audits exist to be meaningful (art §7: 50+). */
  sufficient: boolean;
  entries: CensusEntry[];
}

// ---------------------------------------------------------------------------
// Fully deterministic offline scan (no API key, no server needed).
// Pipeline: lore simulated inventory → compliance math → tier → verdict copy.
// ---------------------------------------------------------------------------

export interface SimulatedScan {
  items: AuditItem[];
  ratio: number;
  caste: Caste;
  audit: HouseholdAudit;
  payload: OraclePayload;
}

function toAuditItem(item: SimItem): AuditItem {
  const ratings: ItemRatings = {};
  for (const key of Object.keys(item.ratings) as DimensionKey[]) {
    const value = item.ratings[key as keyof typeof item.ratings];
    const clamped = clampRating(value);
    if (clamped !== null) ratings[key] = clamped;
  }
  return {
    label: item.label,
    category: item.category,
    count: item.count,
    ratings,
    justification: item.justification,
    materialFamily: item.materialFamily,
    size: item.size,
    bounds: item.bounds
      ? {
          x1: Math.min(Math.max(item.bounds.x1, 0), 1),
          y1: Math.min(Math.max(item.bounds.y1, 0), 1),
          x2: Math.min(Math.max(item.bounds.x2, 0), 1),
          y2: Math.min(Math.max(item.bounds.y2, 0), 1),
        }
      : null,
  };
}

/** Score + enrich an audit item with its SI, overrides and status. */
function scoreItem(item: RatedItem): AuditItem {
  const si = Math.round(itemSi(item) * 10) / 10;
  const overrides = itemOverrides(item);
  return {
    label: item.label,
    category: item.category ?? null,
    count: item.count,
    ratings: item.ratings,
    justification: item.justification ?? null,
    materialFamily: item.materialFamily ?? null,
    size: item.size ?? null,
    overrides,
    bounds: item.bounds ?? null,
    si,
    status: itemStatus(si, overrides),
  };
}

/** Score + status-enrich a raw item list (shared by server and web). */
export function enrichAuditItems(items: readonly RatedItem[]): AuditItem[] {
  return items.map(scoreItem);
}

/**
 * The complete offline scan pipeline: deterministic inventory, compliance
 * math, deterministic tier, simulated verdict copy and suggestions. Used by
 * the server's offline mode (Gemini unconfigured) and the dev bench.
 */
export function simulateHouseholdScan(seed: string): SimulatedScan {
  const simulated = generateSimulatedInventory(seed);
  return simulateScanFromItems(simulated, null, seed);
}

/** Same pipeline over an explicit item list + room type (exhibit rooms). */
export function simulateScanFromItems(
  items: SimItem[],
  roomType: string | null,
  seedKey: string
): SimulatedScan {
  const deduped = dedupeItems(items.map(toAuditItem));
  const scored = deduped.map(scoreItem);
  const ratio = householdRatio(scored);
  const caste = getCasteFromScore(ratio);
  const dominant = dominantDimension(scored);
  const content = generateSimulatedVerdictContent({
    factionId: caste,
    ratio,
    items: items.map((i) => ({
      ...i,
      ratings: i.ratings,
    })),
    dominant,
    seedKey,
  });
  const rawSuggestions = generateSimulatedSuggestions(items, 3).map((s) => ({
    text: s.text,
    target_label: s.target_label,
    pledge: s.pledge,
    impact_pct: s.impact_pct,
  }));
  const top = topOffender(scored);
  const audit: HouseholdAudit = {
    roomType,
    items: scored,
    ratio,
    hardFails: hardFailCount(scored),
    topOffenderLabel: top?.label ?? null,
  };
  const payload: OraclePayload = {
    user_profile: {
      caste,
      biocarbon_ratio: ratio,
      honorific_title: content.honorific_title,
    },
    prophecy: {
      headline: content.headline,
      paragraph_1: content.paragraph_1,
      paragraph_2: content.paragraph_2,
      paragraph_3: content.paragraph_3,
    },
    audit,
    suggestions: rawSuggestions,
  };
  return { items: scored, ratio, caste, audit, payload };
}

/** One deterministic "exhibit" room per tier (dev bench / tests). */
export function simulateTierRoom(caste: Caste): SimulatedScan {
  const room = buildSimulatedRoom(caste);
  return simulateScanFromItems(room.items, room.roomType, `${caste}::exhibit`);
}

// ---------------------------------------------------------------------------
// Carbon Registry (account wallet + assessment archive, unlocked via email
// OTP). Storage/API names deliberately keep their `vault` spelling.
// ---------------------------------------------------------------------------

/**
 * The wallet, the allowance and the fee schedule live in `economy.ts`: the unit is
 * a hundredth of a carbon credit, the allowance is one year's average footprint,
 * and each tier's prices are modulated by the audit itself.
 */
export {
  CREDIT_UNITS_PER_CREDIT,
  KG_CO2E_PER_CREDIT,
  KG_CO2E_PER_CREDIT_UNIT,
  VAULT_ALLOWANCE,
  AUDIT_FACTOR_MIN,
  AUDIT_FACTOR_MAX,
  unitsToCredits,
  unitsToKg,
  auditFactor,
  referenceLoad,
  claimFeeUnits,
  appealFeeUnits,
  INJUNCTION_IMPACT_POINTS,
  INJUNCTION_EFFORT_POINTS,
  INJUNCTION_REWARD_MIN_UNITS,
  INJUNCTION_REWARD_MAX_UNITS,
  INJUNCTION_REWARD_JITTER,
  injunctionTaskPoints,
  injunctionRewardUnits,
  INJUNCTION_INDEX_CAP,
  INJUNCTION_INDEX_HALF_POINTS,
  injunctionIndexBonus,
  injunctionStanding,
} from './economy.js';
export type { InjunctionStanding } from './economy.js';

/** Auditable reasons a wallet balance can move. */
export type WalletLedgerReason = 'seed' | 'claim_fee' | 'appeal_fee' | 'adjustment' | string;

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

/** Lightweight dossier summary for the registry's assessment archive. */
export interface VaultDossierSummary {
  id: string;
  caste: Caste;
  honorificTitle: string;
  biocarbonRatio: number;
  /** Audited room type, e.g. "kitchen" (null when the scan had no hint). */
  roomType: string | null;
  /** Objects audited in that assessment (Σ item counts). */
  objectCount: number;
  /** Items in that assessment hit by at least one Step-5 override. */
  hardFailCount: number;
  createdAt: string;
  evidenceUrl?: string;
}

/** A page of wallet ledger entries plus the total count. */
export interface VaultLedgerPage {
  entries: WalletLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** What honored orders are worth on the index, and how much of it is paperwork. */
export interface InjunctionStandingSummary {
  /** Raw standing points banked from completed orders (impact × effort). */
  points: number;
  /** How many orders have been honored. */
  ordersHonored: number;
  /** Index points those orders contribute (0 … `INJUNCTION_INDEX_CAP`). */
  bonus: number;
  /** `min(100, round(verdicts + orders))` — what the registry certifies. */
  effectiveIndex: number;
  effectiveCaste: Caste;
}

/** Fully-hydrated vault state returned by `GET /api/vault`. */
export interface VaultState {
  user: VaultUser;
  wallet: Wallet;
  stats: VaultStats;
  /**
   * The citizen-level carbon standing pooled from the archived assessments —
   * verdicts only. `injunction` carries what the honored orders add to it, so the
   * two are always shown as the two different numbers they are.
   */
  standing: RegistryStanding;
  /** The paperwork's contribution to the index. */
  injunction: InjunctionStandingSummary;
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