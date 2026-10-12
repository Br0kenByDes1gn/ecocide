import { escapeHtml, renderLayout } from './layout.js';
import type { RenderedEmail } from './verdict.js';

/** Asset Vault unlock code email (email OTP). */
export function vaultOtpEmail(code: string, expiresInMinutes = 10): RenderedEmail {
  const accent = '#22d3ee';

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#94a3b8;">An unlock request was received for your <strong style="color:#e2e8f0;">Asset Vault</strong>. Enter the access code below to authorize it.</p>`,
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Vault Access Code</p>`,
    `<p style="margin:0 0 18px;font-size:34px;letter-spacing:10px;color:${accent};font-weight:bold;">${escapeHtml(code)}</p>`,
    `<p style="margin:0 0 18px;font-size:12px;color:#64748b;">This code expires in ${expiresInMinutes} minutes. If you did not request it, disregard this transmission.</p>`,
  ].join('\n');

  const text = [
    'ASSET VAULT // UNLOCK CODE',
    '',
    `Access code: ${code}`,
    `Expires in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this, disregard this transmission.',
  ].join('\n');

  return {
    subject: `ASSET VAULT UNLOCK CODE // ${code}`,
    html: renderLayout({
      preheader: `Vault access code ${code}`,
      heading: 'ASSET VAULT UNLOCK',
      accent,
      bodyHtml,
      footerNote: 'Asset Vault identity verification',
    }),
    text,
  };
}
