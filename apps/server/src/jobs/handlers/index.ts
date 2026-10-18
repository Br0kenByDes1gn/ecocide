import type { JobContext, JobName, JobPayloads } from '../types.js';
import { makeIssueInjunction } from './injunction-issue.js';
import { makeSendAppealEmail } from './send-appeal-email.js';
import { makeSendInformantEmail } from './send-informant-email.js';
import { makeSendOtpEmail } from './send-otp-email.js';
import { makeSendVerdictEmail } from './send-verdict-email.js';

export type JobHandler<K extends JobName> = (payload: JobPayloads[K]) => Promise<void>;

export interface JobHandlers {
  'email:verdict': JobHandler<'email:verdict'>;
  'email:appeal-ruling': JobHandler<'email:appeal-ruling'>;
  'email:otp': JobHandler<'email:otp'>;
  'email:informant-tip': JobHandler<'email:informant-tip'>;
  'injunction:issue': JobHandler<'injunction:issue'>;
}

/** Build the job handler registry, closing over the shared dependencies. */
export function createHandlers(ctx: JobContext): JobHandlers {
  return {
    'email:verdict': makeSendVerdictEmail(ctx),
    'email:appeal-ruling': makeSendAppealEmail(ctx),
    'email:otp': makeSendOtpEmail(ctx),
    'email:informant-tip': makeSendInformantEmail(ctx),
    'injunction:issue': makeIssueInjunction(ctx),
  };
}
