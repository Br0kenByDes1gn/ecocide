import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AuditItem, OraclePayload } from '@ecocide/types';
import { getFaction, OVERRIDE_RULES } from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { ArrowRightLeft, ChevronDown, ChevronUp, Layers, ScanSearch, Shield } from 'lucide-react';
import type { AuditRevealState } from '../lib/useAuditReveal';
import { drawAuditLens, ITEM_STATUS_COLORS, ITEM_STATUS_LABELS, LENSES, type LensId } from '../lib/audit-lenses';
import { TierStamp } from './TierStamp';
import { soundFx } from '../lib/audio';

/** Pulsing placeholder shown while a stat is waiting to be revealed. */
const Placeholder: React.FC<{ className?: string }> = ({ className = 'w-16 h-2.5' }) => (
  <span aria-hidden className={`inline-block rounded bg-gray-800/90 animate-pulse ${className}`} />
);

interface HouseholdAuditCardProps {
  payload: OraclePayload;
  evidenceUrl?: string;
  /** Reveal state; the static /citizen page passes the fully-revealed state. */
  reveal: AuditRevealState;
  /** Header label; the arbitration page overrides with its own flavor text. */
  headerLabel?: string;
  /** Compact summary-bar form (stamp + title + ratio only) for the arbitration flow. */
  compact?: boolean;
  /** Whether the compact card is clickable to expand back to full size. */
  interactive?: boolean;
  onExpand?: () => void;
  /** Default lens for the evidence photo. */
  defaultLens?: LensId;
}

/**
 * The household audit card shared by the static /citizen dossier and the
 * animated /arbitration reveal: annotated evidence photo (one of the four
 * audit lenses), tier stamp, personalized title, Household Sustainability
 * Index with the waste gauge, the 2×2 stat grid and the per-item cards.
 */
