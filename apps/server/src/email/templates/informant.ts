import type { CitizenRecord } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { INFORMANT_COPY } from '@ecocide/lore';
import { escapeHtml, renderLayout } from './layout.js';
import type { RenderedEmail } from './verdict.js';

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#cbd5e1;">${escapeHtml(text)}</p>`;
}

/**
 * The "anonymous tip" notification delivered to the household a verdict was
 * filed against. It names the classification the Arbiter settled on and points
 * at the verdict page, where — and only there, with this address — the household
 * may claim or appeal.
 */
export function informantTipEmail(record: CitizenRecord, baseUrl: string): RenderedEmail {
  const profile = record.profile;
  const prophecy = record.prophecy;
  const permalink = `${baseUrl}/arbitration/${record.id}`;
  const factionName = getFaction(profile.caste).name;
  const stamp = getFaction(profile.caste).stampText;

  const subject = INFORMANT_COPY.email.subject;

  const bodyHtml = [
    paragraph(INFORMANT_COPY.email.intro),
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#94a3b8;">Your household <strong style="color:#e2e8f0;">${escapeHtml(profile.honorific_title)}</strong> has been classified <strong style="color:#b4ff39;">${escapeHtml(factionName)}</strong> — <em>${escapeHtml(stamp)}</em> — with a Household Sustainability Index of <strong style="color:#b4ff39;">${profile.biocarbon_ratio}%</strong>.</p>`,
    `<hr style="border:none;border-top:1px solid #1e293b;margin:18px 0;" />`,
    `<h2 style="margin:0 0 14px;font-size:15px;letter-spacing:1px;color:#b4ff39;">${escapeHtml(prophecy.headline)}</h2>`,
    paragraph(prophecy.paragraph_1),
    `<p style="margin:18px 0;font-size:12px;line-height:1.7;color:#94a3b8;">${escapeHtml(INFORMANT_COPY.email.note)}</p>`,
    `<p style="margin:22px 0 0;"><a href="${permalink}" style="display:inline-block;padding:11px 20px;background:#b4ff39;color:#04121a;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;border-radius:6px;">VIEW YOUR VERDICT</a></p>`,
  ].join('\n');

  const text = [
    subject,
    '',
    INFORMANT_COPY.email.intro,
    '',
    `Classification: ${factionName} — ${stamp}`,
    `Household Sustainability Index: ${profile.biocarbon_ratio}%`,
    '',
    prophecy.headline,
    prophecy.paragraph_1,
    '',
    INFORMANT_COPY.email.note,
    '',
    `Your verdict: ${permalink}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      preheader: INFORMANT_COPY.email.preheader,
      heading: INFORMANT_COPY.email.heading,
      accent: '#b4ff39',
      bodyHtml,
      footerNote: `${INFORMANT_COPY.email.footerNote} · Dossier ${record.id}`,
    }),
    text,
  };
}
