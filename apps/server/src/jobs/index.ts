import { Queue } from 'bullmq';
import { createRedis } from './connection.js';
import { createBullmqDispatcher, createInlineDispatcher, type JobDispatcher } from './dispatcher.js';
import { createHandlers } from './handlers/index.js';
import { createJobWorker } from './worker.js';
import type { JobContext } from './types.js';

export const QUEUE_NAME = 'ecocide';

export interface JobSystem {
  dispatcher: JobDispatcher;
  /** BullMQ queue — present only in `bullmq` mode (used by the Bull Board UI). */
  queue: Queue | null;
  close(): Promise<void>;
}

/**
 * Boot the job system. With a `redisUrl`, runs an in-process BullMQ worker and
 * returns the durable dispatcher + queue; without one, falls back to inline
 * execution so development and tests need no Redis.
 */
export async function createJobSystem(options: {
  redisUrl?: string;
  context: JobContext;
}): Promise<JobSystem> {
  const handlers = createHandlers(options.context);
  const redisUrl = options.redisUrl?.trim();

  if (!redisUrl) {
    console.log('[Jobs] REDIS_URL not set — running jobs inline (BullMQ disabled).');
    return { dispatcher: createInlineDispatcher(handlers), queue: null, close: async () => {} };
  }

  const connection = createRedis(redisUrl);
  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 1000 },
    },
  });
  const worker = createJobWorker(connection, handlers, QUEUE_NAME);
  console.log(`[Jobs] BullMQ worker online (queue="${QUEUE_NAME}").`);

  return {
    dispatcher: createBullmqDispatcher(queue),
    queue,
    async close() {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}

export type { JobDispatcher } from './dispatcher.js';
export type { JobContext, JobName, JobOptions, JobPayloads } from './types.js';
