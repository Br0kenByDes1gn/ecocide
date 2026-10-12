import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { Gavel, ShieldCheck } from 'lucide-react';
import { useArbitrationFlow } from '../lib/useArbitrationFlow';
import { useAvatarSynthesis } from '../lib/useAvatarSynthesis';
import { useIdentityReveal } from '../lib/useIdentityReveal';
import { DossierIdentityCard } from './DossierIdentityCard';
import { DossierProphecy } from './DossierProphecy';

interface ArbitrationDossierProps {
  payload: OraclePayload;
  portraitUrl: string;
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
 *   1. The biometric mesh portrait scans in, then the stats fill one at a time
 *      (title, presentation, utility grade, asset value, energy level) and the
 *      Compliance Ratio counts up.
 *   2. Pause, then the filled card compacts into a summary bar (mesh + ratio +
 *      title) freeing space for the verdict.
 *   3. The three prophecy paragraphs type at a larger size, each pausing and
 *      collapsing to its first line before the next begins.
 *   4. Once complete, the compact card and each collapsed paragraph can be
 *      clicked (one-way) to expand back to their full size.
 *
 * The bottom of the screen offers the CLAIM / APPEAL flow instead of the
 * archive action row (which belongs on /citizen/:id).
 */
export const ArbitrationDossier: React.FC<ArbitrationDossierProps> = ({
  payload,
  portraitUrl,
  permalinkId,
  onClaim,
  onAppeal,
}) => {
  const { user_profile, prophecy } = payload;

  const avatar = useAvatarSynthesis(permalinkId, payload.avatarUrl, payload.avatarStatus);
  const { reveal, skip: skipReveal } = useIdentityReveal(payload.user_profile);
  const flow = useArbitrationFlow(prophecy, reveal.isComplete);

  const handleSkip = () => {
    skipReveal();
    flow.skip();
  };

  const statusLine = !reveal.isComplete
    ? 'PROCESSING BIOMETRIC IDENTIFICATION...'
    : flow.state.phase === 'typing'
    ? 'RECEIVING QUANTUM TELEMETRY STREAM...'
    : flow.state.isComplete
    ? null
    : 'COMPRESSING DOSSIER TO EXECUTIVE SUMMARY...';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <DossierIdentityCard
        payload={payload}
        portraitUrl={portraitUrl}
        permalinkId={permalinkId}
        avatar={avatar}
        reveal={reveal}
        headerLabel={`${IDENTITY.appName} // CLASSIFICATION PROCEEDING`}
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
          <div className="font-mono text-[11px] tracking-[0.35em] text-cyan-400/90 uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            VERDICT DELIVERED
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={onClaim}
              className="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl font-mono text-base tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              CLAIM
            </button>
            <button
              type="button"
              onClick={onAppeal}
              className="px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl font-mono text-base tracking-widest uppercase flex items-center gap-2.5 transition-all shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] cursor-pointer"
            >
              <Gavel className="w-5 h-5" />
              APPEAL
            </button>
          </div>
          <p className="text-[10px] font-mono text-gray-500">
            CLAIM REGISTERS YOUR DESIGNATION. APPEAL CHALLENGES THE RULING.
          </p>
        </div>
      )}
    </div>
  );
};