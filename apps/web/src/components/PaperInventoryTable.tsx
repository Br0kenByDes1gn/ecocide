import React from 'react';
import type { AuditItem } from '@ecocide/types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from '@ecocide/compliance';
import { ITEM_STATUS_LABELS } from '../lib/audit-lenses';

/** Column template shared by the item-list header and its rows. */
export const ITEM_GRID =
  'grid grid-cols-[2.5rem_minmax(9rem,1.3fr)_minmax(7rem,1fr)_minmax(12rem,1.5fr)_3.5rem_minmax(7.5rem,1fr)] gap-3 px-3';

/** Ink per harm rating 1–5 (1 = least harm, 5 = worst). */
const RATING_INK: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#facc15',
  4: '#f97316',
  5: '#ef4444',
};

/**
 * Rubber-stamp inks for the item status chips on the PAPER layer (art §17.3).
 * The bright ITEM_STATUS_COLORS are the dark-surface/HUD set; on form paper the
 * statuses read as stamp ink, same three families as `.stamp-*` in index.css.
 */
const PAPER_STATUS_INK: Record<string, string> = {
  compliant: '#285A37',
  acceptable: '#315A96',
  'needs-improvement': '#865D13',
  'non-compliant': '#983D3D',
};

/** Human-readable label for a material family key (`bio-based` → Bio-based). */
function materialLabel(family: string): string {
  return family
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

/**
 * One dimension reading: the dimension letter plus a five-segment harm meter
 * (1–5). Inapplicable dimensions render an explicit dash.
 */
const DimensionPip: React.FC<{ dimension: DimensionKey; rating: number | null }> = ({
  dimension,
  rating,
}) => {
  const ink = rating ? RATING_INK[rating] ?? '#ef4444' : null;
  return (
    <span
      className="inline-flex flex-col items-center gap-0.5"
      title={`${DIMENSION_LABELS[dimension]}: ${rating ? `${rating}/5` : 'not applicable'}`}
    >
      <span
        className="text-[8px] font-mono font-bold uppercase leading-none"
        style={{ color: ink ?? '#9a8f74' }}
      >
        {dimension}
      </span>
      {rating ? (
        <span className="flex flex-col-reverse gap-[1px]" aria-hidden>
          {[1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className="w-1.5 h-[2px] rounded-[1px]"
              style={{ backgroundColor: step <= rating ? ink ?? undefined : '#d8cdb2' }}
            />
          ))}
        </span>
      ) : (
        <span className="text-[9px] font-mono leading-none text-[#9a8f74]">—</span>
      )}
    </span>
  );
};

/**
 * The threshold crop of one detected item, taken from the archived evidence
 * photo through its normalized bounding box (sprite technique — no canvas).
 */
