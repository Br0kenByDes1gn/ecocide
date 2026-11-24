// ---------------------------------------------------------------------------
// Evidence store — the archived audit photo, never a database blob.
//
// The DB stores only `evidence_filename`; the bytes live in a store and are
// served by the API at GET /api/evidence/:name, so the browser never talks to
// the storage backend (no bucket policy, no CORS, no hostname in the URL).
//
// Two drivers, selected by `EVIDENCE_STORE`:
//
//   • fs (default) — files in `EVIDENCE_DIR`. This is the images' baked-in
//     default (`/data/evidence`) and what dev, tests and the bundled chart use.
//   • s3           — any S3-compatible bucket (AWS S3, MinIO, R2, B2, Wasabi;
//     GCS through its S3 XML interop). Imported dynamically, so an fs deployment
//     never loads the AWS SDK (same trick as the PGlite driver in db/client.ts).
//
// Object storage removes the one thing that pinned the chart to a single
// replica: a ReadWriteOnce volume mounted by the pod.
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const SAFE_NAME = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

/** An archived photo streamed back to a client. */
export interface EvidenceObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
}

/** Where evidence bytes live. Both drivers resolve names to bytes and back. */
export interface EvidenceStore {
  /** Driver name, for logs and `/api/health`. */
  readonly kind: 'fs' | 's3';
  /** Human-readable location, e.g. `fs:/data/evidence` or `s3:bucket/prefix`. */
  readonly describe: string;
  /** Persist bytes under an already-validated file name. Throws on failure. */
  put(name: string, bytes: Buffer, contentType: string): Promise<void>;
  /** The object, or null when it is not in the archive. Throws on a real error. */
  get(name: string): Promise<EvidenceObject | null>;
}

/** Directory holding evidence files (env EVIDENCE_DIR, else apps/server/data/evidence). */
export function evidenceDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.EVIDENCE_DIR || path.resolve(process.cwd(), 'data', 'evidence');
}

export function evidenceUrlFor(fileName: string): string {
  return `/api/evidence/${encodeURIComponent(fileName)}`;
}

/** Strict validation: nanoid chars + a whitelisted image extension. No dots, no slashes. */
export function isValidEvidenceName(name: string): boolean {
  return typeof name === 'string' && name.length <= 64 && SAFE_NAME.test(name);
}

/** Extension for a data-URL mime type (jpg/png/webp; unknown → jpg). */
export function extensionForMime(mimeType: string): string {
  switch ((mimeType || '').toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

/** File name for a dossier's evidence photo, derived from the dossier id + mime. */
export function evidenceFileNameFor(dossierId: string, mimeType: string): string {
  return `${dossierId}.${extensionForMime(mimeType)}`;
}

/** Content-Type header for a validated evidence file name. */
export function mimeForEvidenceName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Split a data URL ("data:image/jpeg;base64,....") into [head, base64data]. */
export function splitBase64DataUrl(image: string): [string, string] {
  const idx = image.indexOf(';base64,');
  if (idx !== -1) {
    return [image.slice(0, idx), image.slice(idx + ';base64,'.length)];
  }
  if (image.startsWith('data:')) {
    const comma = image.indexOf(',');
    if (comma !== -1) return [image.slice(0, comma), image.slice(comma + 1)];
  }
  return ['', image];
}

/** Decode a data URL / raw base64 photo into bytes + its declared mime type. */
export function decodeEvidenceImage(image: string): { bytes: Buffer; mimeType: string } {
  const [head, data] = splitBase64DataUrl(image);
  // No trailing `;` required: `splitBase64DataUrl` already stripped the
  // `;base64` marker, so `^data:(…);` never matched and every upload was
  // archived as a JPEG — including PNGs.
  const mimeType = head.match(/^data:([^;,]+)/)?.[1]?.trim() || 'image/jpeg';
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0) throw new Error('Evidence image decoded to an empty buffer');
  return { bytes, mimeType };
}

// ---------------------------------------------------------------------------
// Filesystem driver (unchanged behaviour)
// ---------------------------------------------------------------------------

function createFsStore(dir: string): EvidenceStore {
  return {
    kind: 'fs',
    describe: `fs:${dir}`,
    async put(name, bytes) {
      if (!isValidEvidenceName(name)) throw new Error(`Invalid evidence name: ${name}`);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, name), bytes);
    },
    async get(name) {
      if (!isValidEvidenceName(name)) return null;
      const file = path.join(dir, name);
      try {
        await fs.promises.access(file, fs.constants.R_OK);
      } catch {
        return null;
      }
      return {
        body: Readable.toWeb(fs.createReadStream(file)) as ReadableStream<Uint8Array>,
        contentType: mimeForEvidenceName(name),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build the store named by the environment. Async because the S3 driver (and
 * the AWS SDK with it) is imported only when it is actually configured.
 */
export async function createEvidenceStore(env: NodeJS.ProcessEnv = process.env): Promise<EvidenceStore> {
  const kind = (env.EVIDENCE_STORE || 'fs').trim().toLowerCase();

  if (kind === 's3') {
    const bucket = env.S3_BUCKET?.trim();
    if (!bucket) {
      throw new Error(
        'EVIDENCE_STORE=s3 requires S3_BUCKET (and S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY unless the node has ambient credentials).'
      );
    }
    const { createS3EvidenceStore } = await import('./evidence-s3.js');
    return createS3EvidenceStore({
      bucket,
      region: env.S3_REGION?.trim() || 'us-east-1',
      endpoint: env.S3_ENDPOINT?.trim() || undefined,
      prefix: env.S3_PREFIX?.trim() || undefined,
      forcePathStyle: (env.S3_FORCE_PATH_STYLE || '').trim().toLowerCase() === 'true',
      accessKeyId: env.S3_ACCESS_KEY_ID?.trim() || undefined,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    });
  }

  if (kind !== 'fs') {
    throw new Error(`EVIDENCE_STORE must be "fs" or "s3" (got "${kind}")`);
  }

  return createFsStore(evidenceDir(env));
}
