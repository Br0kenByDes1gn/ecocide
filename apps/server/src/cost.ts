export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens?: number;
  totalTokens?: number;
}

export interface CostBreakdown {
  promptCostUsd: number;
  candidatesCostUsd: number;
  thoughtsCostUsd: number;
  totalCostUsd: number;
}

export interface ModelPricingConfig {
  promptPer1M: number;
  candidatesPer1M: number;
  thoughtsPer1M?: number;
}

/**
 * Standard Google Developer Pricing per 1,000,000 tokens (USD)
 */
export const MODEL_PRICING: Record<string, ModelPricingConfig> = {
  // Multimodal Vision + Text Reasoning ($0.18 / $0.72)
  'gemini-3.8-flash': {
    promptPer1M: 0.18,
    candidatesPer1M: 0.72,
    thoughtsPer1M: 0.72,
  },
  'gemini-2.5-flash': {
    promptPer1M: 0.18,
    candidatesPer1M: 0.72,
    thoughtsPer1M: 0.72,
  },
  // Gemini 2.5 Flash Image: Text/multimodal input at $0.18/1M,
  // output image generation tokens billed at $30.00/1M (~$0.0387 per 1290 image tokens)
  'gemini-2.5-flash-image': {
    promptPer1M: 0.18,
    candidatesPer1M: 30.0,
  },
  // Default fallback for simulated/mock engine
  mock: {
    promptPer1M: 0.0,
    candidatesPer1M: 0.0,
  },
};

/**
 * Calculates USD cost for an API call based on token usage and model pricing.
 */
export function calculateApiCost(
  model: string,
  usage: TokenUsage
): CostBreakdown {
  const pricing = MODEL_PRICING[model] || {
    promptPer1M: 0.18,
    candidatesPer1M: 0.72,
    thoughtsPer1M: 0.72,
  };

  const promptTokens = Math.max(0, usage.promptTokens || 0);
  const candidatesTokens = Math.max(0, usage.candidatesTokens || 0);
  const thoughtsTokens = Math.max(0, usage.thoughtsTokens || 0);

  const promptCostUsd = (promptTokens / 1_000_000) * pricing.promptPer1M;
  const candidatesCostUsd = (candidatesTokens / 1_000_000) * pricing.candidatesPer1M;
  const thoughtsCostUsd = (thoughtsTokens / 1_000_000) * (pricing.thoughtsPer1M ?? pricing.candidatesPer1M);

  const totalCostUsd = Number((promptCostUsd + candidatesCostUsd + thoughtsCostUsd).toFixed(6));

  return {
    promptCostUsd: Number(promptCostUsd.toFixed(6)),
    candidatesCostUsd: Number(candidatesCostUsd.toFixed(6)),
    thoughtsCostUsd: Number(thoughtsCostUsd.toFixed(6)),
    totalCostUsd,
  };
}
