import nodemailer, { type Transporter } from 'nodemailer';
import type { MailConfig } from './config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  /** False when SMTP is unconfigured (messages are logged, not sent). */
  readonly enabled: boolean;
  /** Sends a message; resolves with the provider message id when available. */
  send(message: EmailMessage): Promise<string | undefined>;
  /** Best-effort SMTP connectivity check; never throws. */
  verify(): Promise<boolean>;
  close(): void;
}

/**
 * Explicit mailer factory (mirrors `initDb` / `createRepositories`). When SMTP
 * is not configured it uses nodemailer's `jsonTransport`, so development and
 * tests exercise the full send path without a real server.
 */
export function createMailer(config: MailConfig): Mailer {
  const transporter: Transporter = config.enabled
    ? nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.pass } : undefined,
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      })
    : nodemailer.createTransport({ jsonTransport: true });

  return {
    enabled: config.enabled,

    async send(message: EmailMessage): Promise<string | undefined> {
      const info = await transporter.sendMail({
        from: config.from,
        to: message.to,
        replyTo: config.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (config.enabled) {
        console.log(`[Mailer] Sent "${message.subject}" to ${message.to} (${info.messageId})`);
      } else {
        console.log(`[Mailer] SMTP disabled — logged "${message.subject}" for ${message.to}`);
      }
      return info.messageId;
    },

    async verify(): Promise<boolean> {
      if (!config.enabled) return true;
      try {
        await transporter.verify();
        console.log(`[Mailer] SMTP connection verified (${config.host}:${config.port}).`);
        return true;
      } catch (err: any) {
        console.warn('[Mailer] SMTP verification failed:', err?.message || err);
        return false;
      }
    },

    close() {
      transporter.close();
    },
  };
}
