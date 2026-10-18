import { Redis, type RedisOptions } from 'ioredis';

/**
 * ioredis options for a Redis URL.
 *
 * `rediss://` gets you TLS but not *trust*: Memorystore with
 * `SERVER_AUTHENTICATION` signs its server certificate with an instance-owned CA
 * ("Google Cloud Memorystore Redis Server CA", created with the instance) that
 * Node's bundled roots do not know, so the handshake fails with
 * `unable to verify the first certificate`. `REDIS_CA_CERT` carries that CA's
 * PEM, and only a TLS URL uses it — attaching `tls` to a plaintext connection
 * would make the client try to negotiate TLS against a non-TLS server.
 */
export function redisConnectionOptions(url: string, caCert?: string): RedisOptions {
  // BullMQ requires `maxRetriesPerRequest: null` on the connection it uses for
  // blocking commands.
  const options: RedisOptions = { maxRetriesPerRequest: null };
  const ca = caCert?.trim();
  if (ca && url.trim().startsWith('rediss://')) {
    return { ...options, tls: { ca } };
  }
  return options;
}

/**
 * One connection, shared by the Queue and the Worker (BullMQ requires
 * `maxRetriesPerRequest: null` for blocking commands).
 */
export function createRedis(url: string, caCert?: string) {
  return new Redis(url, redisConnectionOptions(url, caCert));
}

export type RedisConnection = ReturnType<typeof createRedis>;
