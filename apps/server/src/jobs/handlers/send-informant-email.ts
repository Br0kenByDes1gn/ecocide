import { informantTipEmail } from '../../email/index.js';
import type { JobContext, JobPayloads } from '../types.js';

export function makeSendInformantEmail(ctx: JobContext) {
  return async (payload: JobPayloads['email:informant-tip']): Promise<void> => {
    const record = await ctx.repositories.getDossier(payload.dossierId);
    if (!record) {
      console.warn(`[Jobs] email:informant-tip skipped — dossier ${payload.dossierId} not found.`);
      return;
    }
    const rendered = informantTipEmail(record, ctx.appBaseUrl);
    await ctx.mailer.send({ to: payload.to, ...rendered });
  };
}
