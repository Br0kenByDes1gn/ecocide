import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { CheckCircle2 } from 'lucide-react';
import { downloadHouseholdDossierPng } from '../lib/dossierCardPng';
import { fullAuditReveal } from '../lib/useAuditReveal';
import { useProphecyTypewriter } from '../lib/useProphecyTypewriter';
import { DossierActions } from './DossierActions';
import { HouseholdAuditCard } from './HouseholdAuditCard';
import { DossierProphecy } from './DossierProphecy';

interface CitizenDossierProps {
  payload: OraclePayload;
  evidenceUrl?: string;
  onReset: () => void;
  permalinkId?: string;
}

/**
 * Static citizen dossier shown at /citizen/:id (also the permalink target of
 * the share buttons). The card is fully revealed; the narrative paragraphs
 * type on mount; the remediation pledges are listed beneath.
 */
export const CitizenDossier: React.FC<CitizenDossierProps> = ({
  payload,
  evidenceUrl,
  onReset,
  permalinkId,
}) => {
  const { user_profile, prophecy, audit, suggestions } = payload;
  const reveal = fullAuditReveal(user_profile, audit);
  const typewriter = useProphecyTypewriter(prophecy);

  const handleDownloadCard = () => {
    downloadHouseholdDossierPng({ payload, permalinkId });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <HouseholdAuditCard payload={payload} evidenceUrl={evidenceUrl} reveal={reveal} />

      <DossierProphecy
        headline={prophecy.headline}
        text1={typewriter.text1}
        text2={typewriter.text2}
        text3={typewriter.text3}
        isTyping={typewriter.isTyping}
        caste={user_profile.caste}
      />

      {/* Remediation orders / pledges available */}
      {suggestions.length > 0 && (
        <div className="bg-[#121a14] rounded-2xl border border-teal-500/40 p-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <CheckCircle2 className="w-5 h-5 text-teal-300" />
            <h3 className="font-mono text-sm font-bold text-teal-300 tracking-wider uppercase">
              REMEDIATION ORDERS // PLEDGES AVAILABLE
            </h3>
          </div>
          <ul className="mt-4 space-y-3">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm font-mono text-gray-300">
                <span className="text-teal-400 font-black shrink-0">+{s.impact_pct}%</span>
                <span className="leading-relaxed">
                  {s.text}{' '}
                  <span className="text-gray-500 text-xs">— {s.pledge}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] font-mono text-gray-500">
            ALL VALUES ARE ESTIMATES // SOURCE ON FILE // FILE AN APPEAL TO PLEDGE THESE ORDERS
          </p>
        </div>
      )}

      <DossierActions
        onReset={onReset}
        onDownload={handleDownloadCard}
        payload={payload}
        share={{
          permalinkId,
          honorificTitle: user_profile.honorific_title,
          factionName: '',
          stampText: getFaction(user_profile.caste).stampText,
          ratio: user_profile.biocarbon_ratio,
          itemsScanned: audit.items.length,
        }}
      />
    </div>
  );
};