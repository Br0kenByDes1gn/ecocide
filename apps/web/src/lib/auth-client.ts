import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

/**
 * Asset Vault auth client.
 *
 * Web relies on Better Auth's HttpOnly `session_token` cookie (sent with
 * `credentials: 'include'`, same-origin through the dev proxy / prod static
 * server). Native/Capacitor shells instead hold the token returned by
 * `signIn.emailOtp` in secure native storage and hand it to `setAuthToken`;
 * the custom fetch then attaches it as `Authorization: Bearer`.
 *
 * The token is intentionally kept in memory only — never in `localStorage` — so
 * XSS cannot exfiltrate it.
 */
let bearerToken: string | null = null;

export function setAuthToken(token: string | null): void {
  bearerToken = token;
}

const authFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (bearerToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${bearerToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });
};

/** Fetch that carries the vault session (cookie on web, bearer on native). */
export { authFetch };

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: 'include',
    customFetchImpl: authFetch,
  },
});

export type VaultAuthClient = typeof authClient;
