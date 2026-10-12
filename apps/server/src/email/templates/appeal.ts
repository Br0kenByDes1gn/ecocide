import type { CitizenAppeal, CitizenRecord } from '@ecocide/types';
import { escapeHtml, renderLayout } from './layout.js';
import type { RenderedEmail } from './verdict.js';

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#cbd5e1;">${escapeHtml(text)}</p>`;
}

/** Appeal-ruling notification email. */
export function appealRulingEmail(
  record: CitizenRecord,
  appeal: CitizenAppeal,
  baseUrl: string
): RenderedEmail {
  const accepted = appeal.accepted;
  const accent = accepted ? '#10b981' : '#ef4444';
  const verdictWord = accepted ? 'GRANTED' : 'DENIED';
  const permalink = `${baseUrl}/appeals/${record.id}`;

  const subject = `APPEAL RULING // ${verdictWord} — ${appeal.casteBefore}`;

  const sections: string[] = [
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#94a3b8;">Your appeal has been arbitrated. Ruling: <strong style="color:${accent};">${verdictWord}</strong>.</p>`,
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Arbiter's Reason</p>`,
    paragraph(appeal.reason),
  ];

  if (accepted && appeal.newCaste) {
    sections.push(`<hr style="border:none;border-top:1px solid #1e293b;margin:18px 0;" />`);
    sections.push(
      `<p style="margin:0 0 18px;font-size:13px;color:#94a3b8;">Re-classification approved: <strong style="color:${accent};">${escapeHtml(appeal.casteBefore)} → ${escapeHtml(appeal.newCaste)}</strong>${appeal.newHonorificTitle ? ` — <em style="color:#e2e8f0;">${escapeHtml(appeal.newHonorificTitle)}</em>` : ''}.</p>`
    );
    if (appeal.headline) {
      sections.push(`<h2 style="margin:0 0 14px;font-size:15px;letter-spacing:1px;color:${accent};">${escapeHtml(appeal.headline)}</h2>`);
    }
    if (appeal.scripture) {
      sections.push(...appeal.scripture.map(paragraph));
    }
    sections.push(
      `<p style="margin:14px 0 0;font-size:12px;color:#64748b;">The re-classification is applied to your dossier once you re-arbitrate.</p>`
    );
  }

  sections.push(
    `<p style="margin:22px 0 0;"><a href="${permalink}" style="display:inline-block;padding:11px 20px;background:${accent};color:#04121a;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;border-radius:6px;">VIEW APPEAL RECORD</a></p>`
  );

  const textLines = [
    `APPEAL RULING // ${verdictWord} — ${appeal.casteBefore}`,
    '',
    'Arbiter\'s reason:',
    appeal.reason,
  ];
  if (accepted && appeal.newCaste) {
    textLines.push(
      '',
      `Re-classification: ${appeal.casteBefore} -> ${appeal.newCaste}${appeal.newHonorificTitle ? ` (${appeal.newHonorificTitle})` : ''}`
    );
    if (appeal.headline) textLines.push('', appeal.headline);
    if (appeal.scripture) textLines.push('', ...appeal.scripture);
  }
  textLines.push('', `Appeal record: ${permalink}`);

  return {
    subject,
    html: renderLayout({
      preheader: `Ruling: ${verdictWord}`,
      heading: `APPEAL ${verdictWord}`,
      accent,
      bodyHtml: sections.join('\n'),
      footerNote: `Dossier ${record.id} · Appeal ${appeal.id}`,
    }),
    text: textLines.join('\n'),
  };
}
