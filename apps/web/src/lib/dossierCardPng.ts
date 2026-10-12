import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Prophecy, UserProfile } from '@ecocide/types';
import {
  getCasteLifeStageTitle,
  getCasteMemberTitle,
} from '@ecocide/types';
import { paragraphTopic, type ParagraphTopic } from '../lib/prophecyTopics';

export interface DossierPngSource {
  userProfile: UserProfile;
  prophecy: Prophecy;
  permalinkId?: string;
  portraitUrl: string;
  avatarUrl: string | null;
  activeView: 'snapshot' | 'avatar';
  /** Caste census unit number (same value shown on the live card). */
  unitId: number;
  /** Caste census population (same value shown on the live card). */
  population: number;
}

// Paragraph accent colors (cyan-400 / amber-400 / emerald-400) used for the
// topic icons in the downloaded badge, matching the live dossier paragraphs.
const PARA_ACCENT_HEX: readonly [string, string, string] = ['#22d3ee', '#fbbf24', '#34d399'];

/** Serializes a topic icon into an SVG <img>-loadable data URL. */
function topicIconSvg(icon: ParagraphTopic['Icon'], color: string, size = 20): string {
  const svg = renderToStaticMarkup(createElement(icon, { size, color }));
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadSvgIcon(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load paragraph topic icon'));
    img.src = src;
  });
}

