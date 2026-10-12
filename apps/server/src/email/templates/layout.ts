export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  preheader?: string;
  heading: string;
  accent?: string;
  bodyHtml: string;
  footerNote?: string;
}

/**
 * Minimal, inline-styled HTML shell for transactional emails. Email clients
 * have poor CSS support, so everything is inlined and table-free.
 */
export function renderLayout(options: LayoutOptions): string {
  const accent = options.accent || '#22d3ee';
  const preheader = options.preheader
    ? `<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(options.preheader)}</span>`
    : '';

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#05070d;color:#e5e7eb;font-family:'Courier New',Courier,monospace;">
    ${preheader}
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid ${accent}55;background:#0a0f1a;border-radius:10px;overflow:hidden;box-shadow:0 0 40px ${accent}1a;">
        <div style="padding:14px 22px;border-bottom:1px solid ${accent}33;background:#080c15;">
          <span style="color:${accent};font-size:12px;letter-spacing:3px;text-transform:uppercase;">AI SUPREME ARBITER // MAINFRAME</span>
        </div>
        <div style="padding:26px 22px;">
          <h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;color:${accent};letter-spacing:1px;">${escapeHtml(options.heading)}</h1>
          ${options.bodyHtml}
        </div>
        <div style="padding:14px 22px;border-top:1px solid ${accent}22;background:#080c15;color:#64748b;font-size:11px;line-height:1.6;">
          ${options.footerNote ? `${escapeHtml(options.footerNote)}<br/>` : ''}
          This is an automated transmission. Do not reply to this address.
        </div>
      </div>
    </div>
  </body>
</html>`;
}
