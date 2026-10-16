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
import { FACTION_IDS, FACTIONS, buildSimulatedRoom, fnv1a } from '@ecocide/lore';

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

// ---------------------------------------------------------------------------
// What an injunction action pays back.
//
// Doing the Bureau's paperwork is the one place the citizen is on the receiving
// end: confirming a completed action banks both standing (the points that lift
// the pooled index) and carbon credits. The points stay the index's business;
// the credits are money and live here, derived from the same two ratings.
// ---------------------------------------------------------------------------

/** Standing awarded per impact rating (`low`…`high`). Also the reward's weight. */
export const INJUNCTION_IMPACT_POINTS: Readonly<Record<string, number>> = {
  low: 2,
  medium: 4,
  high: 8,
};

/** Standing awarded per effort rating (`easy`…`hard`). Also the reward's weight. */
export const INJUNCTION_EFFORT_POINTS: Readonly<Record<string, number>> = {
  easy: 2,
  moderate: 4,
  hard: 8,
};

/**
 * Standing for one action: impact × effort, i.e. 4 (low/easy) up to 64
 * (high/hard). Shared by the confirmation endpoint and the worksheet, which has
 * to show a figure before the task is confirmed and therefore before any stored
 * points exist.
 */
export function injunctionTaskPoints(
  impact: string | undefined,
  effort: string | undefined
): number {
  // Unknown ratings fall to the *lowest* pair: the Bureau does not overpay for
  // paperwork it cannot read.
  return (
    (INJUNCTION_IMPACT_POINTS[impact ?? ''] ?? INJUNCTION_IMPACT_POINTS.low) *
    (INJUNCTION_EFFORT_POINTS[effort ?? ''] ?? INJUNCTION_EFFORT_POINTS.easy)
  );
}

/** A completed action pays between a twentieth and half a credit. */
export const INJUNCTION_REWARD_MIN_UNITS = Math.round(0.05 * CREDIT_UNITS_PER_CREDIT);
export const INJUNCTION_REWARD_MAX_UNITS = Math.round(0.5 * CREDIT_UNITS_PER_CREDIT);

/** How far the deterministic jitter may move a payout, either way. */
export const INJUNCTION_REWARD_JITTER = 0.1;

/** Lowest and highest point pairs, which anchor the scale. */
const POINTS_MIN = 4;
const POINTS_MAX = 64;

/**
 * What one completed action is worth, in credit units.
 *
 * The payout is a property of the chore, not of the moment: the amount is derived
 * from the impact and effort ratings and a hash of the action text, so "Halve the
 * plastic bottle count" is worth the same on every dossier, for every household,
 * forever. That keeps the ledger auditable against a rule (nothing is a dice roll)
 * while still giving two chores of equal standing slightly different payouts.
 *
 * Doubling the impact × effort product adds about an eighth of the range, so the
 * ends land exactly on the extremes: a low-impact, easy task pays the floor and a
 * high-impact, hard one pays the ceiling. The jitter is clamped, so nothing can
 * escape the advertised range.
 */
export function injunctionRewardUnits(
  impact: string | undefined,
  effort: string | undefined,
  action: string
): number {
  const points = injunctionTaskPoints(impact, effort);
  const spread = Math.log2(POINTS_MAX) - Math.log2(POINTS_MIN);
  const progress = (Math.log2(Math.max(POINTS_MIN, points)) - Math.log2(POINTS_MIN)) / spread;
  const base = INJUNCTION_REWARD_MIN_UNITS + progress * (INJUNCTION_REWARD_MAX_UNITS - INJUNCTION_REWARD_MIN_UNITS);

  // −1 … +1, from the chore itself.
  const noise = ((fnv1a(action) % 2001) - 1000) / 1000;
  const jittered = Math.round(base * (1 + noise * INJUNCTION_REWARD_JITTER));

  return Math.max(
    INJUNCTION_REWARD_MIN_UNITS,
    Math.min(INJUNCTION_REWARD_MAX_UNITS, jittered)
  );
}

// ---------------------------------------------------------------------------
// How much honoring orders is worth on the index.
//
// Weighted far below a verdict, on purpose. An order is a chore the Bureau asked
// for; a verdict is what the Bureau measured independently, and the index is a
// record of measurements. Selling index points for chores would let a household
// audit-proof its own standing, so the paperwork's contribution is bounded,
// diminishes with every additional order, and can never approach a pass.
// ---------------------------------------------------------------------------

/**
 * Most index points all the honored orders in the world are worth: about one
 * verdict's move, and never enough to carry a household up a tier on its own.
 */
export const INJUNCTION_INDEX_CAP = 10;

/**
 * Standing points at which half the cap is earned. An average order is worth
 * about twenty points (impact × effort), so this is roughly thirty orders.
 */
export const INJUNCTION_INDEX_HALF_POINTS = 600;

/**
 * Index points contributed by honored orders: `cap × T/(T + half)`.
 *
 * Zero with nothing banked, monotone, and asymptotic — the tenth order helps and
 * the two-hundredth barely does. Not rounded: the components are shown to the
 * citizen next to the verdict index, and one decimal is the difference between
 * "orders do nothing" and "orders count, slowly".
 */
export function injunctionIndexBonus(totalPoints: number): number {
  const points = Math.max(0, totalPoints);
  if (points === 0) return 0;
  return (INJUNCTION_INDEX_CAP * points) / (points + INJUNCTION_INDEX_HALF_POINTS);
}

/** The two numbers a citizen is shown, and the one they add up to. */
export interface InjunctionStanding {
  /** Pooled from the archived verdicts alone — the record of what was measured. */
  verdictIndex: number;
  /** What honored orders add to it (0 … `INJUNCTION_INDEX_CAP`). */
  bonus: number;
  /** What the registry certifies, `min(100, verdicts + orders)`. */
  effectiveIndex: number;
}

export function injunctionStanding(verdictIndex: number, totalPoints: number): InjunctionStanding {
  const bonus = injunctionIndexBonus(totalPoints);
  return {
    verdictIndex,
    bonus,
    effectiveIndex: Math.min(100, Math.round(verdictIndex + bonus)),
  };
}
