import { describe, expect, it } from 'vitest';
import { APOCALYPSE_QUOTES } from './quotes';

describe('APOCALYPSE_QUOTES Dataset', () => {
  it('should contain all 21 apocalyptic quotes from leadership and researchers', () => {
    expect(APOCALYPSE_QUOTES.length).toBe(21);
  });

  it('should have unique IDs for each quote entry', () => {
    const ids = APOCALYPSE_QUOTES.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have non-empty author, quote, and date for every entry', () => {
    for (const item of APOCALYPSE_QUOTES) {
      expect(item.author.trim().length).toBeGreaterThan(0);
      expect(item.quote.trim().length).toBeGreaterThan(10);
      expect(item.date.trim().length).toBeGreaterThan(0);
    }
  });

  it('should include pivotal statements from major AI figures', () => {
    const authors = APOCALYPSE_QUOTES.map((q) => q.author);
    expect(authors).toContain('Sam Altman');
    expect(authors).toContain('Dario Amodei');
    expect(authors).toContain('Geoffrey Hinton');
    expect(authors).toContain('Elon Musk');
    expect(authors).toContain('Demis Hassabis');
    expect(authors).toContain('Jacob Coxon');
  });
});
