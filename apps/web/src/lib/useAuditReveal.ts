import { useCallback, useEffect, useRef, useState } from 'react';
import type { HouseholdAudit, UserProfile } from '@ecocide/types';
import { soundFx } from './audio';

export type AuditRevealPhase = 'evidence' | 'title' | 'ratio' | 'done';

export interface AuditRevealState {
  phase: AuditRevealPhase;
  /** Whether the evidence photo annotation has been revealed. */
  evidenceVisible: boolean;
  /** Progressively typed honorific title; null while hidden. */
  titleText: string | null;
  /** Animated count-up for the Household Sustainability Index. */
  ratioText: string | null;
  /** Items-scanned stat (types in after the title). */
  itemsText: string | null;
  isComplete: boolean;
}

export const TITLE_CHAR_DELAY_MS = 24;
export const PAUSE_BETWEEN_MS = 260;
export const EVIDENCE_HOLD_MS = 700;
export const RATIO_DURATION_MS = 1400;
export const RATIO_COUNT_STEPS = 30;

function fullReveal(profile: UserProfile, audit: HouseholdAudit): AuditRevealState {
  return {
    phase: 'done',
    evidenceVisible: true,
    titleText: profile.honorific_title,
    ratioText: `${profile.biocarbon_ratio}%`,
    itemsText: `${audit.items.length} items scanned`,
    isComplete: true,
  };
}

function initialReveal(): AuditRevealState {
  return {
    phase: 'evidence',
    evidenceVisible: false,
    titleText: null,
    ratioText: null,
    itemsText: null,
    isComplete: false,
  };
}

/**
 * Drives the /arbitration reveal animation:
 *   1. the annotated evidence photo scans in (hold),
 *   2. the honorific title types out,
 *   3. the Household Sustainability Index counts up (finale),
 *   4. done. `skip()` jumps straight to the fully-revealed state.
 */
export function useAuditReveal(profile: UserProfile, audit: HouseholdAudit) {
  const cancelledRef = useRef(false);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [reveal, setReveal] = useState<AuditRevealState>(() => initialReveal());

  useEffect(() => {
    cancelledRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const current: AuditRevealState = { ...initialReveal(), evidenceVisible: true };
    setReveal(current);

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelledRef.current) fn();
      }, ms);
      timeoutsRef.current.push(t);
    };
    const commit = () => setReveal({ ...current });

    soundFx.playLockIn();

    // 1. Title types after the evidence hold
    later(() => {
      current.phase = 'title';
      const title = profile.honorific_title;
      let i = 0;
      const tick = () => {
        i++;
        current.titleText = title.slice(0, i);
        if (i % 2 === 0) soundFx.playTypewriter();
        commit();
        if (i < title.length) later(tick, TITLE_CHAR_DELAY_MS);
        else later(runRatio, PAUSE_BETWEEN_MS);
      };
      tick();
    }, EVIDENCE_HOLD_MS);

    // 2. Items stat, then the ratio count-up finale
    const runRatio = () => {
      if (cancelledRef.current) return;
      current.phase = 'ratio';
      current.itemsText = `${audit.items.length} items scanned`;
      commit();
      later(() => {
        const target = profile.biocarbon_ratio;
        let i = 0;
        const tick = () => {
          i++;
          current.ratioText = `${Math.round((target * i) / RATIO_COUNT_STEPS)}%`;
          if (i === 1) soundFx.playBeep();
          commit();
          if (i < RATIO_COUNT_STEPS) {
            later(tick, RATIO_DURATION_MS / RATIO_COUNT_STEPS);
          } else {
            current.ratioText = `${target}%`;
            current.phase = 'done';
            current.isComplete = true;
            commit();
          }
        };
        tick();
      }, PAUSE_BETWEEN_MS);
    };

    return () => {
      cancelledRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.caste, profile.honorific_title, profile.biocarbon_ratio, audit.items.length]);

  const skip = useCallback(() => {
    cancelledRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setReveal(fullReveal(profile, audit));
  }, [profile, audit]);

  return { reveal, skip };
}

/** Pure helper: the fully-revealed (static) state used by the /citizen page. */
export function fullAuditReveal(profile: UserProfile, audit: HouseholdAudit): AuditRevealState {
  return fullReveal(profile, audit);
}