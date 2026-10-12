import { avatarRegistry } from '../../avatar/registry.js';
import type { JobContext, JobPayloads } from '../types.js';

/**
 * Durable avatar synthesis: loads the dossier (and its archived 360px source
 * snapshot) and reuses the provider registry. Errors are surfaced to BullMQ so
 * the job can be retried with backoff.
 */
export function makeSynthesizeAvatar(ctx: JobContext) {
  return async (payload: JobPayloads['avatar:synthesize']): Promise<void> => {
    const provider = avatarRegistry.get(payload.engine);
    const record = await ctx.repositories.getDossier(payload.dossierId);
    if (!record) {
      console.warn(`[Jobs] avatar:synthesize skipped — dossier ${payload.dossierId} not found.`);
      return;
    }

    const photo = payload.image || record.sourceSnapshot || record.stylizedPortraitUrl;
    if (!photo) {
      console.warn(`[Jobs] avatar:synthesize skipped — no source image for ${payload.dossierId}.`);
      await ctx.repositories.updateDossierAvatar(payload.dossierId, null, 'failed', provider.id);
      return;
    }

    await ctx.repositories.updateDossierAvatar(payload.dossierId, null, 'synthesizing', provider.id);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(`[Jobs] avatar:synthesize skipped — no GEMINI_API_KEY for ${payload.dossierId}.`);
      await ctx.repositories.updateDossierAvatar(payload.dossierId, null, 'failed', provider.id);
      return;
    }

    const startTime = Date.now();
    try {
      const result = await provider.generate({
        image: photo,
        userProfile: record.profile,
        apiKey,
        targetSize: 256,
      });

      if (result.usage) {
        await ctx.repositories.logApiCall({
          dossierId: payload.dossierId,
          callType: 'avatar_synthesis',
          provider: result.usage.provider,
          model: result.usage.model,
          promptTokens: result.usage.promptTokens,
          candidatesTokens: result.usage.candidatesTokens,
          thoughtsTokens: result.usage.thoughtsTokens,
          totalTokens: result.usage.totalTokens,
          costUsd: result.usage.costUsd,
          durationMs: result.usage.durationMs,
          status: 'success',
        });
      }

      await ctx.repositories.updateDossierAvatar(payload.dossierId, result.avatarUrl, 'completed', result.engineId);
      console.log(`[Jobs] avatar:synthesize completed for ${payload.dossierId} via ${result.engineId}.`);
    } catch (err: any) {
      console.error(`[Jobs] avatar:synthesize failed for ${payload.dossierId}:`, err?.message || err);
      await ctx.repositories
        .logApiCall({
          dossierId: payload.dossierId,
          callType: 'avatar_synthesis',
          provider: 'google',
          model: provider.id,
          promptTokens: 0,
          candidatesTokens: 0,
          thoughtsTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          durationMs: Date.now() - startTime,
          status: 'error',
          errorMessage: err?.message || String(err),
        })
        .catch(() => {});
      await ctx.repositories.updateDossierAvatar(payload.dossierId, null, 'failed', provider.id);
      throw err;
    }
  };
}
