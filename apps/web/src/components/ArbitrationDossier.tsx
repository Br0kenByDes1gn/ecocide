import React from 'react';
import type { AuditItem, Caste, OraclePayload } from '@ecocide/types';
import { getFaction, isOverflowCaste } from '@ecocide/types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  dominantDimension,
  dominantMaterialFamily,
  type DimensionKey,
} from '@ecocide/compliance';
import { IDENTITY } from '@ecocide/lore';
import { Gavel, ShieldCheck } from 'lucide-react';
import { ITEM_STATUS_LABELS } from '../lib/audit-lenses';

interface ArbitrationDossierProps {
  payload: OraclePayload;
  /** Served URL of the archived evidence photo (thumbnail crops come from it). */
  evidenceUrl?: string;
  permalinkId?: string;
  /** ISO timestamp of the audit session (archive time, or scan time). */
  sessionDate?: string;
  /** Navigate to the claim screen (/claim/:id). Only wired when a permalink exists. */
  onClaim?: () => void;
  /** Navigate to the appeal screen (/appeal/:id). Only wired when a permalink exists. */
  onAppeal?: () => void;
}

/** Subtle paper-noise texture (same recipe as the landing dossier panel). */
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

/** Compact unavailable marker for dark surfaces. */
const Unavailable: React.FC = () => (
  <span className="text-gray-600 italic">UNAVAILABLE</span>
);

/** Column template shared by the item-list header and its rows. */
const ITEM_GRID =
  'grid grid-cols-[2.5rem_minmax(8rem,1.3fr)_minmax(6rem,0.9fr)_minmax(10.5rem,1.5fr)_3rem_minmax(6.5rem,0.9fr)] gap-2 px-2';

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
      className={`${ITEM_GRID} py-1.5 border-b border-[#e0d6bb] last:border-b-0 items-center text-[10px] font-mono text-[#1f2a1f]`}
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
        className="justify-self-start px-1.5 py-0.5 rounded-sm border text-[8px] font-bold uppercase tracking-widest whitespace-nowrap"
        style={{ color: ink, borderColor: `${ink}99`, backgroundColor: `${ink}14` }}
      >
        {ITEM_STATUS_LABELS[status]}
      </span>
    </div>
  );
};

/**
 * The verdict page at /arbitration/:id.
 *
 * One-viewport layout: a compact verdict panel on the left and a paper-style
 * environmental audit dossier on the right. Every value comes from the
 * backend payload — nothing is synthesized here; fields the audit service
 * does not return render an explicit UNAVAILABLE state instead.
 */
