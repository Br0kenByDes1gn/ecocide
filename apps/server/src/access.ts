/**
 * Who may act on a verdict.
 *
 * A verdict that a tipster filed against another household (`subject_email`) is
 * locked to that household: only a session signed in with the accused address
 * may claim or appeal it. This predicate is the single rule — the claim (`/link`),
 * the appeal filing and the appeal fee all consult it, so they cannot drift.
 *
 * Unattributed verdicts keep the old behavior: a null `subjectEmail` imposes no
 * restriction (the caller's own session checks still apply).
 */

export interface DossierAccessError {
  status: 403;
  code: 'not_attributed_party';
  error: string;
}

/** Case/whitespace-insensitive address comparison (emails are case-folded). */
function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Returns the refusal when the caller may not act on a verdict, or `null` when
 * they may. `subjectEmail` is the dossier's attributed address (null when the
 * verdict is not attributed); `userEmail` is the signed-in citizen's address
 * (null when unauthenticated — an attributed verdict then always refuses).
 */
export function dossierAccessError(
  subjectEmail: string | null | undefined,
  userEmail: string | null | undefined
): DossierAccessError | null {
  if (!subjectEmail) return null;
  if (userEmail && sameAddress(subjectEmail, userEmail)) return null;
  return {
    status: 403,
    code: 'not_attributed_party',
    error:
      'This verdict was submitted as evidence against another household — only that address may claim or appeal it.',
  };
}
