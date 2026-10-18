import { Queue } from 'bullmq';
import { createRedis } from './connection.js';
import { createBullmqDispatcher, createInlineDispatcher, type JobDispatcher } from './dispatcher.js';
import { createHandlers } from './handlers/index.js';
import { createJobWorker } from './worker.js';
import type { JobContext } from './types.js';

export const QUEUE_NAME = 'ecocide';

/**
 * Whether the queue can actually reach Redis.
 *
 * `jobs: 'bullmq'` only says `REDIS_URL` is set — the mode is decided by the
 * environment, never by connecting. A wrong host, port or AUTH string, or a
 * missing VPC route, still reports `bullmq` while every job silently waits, so
 * health reports the *connection* too. `inline` means there is no queue at all.
 */
export type QueueState = 'connected' | 'disconnected' | 'inline';

export interface JobSystem {
  dispatcher: JobDispatcher;
  /** BullMQ queue — present only in `bullmq` mode (used by the Bull Board UI). */
  queue: Queue | null;
  /** Live connection state, updated from the Redis client's own events. */
  queueState(): QueueState;
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
    return {
      dispatcher: createInlineDispatcher(handlers),
      queue: null,
      queueState: () => 'inline',
      close: async () => {},
    };
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

  // The mode is an environment fact; this is the connection fact beside it.
  // ioredis retries forever with `maxRetriesPerRequest: null`, so a bad URL or a
  // blocked port shows up here as a stream of errors while the process stays up.
  let connected = false;
  connection.on('ready', () => {
    if (!connected) console.log(`[Jobs] Redis connected (queue="${QUEUE_NAME}").`);
    connected = true;
  });
  for (const event of ['error', 'close', 'end'] as const) {
    connection.on(event, () => {
      connected = false;
    });
  }
  console.log(`[Jobs] BullMQ worker listening (queue="${QUEUE_NAME}").`);

  return {
    dispatcher: createBullmqDispatcher(queue),
    queue,
    queueState: () => (connected ? 'connected' : 'disconnected'),
    async close() {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}

export type { JobDispatcher } from './dispatcher.js';
export type { JobContext, JobName, JobOptions, JobPayloads } from './types.js';
