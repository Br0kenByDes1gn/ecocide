import { describe, expect, it } from 'vitest';
import type { InjunctionTask } from '@ecocide/types';
import {
  INJUNCTION_POLL_DELAYS_MS,
  INJUNCTION_POLL_DEADLINE_MS,
  hasInjunctionFor,
  injunctionPollDelay,
} from './useInjunction';

/**
 * The dossier page's stamp waits for orders that are issued after the acceptance
 * response, so the interesting parts are the decisions around that wait: whether
 * this verdict's orders are on file, and how long to keep asking. (The polling
 * *window* can't be reproduced offline — with no AI credentials issuance is
 * awaited — so the schedule is asserted rather than slept through.)
 */

const BASE_TASK: InjunctionTask = {
  id: 'task-1',
  action: 'Retire the pods.',
  replaces: 'coffee pod',
  why: 'Less plastic.',
  category: 'reduce',
  impact: 'high',
  effort: 'easy',
  dossierId: 'dossier-a',
  createdAt: '2026-10-16T04:00:00.000Z',
  completed: false,
  completedAt: null,
  points: 0,
};

function task(overrides: Partial<InjunctionTask> = {}): InjunctionTask {
  return { ...BASE_TASK, ...overrides };
}

describe('hasInjunctionFor', () => {
  it('is false while there is nothing to show', () => {
    expect(hasInjunctionFor(null, 'dossier-a')).toBe(false);
    expect(hasInjunctionFor([], 'dossier-a')).toBe(false);
  });

  it('matches only the verdict asked about', () => {
    const tasks = [task({ id: 'a', dossierId: 'dossier-a' }), task({ id: 'b', dossierId: 'dossier-b' })];

    expect(hasInjunctionFor(tasks, 'dossier-a')).toBe(true);
    expect(hasInjunctionFor(tasks, 'dossier-c')).toBe(false);
  });

  it('still counts completed orders — they exist and are worth showing', () => {
    expect(hasInjunctionFor([task({ completed: true, points: 64 })], 'dossier-a')).toBe(true);
  });
});

describe('injunctionPollDelay', () => {
  it('starts immediately, then backs off', () => {
    expect(injunctionPollDelay(0)).toBe(0);
    expect(injunctionPollDelay(1)).toBe(INJUNCTION_POLL_DELAYS_MS[1]);
    expect(injunctionPollDelay(2)).toBeGreaterThan(injunctionPollDelay(1));
  });

  it('caps at the last delay instead of growing without bound', () => {
    const last = INJUNCTION_POLL_DELAYS_MS[INJUNCTION_POLL_DELAYS_MS.length - 1];
    expect(injunctionPollDelay(50)).toBe(last);
    expect(injunctionPollDelay(Number.MAX_SAFE_INTEGER)).toBe(last);
  });

  it('gives up well inside a citizen\u2019s patience', () => {
    // The happy path is one model call (~5-15s in production); the deadline only
    // exists so an issuance that failed cannot leave the page fetching forever.
    expect(INJUNCTION_POLL_DEADLINE_MS).toBeLessThanOrEqual(120_000);
    expect(INJUNCTION_POLL_DELAYS_MS[0]).toBe(0);
  });

  /**
   * Polling is a request per attempt, so the schedule's length is a traffic
   * budget. Derived from the exported constants rather than hard-coded, so a
   * future tweak cannot quietly restore a long tail.
   */
  it('spends at most a handful of requests before the deadline', () => {
    let elapsed = 0;
    let attempts = 1; // the immediate read
    for (;;) {
      elapsed += injunctionPollDelay(attempts);
      if (elapsed >= INJUNCTION_POLL_DEADLINE_MS) break;
      attempts += 1;
    }

    expect(attempts).toBeGreaterThanOrEqual(4); // it does keep trying
    expect(attempts).toBeLessThanOrEqual(6); // ...but not for long
  });
});
