import { useCallback, useEffect, useRef, useState } from 'react';
import type { InjunctionTask } from '@ecocide/types';
import { fetchInjunctionTasksForDossier } from './vault-api';

/**
 * "Where are this verdict's injunction orders?"
 *
 * Issuing them calls a model, so it runs as a queue job started by the
 * acceptance — which means the dossier page the citizen lands on can be a moment
 * early. This hook resolves that race: one immediate read (instant on a repeat
 * visit, since the flag and rows are already there) that also *asks* for the
 * orders when they are missing, then a bounded poll.
 *
 * The first read carries `ensure=1`, which is the retry the whole design hangs
 * on: an issuance that failed is asked for again the next time the page is
 * loaded, and the answer here is immediate either way (the server enqueues a job,
 * it does not wait for the model).
 *
 * It stops on the first of:
 *   • the orders appearing             → `issued`
 *   • a filing with no actions         → `empty` ("no corrective orders")
 *   • the endpoint saying they are not ours → `unavailable`, read from the
 *     public record instead (a locked registry, or someone else's verdict)
 *   • the deadline                     → `unavailable`, with a warning and a
 *     retry control: issuance is best-effort, so polling forever would never
 *     succeed and would hide a real failure
 */

/** Delay before each attempt, in ms; the last value repeats until the deadline. */
export const INJUNCTION_POLL_DELAYS_MS = [0, 1000, 2500, 5000, 10_000] as const;

/**
 * Give up after this long. The model call is the slow part (~5-15s in prod), so
 * 30s covers a sluggish issuance; the deadline only exists so an issuance that
 * *failed* cannot leave the page asking forever. Missing orders are never blank
 * paper: the mark space says so, and offers the retry.
 */
export const INJUNCTION_POLL_DEADLINE_MS = 30_000;

/** True while the page is hidden — a backgrounded tab has nobody watching it. */
function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export type InjunctionStampStatus = 'idle' | 'waiting' | 'issued' | 'empty' | 'unavailable';

/**
 * What the public dossier record says about the filing — available to every
 * reader, including someone signed out on a shared permalink. Used when the
 * registry refuses to hand over the actions themselves.
 */
export interface InjunctionPublicState {
  /** The verdict's checklist is on file (see `CitizenRecord.injunctionFiledAt`). */
  filed: boolean;
  /** How many actions it holds; 0 is a valid filing. */
  orders: number;
}

/** Delay before attempt `n` (0-based), capped at the last entry. */
export function injunctionPollDelay(attempt: number): number {
  const { length } = INJUNCTION_POLL_DELAYS_MS;
  return INJUNCTION_POLL_DELAYS_MS[Math.min(attempt, length - 1)];
}

export interface InjunctionStampState {
  status: InjunctionStampStatus;
  /** The verdict's orders, once they exist and this session may read them. */
  tasks: InjunctionTask[];
  /** False when the orders are on file but belong to another session. */
  readable: boolean;
  /** True when this session can ask for missing orders to be issued again. */
  canRetry: boolean;
  /** Ask again (restarts the wait, with `ensure=1` on its first read). */
  retry: () => void;
}

/** The renderable part of the state, before `retry` is attached. */
export type InjunctionView = Omit<InjunctionStampState, 'retry'>;

/**
 * Turns one answer from the orders endpoint into what the dossier renders.
 *
 * Pure, so the rules that decide between "orders", "no orders", "somebody else's
 * orders" and "not on file" are testable without a DOM:
 *
 *   • `answer === null` (401/403 — a locked registry or another citizen's
 *     verdict) → read the public record instead: filed-with-actions is shown as
 *     an inert stamp, filed-with-none as the green one, unfiled as not-on-file.
 *     Nothing is retried: this session cannot issue somebody else's injunction.
 *   • a checklist with actions → `issued`, readable (the endpoint is owner-only).
 *   • `filed` with no actions → `empty` — a valid filing, not a waiting state.
 *   • unfiled → `waiting`, and this session may ask for a retry.
 */
