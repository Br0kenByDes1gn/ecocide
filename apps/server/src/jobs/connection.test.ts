import { describe, expect, it } from 'vitest';
import { redisConnectionOptions } from './connection';

/**
 * The handshake options for the queue's Redis connection.
 *
 * `rediss://` alone is not enough against Memorystore: the instance signs with
 * an instance-owned CA, and Node's roots do not know it — the connection then
 * fails with "unable to verify the first certificate" while the process stays up
 * and health reports a disconnected queue. The CA is only meaningful for a TLS
 * URL, so a plaintext one must never grow a `tls` block (that would try to
 * negotiate TLS against a non-TLS server).
 */

const PEM = '-----BEGIN CERTIFICATE-----\nMIID7TCCAtWgAwIBAgIBADANBgkqhkiG9w0BAQsFADCBhTELMAkGA1UE\n-----END CERTIFICATE-----';

describe('redisConnectionOptions', () => {
  it('requires retries to be unbounded for BullMQ', () => {
    expect(redisConnectionOptions('redis://10.0.0.1:6379').maxRetriesPerRequest).toBeNull();
  });

  it('trusts the instance CA on a TLS URL', () => {
    const options = redisConnectionOptions('rediss://:auth@10.0.0.1:6378', PEM);

    expect(options.tls).toEqual({ ca: PEM });
  });

  it('trims the PEM (dotenv/Secret Manager values arrive with whitespace)', () => {
    const options = redisConnectionOptions('rediss://:auth@10.0.0.1:6378', `\n  ${PEM}  \n`);

    expect(options.tls).toEqual({ ca: PEM });
  });

  it('never adds TLS to a plaintext URL, even with a CA set', () => {
    expect(redisConnectionOptions('redis://10.0.0.1:6379', PEM).tls).toBeUndefined();
  });

  it('stays plain when no CA is configured', () => {
    const options = redisConnectionOptions('rediss://:auth@10.0.0.1:6378');

    expect(options.tls).toBeUndefined();
    expect(options.maxRetriesPerRequest).toBeNull();
  });
});
