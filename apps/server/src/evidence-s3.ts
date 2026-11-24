// ---------------------------------------------------------------------------
// S3-compatible evidence store (AWS S3, MinIO, Cloudflare R2, Backblaze B2,
// Wasabi, Ceph RGW; GCS through its S3 XML interop with HMAC keys).
//
// Imported dynamically from `evidence.ts` only when EVIDENCE_STORE=s3, so an
// fs deployment never loads the AWS SDK.
//
// Objects are write-once and addressed by file name (nanoid + extension), which
// is why the cache header can be immutable and why no listing is needed at read
// time. Credentials come from the environment (the chart puts them in the
// release Secret); a node role / instance profile still works when they are
// absent, because the SDK falls back to its default provider chain.
// ---------------------------------------------------------------------------

import { Readable } from 'stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { isValidEvidenceName, mimeForEvidenceName, type EvidenceStore } from './evidence.js';

export interface S3EvidenceOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  /** Key prefix inside the bucket, e.g. `evidence`. */
  prefix?: string;
  /** MinIO and most self-hosted gateways need path-style addressing. */
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/** Immutable for a year: names are content-addressed by dossier and written once. */
export const EVIDENCE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function isMissing(error: unknown): boolean {
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
}

export function createS3EvidenceStore(options: S3EvidenceOptions): EvidenceStore {
  const client = new S3Client({
    region: options.region,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.forcePathStyle ? { forcePathStyle: true } : {}),
    ...(options.accessKeyId && options.secretAccessKey
      ? { credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } }
      : {}),
  });

  const prefix = options.prefix ? options.prefix.replace(/^\/+|\/+$/g, '') : '';
  const keyFor = (name: string) => (prefix ? `${prefix}/${name}` : name);

  return {
    kind: 's3',
    describe: `s3:${options.bucket}${prefix ? `/${prefix}` : ''}`,

    async put(name, bytes, contentType) {
      if (!isValidEvidenceName(name)) throw new Error(`Invalid evidence name: ${name}`);
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: keyFor(name),
          Body: bytes,
          ContentType: contentType,
          CacheControl: EVIDENCE_CACHE_CONTROL,
        })
      );
    },

    async get(name) {
      if (!isValidEvidenceName(name)) return null;
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: keyFor(name) })
        );
        if (!result.Body) return null;
        return {
          body: Readable.toWeb(result.Body as Readable) as ReadableStream<Uint8Array>,
          contentType: result.ContentType || mimeForEvidenceName(name),
        };
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
  };
}
