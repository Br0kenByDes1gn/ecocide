import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { Gavel, ShieldCheck } from 'lucide-react';
import { useArbitrationFlow } from '../lib/useArbitrationFlow';
import { useAuditReveal } from '../lib/useAuditReveal';
import { HouseholdAuditCard } from './HouseholdAuditCard';
import { DossierProphecy } from './DossierProphecy';

interface ArbitrationDossierProps {
  payload: OraclePayload;
  evidenceUrl?: string;
  permalinkId?: string;
  /** Navigate to the claim screen (/claim/:id). Only wired when a permalink exists. */
  onClaim?: () => void;
  /** Navigate to the appeal screen (/appeal/:id). Only wired when a permalink exists. */
  onAppeal?: () => void;
}

/**
 * The animated dossier shown at /arbitration/:id right after a scan completes.
 *
 * Animation sequence:
 *   1. The annotated evidence photo scans in; the title types and the
 *      Household Sustainability Index counts up.
 *   2. The card compacts into a summary bar (stamp + title + ratio).
 *   3. The three verdict paragraphs type at a larger size, each pausing and
 *      collapsing to its first line before the next begins.
 *   4. Once complete, the compact card and each collapsed paragraph can be
 *      clicked (one-way) to expand back to their full size.
 */
export const ArbitrationDossier: React.FC<ArbitrationDossierProps> = ({
  payload,
  evidenceUrl,
  permalinkId,
  onClaim,
  onAppeal,
}) => {
  const { user_profile, prophecy, audit } = payload;

  const { reveal, skip: skipReveal } = useAuditReveal(user_profile, audit);
  const flow = useArbitrationFlow(prophecy, reveal.isComplete);

  const handleSkip = () => {
    skipReveal();
    flow.skip();
  };

  const statusLine = !reveal.isComplete
    ? 'PROCESSING HOUSEHOLD AUDIT...'
    : flow.state.phase === 'typing'
    ? 'RECEIVING AUDIT TELEMETRY STREAM...'
    : flow.state.isComplete
    ? null
    : 'COMPRESSING DOSSIER TO EXECUTIVE SUMMARY...';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <HouseholdAuditCard
        payload={payload}
        evidenceUrl={evidenceUrl}
        reveal={reveal}
        headerLabel={`${IDENTITY.appName} // HOUSEHOLD AUDIT PROCEEDING`}
        compact={flow.state.cardCompact}
        interactive={flow.state.isComplete}
        onExpand={flow.expandCard}
      />

      <DossierProphecy
        headline={prophecy.headline}
        text1={flow.state.paragraphs[0].text}
        text2={flow.state.paragraphs[1].text}
        text3={flow.state.paragraphs[2].text}
        isTyping={flow.state.phase === 'typing'}
        caste={user_profile.caste}
        statusLine={statusLine}
        fontSize="lg"
        paragraphCollapsed={flow.state.paragraphs.map((p) => p.collapsed)}
        paragraphExpanded={flow.state.paragraphs.map((p) => p.expanded)}
        interactive={flow.state.isComplete}
        onExpandParagraph={flow.expandParagraph}
        onFastForward={flow.state.isComplete ? undefined : handleSkip}
        fastForwardLabel="ACCELERATE"
      />

      {onClaim && onAppeal && (
        <div className="flex flex-col items-center gap-4 pt-2 pb-2">
          <div className="font-mono text-[11px] tracking-[0.35em] text-lime-400/90 uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            VERDICT DELIVERED
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={onClaim}
              className="px-10 py-4 bg-[#b4ff39] hover:bg-lime-300 text-black font-black rounded-xl font-mono text-base tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-lg hover:scale-[1.02] cursor-pointer"
              style={{ boxShadow: '0 0 30px rgba(180,255,57,0.5)' }}
            >
              <ShieldCheck className="w-5 h-5" />
              ACCEPT VERDICT
            </button>
            <button
              type="button"
              onClick={onAppeal}
              className="px-10 py-4 bg-[#ffb703] hover:bg-amber-400 text-black font-black rounded-xl font-mono text-base tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-lg hover:scale-[1.02] cursor-pointer"
              style={{ boxShadow: '0 0 30px rgba(255,183,3,0.4)' }}
            >
              <Gavel className="w-5 h-5" />
              FILE APPEAL
            </button>
          </div>
          <p className="text-[10px] font-mono text-gray-500">
            {IDENTITY.secondaryLine.toUpperCase()} — ACCEPT REGISTERS THE DESIGNATION. APPEAL CHALLENGES THE RULING.
          </p>
        </div>
      )}
    </div>
  );
};