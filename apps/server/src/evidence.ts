// ---------------------------------------------------------------------------
// Evidence store — the archived audit photo lives as a FILE on disk, never in
// the database. The DB holds only the file name (`evidence_filename`); the web
// app fetches it through GET /api/evidence/:name.
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';

const SAFE_NAME = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

/** Directory holding evidence files (env EVIDENCE_DIR, else apps/server/data/evidence). */
export function evidenceDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.EVIDENCE_DIR || path.resolve(process.cwd(), 'data', 'evidence');
}

export function evidencePath(fileName: string): string {
  return path.join(evidenceDir(), fileName);
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

/**
 * Persist an evidence JPEG/PNG (data URL or raw base64) to disk. The dossier
 * id is the file name, so lookups are deterministic and collision-free.
 * Returns the file name written.
 */
export function saveEvidenceBase64(base64Image: string, dossierId: string): string {
  const [head, data] = splitBase64DataUrl(base64Image);
  const mimeType = head.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';
  const fileName = evidenceFileNameFor(dossierId, mimeType);
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0) throw new Error('Evidence image decoded to an empty buffer');

  const dir = evidenceDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(evidencePath(fileName), buffer);
  return fileName;
}

export function readEvidenceFile(fileName: string): Buffer | null {
  if (!isValidEvidenceName(fileName)) return null;
  try {
    return fs.readFileSync(evidencePath(fileName));
  } catch {
    return null;
  }
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