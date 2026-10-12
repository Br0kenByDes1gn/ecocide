import { appealRulingEmail } from '../../email/index.js';
import type { JobContext, JobPayloads } from '../types.js';

export function makeSendAppealEmail(ctx: JobContext) {
  return async (payload: JobPayloads['email:appeal-ruling']): Promise<void> => {
    const record = await ctx.repositories.getDossier(payload.dossierId);
    if (!record) {
      console.warn(`[Jobs] email:appeal-ruling skipped — dossier ${payload.dossierId} not found.`);
      return;
    }

    const appeals = await ctx.repositories.getAppealsByDossier(payload.dossierId);
    const appeal = appeals.find((entry) => entry.id === payload.appealId);
    if (!appeal) {
      console.warn(`[Jobs] email:appeal-ruling skipped — appeal ${payload.appealId} not found.`);
      return;
    }

    const rendered = appealRulingEmail(record, appeal, ctx.appBaseUrl);
    await ctx.mailer.send({ to: payload.to, ...rendered });
  };
}
