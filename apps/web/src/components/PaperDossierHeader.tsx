import React from 'react';
import { Recycle } from 'lucide-react';

interface PaperDossierHeaderProps {
  caseId: string | null;
  sessionDate?: string;
  /** Subtitle under the bureau title; arbitration keeps the default. */
  subtitle?: string;
  /** Optional second identifier shown under the case ID (citizen page). */
  citizenId?: string | null;
  /** Larger ID text (citizen page); arbitration keeps the compact size. */
  largeIds?: boolean;
  /** Render the subtitle centered below the ID row instead of beside the bureau title. */
  subtitleBelowIds?: boolean;
}

/** Vertical barcode block: varied bar widths, same family as the arbitration dossier. */
const Barcode: React.FC<{ bars: readonly number[] }> = ({ bars }) => (
  <div className="inline-flex w-20 sm:w-24 h-12 items-stretch gap-[2px] p-[3px]">
    {bars.map((w, i) => (
      <span
        key={i}
        className="block h-full bg-[#1f2a1f] barcode-bar"
        style={{ width: `${w}px` }}
      />
    ))}
  </div>
);

function barcodeBarsFor(caseId: string | null): number[] {
  const source = caseId || 'AUDIT';
  const widths = new Set<number>();
  let guard = 0;
  while (widths.size < 16 && guard < 96) {
    const code = source.charCodeAt(guard % source.length) || 1;
    // fractional px widths so adjacent bars do not repeat
    widths.add(Math.round(((code * 37 + (guard + 11) * 19) % 75 + 8) / 10 * 10) / 10);
    guard += 1;
  }
  return [...widths];
}

function sessionDateTextFor(sessionDate?: string): string | null {
  if (!sessionDate) return null;
  const parsed = new Date(sessionDate);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Standalone barcode + date block, shared wherever a paper header needs one. */
export const DossierBarcode: React.FC<{
  caseId: string | null;
  sessionDate?: string;
  large?: boolean;
}> = ({ caseId, sessionDate, large = false }) => {
  const bars = React.useMemo(() => barcodeBarsFor(caseId), [caseId]);
  const dateText = sessionDateTextFor(sessionDate);
  return (
    <div className="flex flex-col items-center shrink-0">
      <Barcode bars={bars} />
      <span
        className={`mt-1 ${
          large ? 'text-[9px] sm:text-xs' : 'text-[9px]'
        } font-mono font-black uppercase tracking-widest text-[#6b7263] whitespace-nowrap`}
        style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
      >
        {dateText ? dateText.toUpperCase() : (caseId ? `#${caseId}` : 'UNAVAILABLE')}
      </span>
    </div>
  );
};

/**
 * Shared paper-dossier header used by the arbitration and citizen dossiers:
 * recycling mark, bureau titles, barcode/date block, and case ID.
 */
export const PaperDossierHeader: React.FC<PaperDossierHeaderProps> = ({
  caseId,
  sessionDate,
  subtitle = 'CONSUMER IMPACT DOSSIER',
  citizenId = null,
  largeIds = false,
  subtitleBelowIds = false,
}) => {
  const barcodeBars = React.useMemo(() => barcodeBarsFor(caseId), [caseId]);

  const sessionDateText = sessionDateTextFor(sessionDate);

  return (
    <>
      <div className="relative flex items-start justify-between gap-3 border-b border-[#cfc4a8] pb-px">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Recycle className="w-9 h-9 sm:w-16 sm:h-16 shrink-0" style={{ color: '#2f7d3a' }} />
          {/*
            `min-h`, never a fixed height: on a narrow screen the bureau title
            wraps onto two or three lines, and a fixed box let that content spill
            out of its own row and over the case IDs below.
          */}
          <div className="flex flex-col justify-center min-h-[3.45rem] min-w-0 gap-0">
            <div className="text-base sm:text-xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight break-words">
              PLANETARY AUDIT BUREAU
            </div>
            {!subtitleBelowIds && (
              <div className="text-left text-[10px] sm:text-sm font-mono uppercase tracking-widest text-[#6b7263] leading-tight">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <Barcode bars={barcodeBars} />
          <span
            className={`mt-1 ${
              largeIds ? 'text-[9px] sm:text-xs' : 'text-[9px]'
            } font-mono font-black uppercase tracking-widest text-[#6b7263] whitespace-nowrap`}
            style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
          >
            {sessionDateText
              ? sessionDateText.toUpperCase()
              : (caseId ? `#${caseId}` : 'UNAVAILABLE')}
          </span>
        </div>
      </div>
      {/*
        The IDs wrap and break rather than clip: the citizen id is a full email
        address, which is wider than the paper on any phone.
      */}
      <div
        className={`relative ${largeIds ? 'mt-[7px]' : 'mt-0'} flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5`}
      >
        <span
          className={`${
            largeIds ? 'text-[13px] sm:text-[17px]' : 'text-[9px]'
          } font-mono font-black uppercase tracking-widest text-[#6b7263] break-all`}
          style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
        >
          Case ID - {caseId ? `#${caseId}` : 'UNAVAILABLE'}
        </span>
        {citizenId && (
          <span
            className={`${
              largeIds ? 'text-[13px] sm:text-[17px]' : 'text-[9px]'
            } font-mono font-black uppercase tracking-widest text-[#6b7263] break-all`}
            style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
          >
            Citizen ID - {citizenId}
          </span>
        )}
      </div>
      {subtitleBelowIds && (
        <div
          className={`relative mt-[11px] text-center ${
            largeIds ? 'text-[13px] sm:text-[17px]' : 'text-[9px]'
          } font-mono font-black uppercase tracking-widest text-[#6b7263]`}
          style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
        >
          {subtitle}
        </div>
      )}
    </>
  );
};