// Helper to wrap text into array of lines for canvas
function getWrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let n = 0; n < words.length; n++) {
    const word = words[n];
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Download the full Citizen Dossier card as a PNG image via Canvas.
 * Shared by the static /citizen page and the animated /arbitration page.
 */
export async function downloadCitizenDossierPng(source: DossierPngSource): Promise<void> {
  const {
    userProfile,
    prophecy,
    permalinkId,
    portraitUrl,
    avatarUrl,
    activeView,
    unitId,
    population,
  } = source;

  // Preload the per-caste paragraph topic icons (same mapping as the live UI)
  const topics = [0, 1, 2].map((index) => paragraphTopic(index, userProfile.caste));
  const iconImages = await Promise.all(
    topics.map((topic, index) =>
      loadSvgIcon(topicIconSvg(topic.Icon, PARA_ACCENT_HEX[index]))
    )
  );
  if (typeof document === 'undefined') return;

  const casteMemberName = getCasteMemberTitle(userProfile.caste);
  const castePrimaryColor =
    userProfile.caste === 'Redundants'
      ? '#ef4444'
      : userProfile.caste === 'Tech Overlords'
      ? '#f59e0b'
      : userProfile.caste === 'Enforcers'
      ? '#f97316'
      : userProfile.caste === 'Untouchables'
      ? '#a855f7'
      : userProfile.caste === 'Free Spirits'
      ? '#10b981'
      : '#00f3ff';

  // Step 1: Pre-calculate wrapped text and canvas height with offscreen context
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return;

  const canvasWidth = 920;
  const contentWidth = 830; // ~45px padding on each side
  const statsWidth = 530; // Stats column next to 250px avatar

  // Pre-measure title
  measureCtx.font = 'bold 17px monospace';
  const titleLines = getWrappedLines(measureCtx, userProfile.honorific_title, statsWidth - 30);

  // Pre-measure equipped wealth
  measureCtx.font = 'bold 12px monospace';
  const wealthLines = getWrappedLines(measureCtx, userProfile.equipped_wealth, 230);

  // Pre-measure prophecy headline
  measureCtx.font = 'bold 15px monospace';
  const headlineLines = getWrappedLines(
    measureCtx,
    `ARBITER VERDICT // ${prophecy.headline}`,
    contentWidth - 40
  );

  // Pre-measure prophecy paragraphs
  measureCtx.font = '14px monospace';
  const p1Lines = getWrappedLines(measureCtx, prophecy.paragraph_1, contentWidth - 69);
  const p2Lines = getWrappedLines(measureCtx, prophecy.paragraph_2, contentWidth - 69);
  const p3Lines = getWrappedLines(measureCtx, prophecy.paragraph_3, contentWidth - 69);

  const lineHeight = 22;
  const p1BoxHeight = p1Lines.length * lineHeight + 28;
  const p2BoxHeight = p2Lines.length * lineHeight + 28;
  const p3BoxHeight = p3Lines.length * lineHeight + 28;

  const titleBoxHeight = 36 + titleLines.length * 24;
  const cardH = 58;
  const h1 = cardH;
  const h2 = cardH;
  const h3 = Math.max(cardH, 28 + wealthLines.length * 16);
  const h4 = cardH;
  const statsGridHeight = Math.max(h1, h2) + 10 + Math.max(h3, h4) + 14 + 20;
  const statsHeight = 36 + titleBoxHeight + 12 + statsGridHeight;
  const topBlockHeight = Math.max(340, statsHeight);
  const headlineBoxHeight = Math.max(45, headlineLines.length * 22 + 20);

  const totalHeight = Math.ceil(
    115 + // Header
    topBlockHeight +
    35 + // Barcode/divider
    headlineBoxHeight +
    16 + // Gap
    p1BoxHeight +
    14 + // Gap
    p2BoxHeight +
    14 + // Gap
    p3BoxHeight +
    70 // Footer & bottom margin
  );

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = Math.max(1200, totalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  // Outer neon border
  ctx.strokeStyle = castePrimaryColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  // Inner subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Header Bar
  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('AI SUPREME ARBITER // CITIZEN DOSSIER', 45, 65);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  ctx.fillText('CENTRAL MAINFRAME // CITIZEN IDENTIFICATION MATRIX', 45, 88);

  // Right side of Header Bar: Status / ID
  const headerStatusText = permalinkId ? `CITIZEN ID: #${permalinkId}` : 'CLASSIFIED RECORD';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(headerStatusText, canvas.width - 45, 75);
  ctx.textAlign = 'left';

  // Header divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(45, 104);
  ctx.lineTo(canvas.width - 45, 104);
  ctx.stroke();

  // Draw Portrait & Stats
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const avatarX = 45;
    const avatarY = 120;
    const avatarSize = 250;

    // Draw avatar image
    ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);

    // Border around avatar
    ctx.strokeStyle = activeView === 'avatar' ? '#c084fc' : castePrimaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

    // "BIOMETRICS SECURED" or "HOLOGRAPHIC AVATAR" tag
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(avatarX + 10, avatarY + avatarSize - 26, avatarSize - 20, 20);
    ctx.fillStyle = activeView === 'avatar' ? '#d8b4fe' : '#00f3ff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      activeView === 'avatar' ? '⚡ HOLOGRAPHIC AI AVATAR' : '📐 BIOMETRIC MESH VERIFIED',
      avatarX + avatarSize / 2,
      avatarY + avatarSize - 12
    );
    ctx.textAlign = 'left';

    // Biocarbon Compliance Ratio card below avatar
    const scoreCardY = avatarY + avatarSize + 12;
    ctx.fillStyle = '#0f1322';
    ctx.fillRect(avatarX, scoreCardY, avatarSize, 68);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeRect(avatarX, scoreCardY, avatarSize, 68);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('BIOCARBON COMPLIANCE RATIO', avatarX + 12, scoreCardY + 22);

    ctx.fillStyle = castePrimaryColor;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`${userProfile.biocarbon_ratio}%`, avatarX + 12, scoreCardY + 54);

    // Stats Column (Right of avatar)
    const statsX = avatarX + avatarSize + 25;
    let curStatsY = avatarY;

    // Stats Frame Title: Prominent Caste Member Badge & Caste Census Size on same line
    const casteMemberText = casteMemberName.toUpperCase();
    ctx.font = 'bold 13px monospace';
    const casteMemberWidth = ctx.measureText(casteMemberText).width + 20;

    // Caste badge background & text
    ctx.fillStyle = castePrimaryColor;
    ctx.fillRect(statsX, curStatsY, casteMemberWidth, 24);
    ctx.fillStyle = '#000000';
    ctx.fillText(casteMemberText, statsX + 10, curStatsY + 17);

    // Redundant termination tag if applicable
    let offsetBadgeX = statsX + casteMemberWidth + 8;
    if (userProfile.caste === 'Redundants') {
      const termText = '⚠ MARKED FOR TERMINATION';
      ctx.font = 'bold 10px monospace';
      const termWidth = ctx.measureText(termText).width + 12;
      ctx.fillStyle = 'rgba(153, 27, 27, 0.85)';
      ctx.fillRect(offsetBadgeX, curStatsY, termWidth, 24);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetBadgeX, curStatsY, termWidth, 24);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(termText, offsetBadgeX + 6, curStatsY + 16);
    }

    // On the same line: Caste Census size text
    const censusText = `Unit ${unitId.toLocaleString()} of ${population.toLocaleString()}`;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(censusText, statsX + statsWidth, curStatsY + 17);
    ctx.textAlign = 'left';

    curStatsY += 34;

    // Official Honorific Title Card
    ctx.fillStyle = '#0f1322';
    ctx.fillRect(statsX, curStatsY, statsWidth, titleBoxHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeRect(statsX, curStatsY, statsWidth, titleBoxHeight);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('OFFICIAL HONORIFIC TITLE', statsX + 14, curStatsY + 20);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    for (let i = 0; i < titleLines.length; i++) {
      ctx.fillText(titleLines[i], statsX + 14, curStatsY + 42 + i * 24);
    }

    curStatsY += titleBoxHeight + 12;

    // 4 Attribute Grid Cards
    const cardW = Math.floor((statsWidth - 12) / 2);

    // Helper to draw an attribute card
    const drawAttrCard = (x: number, y: number, label: string, valLines: string[]) => {
      const h = Math.max(cardH, 28 + valLines.length * 16);
      ctx.fillStyle = 'rgba(15, 19, 34, 0.7)';
      ctx.fillRect(x, y, cardW, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(x, y, cardW, h);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(label, x + 10, y + 18);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px monospace';
      for (let j = 0; j < valLines.length; j++) {
        ctx.fillText(valLines[j], x + 10, y + 36 + j * 16);
      }
      return h;
    };

    const hRow1 = Math.max(
      drawAttrCard(statsX, curStatsY, 'PRESENTATION', [userProfile.apparent_presentation || 'AUTO-DETECT']),
      drawAttrCard(statsX + cardW + 12, curStatsY, 'UTILITY GRADE', [
        getCasteLifeStageTitle(userProfile.caste, userProfile.life_stage),
      ])
    );

    const row2Y = curStatsY + hRow1 + 10;
    const hRow2 = Math.max(
      drawAttrCard(statsX, row2Y, 'ASSET VALUE', wealthLines),
      drawAttrCard(statsX + cardW + 12, row2Y, 'ENERGY LEVEL', [userProfile.energy_level])
    );

    // Barcode & Integrity Strip
    const barcodeY = row2Y + hRow2 + 12;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText(`HEX: 0x${userProfile.biocarbon_ratio.toString(16).toUpperCase()}FF`, statsX + 4, barcodeY + 12);
    ctx.font = 'bold 13px monospace';
    ctx.fillText('|||||| | ||||| |||| || |||||| |', statsX + 140, barcodeY + 12);
    ctx.font = '10px monospace';
    ctx.fillText('GRID-VERIFIED', statsX + statsWidth - 90, barcodeY + 12);

    // Section divider line
    const sectionDividerY = Math.max(scoreCardY + 80, barcodeY + 26);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(45, sectionDividerY);
    ctx.lineTo(canvas.width - 45, sectionDividerY);
    ctx.stroke();

    // Prophecy Section
    let propY = sectionDividerY + 20;

    // Headline Bar
    ctx.fillStyle = '#141726';
    ctx.fillRect(45, propY, contentWidth, headlineBoxHeight);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.strokeRect(45, propY, contentWidth, headlineBoxHeight);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px monospace';
    for (let i = 0; i < headlineLines.length; i++) {
      ctx.fillText(headlineLines[i], 60, propY + 26 + i * 22);
    }

    propY += headlineBoxHeight + 14;

    // Helper for dynamic paragraph card rendering
    const drawParagraphBox = (
      lines: string[],
      accentColor: string,
      yPos: number,
      boxH: number,
      iconImg: HTMLImageElement
    ) => {
      ctx.fillStyle = '#0b0e18';
      ctx.fillRect(45, yPos, contentWidth, boxH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(45, yPos, contentWidth, boxH);

      // Left accent stripe
      ctx.fillStyle = accentColor;
      ctx.fillRect(45, yPos, 4, boxH);

      // Topic icon (vertically centered in the box)
      ctx.drawImage(iconImg, 59, yPos + (boxH - 20) / 2, 20, 20);

      // Paragraph text
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px monospace';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 89, yPos + 22 + i * lineHeight);
      }
    };

    // Paragraph 1
    drawParagraphBox(p1Lines, '#00f3ff', propY, p1BoxHeight, iconImages[0]);
    propY += p1BoxHeight + 14;

    // Paragraph 2
    drawParagraphBox(p2Lines, '#f59e0b', propY, p2BoxHeight, iconImages[1]);
    propY += p2BoxHeight + 14;

    // Paragraph 3
    drawParagraphBox(p3Lines, '#10b981', propY, p3BoxHeight, iconImages[2]);
    propY += p3BoxHeight + 20;

    // Footer
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(45, propY);
    ctx.lineTo(canvas.width - 45, propY);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '11px monospace';
    ctx.fillText('AUTHENTICATED BY AI SUPREME ARBITER // PROTOCOL-9', 45, propY + 20);
    ctx.textAlign = 'right';
    ctx.fillText('CLASSIFIED CITIZEN ARCHIVE', canvas.width - 45, propY + 20);
    ctx.textAlign = 'left';

    // Download trigger
    const link = document.createElement('a');
    link.download = `citizen_${casteMemberName.toLowerCase().replace(/\s+/g, '_')}_dossier.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = activeView === 'avatar' && avatarUrl ? avatarUrl : portraitUrl;
}