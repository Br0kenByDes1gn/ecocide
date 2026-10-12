import { verdictEmail } from '../../email/index.js';
import type { JobContext, JobPayloads } from '../types.js';

export function makeSendVerdictEmail(ctx: JobContext) {
  return async (payload: JobPayloads['email:verdict']): Promise<void> => {
    const record = await ctx.repositories.getDossier(payload.dossierId);
    if (!record) {
      console.warn(`[Jobs] email:verdict skipped — dossier ${payload.dossierId} not found.`);
      return;
    }
    const rendered = verdictEmail(record, ctx.appBaseUrl);
    await ctx.mailer.send({ to: payload.to, ...rendered });
  };
}
