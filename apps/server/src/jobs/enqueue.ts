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
 * concurrent runs for one verdict share a single-flight execution
 * (`issueInjunction`); a BullMQ job is deduped by `jobId` and the handler no-ops
 * once the verdict is filed; the checklist cache avoids a second model call; the
 * task rows sit behind a unique key and are written in one transaction. The
 * removal flags let the id be reused after the job *finishes* (including a final
 * failure), which is what makes the page-load retry possible at all.
 *
 * **Inline mode does not wait.** The inline dispatcher (dev/tests, and any
 * deployment without Redis) runs the handler in the calling process, so awaiting
 * it would put a whole model call inside the acceptance request — and inside the
 * dossier read that asks for missing orders. The filed flag is the durable state,
 * the handler already logs its own failure, and the page's retry covers it. With
 * Redis the wait is only `queue.add`.
 */
export async function enqueueInjunction(
  dispatcher: JobDispatcher,
  dossierId: string,
  userId: string
): Promise<void> {
  const request = dispatcher.enqueue(
    'injunction:issue',
    { dossierId, userId },
    {
      jobId: `injunction:${dossierId}`,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );

  if (dispatcher.mode === 'inline') {
    // Fire and forget: the request that triggered it must not pay for the model.
    void request.catch((err: any) => {
      console.warn(`[Injunction] inline issuance for ${dossierId} failed:`, err?.message || err);
    });
    return;
  }

  try {
    await request;
  } catch (err: any) {
    // Best effort by design: the durable state is `accepted_at` + the missing
    // filed flag, so a queue that is down delays the orders instead of failing
    // the claim that was just paid for (or the page read that asked for them).
    // The next dossier load asks again.
    console.warn(`[Injunction] could not enqueue issuance for ${dossierId}:`, err?.message || err);
  }
}
