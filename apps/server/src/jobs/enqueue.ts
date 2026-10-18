import type { JobDispatcher } from './dispatcher.js';

/**
 * Ask for a verdict's environmental injunction to be issued.
 *
 * Called from the two places that can know orders are missing:
 *
 *  • **acceptance** — `POST /api/vault/link` enqueues it as soon as the verdict
 *    is accepted, so the orders are usually on file before the dossier renders.
 *  • **the dossier page's first read** — `GET /api/vault/injunction-tasks?ensure=1`
 *    enqueues it whenever an accepted verdict has no filed flag, which is how a
 *    failed issuance gets retried on the next visit.
 *
 * Idempotency is layered, so a duplicate enqueue is cheap rather than wrong:
 * a pending job is deduped by `jobId`; the handler no-ops once the verdict is
 * filed; the checklist cache avoids a second model call; the task rows sit
 * behind a unique key and are written in one transaction. The removal flags let
 * the id be reused after the job *finishes* (including a final failure), which is
 * what makes the page-load retry possible at all.
 */
export async function enqueueInjunction(
  dispatcher: JobDispatcher,
  dossierId: string,
  userId: string
): Promise<void> {
  try {
    await dispatcher.enqueue(
      'injunction:issue',
      { dossierId, userId },
      {
        jobId: `injunction:${dossierId}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  } catch (err: any) {
    // Best effort by design: the durable state is `accepted_at` + the missing
    // filed flag, so a queue that is down delays the orders instead of failing
    // the claim that was just paid for (or the page read that asked for them).
    // The next dossier load asks again.
    console.warn(`[Injunction] could not enqueue issuance for ${dossierId}:`, err?.message || err);
  }
}
