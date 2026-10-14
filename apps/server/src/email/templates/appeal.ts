import type { CitizenAppeal, CitizenRecord } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { escapeHtml, renderLayout } from './layout.js';
import type { RenderedEmail } from './verdict.js';

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#d5e0d2;">${escapeHtml(text)}</p>`;
}

/** Appeal-ruling notification email. */
export function appealRulingEmail(
  record: CitizenRecord,
  appeal: CitizenAppeal,
  baseUrl: string
): RenderedEmail {
  const accepted = appeal.accepted;
  const accent = accepted ? '#22c55e' : '#ef4444';
  const verdictWord = accepted ? 'GRANTED' : 'DENIED';
  const permalink = `${baseUrl}/appeals/${record.id}`;
  const prevName = getFaction(appeal.casteBefore).name;
  const newName = appeal.newCaste ? getFaction(appeal.newCaste).name : null;

  const subject = `APPEAL RULING // ${verdictWord} — ${prevName}`;

  const sections: string[] = [
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#a9b8aa;">Your appeal has been reviewed. Ruling: <strong style="color:${accent};">${verdictWord}</strong>.</p>`,
    `<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7c8b7e;">Ruling Reason</p>`,
    paragraph(appeal.reason),
  ];

  if (accepted && appeal.newCaste && newName) {
    sections.push(`<hr style="border:none;border-top:1px solid #223026;margin:18px 0;" />`);
    sections.push(
      `<p style="margin:0 0 18px;font-size:13px;color:#a9b8aa;">Re-classification: <strong style="color:${accent};">${escapeHtml(prevName)} → ${escapeHtml(newName)}</strong>${appeal.newHonorificTitle ? ` — <em style="color:#e6efe3;">${escapeHtml(appeal.newHonorificTitle)}</em>` : ''}.</p>`
    );
    if (appeal.headline) {
      sections.push(`<h2 style="margin:0 0 14px;font-size:15px;letter-spacing:1px;color:${accent};">${escapeHtml(appeal.headline)}</h2>`);
    }
    if (appeal.scripture) {
      sections.push(...appeal.scripture.map(paragraph));
    }
    sections.push(
      `<p style="margin:14px 0 0;font-size:12px;color:#7c8b7e;">The re-classification is applied to your dossier once you request a re-assessment.</p>`
    );
  }

  sections.push(
    `<p style="margin:22px 0 0;"><a href="${permalink}" style="display:inline-block;padding:11px 20px;background:${accent};color:#080b08;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;border-radius:6px;">VIEW APPEAL RECORD</a></p>`
  );

  const textLines = [
    `APPEAL RULING // ${verdictWord} — ${prevName}`,
    '',
    'Ruling reason:',
    appeal.reason,
  ];
  if (accepted && appeal.newCaste && newName) {
    textLines.push(
      '',
      `Re-classification: ${prevName} -> ${newName}${appeal.newHonorificTitle ? ` (${appeal.newHonorificTitle})` : ''}`
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
