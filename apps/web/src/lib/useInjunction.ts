import { useEffect, useRef, useState } from 'react';
import type { InjunctionTask } from '@ecocide/types';
import { fetchInjunctionTasksForDossier } from './vault-api';

/**
 * "Have this verdict's injunction orders been issued yet?"
 *
 * Issuing them calls a model, so it deliberately runs *after* the acceptance
 * response — which means the dossier page the citizen lands on can be a moment
 * early. This hook resolves that race: one immediate read (instant on a repeat
 * visit, since the rows are already there) and then a bounded poll.
 *
 * It stops on the first of:
 *   • the orders appearing                  → `issued`
 *   • the endpoint saying they are not ours → `idle`  (locked registry, or
 *                                             someone else's verdict)
 *   • the deadline                          → `idle`, with a warning: issuance
 *     is best-effort, so polling forever would never succeed and would hide a
 *     real failure.
 */

/** Delay before each attempt, in ms; the last value repeats until the deadline. */
export const INJUNCTION_POLL_DELAYS_MS = [0, 1000, 2500, 5000, 10_000] as const;

/**
 * Give up after this long. The model call is the slow part (~5-15s in prod), so
 * 30s covers a sluggish issuance; the deadline only exists so an issuance that
 * *failed* cannot leave the page asking forever.
 */
export const INJUNCTION_POLL_DEADLINE_MS = 30_000;

/** True while the page is hidden — a backgrounded tab has nobody watching it. */
function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export type InjunctionStampStatus = 'idle' | 'waiting' | 'issued';

/** True when this verdict's orders are on file. */
export function hasInjunctionFor(tasks: InjunctionTask[] | null, dossierId: string): boolean {
  return Boolean(tasks?.some((task) => task.dossierId === dossierId));
}

/** Delay before attempt `n` (0-based), capped at the last entry. */
export function injunctionPollDelay(attempt: number): number {
  const { length } = INJUNCTION_POLL_DELAYS_MS;
  return INJUNCTION_POLL_DELAYS_MS[Math.min(attempt, length - 1)];
}

export interface InjunctionStampState {
  status: InjunctionStampStatus;
  /** The verdict's orders, once they exist (newest first). */
  tasks: InjunctionTask[];
}

export function useInjunctionStamp(
  dossierId: string | undefined,
  enabled: boolean
): InjunctionStampState {
  const [state, setState] = useState<InjunctionStampState>({ status: 'idle', tasks: [] });
  // Lets the effect stop without re-running when a late response lands.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!dossierId || !enabled) {
      setState({ status: 'idle', tasks: [] });
      return;
    }

    cancelledRef.current = false;
    const startedAt = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const cancelled = () => cancelledRef.current || controller.signal.aborted;
    const pastDeadline = () => Date.now() - startedAt >= INJUNCTION_POLL_DEADLINE_MS;

    const poll = async () => {
      let tasks: InjunctionTask[] | null;
      try {
        tasks = await fetchInjunctionTasksForDossier(dossierId, controller.signal);
      } catch {
        // Transient (5xx, dropped connection): keep trying until the deadline
        // rather than treat it as a definitive "no orders".
        if (cancelled()) return;
        if (pastDeadline()) {
          console.warn(`[Injunction] could not read the orders for ${dossierId}; giving up.`);
          setState({ status: 'idle', tasks: [] });
          return;
        }
        attempt += 1;
        schedule(injunctionPollDelay(attempt));
        return;
      }
      if (cancelled()) return;

      if (tasks === null) {
        // Not ours (locked registry / another citizen's verdict): stop asking.
        setState({ status: 'idle', tasks: [] });
        return;
      }

      if (hasInjunctionFor(tasks, dossierId)) {
        setState({ status: 'issued', tasks });
        return;
      }

      setState({ status: 'waiting', tasks: [] });

      if (pastDeadline()) {
        console.warn(`[Injunction] no orders on file for ${dossierId} after polling; giving up.`);
        setState({ status: 'idle', tasks: [] });
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
          setState({ status: 'idle', tasks: [] });
          return;
        }
        if (isHidden()) {
          schedule(injunctionPollDelay(attempt + 1));
          return;
        }
        void poll();
      }, delay);
    };

    const onVisible = () => {
      if (cancelled() || isHidden()) return;
      // Deliberately not deadline-gated: a citizen who pocketed the phone through
      // the whole window gets one read when they come back, which is the case
      // this exists for. `poll` decides what to do if it finds nothing.
      if (timer) clearTimeout(timer);
      void poll();
    };

    document.addEventListener('visibilitychange', onVisible);
    void poll();

    return () => {
      cancelledRef.current = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dossierId, enabled]);

  return state;
}
