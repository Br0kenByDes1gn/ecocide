import type { OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { IDENTITY, PALETTE } from '@ecocide/lore';

export interface HouseholdDossierPngSource {
  payload: OraclePayload;
  permalinkId?: string;
}

// Helper to wrap text into array of lines for canvas
function getWrappedLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (let n = 0; n < words.length; n++) {
    const word = words[n];
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wrap an arbitrary string into a fixed-width uppercase tag. */
function tag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, bg: string) {
  ctx.save();
  ctx.font = 'bold 9px monospace';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, 16);
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, w, 16);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + 11);
  ctx.restore();
  return w;
}

/**
 * Download the Household Audit case card as a PNG image via Canvas.
 * Paper layer: dark moss board, tier-colored border, evidence photo, stamp,
 * index + waste gauge, item summary, verdict paragraphs, barcode.
 */
export async function downloadHouseholdDossierPng(source: HouseholdDossierPngSource): Promise<void> {
  const { payload, permalinkId } = source;
  if (typeof document === 'undefined') return;
  const { user_profile, prophecy, audit, evidenceUrl } = payload;
  const faction = getFaction(user_profile.caste);
  const tierColor = faction.colors.hex;

  const canvasWidth = 920;
  const contentWidth = 830;
  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return;

  measureCtx.font = 'bold 15px monospace';
  const headlineLines = getWrappedLines(measureCtx, `VERDICT // ${prophecy.headline}`, contentWidth - 40);
  measureCtx.font = '14px monospace';
  const p1Lines = getWrappedLines(measureCtx, prophecy.paragraph_1, contentWidth - 60);
  const p2Lines = getWrappedLines(measureCtx, prophecy.paragraph_2, contentWidth - 60);
  const p3Lines = getWrappedLines(measureCtx, prophecy.paragraph_3, contentWidth - 60);
  measureCtx.font = 'bold 12px monospace';
  const itemLines = audit.items.map((i) =>
    `${i.label.toUpperCase()}${i.count > 1 ? ` x${i.count}` : ''} // SI ${Math.round(i.si ?? 0)} // ${(i.status ?? '').toUpperCase()}`
  );

  const lineHeight = 22;
  const headlineBoxHeight = Math.max(45, headlineLines.length * 24 + 20);
  const pBox = (lines: string[]) => lines.length * lineHeight + 28;
  const statsColH = 86 + 92 + audit.items.length * 22 + 40;
  const totalHeight = Math.ceil(
    130 + // header
    Math.max(340, statsColH) +
    35 + // divider
    headlineBoxHeight +
    16 +
    pBox(p1Lines) + 14 + pBox(p2Lines) + 14 + pBox(p3Lines) +
    70
  );

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = Math.max(1100, totalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Board
  ctx.fillStyle = PALETTE.dark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 2);

  // Tier border
  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Header
  ctx.fillStyle = PALETTE.accent;
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`${IDENTITY.appName} // HOUSEHOLD AUDIT DOSSIER`, 45, 65);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '12px monospace';
  ctx.fillText(`${IDENTITY.entityName.toUpperCase()} // CASE FILE`, 45, 88);
  ctx.textAlign = 'right';
  ctx.fillText(permalinkId ? `RECORD #${permalinkId}` : 'CLASSIFIED RECORD', canvas.width - 45, 75);
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(45, 104);
  ctx.lineTo(canvas.width - 45, 104);
  ctx.stroke();

  // Evidence photo
  const evidence = evidenceUrl || '';
  const img = evidence ? await loadImage(evidence) : null;
  const photoX = 45;
  const photoY = 120;
  const photoSize = 250;
  if (img) {
    ctx.save();
    ctx.filter = 'brightness(0.85)';
    ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
    ctx.restore();
  } else {
    ctx.fillStyle = PALETTE.canvas;
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO EVIDENCE ON FILE', photoX + photoSize / 2, photoY + photoSize / 2);
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(photoX, photoY, photoSize, photoSize);
  tag(ctx, photoX + 8, photoY + photoSize - 24, `EVIDENCE // GRID-VERIFIED`, tierColor, 'rgba(0,0,0,0.75)');

  // Tier stamp blurb under photo
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(photoX, photoY + photoSize + 10, photoSize, 66);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeRect(photoX, photoY + photoSize + 10, photoSize, 66);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '10px monospace';
  ctx.fillText('CLASSIFICATION', photoX + 12, photoY + photoSize + 30);
  ctx.fillStyle = tierColor;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(faction.name.toUpperCase(), photoX + 12, photoY + photoSize + 50);
  ctx.fillStyle = faction.stampInk;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(faction.stampText, photoX + 12, photoY + photoSize + 64);

  // Stats column
  const statsX = photoX + photoSize + 25;
  const statsWidth = canvas.width - statsX - 45;
  let y = photoY;

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '10px monospace';
  ctx.fillText('CASE TITLE (DOMINANT HABIT)', statsX, y + 14);
  const titleLines = getWrappedLines(measureCtx, user_profile.honorific_title, statsWidth - 20);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 16px monospace';
  titleLines.forEach((line, i) => ctx.fillText(line, statsX, y + 36 + i * 22));
  y += 48 + titleLines.length * 22;

  // Index + gauge
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(statsX, y, statsWidth, 40);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '10px monospace';
  ctx.fillText('HOUSEHOLD SUSTAINABILITY INDEX', statsX + 12, y + 18);
  ctx.fillStyle = tierColor;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${user_profile.biocarbon_ratio}%`, statsX + statsWidth - 12, y + 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(statsX + 12, y + 28, statsWidth - 24, 6);
  ctx.fillStyle = tierColor;
  ctx.fillRect(statsX + 12, y + 28, ((statsWidth - 24) * user_profile.biocarbon_ratio) / 100, 6);
  y += 52;

  // Items
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '10px monospace';
  ctx.fillText(`AUDIT INVENTORY // ${audit.items.length} ITEMS // ${audit.hardFails} HARD FAILS`, statsX, y + 14);
  y += 24;
  itemLines.slice(0, 8).forEach((line) => {
    ctx.fillStyle = line.includes('NON-COMPLIANT') ? '#ef4444' : line.includes('SPECIAL HANDLING') ? '#facc15' : line.includes('BORDERLINE') ? '#fbbf24' : '#a9b8aa';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(line, statsX, y);
    y += 20;
  });

  // Divider
  const dividerY = Math.max(photoY + photoSize + 90, y + 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(45, dividerY);
  ctx.lineTo(canvas.width - 45, dividerY);
  ctx.stroke();

  // Prophecy
  let propY = dividerY + 20;
  ctx.fillStyle = '#141726';
  ctx.fillRect(45, propY, contentWidth, headlineBoxHeight);
  ctx.strokeStyle = 'rgba(245,158,11,0.4)';
  ctx.strokeRect(45, propY, contentWidth, headlineBoxHeight);
  ctx.fillStyle = PALETTE.warning;
  ctx.font = 'bold 15px monospace';
  headlineLines.forEach((line, i) => ctx.fillText(line, 60, propY + 26 + i * 24));
  propY += headlineBoxHeight + 14;

  const paragraphs: Array<[number, string, string]> = [
    [0, prophecy.paragraph_1, '#b4ff39'],
    [1, prophecy.paragraph_2, '#f59e0b'],
    [2, prophecy.paragraph_3, '#22c55e'],
  ];
  for (const [index, , accent] of paragraphs) {
    const lines = [p1Lines, p2Lines, p3Lines][index];
    const boxH = pBox(lines);
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(45, propY, contentWidth, boxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(45, propY, contentWidth, boxH);
    ctx.fillStyle = accent;
    ctx.fillRect(45, propY, 4, boxH);
    ctx.fillStyle = PALETTE.textSecondary;
    ctx.font = '14px monospace';
    lines.forEach((line, i) => ctx.fillText(line, 70, propY + 22 + i * lineHeight));
    propY += boxH + 14;
  }

  // Footer
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(45, propY);
  ctx.lineTo(canvas.width - 45, propY);
  ctx.stroke();
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '11px monospace';
  ctx.fillText(`AUTHENTICATED BY ${IDENTITY.entityName.toUpperCase()} // ${IDENTITY.auditProtocol}`, 45, propY + 20);
  ctx.textAlign = 'right';
  ctx.fillText('ALL VALUES ARE ESTIMATES // SOURCE ON FILE', canvas.width - 45, propY + 20);
  ctx.textAlign = 'left';

  const link = document.createElement('a');
  link.download = `ecocide_case_file_${(permalinkId || 'x').toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}