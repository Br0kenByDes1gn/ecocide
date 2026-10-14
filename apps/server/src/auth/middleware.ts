import type { MiddlewareHandler } from 'hono';
import type { Auth } from './index.js';

type SessionResult = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type AuthUser = SessionResult['user'];
export type AuthSession = SessionResult['session'];

/** Hono context variables populated by {@link requireSession}. */
export interface AuthVariables {
  user: AuthUser;
  session: AuthSession;
}

/**
 * Gate a route behind a valid vault session. Reads the Better Auth session from
 * the request — the `session_token` cookie on web, or an
 * `Authorization: Bearer <token>` header on native shells (via the bearer
 * plugin) — and 401s when absent.
 */
export function requireSession(auth: Auth): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!result) {
      return c.json({ error: 'Carbon Registry locked — authentication required' }, 401);
    }
    c.set('user', result.user);
    c.set('session', result.session);
    await next();
  };
}