export const ArbitrationDossier: React.FC<ArbitrationDossierProps> = ({
  payload,
  evidenceUrl,
  permalinkId,
  sessionDate,
  onClaim,
  onAppeal,
}) => {
  const { user_profile, prophecy, audit } = payload;

  const score = user_profile?.biocarbon_ratio;
  const hasScore = typeof score === 'number' && !Number.isNaN(score);
  const faction = getFaction(user_profile.caste as Caste);
  const overflow = isOverflowCaste(user_profile.caste);
  const caseId = permalinkId || payload.id || null;

  const items = audit?.items ?? [];
  const ratio = audit?.ratio ?? score ?? null;
  const dominant = dominantDimension(items);
  const dominantMaterial = dominantMaterialFamily(items);

  const sessionDateText = (() => {
    if (!sessionDate) return null;
    const parsed = new Date(sessionDate);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  })();

  const impactRows: Array<{ label: string; value: string | null; sub?: string | null }> = [
    {
      label: 'Compliance Ratio',
      value: ratio != null ? `${Math.round(ratio)}%` : null,
    },
    { label: 'Audit Area', value: audit?.roomType ?? null },
    { label: 'Items Audited', value: String(items.length) },
    { label: 'Hard Fails', value: String(audit?.hardFails ?? 0) },
    { label: 'Top Offender', value: audit?.topOffenderLabel ?? null },
    {
      label: 'Dominant Driver',
      value: dominant ? DIMENSION_LABELS[dominant] : null,
      sub: dominantMaterial ? materialLabel(dominantMaterial) : null,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-3 lg:max-h-[calc(100dvh-184px)]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {/* Left: compact verdict panel */}
        <section
          aria-label="Household verdict"
          className="rounded-xl border border-gray-800 bg-[#121a14] p-4 flex flex-col min-w-0 lg:min-h-0 lg:overflow-y-auto"
        >
          <h2 className="text-[10px] font-mono tracking-[0.3em] text-lime-400/90 uppercase">
            Household Verdict
          </h2>

          <dl className="mt-3 space-y-2.5 text-xs font-mono">
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Household Name
              </dt>
              <dd className="mt-0.5 text-gray-300">
                <Unavailable />{' '}
                <span className="text-gray-600 text-[10px]">
                  — no name recorded
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Case ID
              </dt>
              <dd className="mt-0.5 text-gray-200 break-all">
                {caseId ? `#${caseId}` : <Unavailable />}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Audit Session Date
              </dt>
              <dd className="mt-0.5 text-gray-200">
                {sessionDateText || <Unavailable />}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Official Designation
              </dt>
              <dd className="mt-0.5 text-gray-200">
                {user_profile.honorific_title || <Unavailable />}
              </dd>
            </div>
          </dl>

          {/* Compliance score — the existing backend value (biocarbon_ratio) */}
          <div
            className="mt-4 rounded-lg border border-gray-800 bg-black/40 p-3"
            style={{
              borderColor: `${faction.colors.hex}55`,
              boxShadow: `0 0 24px ${faction.colors.hex}26`,
            }}
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Sustainability Index
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className="text-3xl font-black tracking-tight"
                style={{ color: faction.colors.hex }}
              >
                {hasScore ? Math.round(score) : '—'}
              </span>
              <span className="text-[11px] text-gray-500">/ 100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-800/80 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: hasScore ? `${Math.max(0, Math.min(100, score))}%` : '0%',
                  backgroundColor: faction.colors.hex,
                }}
              />
            </div>
          </div>

          {/* Tier, status and verdict line — from the lore taxonomy */}
          <div className="mt-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Verdict Category
            </div>
            <div className="mt-1 text-sm font-bold" style={{ color: faction.colors.hex }}>
              {faction.name}
            </div>
            <span
              className="mt-2 inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: faction.colors.hex,
                borderColor: `${faction.colors.hex}66`,
                backgroundColor: `${faction.colors.hex}14`,
              }}
            >
              {faction.stampText}
            </span>
            <p
              className="mt-3 text-[11px] font-mono leading-relaxed italic"
              style={{ color: faction.colors.hex }}
            >
              “{faction.verdictLine}”
            </p>
          </div>
        </section>

        {/* Right: paper-style environmental audit dossier */}
        <section
          aria-label="Environmental audit dossier"
          className="paper-layer relative rounded-xl border border-[#d9cfb6] p-4 flex flex-col min-w-0 overflow-hidden"
        >
          {/* paper texture */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: PAPER_NOISE }}
          />

          <div className="relative flex flex-wrap items-start justify-between gap-2 border-b border-[#cfc4a8] pb-2">
            <div>
              <h2 className="text-sm font-black font-mono uppercase tracking-widest text-[#1f2a1f]">
                Official Environmental Audit
              </h2>
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#6b7263]">
                {IDENTITY.entityName} // Domestic Resource Division
              </p>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#6b7263]">
                Case ID
              </div>
              <div className="text-xs font-mono font-bold text-[#1f2a1f] break-all">
                {caseId ? `#${caseId}` : 'UNAVAILABLE'}
              </div>
            </div>
          </div>

          {/* Overall classification — the tier resolved from the audit score */}
          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#6b7263]">
              Classification
            </span>
            <span
              className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wide"
              style={{ backgroundColor: faction.colors.hex, color: '#1f2a1f' }}
            >
              {faction.name}
            </span>
            {overflow && (
              <span className="px-1.5 py-0.5 rounded-sm border border-[#c2322b] text-[9px] font-mono font-bold uppercase text-[#c2322b]">
                Overflow registry
              </span>
            )}
          </div>

          {/* Concise explanation — first verdict paragraph returned by the backend */}
          <p className="relative mt-2 text-[11px] font-mono leading-relaxed text-[#2c3a2c]">
            {prophecy.paragraph_1}
          </p>

          {/* Environmental impact summary — actual returned values */}
          <div className="relative mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {impactRows.map((row) => (
              <div
                key={row.label}
                className="rounded-sm border border-[#cfc4a8] bg-[#fbf7ea] px-2 py-1.5 min-w-0"
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-[#6b7263] truncate">
                  {row.label}
                </div>
                <div className="mt-0.5 text-[11px] font-mono font-bold text-[#1f2a1f] truncate">
                  {row.value ?? (
                    <span className="italic text-[#9a8f74]">UNAVAILABLE</span>
                  )}
                </div>
                {row.sub && (
                  <div className="text-[9px] font-mono text-[#9a8f74] truncate">
                    {row.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detected household items — the only vertically scrolling region */}
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
                className={`${ITEM_GRID} sticky top-0 z-10 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#6b7263] border-b border-[#cfc4a8] bg-[#efe8d2] min-w-[44rem]`}
              >
                <span>Img</span>
                <span className="truncate">Item</span>
                <span className="truncate">Material</span>
                <span>Dimensions</span>
                <span className="text-right">SI</span>
                <span>Status</span>
              </div>
              <div className="min-w-[44rem]">
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
                  <div className={`${ITEM_GRID} py-2 text-[10px] font-mono italic text-[#9a8f74]`}>
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
        </section>
      </div>

      {/* Bottom actions — the existing claim/appeal navigation handlers */}
      {onClaim && onAppeal && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClaim}
              className="px-8 py-3 bg-[#b4ff39] hover:bg-[#c6ff66] text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-[0_0_25px_rgba(180,255,57,0.4)] hover:shadow-[0_0_35px_rgba(180,255,57,0.8)] hover:scale-[1.02] cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              ACCEPT VERDICT
            </button>
            <button
              type="button"
              onClick={onAppeal}
              className="px-8 py-3 bg-[#ffb703] hover:bg-[#ca8a04] text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-[0_0_25px_rgba(255,183,3,0.4)] hover:shadow-[0_0_35px_rgba(255,183,3,0.8)] hover:scale-[1.02] cursor-pointer"
            >
              <Gavel className="w-5 h-5" />
              APPEAL TO THE ARBITER
            </button>
          </div>
          <p className="text-[10px] font-mono text-amber-400/90 tracking-widest uppercase">
            {IDENTITY.secondaryLine}
          </p>
        </div>
      )}
    </div>
  );
};

export default ArbitrationDossier;
