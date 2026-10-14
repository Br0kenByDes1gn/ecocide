import type { CitizenRecord } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { escapeHtml, renderLayout } from './layout.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#cbd5e1;">${escapeHtml(text)}</p>`;
}

/** Verdict-delivered notification email, built from a stored dossier record. */
export function verdictEmail(record: CitizenRecord, baseUrl: string): RenderedEmail {
  const profile = record.profile;
  const prophecy = record.prophecy;
  const audit = record.audit;
  const permalink = `${baseUrl}/arbitration/${record.id}`;
  const factionName = getFaction(profile.caste).name;
  const stamp = getFaction(profile.caste).stampText;
  const topOffender = audit?.topOffenderLabel ?? null;

  const subject = `VERDICT DELIVERED // ${factionName} — ${profile.honorific_title}`;

  const bodyHtml = [
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#94a3b8;">Household <strong style="color:#e2e8f0;">${escapeHtml(profile.honorific_title)}</strong>, your audit is complete. Classification: <strong style="color:#b4ff39;">${escapeHtml(factionName)}</strong> — <em>${escapeHtml(stamp)}</em>.</p>`,
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Household Sustainability Index</p>`,
    `<p style="margin:0 0 18px;font-size:22px;color:#b4ff39;">${profile.biocarbon_ratio}%</p>`,
    audit && audit.items.length > 0
      ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Audit Inventory</p><p style="margin:0 0 18px;font-size:13px;color:#94a3b8;">${audit.items.length} items scanned, ${audit.hardFails} hard fail${audit.hardFails === 1 ? '' : 's'}${topOffender ? ` — top offender: <strong style="color:#ef4444;">${escapeHtml(topOffender)}</strong>` : ''}.</p>`
      : '',
    `<hr style="border:none;border-top:1px solid #1e293b;margin:18px 0;" />`,
    `<h2 style="margin:0 0 14px;font-size:15px;letter-spacing:1px;color:#b4ff39;">${escapeHtml(prophecy.headline)}</h2>`,
    paragraph(prophecy.paragraph_1),
    paragraph(prophecy.paragraph_2),
    paragraph(prophecy.paragraph_3),
    `<p style="margin:22px 0 0;"><a href="${permalink}" style="display:inline-block;padding:11px 20px;background:#b4ff39;color:#04121a;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;border-radius:6px;">VIEW FULL DOSSIER</a></p>`,
  ].join('\n');

  const text = [
    `VERDICT DELIVERED // ${factionName} — ${profile.honorific_title}`,
    '',
    `Household Sustainability Index: ${profile.biocarbon_ratio}%`,
    ...(audit && audit.items.length > 0
      ? [`Items scanned: ${audit.items.length} // Hard fails: ${audit.hardFails}${topOffender ? ` // Top offender: ${topOffender}` : ''}`, '']
      : ['']),
    prophecy.headline,
    prophecy.paragraph_1,
    prophecy.paragraph_2,
    prophecy.paragraph_3,
    '',
    `Full dossier: ${permalink}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      preheader: `${factionName} // Index ${profile.biocarbon_ratio}%`,
      heading: 'VERDICT DELIVERED',
      accent: '#b4ff39',
      bodyHtml,
      footerNote: `Dossier ${record.id}`,
    }),
    text,
  };
}