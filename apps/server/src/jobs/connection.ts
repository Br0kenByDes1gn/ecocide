import { Redis } from 'ioredis';

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the connection it uses for
 * blocking commands. Reuse a single connection for the Queue and Worker.
 */
export function createRedis(url: string) {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export type RedisConnection = ReturnType<typeof createRedis>;
