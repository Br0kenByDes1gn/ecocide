import React from 'react';
import type { Caste, OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { IDENTITY, ADJUDICATORS_ON_DUTY } from '@ecocide/lore';
import { ArrowRight, Gavel, ShieldCheck, UserSearch } from 'lucide-react';
import { PaperDossierHeader } from './PaperDossierHeader';
import { PaperInventoryTable } from './PaperInventoryTable';

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
  /** Navigate to the informant screen (/inform/:id). Only wired when a permalink exists. */
  onInform?: () => void;
  /** Open the Planetary Grid (/grid). */
  onOpenGrid?: () => void;
  /** Open the credits page (/adjudicators). */
  onOpenAdjudicators?: () => void;
}

/** Subtle paper-noise texture (same recipe as the landing dossier panel). */
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

/** Compact unavailable marker for dark surfaces. */
const Unavailable: React.FC = () => (
  <span className="text-gray-600 italic">UNAVAILABLE</span>
);

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
  onInform,
  onOpenGrid,
  onOpenAdjudicators,
}) => {
  const { user_profile, prophecy, audit } = payload;

  const score = user_profile?.biocarbon_ratio;
  const hasScore = typeof score === 'number' && !Number.isNaN(score);
  const faction = getFaction(user_profile.caste as Caste);

  const caseId = permalinkId || payload.id || null;

  const items = audit?.items ?? [];
  const ratio = audit?.ratio ?? score ?? null;

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
    { label: 'Items Audited', value: String(items.length) },
    { label: 'Top Offender', value: audit?.topOffenderLabel ?? null },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-3 lg:max-h-[calc((100dvh-184px)*1.106)]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0">
        {/* Left: compact verdict panel */}
        <section
          aria-label="Household verdict"
          className="rounded-xl border border-gray-800 bg-[#121a14] p-[1.15rem] flex flex-col min-w-0 lg:min-h-0 lg:overflow-y-auto"
        >
          <h2 className="text-[10px] font-mono tracking-[0.3em] text-lime-400/90 uppercase">
            Household Verdict
          </h2>

          <dl className="mt-3 space-y-2.5 text-xs font-mono">
            <div>
              <dt className="text-[10px] text-gray-500 uppercase tracking-widest">
                Case ID
              </dt>
              <dd
                className="mt-0.5 text-gray-200 break-all text-lg font-black"
                style={{ letterSpacing: '1px' }}
              >
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

          {/* Sustainability Index — value only, no bar or box */}
          <div className="mt-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Sustainability Index
            </div>
            <div
              className="mt-1 text-4xl font-black tracking-tight"
              style={{ color: faction.colors.hex }}
            >
              {hasScore ? Math.round(score) : '—'}
            </div>
          </div>

          {/* Tier, status and verdict line — from the lore taxonomy */}
          <div className="mt-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">
              Verdict Category
            </div>
            <div
              className="mt-1 text-xl font-black uppercase"
              style={{ color: faction.colors.hex }}
            >
              {faction.name}
            </div>
            <div
              className="mt-3 rounded-sm border-2 border-dotted p-2 text-sm font-mono leading-relaxed italic"
              style={{ color: faction.colors.hex, borderColor: `${faction.colors.hex}99` }}
            >
              {faction.verdictLine}
            </div>
          </div>
        </section>

        {/* Right: paper-style environmental audit dossier */}
        <section
          aria-label="Environmental audit dossier"
          className="paper-layer font-mono relative rounded-xl border border-[#d9cfb6] p-4 flex flex-col min-w-0 overflow-hidden"
        >
          {/* paper texture */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: PAPER_NOISE }}
          />

          <PaperDossierHeader caseId={caseId} sessionDate={sessionDate} largeIds />

          {/* Overall classification — the tier resolved from the audit score */}
          <div className="relative mt-1 flex flex-wrap items-center gap-2">
            <span className="text-base font-mono uppercase tracking-widest text-[#6b7263]">
              Classification
            </span>
            {/*
              The stamp scales down and wraps on a phone: at its desktop size a
              long tier name is wider than the paper, and a `shrink-0` block in a
              non-wrapping row can only be clipped.
            */}
            <span
              className="relative shrink-0 max-w-full break-words px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-2xl font-black uppercase tracking-widest rounded-sm rotate-[-2deg] border-[3px] sm:border-[6px]"
              style={{
                color: '#c2322b',
                borderColor: '#c2322b',
                fontWeight: 'bold',
              }}
            >
              {faction.name}
            </span>
          </div>

          {/* Concise explanation — first verdict paragraph returned by the backend */}
          <p className="relative mt-2 text-[11px] font-mono leading-relaxed text-[#2c3a2c]">
            {prophecy.paragraph_1}
          </p>

          {/* Environmental impact summary — actual returned values */}
          <div
            className="relative mt-3 rounded-sm border border-[#b9ad8f] p-2"
            style={{ backgroundColor: '#bead8e', letterSpacing: '1px' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {impactRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#1f2a1f] truncate">
                    {row.label}
                  </div>
                  <div
                    className="mt-0.5 text-lg font-mono font-black text-[#1a1a1a] truncate"
                    style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
                  >
                    {row.value ?? (
                      <span className="italic text-[#9a8f74]">UNAVAILABLE</span>
                    )}
                  </div>
                  {row.sub && (
                    <div className="text-sm font-mono text-[#4b4336] truncate">
                      {row.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <PaperInventoryTable items={items} evidenceUrl={evidenceUrl} />
        </section>
      </div>

      {/* Bottom actions — the existing claim/appeal navigation handlers */}
      {onClaim && onAppeal && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="rounded-sm border border-gray-800 bg-transparent p-3 flex flex-wrap items-center justify-center gap-3">
            {payload.acceptedAt ? (
              <div className="flex items-center gap-2.5 px-8 py-3 font-mono text-sm tracking-widest uppercase text-lime-300">
                <ShieldCheck className="w-5 h-5" />
                VERDICT ACCEPTED — RULING FINAL
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClaim}
                  className="px-8 py-3 bg-[#b4ff39] hover:bg-[#c6ff66] text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-[0_0_25px_rgba(180,255,57,0.4)] hover:shadow-[0_0_35px_rgba(180,255,57,0.8)] hover:scale-[1.02] cursor-pointer"
                >
                  <ShieldCheck className="w-5 h-5" />
                  ACCEPT VERDICT
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={onAppeal}
                  className="px-8 py-3 bg-[#ffb703] hover:bg-[#ca8a04] text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-[0_0_25px_rgba(255,183,3,0.4)] hover:shadow-[0_0_35px_rgba(255,183,3,0.8)] hover:scale-[1.02] cursor-pointer"
                >
                  <Gavel className="w-5 h-5" />
                  APPEAL TO THE ARBITER
                  <ArrowRight className="w-5 h-5" />
                </button>
                {/*
                  A verdict already attributed to another household is closed to
                  further tips — the address is never shown publicly, only that a
                  response is pending.
                */}
                {onInform && !payload.attributed && (
                  <button
                    type="button"
                    onClick={onInform}
                    className="px-8 py-3 bg-transparent hover:bg-gray-800 text-gray-200 border border-gray-600 hover:border-lime-400 font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2.5 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <UserSearch className="w-5 h-5 text-lime-400" />
                    SUBMIT AS EVIDENCE FOR SOMEONE ELSE
                  </button>
                )}
              </>
            )}
          </div>
          {payload.attributed && !payload.acceptedAt && (
            <p className="text-[10px] font-mono text-amber-400/90 tracking-widest uppercase">
              VERDICT ATTRIBUTED — RESPONSE PENDING. ONLY THE ACCUSED HOUSEHOLD MAY CLAIM OR APPEAL.
            </p>
          )}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-900 pt-2">
            <p className="text-[10px] font-mono text-amber-400/90 tracking-widest uppercase">
              {IDENTITY.secondaryLine}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
              <button
                type="button"
                onClick={onOpenGrid}
                disabled={!onOpenGrid}
                className="flex items-center gap-2 transition-colors hover:text-lime-400 cursor-pointer disabled:cursor-default disabled:hover:text-gray-500"
                title="Open the Planetary Grid (/grid)"
              >
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                <span>OBJECT AUDIT ENGINE ONLINE | {IDENTITY.entityName.toUpperCase()}</span>
              </button>
              <button
                type="button"
                onClick={onOpenAdjudicators}
                disabled={!onOpenAdjudicators}
                className="whitespace-nowrap text-lime-700 transition-colors hover:text-lime-400 cursor-pointer disabled:cursor-default disabled:hover:text-lime-700"
                title="Meet the staff on duty (/adjudicators)"
              >
                {ADJUDICATORS_ON_DUTY}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArbitrationDossier;
