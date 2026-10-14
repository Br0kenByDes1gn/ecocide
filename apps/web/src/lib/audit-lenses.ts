// ---------------------------------------------------------------------------
// audit-lenses — the four canonical treatments of the audited photograph
// (art_directions.md §9). Every lens draws over the user's photo plus the
// detected item boxes (normalized 0–1). The subject is always the room and
// its objects; nothing here renders people.
//
//   neon-outline    default brand look: darkened photo, glowing lime outlines
//   evidence-photo  warm case-file snapshot with exhibit framing (paper layer)
//   inspection-hud  cold CRT wash, status-colored boxes, bloom, heavy scanlines
//   carbon-heat     false-color harm map (H) on the landfill-black chamber
// ---------------------------------------------------------------------------

import type { AuditItem } from '@ecocide/types';
import { harmScore, siFromHarm } from '@ecocide/compliance';
import { PALETTE } from '@ecocide/lore';

export type LensId = 'neon-outline' | 'evidence-photo' | 'inspection-hud' | 'carbon-heat';

export const LENSES: ReadonlyArray<{ id: LensId; label: string }> = [
  { id: 'neon-outline', label: 'NEON OUTLINE' },
  { id: 'evidence-photo', label: 'EVIDENCE PHOTO' },
  { id: 'inspection-hud', label: 'INSPECTION HUD' },
  { id: 'carbon-heat', label: 'CARBON HEAT MAP' },
];

export const ITEM_STATUS_COLORS = {
  compliant: '#22c55e',
  borderline: '#facc15',
  'non-compliant': '#ef4444',
} as const;

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }
  // faint RGB chromatic fringe (per art §8.1)
  ctx.fillStyle = 'rgba(255, 0, 0, 0.03)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 255, 0, 0.01)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 255, 0.03)';
  ctx.fillRect(0, 0, w, h);
}

function boxFor(item: AuditItem, width: number, height: number) {
  const b = item.bounds;
  if (!b) return null;
  const x = Math.max(0, b.x1 * width);
  const y = Math.max(0, b.y1 * height);
  const w = Math.min(width - x, (b.x2 - b.x1) * width);
  const h = Math.min(height - y, (b.y2 - b.y1) * height);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

// ---------------------------------------------------------------------------
// Lenses (each starts from the raw photo with its own grade)
// ---------------------------------------------------------------------------

function drawNeonOutline(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  items: AuditItem[]
) {
  ctx.save();
  ctx.filter = 'grayscale(0.75) brightness(0.6) saturate(0.8)';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(7, 10, 8, 0.35)';
  ctx.fillRect(0, 0, w, h);

  for (const item of items) {
    const box = boxFor(item, w, h);
    if (!box) continue;
    const size = Math.max(box.w, box.h);
    const intensity = Math.min(0.9, 0.35 + (size / Math.max(w, h)) * 2.2);
    const status = item.status ?? 'borderline';

    ctx.save();
    ctx.strokeStyle = PALETTE.accent;
    ctx.globalAlpha = intensity;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.accent;
    ctx.shadowBlur = 10;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08 + (intensity - 0.35) * 0.25;
    ctx.fillStyle = ITEM_STATUS_COLORS[status];
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
  }

  drawScanlines(ctx, w, h, 0.18);
}

function drawEvidencePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  items: AuditItem[]
) {
  ctx.save();
  ctx.filter = 'sepia(0.3) saturate(0.8) brightness(1.04) contrast(0.96)';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();

  // subtle paper vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(24, 20, 8, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  for (const item of items) {
    const box = boxFor(item, w, h);
    if (!box) continue;
    // exhibit leader line from the item center to its tag position
    ctx.save();
    ctx.strokeStyle = PALETTE.paperInk;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = box.x + box.w * 0.5;
    const cy = box.y + box.h * 0.5;
    const tagX = box.x + box.w + 12 > w - 30 ? box.x - 14 : box.x + box.w + 10;
    const tagY = Math.max(14, Math.min(h - 14, cy));
    ctx.moveTo(cx, cy);
    ctx.lineTo(tagX, tagY);
    ctx.stroke();
    ctx.fillStyle = PALETTE.stampRed;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawScanlines(ctx, w, h, 0.05);
}

