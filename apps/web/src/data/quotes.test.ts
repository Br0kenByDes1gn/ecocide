import { describe, expect, it } from 'vitest';
import { REGISTRY_QUOTES } from './quotes';

describe('REGISTRY_QUOTES Dataset (placeholder deck)', () => {
  it('ships at least six transmissions for the intro sequence', () => {
    expect(REGISTRY_QUOTES.length).toBeGreaterThanOrEqual(6);
  });

  it('has unique IDs for each quote entry', () => {
    const ids = REGISTRY_QUOTES.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has non-empty author, quote, and date for every entry', () => {
    for (const item of REGISTRY_QUOTES) {
      expect(item.author.trim().length).toBeGreaterThan(0);
      expect(item.quote.trim().length).toBeGreaterThan(10);
      expect(item.date.trim().length).toBeGreaterThan(0);
    }
  });

  it('speaks as the Arbiter and the Bureau', () => {
    const authors = REGISTRY_QUOTES.map((q) => q.author);
    expect(authors).toContain('AI Supreme Arbiter of Consumption');
    expect(authors).toContain('Central Audit Office');
  });
});