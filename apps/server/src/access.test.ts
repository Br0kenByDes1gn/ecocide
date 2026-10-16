import { describe, expect, it } from 'vitest';
import { dossierAccessError } from './access.js';

/**
 * The one rule that keeps a tipped verdict locked to the accused household.
 * The claim, the appeal filing and the appeal fee all consult this predicate, so
 * its cases are pinned here.
 */
describe('dossierAccessError', () => {
  it('imposes nothing on an unattributed verdict', () => {
    expect(dossierAccessError(null, null)).toBeNull();
    expect(dossierAccessError(undefined, 'anyone@example.com')).toBeNull();
    expect(dossierAccessError('', undefined)).toBeNull();
  });

  it('lets the attributed household through, matching case and whitespace', () => {
    expect(dossierAccessError('accused@example.com', 'accused@example.com')).toBeNull();
    expect(dossierAccessError('Accused@Example.com', ' accused@example.com ')).toBeNull();
  });

  it('refuses a different address', () => {
    const refusal = dossierAccessError('accused@example.com', 'someone-else@example.com');
    expect(refusal?.status).toBe(403);
    expect(refusal?.code).toBe('not_attributed_party');
  });

  it('refuses an unauthenticated caller outright', () => {
    const refusal = dossierAccessError('accused@example.com', null);
    expect(refusal?.status).toBe(403);
    expect(refusal?.code).toBe('not_attributed_party');
  });
});
