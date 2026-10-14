import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { getFaction, isOverflowCaste } from '@ecocide/types';
import { IDENTITY, getVerdictTier } from '@ecocide/lore';
import { Gavel, ShieldCheck } from 'lucide-react';

interface ArbitrationDossierProps {
  payload: OraclePayload;
  portraitUrl: string;
  permalinkId?: string;
  /** ISO timestamp of the audit session (archive time, or scan time). */
  sessionDate?: string;
  /** Navigate to the claim screen (/claim/:id). Only wired when a permalink exists. */
  onClaim?: () => void;
  /** Navigate to the appeal screen (/appeal/:id). Only wired when a permalink exists. */
  onAppeal?: () => void;
}

/** Subtle paper-noise texture (same recipe as the legacy paper card). */
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

/** Compact unavailable marker for dark surfaces. */
const Unavailable: React.FC = () => (
  <span className="text-gray-600 italic">UNAVAILABLE</span>
);

/** Column template shared by the item-list header and its rows. */
const ITEM_GRID =
  'grid grid-cols-[2.75rem_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_3.25rem] gap-2 px-2';

/**
 * The verdict page at /arbitration/:id.
 *
 * One-viewport layout: a compact citizen verdict panel on the left and
 * a paper-style environmental audit dossier on the right. Every value
 * comes from the existing backend payload — nothing is synthesized
 * here; fields the scan service does not return yet render an
 * explicit UNAVAILABLE state instead.
 */
export const ArbitrationDossier: React.FC<ArbitrationDossierProps> = ({
  payload,
  permalinkId,
  sessionDate,
  onClaim,
  onAppeal,
}) => {
  const { user_profile, prophecy, telemetry } = payload;

  // Existing backend values only.
  const score = user_profile?.biocarbon_ratio;
  const hasScore = typeof score === 'number' && !Number.isNaN(score);
  const tier = hasScore ? getVerdictTier(score) : null;
  const faction = getFaction(user_profile.caste);
  const overflow = isOverflowCaste(user_profile.caste);
  const caseId = permalinkId || payload.id || null;

  const sessionDateText = (() => {
    if (!sessionDate) return null;
    const parsed = new Date(sessionDate);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  })();

  const impactRows: Array<{ label: string; value: string | null }> = [
    {
      label: 'Compliance Ratio',
      value: hasScore ? `${Math.round(score)}%` : null,
    },
    {
      label: 'Classification Percentile',
      value:
        telemetry?.castePercentile != null
          ? telemetry.castePercentile.toFixed(1)
          : null,
    },
    { label: 'Energy Level', value: user_profile.energy_level || null },
    { label: 'Life Stage', value: user_profile.life_stage || null },
    { label: 'Asset Value', value: user_profile.equipped_wealth || null },
    { label: 'Presentation', value: user_profile.apparent_presentation || null },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-3 lg:max-h-[calc(100dvh-160px)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {/* Left: compact citizen verdict panel */}
        <section
          aria-label="Citizen verdict"
          className="rounded-xl border border-gray-800 bg-[#111422] p-4 flex flex-col min-w-0"
        >
          <h2 className="text-[10px] font-mono tracking-[0.3em] text-lime-400/90 uppercase">
            Citizen Verdict
          </h2>

          <dl className="mt-3 space-y-2.5 text-xs font-mono">
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Citizen Name
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
                Citizen ID
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
            style={
              tier
                ? {
                    borderColor: `${tier.color}55`,
                    boxShadow: `0 0 24px ${tier.color}26`,
                  }
                : undefined
            }
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Compliance Score
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className="text-3xl font-black tracking-tight"
                style={{ color: tier?.color }}
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
                  backgroundColor: tier?.color,
                }}
              />
            </div>
          </div>

          {/* Verdict category, status and verdict line — from the tier table */}
          <div className="mt-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Verdict Category
            </div>
            <div
              className="mt-1 text-sm font-bold"
              style={{ color: tier?.color }}
            >
              {tier ? tier.label : <Unavailable />}
            </div>
            {tier && (
              <span
                className="mt-2 inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest"
                style={{
                  color: tier.color,
                  borderColor: `${tier.color}66`,
                  backgroundColor: `${tier.color}14`,
                }}
              >
                {tier.status}
              </span>
            )}
            {tier && (
              <p
                className="mt-3 text-[11px] font-mono leading-relaxed italic"
                style={{ color: tier.color }}
              >
                “{tier.verdictLine}”
              </p>
            )}
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

          {/* Overall verdict classification — the existing census faction */}
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
              </div>
            ))}
          </div>

          {/* Detected household items — the only vertically scrolling region */}
          <div className="relative mt-3 flex flex-col min-h-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[9px] font-mono uppercase tracking-widest text-[#6b7263]">
                Detected Household Items
              </h3>
              <span className="text-[9px] font-mono text-[#9a8f74]">
                item-level results not yet returned by the scan service
              </span>
            </div>
            <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto max-h-64 lg:max-h-none rounded-sm border border-[#cfc4a8] bg-[#fbf7ea]">
              <div
                className={`${ITEM_GRID} sticky top-0 z-10 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#6b7263] border-b border-[#cfc4a8] bg-[#efe8d2]`}
              >
                <span>Img</span>
                <span className="truncate">Item</span>
                <span className="truncate">Material</span>
                <span className="truncate">Decomposes</span>
                <span className="truncate">Recyclable</span>
                <span className="truncate">Toxicity</span>
                <span className="truncate text-right">Score</span>
              </div>
              {/* Explicit unavailable state: the backend returns no item-level
                  fields (thumbnail, name, material, decomposition, recyclability,
                  toxicity, score) yet. */}
              <div className={`${ITEM_GRID} py-2 text-[10px] font-mono text-[#9a8f74]`}>
                <div className="w-10 h-10 rounded-sm border border-dashed border-[#b9ad8f] flex items-center justify-center text-[8px] uppercase">
                  N/A
                </div>
                <span className="italic truncate">unavailable</span>
                <span className="italic truncate">unavailable</span>
                <span className="italic truncate">unavailable</span>
                <span className="italic truncate">unavailable</span>
                <span className="italic truncate">unavailable</span>
                <span className="italic truncate text-right">unavailable</span>
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
            Guilty until pledged.
          </p>
        </div>
      )}
    </div>
  );
};
