import React from 'react';
import { Recycle } from 'lucide-react';

interface PaperDossierHeaderProps {
  caseId: string | null;
  sessionDate?: string;
  /** Subtitle under the bureau title; arbitration keeps the default. */
  subtitle?: string;
}

/** Vertical barcode block: varied bar widths, same family as the arbitration dossier. */
const Barcode: React.FC<{ bars: readonly number[] }> = ({ bars }) => (
  <div className="inline-flex w-24 h-12 items-stretch gap-[2px] p-[3px]">
    {bars.map((w, i) => (
      <span
        key={i}
        className="block h-full bg-[#1f2a1f] barcode-bar"
        style={{ width: `${w}px` }}
      />
    ))}
  </div>
);

/**
 * Shared paper-dossier header used by the arbitration and citizen dossiers:
 * recycling mark, bureau titles, barcode/date block, and case ID.
 */
export const PaperDossierHeader: React.FC<PaperDossierHeaderProps> = ({
  caseId,
  sessionDate,
  subtitle = 'CONSUMER IMPACT DOSSIER',
}) => {
  const barcodeBars = React.useMemo(() => {
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
  }, [caseId]);

  const sessionDateText = (() => {
    if (!sessionDate) return null;
    const parsed = new Date(sessionDate);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  })();

  return (
    <>
      <div className="relative flex items-start justify-between gap-3 border-b border-[#cfc4a8] pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <Recycle className="w-16 h-16 shrink-0" style={{ color: '#2f7d3a' }} />
          <div className="flex flex-col justify-center h-[3.45rem] min-w-0 gap-0">
            <div className="text-xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight">
              PLANETARY AUDIT BUREAU
            </div>
            <div className="text-left text-sm font-mono uppercase tracking-widest text-[#6b7263] leading-tight">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <Barcode bars={barcodeBars} />
          <span
            className="mt-1 text-[9px] font-mono font-black uppercase tracking-widest text-[#6b7263] whitespace-nowrap"
            style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
          >
            {sessionDateText
              ? sessionDateText.toUpperCase()
              : (caseId ? `#${caseId}` : 'UNAVAILABLE')}
          </span>
        </div>
      </div>
      <div className="relative mt-1 text-xl font-black font-mono uppercase tracking-widest text-[#1f2a1f] leading-tight">
        Case ID - {caseId ? `#${caseId}` : 'UNAVAILABLE'}
      </div>
    </>
  );
};
