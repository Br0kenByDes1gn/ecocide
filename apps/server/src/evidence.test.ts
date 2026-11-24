import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createEvidenceStore,
  decodeEvidenceImage,
  evidenceFileNameFor,
  evidenceUrlFor,
  extensionForMime,
  isValidEvidenceName,
  mimeForEvidenceName,
  splitBase64DataUrl,
  type EvidenceStore,
} from './evidence.js';

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function readAll(store: EvidenceStore, name: string): Promise<Buffer | null> {
  const object = await store.get(name);
  if (!object) return null;
  const chunks: Buffer[] = [];
  const reader = object.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

describe('evidence naming', () => {
  it('only accepts nanoid names with a whitelisted image extension', () => {
    expect(isValidEvidenceName('GUF6A-eb5a.jpg')).toBe(true);
    expect(isValidEvidenceName('abc_123-x.webp')).toBe(true);
    expect(isValidEvidenceName('../../etc/passwd')).toBe(false);
    expect(isValidEvidenceName('abc.jpg.exe')).toBe(false);
    expect(isValidEvidenceName('abc.gif')).toBe(false);
    expect(isValidEvidenceName('a'.repeat(65) + '.jpg')).toBe(false);
  });

  it('derives the file name and content type from the mime type', () => {
    expect(evidenceFileNameFor('abc123', 'image/png')).toBe('abc123.png');
    expect(evidenceFileNameFor('abc123', 'image/jpeg')).toBe('abc123.jpg');
    expect(evidenceFileNameFor('abc123', 'application/octet-stream')).toBe('abc123.jpg');
    expect(extensionForMime('IMAGE/WEBP')).toBe('webp');
    expect(mimeForEvidenceName('x.png')).toBe('image/png');
    expect(mimeForEvidenceName('x.webp')).toBe('image/webp');
    expect(mimeForEvidenceName('x.jpeg')).toBe('image/jpeg');
  });

  it('builds the public URL, and it round-trips through the name check', () => {
    const url = evidenceUrlFor('abc123.jpg');
    expect(url).toBe('/api/evidence/abc123.jpg');
    expect(isValidEvidenceName(url.split('/').pop() as string)).toBe(true);
  });

  it('decodes a data URL and refuses an empty payload', () => {
    const { bytes, mimeType } = decodeEvidenceImage(tinyPng);
    expect(mimeType).toBe('image/png');
    expect(bytes.length).toBeGreaterThan(0);
    expect(() => decodeEvidenceImage('data:image/png;base64,')).toThrow(/empty/);
  });

  it('splits a data URL into head and payload, and passes raw base64 through', () => {
    expect(splitBase64DataUrl(tinyPng)[0]).toBe('data:image/png');
    expect(splitBase64DataUrl('QUJD')).toEqual(['', 'QUJD']);
  });
});

describe('filesystem evidence store', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecocide-evidence-'));

  it('is the default, and reports where it writes', async () => {
    const store = await createEvidenceStore({ EVIDENCE_DIR: dir });
    expect(store.kind).toBe('fs');
    expect(store.describe).toBe(`fs:${dir}`);
  });

  it('round-trips bytes and serves the content type from the extension', async () => {
    const store = await createEvidenceStore({ EVIDENCE_DIR: dir });
    const { bytes, mimeType } = decodeEvidenceImage(tinyPng);

    await store.put('roundtrip.png', bytes, mimeType);

    const object = await store.get('roundtrip.png');
    expect(object?.contentType).toBe('image/png');
    expect(await readAll(store, 'roundtrip.png')).toEqual(bytes);
  });

  it('answers null for a name that was never archived', async () => {
    const store = await createEvidenceStore({ EVIDENCE_DIR: dir });
    expect(await store.get('missing.jpg')).toBeNull();
  });

  it('refuses to write a name that could escape the directory', async () => {
    const store = await createEvidenceStore({ EVIDENCE_DIR: dir });
    await expect(store.put('../escape.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      /Invalid evidence name/
    );
    expect(await store.get('../escape.jpg')).toBeNull();
  });
});

describe('evidence store configuration', () => {
  it('defaults to the filesystem when EVIDENCE_STORE is unset', async () => {
    const store = await createEvidenceStore({ EVIDENCE_DIR: '/var/evidence' });
    expect(store.kind).toBe('fs');
  });

  it('refuses an unknown driver instead of silently using the filesystem', async () => {
    await expect(createEvidenceStore({ EVIDENCE_STORE: 'gcs' })).rejects.toThrow(/fs.*s3/);
  });

  it('refuses s3 without a bucket', async () => {
    await expect(createEvidenceStore({ EVIDENCE_STORE: 's3' })).rejects.toThrow(/S3_BUCKET/);
  });

  it('builds an s3 store from the environment', async () => {
    const store = await createEvidenceStore({
      EVIDENCE_STORE: 's3',
      S3_BUCKET: 'ecocide-evidence',
      S3_PREFIX: 'evidence',
      S3_ENDPOINT: 'http://minio.local:9000',
      S3_FORCE_PATH_STYLE: 'true',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(store.kind).toBe('s3');
    expect(store.describe).toBe('s3:ecocide-evidence/evidence');
  });
});
