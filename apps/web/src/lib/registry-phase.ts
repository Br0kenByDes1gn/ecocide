/**
 * What a registry-backed screen should render, decided in one place.
 *
 * Both `/registry` and `/injunction` walk the same ladder — waiting for the
 * session, then for the account, then the record itself — and they used to
 * decide it inline with better-auth's `isPending`. That flag is not "the app has
 * not loaded yet": the session atom sets it to `data === null` on *every* fetch,
 * so for a logged-out visitor it flips back to true on any background refetch
 * (better-auth refetches the session when a tab becomes visible again). Reading
 * it as a mount gate tore the unlock form out of the tree on a tab switch and
 * threw away the email and the code the citizen had just typed.
 *
 * So the gate is `sessionReady` — "the session has resolved at least once in
 * this document" — and it never goes back. A refetch is invisible here.
 */
export type RegistryPhase =
  /** No session answer yet: the only state worth blocking the screen for. */
  | 'loading'
  /** Nobody is signed in: show the email-OTP unlock form. */
  | 'locked'
  /** Signed in, account still on its way: a spinner, briefly. */
  | 'hydrating'
  /** Signed in, but the account fetch failed: say so, and offer a retry. */
  | 'failed'
  /** Signed in with the account in hand. */
  | 'ready';

export interface RegistryPhaseInput {
  /** True once the session has resolved at least once (never un-set). */
  sessionReady: boolean;
  /** The session, or null/undefined while there is none. */
  session: unknown;
  /** The registry account record, or null until it loads. */
  vault: unknown;
  /** A failure from the account fetch, if the last attempt failed. */
  vaultError?: string | null;
}

export function registryPhase({
  sessionReady,
  session,
  vault,
  vaultError = null,
}: RegistryPhaseInput): RegistryPhase {
  // Only the *first* resolution may block: a background refetch must never
  // unmount whatever is on screen.
  if (!sessionReady) return 'loading';
  if (!session && !vault) return 'locked';
  if (vault) return 'ready';
  // Signed in without a record yet: distinguish "still coming" from "gave up",
  // so a failed fetch is a retryable state rather than an endless spinner.
  return vaultError ? 'failed' : 'hydrating';
}
