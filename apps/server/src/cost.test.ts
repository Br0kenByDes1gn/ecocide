import { describe, it, expect } from 'vitest';
import { calculateApiCost, MODEL_PRICING } from './cost.js';

describe('calculateApiCost', () => {
  it('calculates cost accurately for gemini-3.8-flash text and vision', () => {
    const result = calculateApiCost('gemini-3.8-flash', {
      promptTokens: 1000,
      candidatesTokens: 500,
      thoughtsTokens: 100,
    });

    // 1000 / 1M * 0.18 = 0.00018
    // 500 / 1M * 0.72 = 0.00036
    // 100 / 1M * 0.72 = 0.000072
    // total = 0.000612
    expect(result.promptCostUsd).toBeCloseTo(0.00018, 5);
    expect(result.candidatesCostUsd).toBeCloseTo(0.00036, 5);
    expect(result.thoughtsCostUsd).toBeCloseTo(0.000072, 6);
    expect(result.totalCostUsd).toBeCloseTo(0.000612, 5);
  });

  it('calculates cost accurately for gemini-2.5-flash-image with image output tokens', () => {
    const result = calculateApiCost('gemini-2.5-flash-image', {
      promptTokens: 800,
      candidatesTokens: 1290, // standard 1024x1024 image tokens
    });

    // 800 / 1M * 0.18 = 0.000144
    // 1290 / 1M * 30.0 = 0.038700
    // total = 0.038844
    expect(result.promptCostUsd).toBeCloseTo(0.000144, 5);
    expect(result.candidatesCostUsd).toBeCloseTo(0.0387, 4);
    expect(result.totalCostUsd).toBeCloseTo(0.038844, 4);
  });

  it('returns 0 for mock provider', () => {
    const result = calculateApiCost('mock', {
      promptTokens: 500,
      candidatesTokens: 200,
    });

    expect(result.totalCostUsd).toBe(0);
  });
});
