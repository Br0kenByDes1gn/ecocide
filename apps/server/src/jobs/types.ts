import type { Repositories } from '../db/index.js';
import type { Mailer } from '../email/index.js';

/** Registered job names and their typed payloads. */
export type JobName = 'email:verdict' | 'email:appeal-ruling' | 'email:otp' | 'email:informant-tip';

export interface JobPayloads {
  'email:verdict': { dossierId: string; to: string };
  'email:appeal-ruling': { dossierId: string; appealId: string; to: string };
  'email:otp': { to: string; code: string };
  'email:informant-tip': { dossierId: string; to: string };
}

export interface JobOptions {
  /** Deterministic id used to dedupe enqueues (e.g. one email per dossier). */
  jobId?: string;
  /** Delay before the job becomes available, in milliseconds. */
  delay?: number;
}

/** Dependencies available to every job handler. */
export interface JobContext {
  repositories: Repositories;
  mailer: Mailer;
  appBaseUrl: string;
}
