import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@ecocide/types';
import { getCasteLifeStageTitle } from '@ecocide/types';
import { soundFx } from './audio';

export type RevealPhase =
  | 'mesh'
  | 'title'
  | 'presentation'
  | 'utility'
  | 'asset'
  | 'energy'
  | 'compliance'
  | 'done';

export interface IdentityRevealState {
  phase: RevealPhase;
  /** Whether the biometric mesh portrait has been revealed. */
  meshVisible: boolean;
  /** Progressively typed stat values; null while the stat is still hidden. */
  titleText: string | null;
  presentationText: string | null;
  utilityText: string | null;
  assetText: string | null;
  energyText: string | null;
  /** Animated count-up text for the Compliance Ratio (percent). */
  complianceText: string | null;
  /** True once every stat (including the ratio finale) has been revealed. */
  isComplete: boolean;
}

export const CHAR_DELAY_MS = 24;
export const PAUSE_BETWEEN_MS = 260;
export const MESH_HOLD_MS = 900;
export const COMPLIANCE_DURATION_MS = 1400;
export const COMPLIANCE_COUNT_STEPS = 30;

export type RevealStepKey =
  | 'titleText'
  | 'presentationText'
  | 'utilityText'
  | 'assetText'
  | 'energyText';

export interface IdentityRevealStep {
  key: RevealStepKey;
  phase: Exclude<RevealPhase, 'mesh' | 'compliance' | 'done'>;
  value: string;
}

/**
 * Pure helper: the mandated stat fill-in order.
 * Mesh first, then title, presentation, utility grade, asset value and finally
 * energy level (the Compliance Ratio count-up is the finale).
 */
export function buildIdentityRevealSteps(profile: UserProfile): IdentityRevealStep[] {
  return [
    { key: 'titleText', phase: 'title', value: profile.honorific_title },
    { key: 'presentationText', phase: 'presentation', value: profile.apparent_presentation },
    {
      key: 'utilityText',
      phase: 'utility',
      value: getCasteLifeStageTitle(profile.caste, profile.life_stage),
    },
    { key: 'assetText', phase: 'asset', value: profile.equipped_wealth },
    { key: 'energyText', phase: 'energy', value: profile.energy_level },
  ];
}

/** Pure helper: the fully-revealed (static) state used by the /citizen page. */
export function fullIdentityReveal(profile: UserProfile): IdentityRevealState {
  return {
    phase: 'done',
    meshVisible: true,
    titleText: profile.honorific_title,
    presentationText: profile.apparent_presentation,
    utilityText: getCasteLifeStageTitle(profile.caste, profile.life_stage),
    assetText: profile.equipped_wealth,
    energyText: profile.energy_level,
    complianceText: `${profile.biocarbon_ratio}%`,
    isComplete: true,
  };
}

function initialIdentityReveal(): IdentityRevealState {
  return {
    phase: 'mesh',
    meshVisible: false,
    titleText: null,
    presentationText: null,
    utilityText: null,
    assetText: null,
    energyText: null,
    complianceText: null,
    isComplete: false,
  };
}

/**
 * Drives the /arbitration reveal animation:
 *   1. mesh scans in (hold),
 *   2. each stat types out sequentially (title → presentation → utility grade →
 *      asset value → energy level),
 *   3. the Compliance Ratio counts up to its final percent,
 *   4. done.
 * Returns `skip()` to jump straight to the fully-revealed state.
 */
export function useIdentityReveal(profile: UserProfile) {
  const cancelledRef = useRef(false);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [reveal, setReveal] = useState<IdentityRevealState>(() => initialIdentityReveal());

  useEffect(() => {
    cancelledRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const current: IdentityRevealState = { ...initialIdentityReveal(), meshVisible: true };
    setReveal(current);

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelledRef.current) fn();
      }, ms);
      timeoutsRef.current.push(t);
    };
    const commit = () => setReveal({ ...current });

    soundFx.playLockIn();

    const steps = buildIdentityRevealSteps(profile);
    let cursor = 0;

    const runNext = () => {
      if (cancelledRef.current) return;
      if (cursor >= steps.length) {
        later(runCompliance, PAUSE_BETWEEN_MS);
        return;
      }
      const step = steps[cursor];
      cursor++;
      current.phase = step.phase;
      let i = 0;
      const tick = () => {
        i++;
        current[step.key] = step.value.slice(0, i);
        if (i % 2 === 0) soundFx.playTypewriter();
        commit();
        if (i < step.value.length) {
          later(tick, CHAR_DELAY_MS);
        } else {
          later(runNext, PAUSE_BETWEEN_MS);
        }
      };
      tick();
    };

    const runCompliance = () => {
      if (cancelledRef.current) return;
      current.phase = 'compliance';
      const target = profile.biocarbon_ratio;
      let i = 0;
      const tick = () => {
        i++;
        current.complianceText = `${Math.round((target * i) / COMPLIANCE_COUNT_STEPS)}%`;
        if (i === 1) soundFx.playBeep();
        commit();
        if (i < COMPLIANCE_COUNT_STEPS) {
          later(tick, COMPLIANCE_DURATION_MS / COMPLIANCE_COUNT_STEPS);
        } else {
          current.complianceText = `${target}%`;
          current.phase = 'done';
          current.isComplete = true;
          commit();
        }
      };
      tick();
    };

    later(runNext, MESH_HOLD_MS);

    return () => {
      cancelledRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [profile]);

  const skip = useCallback(() => {
    cancelledRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setReveal(fullIdentityReveal(profile));
  }, [profile]);

  return { reveal, skip };
}