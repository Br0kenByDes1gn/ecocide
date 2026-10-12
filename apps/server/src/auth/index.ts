import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, emailOTP } from 'better-auth/plugins';
import type { DbConnection } from '../db/client.js';
import { account, session, user, verification } from '../db/schema.js';
import type { JobDispatcher } from '../jobs/index.js';
import type { AuthConfig } from './config.js';

/**
 * Drizzle model map for Better Auth. Keys are Better Auth's logical model names
 * (`user`, `session`, `account`, `verification`); values are the Drizzle tables
 * whose column keys match Better Auth's logical field names (camelCase).
 */
const authSchema = { user, session, account, verification };

export interface CreateAuthOptions {
  db: DbConnection['db'];
  jobs: JobDispatcher;
  config: AuthConfig;
}

/**
 * Build the Better Auth instance (explicit factory, like `initDb` /
 * `createRepositories`). Email + password is disabled entirely: the only way in
 * is an email OTP, which doubles as the Asset Vault unlock.
 */
export function createAuth(options: CreateAuthOptions) {
  const { config } = options;

  return betterAuth({
    appName: config.appName,
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(options.db, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    // No passwords. Email OTP is the sole authentication factor.
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh once per day
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 60 * 10, // 10 minutes
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // New emails are auto-registered on first sign-in (the vault unlock).
        disableSignUp: false,
        resendStrategy: 'rotate',
        rateLimit: { window: 60, max: 5 },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return;
          // Without SMTP the code would otherwise be unrecoverable locally.
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Auth] Vault unlock OTP for ${email}: ${otp}`);
          }
          // Fire-and-forget so the endpoint response time does not leak whether
          // the address exists (and stays fast when SMTP is slow).
          void options.jobs.enqueue('email:otp', { to: email, code: otp }).catch((err) => {
            console.error('[Auth] Failed to enqueue OTP email:', err?.message || err);
          });
        },
      }),
      // Lets native/Capacitor shells authenticate with `Authorization: Bearer`.
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
