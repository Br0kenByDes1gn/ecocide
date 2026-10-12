import type { Queue } from 'bullmq';
import type { JobHandlers } from './handlers/index.js';
import type { JobName, JobOptions, JobPayloads } from './types.js';

/**
 * Small facade over job execution. Two implementations:
 *  - `bullmq`  → durable queue backed by Redis (production).
 *  - `inline`  → runs the handler in-process immediately (dev/tests when no
 *                REDIS_URL is configured, so Redis is not required).
 */
export interface JobDispatcher {
  readonly mode: 'bullmq' | 'inline';
  enqueue<K extends JobName>(name: K, data: JobPayloads[K], options?: JobOptions): Promise<void>;
  /** Register/replace a recurring (cron) job. No-op in inline mode. */
  schedule(id: string, pattern: string, name: JobName, data: JobPayloads[JobName]): Promise<void>;
}

export function createBullmqDispatcher(queue: Queue): JobDispatcher {
  return {
    mode: 'bullmq',
    async enqueue<K extends JobName>(name: K, data: JobPayloads[K], options?: JobOptions) {
      await queue.add(name, data as never, {
        ...(options?.jobId ? { jobId: options.jobId } : {}),
        ...(options?.delay ? { delay: options.delay } : {}),
      });
    },
    async schedule(id: string, pattern: string, name: JobName, data: JobPayloads[JobName]) {
      await queue.upsertJobScheduler(id, { pattern }, { name, data: data as never });
    },
  };
}

export function createInlineDispatcher(handlers: JobHandlers): JobDispatcher {
  return {
    mode: 'inline',
    async enqueue<K extends JobName>(name: K, data: JobPayloads[K]) {
      const handler = handlers[name] as (payload: JobPayloads[K]) => Promise<void>;
      try {
        await handler(data);
      } catch (err: any) {
        // Inline mode must never break the caller — log and move on.
        console.error(`[Jobs] Inline job "${name}" failed:`, err?.message || err);
      }
    },
    async schedule(id: string, pattern: string, name: JobName) {
      console.log(`[Jobs] Scheduler "${id}" (${pattern}) for "${name}" ignored — queue is in inline mode.`);
    },
  };
}