function drawInspectionHud(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  items: AuditItem[],
  activeLabel?: string | null
) {
  ctx.save();
  ctx.filter = 'grayscale(0.35) brightness(0.72) saturate(1.1)';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(4, 18, 24, 0.35)';
  ctx.fillRect(0, 0, w, h);

  for (const item of items) {
    const box = boxFor(item, w, h);
    if (!box) continue;
    const status = item.status ?? 'borderline';
    const color = ITEM_STATUS_COLORS[status];
    const isActive = !!activeLabel && item.label === activeLabel;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = isActive ? 0.85 : 0.42;
    ctx.lineWidth = isActive ? 1.4 : 0.75;
    ctx.shadowColor = color;
    ctx.shadowBlur = isActive ? 8 : 3;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    for (const [dx, dy] of [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x, box.y + box.h],
      [box.x + box.w, box.y + box.h],
    ] as const) {
      ctx.fillRect(dx - 2, dy - 2, 4, 4);
    }
    ctx.restore();
  }

  drawScanlines(ctx, w, h, 0.28);
}

/** 5-stop harm gradient (low impact → severe), art §9.4. */
const HEAT_STOPS: ReadonlyArray<[number, string]> = [
  [0.0, '#052e16'],
  [0.25, '#22c55e'],
  [0.5, '#facc15'],
  [0.75, '#f97316'],
  [1.0, '#ff0055'],
];

function heatColor(t: number): string {
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t0, c0] = HEAT_STOPS[i - 1];
    const [t1, c1] = HEAT_STOPS[i];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      const [r0, g0, b0] = hex(c0);
      const [r1, g1, b1] = hex(c1);
      const ch = (v: number) => Math.round(v).toString(16).padStart(2, '0');
      return `#${ch(r0 + (r1 - r0) * f)}${ch(g0 + (g1 - g0) * f)}${ch(b0 + (b1 - b0) * f)}`;
    }
  }
  return '#ff0055';
}

function drawCarbonHeat(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  items: AuditItem[]
) {
  ctx.fillStyle = PALETTE.landfill;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = 'brightness(0.5) contrast(1.1)';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(11, 10, 6, 0.4)';
  ctx.fillRect(0, 0, w, h);

  for (const item of items) {
    const box = boxFor(item, w, h);
    if (!box) continue;
    const hScore = harmScore(item.ratings);
    const t = (hScore - 1) / 4; // H 1..5 → 0..1
    ctx.save();
    ctx.fillStyle = heatColor(t);
    ctx.globalAlpha = 0.75;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
  }

  // vertical legend bar at the right edge
  const barW = 14;
  const barX = w - barW - 10;
  const barY = 16;
  const barH = Math.max(80, h - 32);
  const gradient = ctx.createLinearGradient(0, barY + barH, 0, barY);
  for (const [t, c] of HEAT_STOPS) gradient.addColorStop(t, c);
  ctx.fillStyle = gradient;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = 'rgba(255,183,3,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = PALETTE.warning;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SEVERE', barX + barW / 2, barY + 10);
  ctx.fillText('MODERATE', barX + barW / 2, barY + barH / 2);
  ctx.fillText('LOW', barX + barW / 2, barY + barH - 6);
  ctx.textAlign = 'left';

  drawScanlines(ctx, w, h, 0.1);
}

/**
 * Render one of the four audit lenses over the evidence photo. Always starts
 * from the RAW image element, so re-rendering any lens is deterministic.
 */
export function drawAuditLens(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  items: AuditItem[],
  lens: LensId,
  activeLabel?: string | null
): void {
  ctx.clearRect(0, 0, width, height);
  switch (lens) {
    case 'evidence-photo':
      drawEvidencePhoto(ctx, img, width, height, items);
      break;
    case 'inspection-hud':
      drawInspectionHud(ctx, img, width, height, items, activeLabel);
      break;
    case 'carbon-heat':
      drawCarbonHeat(ctx, img, width, height, items);
      break;
    case 'neon-outline':
    default:
      drawNeonOutline(ctx, img, width, height, items);
      break;
  }
}

/** Per-item one-liner for chips: "PET BOTTLE x3 // SI 41 // NON-COMPLIANT". */
export function itemChipText(item: AuditItem): string {
  const count = item.count > 1 ? ` x${item.count}` : '';
  const si = Math.round(item.si ?? siFromHarm(harmScore(item.ratings)));
  return `${item.label.toUpperCase()}${count} // SI ${si} // ${(item.status ?? 'borderline').toUpperCase()}`;
}