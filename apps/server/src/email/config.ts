/**
 * SMTP / mail configuration, sourced entirely from the environment so the
 * feature is disabled (and falls back to a logging transport) when unset.
 */

export interface MailConfig {
  /** True when SMTP_HOST is configured; otherwise the mailer logs instead of sending. */
  enabled: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
  /** Public base URL used to build permalinks in emails. */
  appBaseUrl: string;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const host = env.SMTP_HOST?.trim() || undefined;
  const port = Number(env.SMTP_PORT) || 587;
  const user = env.SMTP_USER?.trim() || undefined;
  const pass = env.SMTP_PASS || undefined;

  return {
    enabled: Boolean(host),
    host,
    port,
    secure: envBool(env.SMTP_SECURE, port === 465),
    user,
    pass,
    from: env.MAIL_FROM?.trim() || 'AI Supreme Arbiter <arbiter@ecocide.local>',
    replyTo: env.MAIL_REPLY_TO?.trim() || undefined,
    appBaseUrl: (env.APP_BASE_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, ''),
  };
}
