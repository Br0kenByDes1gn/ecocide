// ---------------------------------------------------------------------------
// The economy's promises, as arithmetic.
//
// The one that matters is the allowance: a citizen at the bottom of the taxonomy
// should get about twenty audits and an appeal out of one year's average
// footprint, and every better tier should get more. Because fees scale with the
// audit, that promise is stated against each tier's exhibit room — the repo's own
// definition of "a typical room of this tier".
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { FACTIONS, FACTIONS as TIERS, simulateTierRoom, type Caste } from './index.js';
import {
  AUDIT_FACTOR_MAX,
  AUDIT_FACTOR_MIN,
  INJUNCTION_INDEX_CAP,
  INJUNCTION_INDEX_HALF_POINTS,
  INJUNCTION_REWARD_JITTER,
  INJUNCTION_REWARD_MAX_UNITS,
  INJUNCTION_REWARD_MIN_UNITS,
  INFORMANT_REWARD_UNITS,
  CREDIT_UNITS_PER_CREDIT,
  KG_CO2E_PER_CREDIT,
  VAULT_ALLOWANCE,
  appealFeeUnits,
  auditFactor,
  claimFeeUnits,
  referenceLoad,
  unitsToCredits,
  unitsToKg,
  injunctionRewardUnits,
  injunctionTaskPoints,
  injunctionIndexBonus,
  injunctionStanding,
} from './economy.js';
import type { AuditItem } from './index.js';

const itemsFor = (caste: Caste): AuditItem[] => simulateTierRoom(caste).payload.audit.items;
const tierIds = TIERS.map((f) => f.id as Caste);

/** How many audits fit in the allowance if one appeal is also filed. */
function auditsAffordable(caste: Caste): number {
  const items = itemsFor(caste);
  const budget = VAULT_ALLOWANCE - appealFeeUnits(caste, items);
  return Math.floor(budget / claimFeeUnits(caste, items));
}

describe('carbon credits and the allowance', () => {
  it('counts a hundred units to the credit, a thousand kilograms to the tonne', () => {
    expect(CREDIT_UNITS_PER_CREDIT).toBe(100);
    expect(KG_CO2E_PER_CREDIT).toBe(1000);
    expect(unitsToCredits(CREDIT_UNITS_PER_CREDIT)).toBe(1);
    expect(unitsToCredits(VAULT_ALLOWANCE)).toBe(7);
    expect(unitsToKg(VAULT_ALLOWANCE)).toBe(7000);
    expect(unitsToKg(1)).toBe(10);
  });

  it('is one year of average footprint, rounded up', () => {
    // 6.6 t is the real average; the Bureau rounds it to a whole credit.
    expect(unitsToCredits(VAULT_ALLOWANCE)).toBe(7);
    expect(unitsToCredits(VAULT_ALLOWANCE)).toBeGreaterThan(6.6);
  });
});