const ItemThumb: React.FC<{ imageUrl?: string; item: AuditItem }> = ({ imageUrl, item }) => {
  const box = item.bounds;
  if (!imageUrl || !box) {
    return (
      <div className="w-10 h-10 rounded-sm border border-dashed border-[#b9ad8f] flex items-center justify-center text-[8px] uppercase text-[#9a8f74]">
        N/A
      </div>
    );
  }
  // Pad the box slightly so the detected object is not clipped at the edges.
  const rawW = Math.min(Math.max(box.x2 - box.x1, 0.02), 1);
  const rawH = Math.min(Math.max(box.y2 - box.y1, 0.02), 1);
  const padX = rawW * 0.08;
  const padY = rawH * 0.08;
  const x1 = Math.max(0, box.x1 - padX);
  const y1 = Math.max(0, box.y1 - padY);
  const x2 = Math.min(1, box.x2 + padX);
  const y2 = Math.min(1, box.y2 + padY);
  const w = Math.min(Math.max(x2 - x1, 0.02), 1);
  const h = Math.min(Math.max(y2 - y1, 0.02), 1);
  const position = (offset: number, size: number) =>
    size >= 1 ? '0%' : `${(offset / (1 - size)) * 100}%`;

  return (
    <div
      role="img"
      aria-label={`Evidence crop: ${item.label}`}
      className="w-10 h-10 rounded-sm border border-[#b9ad8f] overflow-hidden"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${100 / w}% ${100 / h}%`,
        backgroundPosition: `${position(x1, w)} ${position(y1, h)}`,
      }}
    />
  );
};

/** One row of the detected-items table (mirrors the ITEM_GRID template). */
const ItemRow: React.FC<{ item: AuditItem; index: number; evidenceUrl?: string }> = ({
  item,
  index,
  evidenceUrl,
}) => {
  const status = item.status ?? 'needs-improvement';
  const ink = PAPER_STATUS_INK[status] ?? PAPER_STATUS_INK['needs-improvement'];
  return (
    <div
      className={`${ITEM_GRID} py-2 border-b border-[#e0d6bb] last:border-b-0 items-center text-xs font-mono text-[#1f2a1f]`}
      style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
    >
      <ItemThumb imageUrl={evidenceUrl} item={item} />
      <span className="min-w-0">
        <span className="block truncate font-bold">{item.label}</span>
        <span className="block text-[9px] text-[#9a8f74]">
          {item.count > 1 ? `×${item.count}` : 'SINGLE'} · EXHIBIT {String(index + 1).padStart(2, '0')}
        </span>
      </span>
      <span className="truncate">
        {item.materialFamily ? (
          materialLabel(item.materialFamily)
        ) : (
          <span className="italic text-[#9a8f74]">unavailable</span>
        )}
      </span>
      <span className="flex items-start gap-1.5" aria-label="Harm dimensions">
        {DIMENSION_KEYS.map((key) => (
          <DimensionPip key={key} dimension={key} rating={item.ratings?.[key] ?? null} />
        ))}
      </span>
      <span className="font-black tabular-nums text-right">
        {item.si != null ? Math.round(item.si) : '—'}
      </span>
      <span
        className="justify-self-start px-2.5 py-1 rounded-sm border text-[12px] font-bold uppercase tracking-widest whitespace-nowrap"
        style={{ color: ink, borderColor: `${ink}99`, backgroundColor: `${ink}14` }}
      >
        {ITEM_STATUS_LABELS[status]}
      </span>
    </div>
  );
};

/**
 * Paper-styled detected-household-items table shared by the arbitration and
 * citizen dossiers: header row plus one row per audited item.
 */
export const PaperInventoryTable: React.FC<{ items: AuditItem[]; evidenceUrl?: string }> = ({
  items,
  evidenceUrl,
}) => (
  <div className="relative mt-3 flex flex-col min-h-0 min-w-0 flex-1">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[9px] font-mono uppercase tracking-widest text-[#6b7263]">
        Detected Household Items
      </h3>
      <span className="text-[9px] font-mono text-[#9a8f74]">
        harm meters: m r d c l t p e · 1 (low) → 5 (worst)
      </span>
    </div>
    <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto overflow-x-auto max-h-72 lg:max-h-none rounded-sm border border-[#cfc4a8] bg-[#fbf7ea]">
      <div
        className={`${ITEM_GRID} sticky top-0 z-10 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#6b7263] border-b border-[#cfc4a8] bg-[#efe8d2] min-w-[50rem]`}
        style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
      >
        <span>Img</span>
        <span className="truncate">Item</span>
        <span className="truncate">Material</span>
        <span>Dimensions</span>
        <span className="text-right">SI</span>
        <span>Status</span>
      </div>
      <div className="min-w-[50rem]">
        {items.length > 0 ? (
          items.map((item, index) => (
            <ItemRow
              key={`${item.label}-${index}`}
              item={item}
              index={index}
              evidenceUrl={evidenceUrl}
            />
          ))
        ) : (
          <div className={`${ITEM_GRID} py-2 text-xs font-mono italic text-[#9a8f74]`}>
            <div className="w-10 h-10 rounded-sm border border-dashed border-[#b9ad8f] flex items-center justify-center text-[8px] uppercase">
              N/A
            </div>
            <span className="truncate">no items returned</span>
            <span className="truncate">unavailable</span>
            <span className="truncate">unavailable</span>
            <span className="text-right">—</span>
            <span className="truncate">unavailable</span>
          </div>
        )}
      </div>
    </div>
  </div>
);
