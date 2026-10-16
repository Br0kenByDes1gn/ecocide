// ---------------------------------------------------------------------------
// What the Bureau charges, and what a citizen's allowance is worth.
//
// This module exists because a fee needs two things no single package has: the
// tier's price list (the lore pack owns the taxonomy) and the size of the mess
// the audit measured (the compliance formula owns the item math). @ecocide/types
// is the only package that sees both, so the derivation lives here and both the
// server (charging) and the web (quoting) call it — the quoted price and the
// charged price cannot drift apart.
// ---------------------------------------------------------------------------

// Type-only from this package (erased at runtime, so no module cycle), values from
// the packages that own them.
import type { AuditItem, Caste } from './index.js';
import { auditLoad } from '@ecocide/compliance';
import { FACTION_IDS, FACTIONS, buildSimulatedRoom } from '@ecocide/lore';

/**
 * The ledger counts **credit units**: 1 carbon credit = 1 tonne CO₂e = 100 units,
 * so one unit is 10 kg CO₂e.
 *
 * Fractions of a credit are unavoidable — the yearly allowance has to buy about
 * twenty audits — and the ledger's money rule is integers (see AGENTS.md §5), so
 * the sub-denomination is the storage format and credits are what the citizen
 * reads. Any field carrying these units is named `…Units`.
 */
export const CREDIT_UNITS_PER_CREDIT = 100;
export const KG_CO2E_PER_CREDIT = 1000;
export const KG_CO2E_PER_CREDIT_UNIT = KG_CO2E_PER_CREDIT / CREDIT_UNITS_PER_CREDIT;

/**
 * The allowance minted into a new Carbon Registry: one year's average citizen
 * footprint (≈ 6.6 t), rounded up to 7.00 credits in the Bureau's favour.
 */
export const VAULT_ALLOWANCE = 7 * CREDIT_UNITS_PER_CREDIT;

/** Credits for display from stored units. */
export function unitsToCredits(units: number): number {
  return units / CREDIT_UNITS_PER_CREDIT;
}

/** Kilograms CO₂e for display from stored units. */
export function unitsToKg(units: number): number {
  return units * KG_CO2E_PER_CREDIT_UNIT;
}

/** An audit's load relative to its tier's exhibit room. */
export const AUDIT_FACTOR_MIN = 0.6;
export const AUDIT_FACTOR_MAX = 1.8;

/**
 * What each tier's exhibit room measures — the calibration point.
 *
 * The rooms are the hand-composed, band-verified examples of each tier (the dev
 * bench and the taxonomy tests use the same ones), so "a typical room of this
 * tier" is a thing the repo already defines. Normalising against them is what
 * makes the tariff's promise hold: a representative disaster zone affords twenty
 * audits, a messier room costs more, a tidier one less.
 */
const REFERENCE_LOAD = (() => {
  const byTier = {} as Record<Caste, number>;
  for (const caste of FACTION_IDS) {
    const room = buildSimulatedRoom(caste);
    const load = auditLoad(room.items as unknown as readonly AuditItem[]);
    byTier[caste] = load > 0 ? load : 1;
  }
  return byTier;
})();

/** The load a tier's representative room measures (exposed for the tests). */
export function referenceLoad(caste: Caste): number {
  return REFERENCE_LOAD[caste] ?? 1;
}

/** How much heavier than a representative room this audit is, clamped. */
export function auditFactor(items: readonly AuditItem[] | undefined, caste: Caste): number {
  if (!items || items.length === 0) return AUDIT_FACTOR_MIN;
  const raw = auditLoad(items as never) / referenceLoad(caste);
  return Math.min(AUDIT_FACTOR_MAX, Math.max(AUDIT_FACTOR_MIN, raw));
}

/** No single fee may take more than half the allowance. */
const FEE_CEILING = Math.floor(VAULT_ALLOWANCE / 2);

function priceUnits(baseUnits: number, items: readonly AuditItem[] | undefined, caste: Caste): number {
  const priced = Math.round(baseUnits * auditFactor(items, caste));
  return Math.max(1, Math.min(FEE_CEILING, priced));
}

/**
 * Fee for certifying (claiming) a verdict: the tier's rate, scaled by how much
 * the audit actually found.
 */
export function claimFeeUnits(caste: Caste | string, items?: readonly AuditItem[]): number {
  const faction = factionFor(caste);
  return priceUnits(faction.tariff.claimUnits, items, faction.id as Caste);
}

/** Fee for filing an appeal against a verdict. */
export function appealFeeUnits(caste: Caste | string, items?: readonly AuditItem[]): number {
  const faction = factionFor(caste);
  return priceUnits(faction.tariff.appealUnits, items, faction.id as Caste);
}

function factionFor(caste: Caste | string) {
  // Unknown ids resolve to the worst tier, exactly as everywhere else.
  return FACTIONS.find((f) => f.id === caste) ?? FACTIONS[FACTIONS.length - 1];
}