describe('fee schedule', () => {
  it('prices every audit at its tier reference, so the base rates hold', () => {
    for (const caste of tierIds) {
      expect(auditFactor(itemsFor(caste), caste)).toBeCloseTo(1, 5);
      expect(claimFeeUnits(caste, itemsFor(caste))).toBe(
        FACTIONS.find((f) => f.id === caste)!.tariff.claimUnits
      );
    }
  });

  it('gives the disaster zone about twenty audits and an appeal, and more to every better tier', () => {
    expect(auditsAffordable('disaster-zone')).toBe(20);

    // Monotonic down the taxonomy: each better tier affords more, never fewer.
    for (let i = 1; i < tierIds.length; i++) {
      expect(auditsAffordable(tierIds[i - 1])).toBeGreaterThan(auditsAffordable(tierIds[i]));
    }
    // And the whole point: it is *about* twenty for the worst tier, not a handful.
    expect(auditsAffordable('disaster-zone')).toBeGreaterThanOrEqual(18);
  });

  it('keeps the legend minimal and the worst tier the most expensive', () => {
    const legend = claimFeeUnits('carbon-neutral-legend', itemsFor('carbon-neutral-legend'));
    const disaster = claimFeeUnits('disaster-zone', itemsFor('disaster-zone'));
    expect(legend).toBeLessThan(disaster);
    expect(unitsToCredits(legend)).toBeLessThan(0.05);
    expect(unitsToCredits(disaster)).toBeLessThanOrEqual(0.35);
    // Every tier's appeal is the larger act.
    for (const caste of tierIds) {
      expect(appealFeeUnits(caste, itemsFor(caste))).toBeGreaterThan(claimFeeUnits(caste, itemsFor(caste)));
    }
  });

  it('charges a messier room more than a tidy one, within bounds', () => {
    const room = itemsFor('disaster-zone');
    const heavier: AuditItem[] = room.map((i) => ({ ...i, count: i.count * 4 }));
    const lighter: AuditItem[] = room.map((i) => ({ ...i, count: 1, size: 'small' }));

    expect(auditFactor(heavier, 'disaster-zone')).toBeGreaterThan(1);
    expect(auditFactor(lighter, 'disaster-zone')).toBeLessThan(1);
    expect(claimFeeUnits('disaster-zone', heavier)).toBeGreaterThan(claimFeeUnits('disaster-zone', room));

    // Clamped, so no room can be priced out of all proportion.
    const absurd: AuditItem[] = room.map((i) => ({ ...i, count: 500 }));
    expect(auditFactor(absurd, 'disaster-zone')).toBe(AUDIT_FACTOR_MAX);
    expect(auditFactor([], 'disaster-zone')).toBe(AUDIT_FACTOR_MIN);
  });

  it('never lets a single fee take more than half the allowance', () => {
    const absurd: AuditItem[] = itemsFor('disaster-zone').map((i) => ({ ...i, count: 1000 }));
    expect(claimFeeUnits('disaster-zone', absurd)).toBeLessThanOrEqual(Math.floor(VAULT_ALLOWANCE / 2));
    // And every fee is at least one unit, so nothing is ever free by accident.
    for (const caste of tierIds) {
      expect(claimFeeUnits(caste, [])).toBeGreaterThanOrEqual(1);
      expect(appealFeeUnits(caste, undefined)).toBeGreaterThanOrEqual(1);
    }
  });

  it('measures a reference load per tier that a real room can hit', () => {
    for (const caste of tierIds) {
      expect(referenceLoad(caste)).toBeGreaterThan(0);
    }
  });

  it('pays a completed order between a twentieth and half a credit', () => {
    // Every rating pair, always with the same chore.
    for (const impact of ['low', 'medium', 'high']) {
      for (const effort of ['easy', 'moderate', 'hard']) {
        const units = injunctionRewardUnits(impact, effort, 'Halve the plastic bottle count');
        expect(units).toBeGreaterThanOrEqual(INJUNCTION_REWARD_MIN_UNITS);
        expect(units).toBeLessThanOrEqual(INJUNCTION_REWARD_MAX_UNITS);
        expect(Number.isInteger(units)).toBe(true);
      }
    }
    // The ends of the range land exactly where the ratings say they should.
    expect(injunctionRewardUnits('low', 'easy', 'Halve the plastic bottle count')).toBe(
      INJUNCTION_REWARD_MIN_UNITS
    );
    expect(unitsToCredits(INJUNCTION_REWARD_MIN_UNITS)).toBe(0.05);
    expect(unitsToCredits(INJUNCTION_REWARD_MAX_UNITS)).toBe(0.5);
  });

  it('pays more for impact and effort, monotonically', () => {
    const chore = 'Route the copper pot set to recycling';
    const at = (impact: string, effort: string) =>
      injunctionRewardUnits(impact, effort, `${chore} (${impact}/${effort})`);
    // Effort climbs within an impact, and impact climbs within an effort.
    expect(at('high', 'hard')).toBeGreaterThan(at('high', 'easy'));
    expect(at('high', 'hard')).toBeGreaterThan(at('low', 'hard'));
    expect(at('medium', 'moderate')).toBeGreaterThan(at('low', 'easy'));
    // And the standing that rides with it uses the same weights.
    expect(injunctionTaskPoints('high', 'hard')).toBeGreaterThan(injunctionTaskPoints('low', 'easy'));
  });

  it('pays a chore the same amount every time, and jitters only a little', () => {
    // The payout is a property of the action, not of the moment or the household.
    const first = injunctionRewardUnits('medium', 'moderate', 'Halve the reusable tote bag count');
    const again = injunctionRewardUnits('medium', 'moderate', 'Halve the reusable tote bag count');
    expect(again).toBe(first);

    // Two different chores of the same standing may differ, but stay close and in range.
    const others = ['Retire the kettle', 'Recycle the polyester shirts', 'Fix the microwave'];
    const base = first;
    for (const action of others) {
      const units = injunctionRewardUnits('medium', 'moderate', action);
      expect(units).toBeGreaterThanOrEqual(INJUNCTION_REWARD_MIN_UNITS);
      expect(units).toBeLessThanOrEqual(INJUNCTION_REWARD_MAX_UNITS);
      expect(Math.abs(units - base)).toBeLessThanOrEqual(
        Math.ceil(base * INJUNCTION_REWARD_JITTER) + 1
      );
    }
  });

  it('never overpays an unreadable rating', () => {
    // A missing or unknown rating is priced as the cheapest pair the Bureau knows.
    const floor = INJUNCTION_REWARD_MIN_UNITS;
    expect(injunctionTaskPoints(undefined, undefined)).toBe(4);
    expect(injunctionTaskPoints('enormous', 'trivial')).toBe(4);
    expect(injunctionRewardUnits(undefined, undefined, 'Anything at all')).toBe(floor);
  });

  it('cannot be inflated by honored orders alone', () => {
    // The regression this exists for: an account with 216 honored orders was
    // pinned at 100% because every order's points were added straight to the
    // index. Paperwork must never carry a household up a tier.
    const orders = 216;
    const points = orders * 20; // an average order is worth about twenty points
    const standing = injunctionStanding(58, points);

    expect(standing.verdictIndex).toBe(58);
    expect(standing.bonus).toBeLessThanOrEqual(INJUNCTION_INDEX_CAP);
    expect(standing.bonus).toBeLessThan(10);
    expect(standing.effectiveIndex).toBeLessThan(70);
    // Even a spotless verdict record plus endless paperwork stops short of a pass.
    expect(injunctionStanding(95, points * 100).effectiveIndex).toBe(100);
    expect(injunctionStanding(88, points).effectiveIndex).toBeLessThan(100);
  });

  it('adds nothing until something is honored, then slows down', () => {
    expect(injunctionIndexBonus(0)).toBe(0);
    expect(injunctionIndexBonus(-50)).toBe(0);

    // Monotone: more honored orders always help.
    const rungs = [20, 200, 600, 2000, 20000].map(injunctionIndexBonus);
    for (let i = 1; i < rungs.length; i++) {
      expect(rungs[i]).toBeGreaterThan(rungs[i - 1]);
    }
    // Diminishing: the *same* amount of paperwork is worth less the later it comes.
    const early = injunctionIndexBonus(200) - injunctionIndexBonus(0);
    const later = injunctionIndexBonus(1200) - injunctionIndexBonus(1000);
    expect(later).toBeLessThan(early);
    // Half the cap lands at the half-point by construction.
    expect(injunctionIndexBonus(INJUNCTION_INDEX_HALF_POINTS)).toBeCloseTo(INJUNCTION_INDEX_CAP / 2, 6);
    // And it never reaches the cap, however much paperwork is filed.
    expect(injunctionIndexBonus(1_000_000)).toBeLessThan(INJUNCTION_INDEX_CAP);
  });

  it('keeps the two numbers a citizen sees consistent', () => {
    const s = injunctionStanding(74, 900);
    expect(s.verdictIndex).toBe(74);
    expect(s.effectiveIndex).toBe(Math.min(100, Math.round(74 + s.bonus)));
    // The certified figure is never below the measured one.
    expect(s.effectiveIndex).toBeGreaterThanOrEqual(s.verdictIndex);
  });

  it('falls back to the worst tier for an unknown classification', () => {
    expect(claimFeeUnits('not-a-tier', undefined)).toBe(claimFeeUnits('disaster-zone', undefined));
  });
});

describe('the informant bounty', () => {
  it('pays one whole carbon credit for a verified tip', () => {
    expect(unitsToCredits(INFORMANT_REWARD_UNITS)).toBe(1);
    expect(unitsToKg(INFORMANT_REWARD_UNITS)).toBe(1000);
  });
});