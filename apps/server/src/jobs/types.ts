import type { Repositories } from '../db/index.js';
import type { Mailer } from '../email/index.js';

/** Registered job names and their typed payloads. */
export type JobName =
  | 'email:verdict'
  | 'email:appeal-ruling'
  | 'email:otp'
  | 'email:informant-tip'
  | 'injunction:issue';

export interface JobPayloads {
  'email:verdict': { dossierId: string; to: string };
  'email:appeal-ruling': { dossierId: string; appealId: string; to: string };
  'email:otp': { to: string; code: string };
  'email:informant-tip': { dossierId: string; to: string };
  /** Issue the environmental injunction for an accepted verdict (idempotent). */
  'injunction:issue': { dossierId: string; userId: string };
}

export interface JobOptions {
  /** Deterministic id used to dedupe enqueues (e.g. one email per dossier). */
  jobId?: string;
  /** Delay before the job becomes available, in milliseconds. */
  delay?: number;
  /**
   * Drop the job once it finishes, instead of keeping a copy for inspection.
   *
   * A retained job keeps its `jobId` reserved forever, so a failed job that must
   * be retryable *by a later request* (the injunction) has to be removed when it
   * settles — otherwise the next enqueue would be silently swallowed.
   */
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

/** Dependencies available to every job handler. */
export interface JobContext {
  repositories: Repositories;
  mailer: Mailer;
  appBaseUrl: string;
}
