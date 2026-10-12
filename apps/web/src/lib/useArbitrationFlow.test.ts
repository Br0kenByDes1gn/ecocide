import { describe, expect, it } from 'vitest';
import type { Prophecy } from '@ecocide/types';
import {
  applyCardExpand,
  applyParagraphExpand,
  completeFlowState,
  COMPACT_DELAY_MS,
  PARAGRAPH_PAUSE_MS,
  TYPE_CHAR_MS,
} from './useArbitrationFlow';

const prophecy: Prophecy = {
  headline: 'OFFICIAL VERDICT: SECTOR 99 HIERARCHY REGISTRATION',
  paragraph_1: 'Attention citizen. Your compliance is acceptable.',
  paragraph_2: 'Your designated occupation is redundancy management.',
  paragraph_3: 'The mainframe records your existence with mild disdain.',
};

describe('useArbitrationFlow helpers', () => {
  it('types paragraphs with the same cadence as the prophecy typewriter', () => {
    expect(TYPE_CHAR_MS).toBe(18);
    expect(COMPACT_DELAY_MS).toBe(1000);
    expect(PARAGRAPH_PAUSE_MS).toBeGreaterThanOrEqual(2000);
    expect(PARAGRAPH_PAUSE_MS).toBeLessThanOrEqual(3000);
  });

  it('completeFlowState yields the rest state: compact card, all paragraphs typed and collapsed', () => {
    const state = completeFlowState(prophecy);
    expect(state.isComplete).toBe(true);
    expect(state.phase).toBe('complete');
    expect(state.cardCompact).toBe(true);
    expect(state.cardExpanded).toBe(false);
    expect(state.paragraphs.map((p) => p.text)).toEqual([
      prophecy.paragraph_1,
      prophecy.paragraph_2,
      prophecy.paragraph_3,
    ]);
    expect(state.paragraphs.every((p) => p.collapsed && !p.expanded)).toBe(true);
  });

  it('never expands the card before completion', () => {
    const during = applyCardExpand({
      ...completeFlowState(prophecy),
      isComplete: false,
    });
    expect(during.cardCompact).toBe(true);
    expect(during.cardExpanded).toBe(false);
  });

  it('expands the card one-way after completion', () => {
    const state = completeFlowState(prophecy);
    const expanded = applyCardExpand(state);
    expect(expanded.cardCompact).toBe(false);
    expect(expanded.cardExpanded).toBe(true);
    // One-way: applying again is a no-op
    expect(applyCardExpand(expanded)).toBe(expanded);
  });

  it('never expands paragraphs before completion or out of range', () => {
    const during = applyParagraphExpand({ ...completeFlowState(prophecy), isComplete: false }, 0);
    expect(during.paragraphs[0].collapsed).toBe(true);
    expect(during.paragraphs[0].expanded).toBe(false);

    const outOfRange = applyParagraphExpand(completeFlowState(prophecy), 5);
    expect(outOfRange.paragraphs[0].expanded).toBe(false);
  });

  it('expands a single paragraph one-way after completion', () => {
    const state = completeFlowState(prophecy);
    const expanded = applyParagraphExpand(state, 1);
    expect(expanded.paragraphs[1]).toMatchObject({ collapsed: false, expanded: true });
    expect(expanded.paragraphs[0].expanded).toBe(false);
    expect(expanded.paragraphs[2].expanded).toBe(false);
    // idempotent / one-way
    expect(applyParagraphExpand(expanded, 1)).toBe(expanded);
  });
});