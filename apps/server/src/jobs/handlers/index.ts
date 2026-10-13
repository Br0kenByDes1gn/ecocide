import type { JobContext, JobName, JobPayloads } from '../types.js';
import { makeSendAppealEmail } from './send-appeal-email.js';
import { makeSendOtpEmail } from './send-otp-email.js';
import { makeSendVerdictEmail } from './send-verdict-email.js';

export type JobHandler<K extends JobName> = (payload: JobPayloads[K]) => Promise<void>;

export interface JobHandlers {
  'email:verdict': JobHandler<'email:verdict'>;
  'email:appeal-ruling': JobHandler<'email:appeal-ruling'>;
  'email:otp': JobHandler<'email:otp'>;
}

/** Build the job handler registry, closing over the shared dependencies. */
export function createHandlers(ctx: JobContext): JobHandlers {
  return {
    'email:verdict': makeSendVerdictEmail(ctx),
    'email:appeal-ruling': makeSendAppealEmail(ctx),
    'email:otp': makeSendOtpEmail(ctx),
  };
}