export const HouseholdAuditCard: React.FC<HouseholdAuditCardProps> = ({
  payload,
  evidenceUrl,
  reveal,
  headerLabel = `${IDENTITY.appName} // HOUSEHOLD AUDIT DOSSIER`,
  compact = false,
  interactive = false,
  onExpand,
  defaultLens = 'neon-outline',
}) => {
  const { user_profile, audit, suggestions } = payload;
  const faction = getFaction(user_profile.caste);
  const [lens, setLens] = useState<LensId>(defaultLens);
  const [itemsOpen, setItemsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clickable = interactive && compact && !!onExpand;

  useEffect(() => {
    if (lens !== defaultLens) setLens(defaultLens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceUrl]);

  // Render the lens over the evidence photo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (img: HTMLImageElement) => {
      drawAuditLens(ctx, img, canvas.width, canvas.height, audit.items, lens);
    };

    const img = new Image();
    if (evidenceUrl) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => draw(img);
    img.onerror = () => {
      // no evidence → faint audit-grid void with the items' chips only
      ctx.fillStyle = '#070a08';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = evidenceUrl || '';
  }, [evidenceUrl, lens, audit.items]);

  const bounded = useMemo(() => audit.items.filter((i) => i.bounds), [audit.items]);
  const unbounded = useMemo(() => audit.items.filter((i) => !i.bounds), [audit.items]);

  const stat = (text: string | null, placeholderClassName = 'w-16 h-2.5') =>
    text ? <>{text}</> : <Placeholder className={placeholderClassName} />;

  const ratio = user_profile.biocarbon_ratio;
  const wasteFill = Math.max(0, Math.min(100, 100 - ratio));

  return (
    <div className="space-y-6">
      <div
        onClick={clickable ? onExpand : undefined}
        role={clickable ? 'button' : undefined}
        title={clickable ? 'Expand dossier to full size' : undefined}
        className={`relative bg-[#121a14] rounded-2xl border-2 ${faction.colors.border} overflow-hidden shadow-2xl transition-all duration-700 ${
          clickable ? 'cursor-pointer hover:shadow-[0_0_30px_rgba(180,255,57,0.25)] hover:border-lime-400/80' : ''
        } ${compact ? 'p-3' : 'p-5 sm:p-6'}`}
      >
        <div
          className={`absolute inset-0 scanlines pointer-events-none transition-opacity duration-700 ${
            compact ? 'opacity-15' : 'opacity-30'
          }`}
        />

        {clickable && (
          <div
            className="absolute right-3 top-2.5 flex items-center gap-1 text-[9px] font-mono text-lime-300 bg-lime-950/70 border border-lime-500/40 px-1.5 py-0.5 rounded z-10"
          >
            <ArrowRightLeft className="w-2.5 h-2.5" />
            EXPAND DOSSIER
          </div>
        )}

        {/* Card Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between border-b border-gray-800/80 pb-4 gap-2 overflow-hidden transition-all duration-500 ${
            compact ? 'max-h-0 opacity-0 border-b-transparent p-0' : 'max-h-24 opacity-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${faction.colors.color}`} />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-400">{headerLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500">
            <span>CASE FILE // {payload.id ? `#${payload.id}` : 'PENDING'}</span>
          </div>
        </div>

        <div className={`grid grid-cols-12 gap-5 transition-all duration-700 ${compact ? 'mt-1 gap-3 items-center' : 'mt-5'}`}>
          {/* Evidence photo column */}
          <div
            className={`transition-all duration-700 ${
              compact ? 'col-span-12 sm:col-span-2' : 'sm:col-span-6'
            }`}
          >
            <div
              className={`relative overflow-hidden rounded-xl border ${
                faction.colors.border
              } transition-all duration-700 ${
                compact ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-full aspect-square'
              } ${reveal.evidenceVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              <canvas ref={canvasRef} className="w-full h-full" width={640} height={640} />

              {/* item label chips (DOM overlay, crisp text) */}
              {!compact &&
                bounded.map((item, i) => {
                  const b = item.bounds!;
                  const status = item.status ?? 'borderline';
                  const color = ITEM_STATUS_COLORS[status];
                  const style: React.CSSProperties = {
                    left: `${b.x1 * 100}%`,
                    top: `${b.y1 * 100}%`,
                    borderColor: color,
                    color,
                  };
                  return (
                    <div
                      key={`${item.label}-${i}`}
                      className="absolute z-10 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold whitespace-nowrap pointer-events-none bg-black/70 backdrop-blur-sm"
                      style={style}
                    >
                      {item.label.toUpperCase()}
                      {item.count > 1 ? ` x${item.count}` : ''}
                      <span className="opacity-70"> // SI {Math.round(item.si ?? 0)}</span>
                    </div>
                  );
                })}

              {/* lens switcher */}
              {!compact && (
                <div className="absolute bottom-1.5 right-1.5 z-10 flex gap-1">
                  {LENSES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setLens(l.id);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-colors cursor-pointer ${
                        lens === l.id
                          ? 'bg-lime-500 text-black border-lime-400'
                          : 'bg-black/70 text-gray-300 border-gray-700 hover:border-lime-500/60'
                      }`}
                      title={l.label}
                    >
                      {l.id === 'neon-outline' ? 'NEON' : l.id === 'evidence-photo' ? 'EVIDENCE' : l.id === 'inspection-hud' ? 'HUD' : 'HEAT'}
                    </button>
                  ))}
                </div>
              )}

              {/* bottom label */}
              {!compact && (
                <div className="absolute bottom-1.5 left-1.5 z-10 bg-black/70 backdrop-blur-md px-1.5 py-1 rounded text-center text-[8px] font-mono text-gray-300 border border-gray-700 flex items-center gap-1">
                  <ScanSearch className="w-2.5 h-2.5 text-lime-400" />
                  AUDIT EVIDENCE // {audit.items.length} ITEMS DETECTED
                </div>
              )}
            </div>
          </div>

          {/* Details column */}
          <div
            className={`flex flex-col justify-center min-w-0 transition-all duration-700 ${
              compact ? 'col-span-12 sm:col-span-10 space-y-1.5' : 'sm:col-span-6 space-y-4'
            }`}
          >
            {compact ? (
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <TierStamp caste={user_profile.caste} compact />
                  <div className="min-w-0">
                    <div className="text-[10px] text-gray-400 uppercase whitespace-nowrap">SUSTAINABILITY INDEX</div>
                    <div className={`text-xl sm:text-2xl font-black tracking-widest ${faction.colors.color}`}>
                      {stat(reveal.ratioText, 'w-16 h-5')}
                    </div>
                  </div>
                </div>
                <div className="text-right min-w-0">
                  <div className={`font-bold font-mono text-white tracking-wide truncate ${faction.colors.color}`}>
                    {stat(reveal.titleText, 'w-2/3 h-4')}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Tier banner */}
                <div className={`flex items-center justify-between gap-3 rounded-xl border ${faction.colors.border} ${faction.colors.bg} px-3 py-2.5 ${faction.colors.glow}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <TierStamp caste={user_profile.caste} />
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">CLASSIFICATION</div>
                      <div className={`font-black font-mono text-base sm:text-lg leading-tight ${faction.colors.color}`}>
                        {faction.name}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 italic truncate">{faction.verdictLine}</div>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Score {ratio}–100</span>
                    <span className="text-[9px] font-mono text-gray-500">{faction.reticleMotif.toUpperCase()}</span>
                  </div>
                </div>

                {/* Title */}
                <div className="min-w-0">
                  <div className="text-xs font-mono text-gray-400">CASE TITLE // DOMINANT HABIT</div>
                  <div className={`font-bold font-mono text-white tracking-wide mt-0.5 text-xl sm:text-2xl break-words ${faction.colors.color}`}>
                    {stat(reveal.titleText, 'w-2/3 h-5')}
                  </div>
                </div>

                {/* Ratio + waste gauge */}
                <div className="bg-black/40 p-3 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-400">HOUSEHOLD SUSTAINABILITY INDEX</span>
                    <span className={`font-black tracking-widest ${faction.colors.color}`}>
                      {stat(reveal.ratioText, 'w-14 h-4')}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-gray-900 overflow-hidden border border-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${faction.colors.barColor}`}
                      style={{ width: `${reveal.isComplete ? ratio : 0}%`, transitionDelay: '300ms' }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-gray-500">
                    <span>CLEAN PROFILE</span>
                    <span>WASTE BURDEN {wasteFill}%</span>
                    <span>SEVERE</span>
                  </div>
                </div>

                {/* 2x2 stat grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                  <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                    <span className="text-gray-500 block text-[10px] uppercase">ITEMS SCANNED</span>
                    <span className="text-gray-200 font-semibold">{stat(reveal.itemsText, 'w-20 h-2.5')}</span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                    <span className="text-gray-500 block text-[10px] uppercase">HARD FAILS</span>
                    <span className={audit.hardFails > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                      {reveal.isComplete ? audit.hardFails : <Placeholder className="w-8 h-2.5" />}
                    </span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                    <span className="text-gray-500 block text-[10px] uppercase">TOP OFFENDER</span>
                    <span className="text-amber-400 font-semibold break-words">
                      {reveal.isComplete ? (audit.topOffenderLabel || 'NONE') : <Placeholder className="w-24 h-2.5" />}
                    </span>
                  </div>
                  <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                    <span className="text-gray-500 block text-[10px] uppercase">PLEDGES AVAILABLE</span>
                    <span className="text-teal-300 font-semibold">
                      {reveal.isComplete ? suggestions.length : <Placeholder className="w-8 h-2.5" />}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Per-item cards (full mode) */}
        {!compact && (
          <div className="mt-5 pt-4 border-t border-gray-800/80 space-y-3">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setItemsOpen((o) => !o);
              }}
              className="w-full flex items-center justify-between text-xs font-mono text-gray-300 hover:text-lime-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-500" />
                AUDIT INVENTORY ({audit.items.length} ITEMS{audit.hardFails > 0 ? ` // ${audit.hardFails} FLAGGED` : ''})
              </span>
              {itemsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {itemsOpen && (
              <div className="grid gap-2.5 max-h-80 overflow-y-auto pr-1">
                {audit.items.map((item, i) => (
                  <ItemCard key={`${item.label}-${i}`} item={item} index={i} />
                ))}
                {unbounded.length > 0 && (
                  <div className="text-[9px] font-mono text-gray-500">
                    {unbounded.length} ITEM(S) WITHOUT A LOCALIZABLE POSITION — LISTED WITHOUT BOUNDS
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Barcode strip */}
        <div
          className={`pt-2 border-t border-gray-800 flex justify-between items-center text-[10px] font-mono text-gray-500 overflow-hidden transition-all duration-500 ${
            compact ? 'max-h-0 opacity-0 border-t-transparent' : 'max-h-10 opacity-100'
          }`}
        >
          <span>CASE FILE: {payload.id ? `#${payload.id}` : 'PENDING'} // AUDIT PROTOCOL {IDENTITY.auditProtocol}</span>
          <div className="tracking-[4px] font-bold text-gray-400">||||| | |||| ||| |</div>
          <span>GRID-VERIFIED // ALL VALUES ARE ESTIMATES</span>
        </div>
      </div>
    </div>
  );
};

/** One audited item card: label ×count, SI, stamp, four properties. */
const ItemCard: React.FC<{ item: AuditItem; index: number }> = ({ item, index }) => {
  const status = item.status ?? 'borderline';
  const color = ITEM_STATUS_COLORS[status];
  const bars: Array<{ key: 'r' | 'd' | 'm' | 't'; label: string }> = [
    { key: 'm', label: 'MATERIAL' },
    { key: 'd', label: 'DECOMP' },
    { key: 'r', label: 'RECYCLE' },
    { key: 't', label: 'TOXICITY' },
  ];
  return (
    <div className="bg-black/35 rounded-lg border border-gray-800/80 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="font-mono text-sm font-bold text-gray-100 truncate">
            {item.label.toUpperCase()}
            {item.count > 1 ? ` x${item.count}` : ''}
          </span>
          <span className="font-mono text-[10px] text-gray-500">EXHIBIT {String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-black" style={{ color }}>
            SI {Math.round(item.si ?? 0)}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-sm font-mono font-black text-[8px] tracking-widest border"
            style={{ color, borderColor: color, transform: 'rotate(-2deg)' }}
          >
            {ITEM_STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {bars.map(({ key, label }) => {
          const rating = item.ratings[key];
          return (
            <div key={key} className="bg-black/40 rounded px-1.5 py-1">
              <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">{label}</div>
              <div className="text-[10px] font-mono font-bold text-gray-300">
                {rating === undefined || rating === null ? 'N/A' : `${rating} / 5`}
              </div>
            </div>
          );
        })}
      </div>

      {item.justification && (
        <div className="mt-1.5 text-[10px] font-mono italic text-gray-500 leading-snug">“{item.justification}”</div>
      )}

      {/* Step-5 override flags (feeds the explain panel) */}
      {(item.overrides?.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.overrides!.map((rule) => (
            <span
              key={rule}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono font-bold text-[8px] tracking-widest border"
              style={{ color: '#facc15', borderColor: '#facc1580', backgroundColor: 'rgba(250,204,21,0.06)' }}
              title="Step-5 override rule — this item hard-fails regardless of its average"
            >
              ⚠ {OVERRIDE_RULES[rule].toUpperCase()}
            </span>
          ))}
        </div>
      )}
      {item.size && (
        <div className="mt-1 font-mono text-[8px] text-gray-500 uppercase tracking-wider">
          SIZE: {item.size} // WEIGHT ×{item.size === 'small' ? '0.5' : item.size === 'large' ? '2' : '1'}
        </div>
      )}
    </div>
  );
};