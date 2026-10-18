import { describe, expect, it } from 'vitest';
import type { InjunctionTask } from '@ecocide/types';
import {
  INJUNCTION_POLL_DELAYS_MS,
  INJUNCTION_POLL_DEADLINE_MS,
  injunctionPollDelay,
  resolveInjunctionState,
} from './useInjunction';

/**
 * The dossier page's stamp waits for orders that are issued after the acceptance
 * response, so the interesting parts are the decisions around that wait: what one
 * answer from the orders endpoint means for the paper, and how long to keep
 * asking. (The polling *window* can't be reproduced offline — with no AI
 * credentials issuance runs inline — so the schedule is asserted rather than
 * slept through.)
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
  rewardUnits: 0,
};

function task(overrides: Partial<InjunctionTask> = {}): InjunctionTask {
  return { ...BASE_TASK, ...overrides };
}

describe('resolveInjunctionState', () => {
  const unfiled = { filed: false, orders: 0 };

  it('renders the orders once this session may read them', () => {
    const state = resolveInjunctionState(
      { tasks: [task({ dossierId: 'dossier-a' })], filed: true, orders: 1 },
      unfiled
    );

    expect(state.status).toBe('issued');
    expect(state.tasks).toHaveLength(1);
    expect(state.readable).toBe(true);
    expect(state.canRetry).toBe(false);
  });

  it('still counts completed orders — they exist and are worth showing', () => {
    const state = resolveInjunctionState(
      { tasks: [task({ completed: true, points: 64 })], filed: true, orders: 1 },
      unfiled
    );

    expect(state.status).toBe('issued');
    expect(state.tasks).toHaveLength(1);
  });

  it('calls a filing with no actions a filing, not a wait', () => {
    const state = resolveInjunctionState({ tasks: [], filed: true, orders: 0 }, unfiled);

    expect(state.status).toBe('empty');
    expect(state.canRetry).toBe(false);
  });

  it('keeps waiting while an accepted verdict has nothing on file', () => {
    const state = resolveInjunctionState({ tasks: [], filed: false, orders: 0 }, unfiled);

    expect(state.status).toBe('waiting');
    expect(state.canRetry).toBe(true);
  });

  it('falls back to the public record when the orders are not ours', () => {
    // A locked registry, or a shared permalink read by another session: 401/403
    // must not read as "no orders". The filing is public, the actions are not.
    const withActions = resolveInjunctionState(null, { filed: true, orders: 4 });
    expect(withActions.status).toBe('issued');
    expect(withActions.readable).toBe(false);
    expect(withActions.tasks).toEqual([]);
    // Nothing to retry: this session cannot issue somebody else's injunction.
    expect(withActions.canRetry).toBe(false);

    expect(resolveInjunctionState(null, { filed: true, orders: 0 }).status).toBe('empty');
  });

  it('says so when nothing is on file and it cannot be read', () => {
    const state = resolveInjunctionState(null, { filed: false, orders: 0 });

    expect(state.status).toBe('unavailable');
    expect(state.readable).toBe(false);
    expect(state.canRetry).toBe(false);
  });
});

describe('injunctionPollDelay', () => {  it('starts immediately, then backs off', () => {
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
