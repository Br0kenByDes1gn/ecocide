import { vaultOtpEmail } from '../../email/index.js';
import type { JobContext, JobPayloads } from '../types.js';

/** Delivers an Asset Vault unlock code (email OTP). */
export function makeSendOtpEmail(ctx: JobContext) {
  return async (payload: JobPayloads['email:otp']): Promise<void> => {
    const rendered = vaultOtpEmail(payload.code);
    await ctx.mailer.send({ to: payload.to, ...rendered });
  };
}
