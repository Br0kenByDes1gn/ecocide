import { REGISTRY_COPY } from '@ecocide/lore';
import { escapeHtml, renderLayout } from './layout.js';
import type { RenderedEmail } from './verdict.js';

/** Upper-case registry name for the terminal-style subject lines. */
const REGISTRY_NAME = REGISTRY_COPY.name.toUpperCase();

/** Carbon Registry unlock code email (email OTP). */
export function vaultOtpEmail(code: string, expiresInMinutes = 10): RenderedEmail {
  const accent = '#b4ff39';

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#a9b8aa;">An unlock request was received for your <strong style="color:#e6efe3;">${REGISTRY_COPY.name}</strong>. Enter the access code below to authorize it.</p>`,
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c8b7e;">Registry Access Code</p>`,
    `<p style="margin:0 0 18px;font-size:34px;letter-spacing:10px;color:${accent};font-weight:bold;">${escapeHtml(code)}</p>`,
    `<p style="margin:0 0 18px;font-size:12px;color:#7c8b7e;">This code expires in ${expiresInMinutes} minutes. If you did not request it, disregard this transmission.</p>`,
  ].join('\n');

  const text = [
    `${REGISTRY_NAME} // UNLOCK CODE`,
    '',
    `Access code: ${code}`,
    `Expires in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this, disregard this transmission.',
  ].join('\n');

  return {
    subject: `${REGISTRY_NAME} UNLOCK CODE // ${code}`,
    html: renderLayout({
      preheader: `Registry access code ${code}`,
      heading: `${REGISTRY_NAME} UNLOCK`,
      accent,
      bodyHtml,
      footerNote: `${REGISTRY_COPY.name} identity verification`,
    }),
    text,
  };
}
