import { useCallback, useEffect, useRef, useState } from 'react';
import type { Prophecy } from '@ecocide/types';
import { soundFx } from './audio';

export type ArbitrationPhase = 'compact-pending' | 'compacting' | 'typing' | 'complete';

export interface ArbitrationParagraphState {
  /** Progressively typed text of the paragraph. */
  text: string;
  /** Whether the paragraph is collapsed to its first visual line. */
  collapsed: boolean;
  /** Whether the user has one-way expanded it back to full text. */
  expanded: boolean;
}

export interface ArbitrationFlowState {
  phase: ArbitrationPhase;
  /** Whether the identity card is in its compact summary-bar form. */
  cardCompact: boolean;
  /** Whether the user has expanded the compact card back to full size. */
  cardExpanded: boolean;
  /** True once every animation (fill, compact, all paragraphs) has finished. */
  isComplete: boolean;
  paragraphs: ArbitrationParagraphState[];
}

export const COMPACT_DELAY_MS = 1000;
export const COMPACT_TRANSITION_MS = 900;
export const PARAGRAPH_PAUSE_MS = 2500;
export const TYPE_CHAR_MS = 18;

function initialFlowState(): ArbitrationFlowState {
  return {
    phase: 'compact-pending',
    cardCompact: false,
    cardExpanded: false,
    isComplete: false,
    paragraphs: [0, 1, 2].map(() => ({ text: '', collapsed: false, expanded: false })),
  };
}

function clone(state: ArbitrationFlowState): ArbitrationFlowState {
  return { ...state, paragraphs: state.paragraphs.map((p) => ({ ...p })) };
}

/** Pure helper: the rest/complete state — compact card, every paragraph typed + collapsed. */
export function completeFlowState(prophecy: Prophecy): ArbitrationFlowState {
  return {
    phase: 'complete',
    cardCompact: true,
    cardExpanded: false,
    isComplete: true,
    paragraphs: [
      { text: prophecy.paragraph_1, collapsed: true, expanded: false },
      { text: prophecy.paragraph_2, collapsed: true, expanded: false },
      { text: prophecy.paragraph_3, collapsed: true, expanded: false },
    ],
  };
}

/** Pure helper: one-way card expansion, only effective after completion. */
export function applyCardExpand(state: ArbitrationFlowState): ArbitrationFlowState {
  if (!state.isComplete || state.cardExpanded) return state;
  return { ...state, cardCompact: false, cardExpanded: true };
}

/** Pure helper: one-way paragraph expansion, only effective after completion. */
export function applyParagraphExpand(
  state: ArbitrationFlowState,
  index: number
): ArbitrationFlowState {
  if (!state.isComplete || index < 0 || index >= state.paragraphs.length) return state;
  const paragraph = state.paragraphs[index];
  if (paragraph.expanded) return state;
  const paragraphs = state.paragraphs.map((p, j) =>
    j === index ? { ...p, collapsed: false, expanded: true } : p
  );
  return { ...state, paragraphs };
}

/**
 * Orchestrates the post-fill arbitration animation on /arbitration/:id:
 *   1. pause, then collapse the filled card into a compact summary bar
 *      (stamp + title + ratio),
 *   2. type each prophecy paragraph in sequence (bigger font) with a pause
 *      after each, then collapse it to its first line,
 *   3. mark complete — from then on the card and paragraphs can be clicked to
 *      expand back to full size (one-way).
 * `skip()` jumps straight to the completed state.
 */
export function useArbitrationFlow(prophecy: Prophecy, enabled: boolean) {
  const cancelledRef = useRef(false);
  const skippedRef = useRef(false);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [state, setState] = useState<ArbitrationFlowState>(() => initialFlowState());

  useEffect(() => {
    cancelledRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (!enabled || skippedRef.current) return;

    const current: ArbitrationFlowState = initialFlowState();
    setState(current);

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelledRef.current) fn();
      }, ms);
      timeoutsRef.current.push(t);
    };
    const commit = () => setState(clone(current));

    const texts = [prophecy.paragraph_1, prophecy.paragraph_2, prophecy.paragraph_3];

    const typeParagraph = (index: number, onDone: () => void) => {
      const full = texts[index];
      let i = 0;
      const tick = () => {
        i++;
        current.paragraphs[index] = { ...current.paragraphs[index], text: full.slice(0, i) };
        current.phase = 'typing';
        if (i % 3 === 0) soundFx.playTypewriter();
        commit();
        if (i < full.length) later(tick, TYPE_CHAR_MS);
        else onDone();
      };
      tick();
    };

    let stage = 0;
    const collapseAndNext = () => {
      current.paragraphs[stage] = { ...current.paragraphs[stage], collapsed: true };
      commit();
      stage++;
      if (stage >= texts.length) {
        current.phase = 'complete';
        current.isComplete = true;
        commit();
        return;
      }
      typeParagraph(stage, () => later(collapseAndNext, PARAGRAPH_PAUSE_MS));
    };

    // Pause after the card fill, then compact, then begin typing paragraph 1
    later(() => {
      current.cardCompact = true;
      current.phase = 'compacting';
      soundFx.playBeep();
      commit();
      later(() => {
        typeParagraph(0, () => later(collapseAndNext, PARAGRAPH_PAUSE_MS));
      }, COMPACT_TRANSITION_MS);
    }, COMPACT_DELAY_MS);

    return () => {
      cancelledRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [enabled, prophecy]);

  const skip = useCallback(() => {
    skippedRef.current = true;
    cancelledRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setState(completeFlowState(prophecy));
  }, [prophecy]);

  const expandCard = useCallback(() => setState((s) => applyCardExpand(s)), []);
  const expandParagraph = useCallback(
    (index: number) => setState((s) => applyParagraphExpand(s, index)),
    []
  );

  return { state, skip, expandCard, expandParagraph };
}