export function resolveInjunctionState(
  answer: { tasks: InjunctionTask[]; filed: boolean; orders: number } | null,
  fallback: InjunctionPublicState
): InjunctionView {
  if (answer === null) {
    if (!fallback.filed) return { status: 'unavailable', tasks: [], readable: false, canRetry: false };
    return fallback.orders > 0
      ? { status: 'issued', tasks: [], readable: false, canRetry: false }
      : { status: 'empty', tasks: [], readable: false, canRetry: false };
  }

  if (answer.tasks.length > 0) {
    return { status: 'issued', tasks: answer.tasks, readable: true, canRetry: false };
  }
  if (answer.filed) return { status: 'empty', tasks: [], readable: true, canRetry: false };
  return { status: 'waiting', tasks: [], readable: true, canRetry: true };
}

const IDLE: InjunctionView = {
  status: 'idle',
  tasks: [],
  readable: true,
  canRetry: false,
};

export function useInjunctionStamp(
  dossierId: string | undefined,
  enabled: boolean,
  fallback: InjunctionPublicState = { filed: false, orders: 0 }
): InjunctionStampState {
  // Scalars, so the effect below does not restart on every render (the caller
  // builds `fallback` inline).
  const { filed: fallbackFiled, orders: fallbackOrders } = fallback;

  const [state, setState] = useState<Omit<InjunctionStampState, 'retry'>>(IDLE);
  // Bumped by `retry`: the wait starts over, ensure included.
  const [attemptToken, setAttemptToken] = useState(0);
  // Lets the effect stop without re-running when a late response lands.
  const cancelledRef = useRef(false);

  const retry = useCallback(() => setAttemptToken((token) => token + 1), []);

  useEffect(() => {
    if (!dossierId || !enabled) {
      setState(IDLE);
      return;
    }

    cancelledRef.current = false;
    const startedAt = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const cancelled = () => cancelledRef.current || controller.signal.aborted;
    const pastDeadline = () => Date.now() - startedAt >= INJUNCTION_POLL_DEADLINE_MS;
    const settle = (
      status: InjunctionStampStatus,
      tasks: InjunctionTask[] = [],
      readable = true,
      canRetry = false
    ) => setState({ status, tasks, readable, canRetry });

    const poll = async (askToIssue: boolean) => {
      let answer: Awaited<ReturnType<typeof fetchInjunctionTasksForDossier>>;
      try {
        answer = await fetchInjunctionTasksForDossier(dossierId, {
          signal: controller.signal,
          ensure: askToIssue,
        });
      } catch {
        // Transient (5xx, dropped connection): keep trying until the deadline
        // rather than treat it as a definitive "no orders".
        if (cancelled()) return;
        if (pastDeadline()) {
          console.warn(`[Injunction] could not read the orders for ${dossierId}; giving up.`);
          settle('unavailable', [], false, true);
          return;
        }
        attempt += 1;
        schedule(injunctionPollDelay(attempt));
        return;
      }
      if (cancelled()) return;

      const resolved = resolveInjunctionState(answer, { filed: fallbackFiled, orders: fallbackOrders });

      if (resolved.status !== 'waiting') {
        setState(resolved);
        return;
      }

      // Ours, and not on file yet: keep asking.
      setState(resolved);
      if (pastDeadline()) {
        console.warn(`[Injunction] no orders on file for ${dossierId} after polling; giving up.`);
        settle('unavailable', [], true, true);
        return;
      }

      attempt += 1;
      schedule(injunctionPollDelay(attempt));
    };

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        // Out of time: issuance is best-effort, so stop asking instead of burning
        // a request we already know we will discard.
        if (pastDeadline()) {
          console.warn(`[Injunction] gave up waiting for the orders of ${dossierId}.`);
          settle('unavailable', [], true, true);
          return;
        }
        if (isHidden()) {
          schedule(injunctionPollDelay(attempt + 1));
          return;
        }
        void poll(false);
      }, delay);
    };

    const onVisible = () => {
      if (cancelled() || isHidden()) return;
      // Deliberately not deadline-gated: a citizen who pocketed the phone through
      // the whole window gets one read when they come back, which is the case
      // this exists for. `poll` decides what to do if it finds nothing.
      if (timer) clearTimeout(timer);
      void poll(false);
    };

    document.addEventListener('visibilitychange', onVisible);
    // The wait is live from the first paint (the dossier says who is working),
    // and the first read is also the retry that asks for missing orders.
    setState({ ...IDLE, status: 'waiting' });
    void poll(true);

    return () => {
      cancelledRef.current = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dossierId, enabled, fallbackFiled, fallbackOrders, attemptToken]);

  return { ...state, retry };
}
