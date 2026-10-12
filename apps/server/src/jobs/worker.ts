import { Worker } from 'bullmq';
import type { RedisConnection } from './connection.js';
import type { JobHandlers } from './handlers/index.js';

/** In-process BullMQ worker (shares the app's SQLite access). */
export function createJobWorker(connection: RedisConnection, handlers: JobHandlers, queueName: string): Worker {
  const worker = new Worker(
    queueName,
    async (job) => {
      const handler = (handlers as unknown as Record<string, ((payload: unknown) => Promise<void>) | undefined>)[
        job.name
      ];
      if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
      await handler(job.data);
    },
    { connection, concurrency: 5 }
  );

  worker.on('completed', (job) => {
    console.log(`[Jobs] ${job.name}#${job.id} completed.`);
  });
  worker.on('failed', (job, err) => {
    console.warn(
      `[Jobs] ${job?.name}#${job?.id} failed (attempt ${(job?.attemptsMade ?? 0) + 1}): ${err?.message || err}`
    );
  });
  worker.on('error', (err) => {
    console.error('[Jobs] Worker error:', err?.message || err);
  });

  return worker;
}
