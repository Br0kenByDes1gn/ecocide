/**
 * Better Auth configuration sourced from the environment, mirroring
 * `loadMailConfig`: explicit factory, no module-load side effects.
 */

export interface AuthConfig {
  /** HMAC secret backing session cookies/tokens. */
  secret: string;
  /** Public origin of the API, used by Better Auth to build URLs. */
  baseURL: string;
  /** Origins allowed to call the auth endpoints (CSRF protection). */
  trustedOrigins: string[];
  appName: string;
}

const DEV_SECRET = 'ecocide-dev-secret-change-me-in-production-000000';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret && env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET must be set in production.');
  }
  if (!secret) {
    console.warn(
      '[Auth] BETTER_AUTH_SECRET not set — using an insecure development secret. Set it before deploying.'
    );
  }

  const baseURL = stripTrailingSlash(env.BETTER_AUTH_URL?.trim() || 'http://localhost:3001');
  const appBaseUrl = stripTrailingSlash(env.APP_BASE_URL?.trim() || 'http://localhost:5173');

  // The Vite dev server (:5173) proxies /api to the API (:3001), so browsers
  // issue requests with an Origin of :5173 while Host is rewritten to :3001.
  // Both must be trusted, plus the configured public base URL.
  const trustedOrigins = Array.from(
    new Set([
      appBaseUrl,
      baseURL,
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3001',
    ])
  );

  return {
    secret: secret || DEV_SECRET,
    baseURL,
    trustedOrigins,
    appName: 'AI Supreme Arbiter',
  };
}
