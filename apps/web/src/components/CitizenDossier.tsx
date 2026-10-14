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
import { PaperDossierHeader } from './PaperDossierHeader';

interface CitizenDossierProps {
  payload: OraclePayload;
  evidenceUrl?: string;
  onReset: () => void;
  permalinkId?: string;
  sessionDate?: string;
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
  sessionDate,
}) => {
  const { user_profile, prophecy, audit, suggestions } = payload;
  const reveal = fullAuditReveal(user_profile, audit);
  const typewriter = useProphecyTypewriter(prophecy);

  const caseId = permalinkId || payload.id || null;

  const handleDownloadCard = () => {
    downloadHouseholdDossierPng({ payload, permalinkId });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <HouseholdAuditCard payload={payload} evidenceUrl={evidenceUrl} reveal={reveal} />

        <div className="space-y-6">
          <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-4 flex flex-col min-w-0 overflow-hidden space-y-6">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
            <PaperDossierHeader caseId={caseId} sessionDate={sessionDate} subtitle="IMPACT FINDINGS" />
            <div className="relative">
              <DossierProphecy
                headline={prophecy.headline}
                text1={typewriter.text1}
                text2={typewriter.text2}
                text3={typewriter.text3}
                isTyping={typewriter.isTyping}
                caste={user_profile.caste}
                tone="paper"
              />
            </div>

            {/* Remediation orders / pledges available */}
            {suggestions.length > 0 && (
              <div className="relative rounded-sm border border-[#cfc4a8] bg-[#fbf7ea] p-4">
                <div className="flex items-center gap-2 border-b border-[#cfc4a8] pb-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1f2a1f]" />
                  <h3 className="font-mono text-sm font-bold text-[#1f2a1f] tracking-wider uppercase">
                    REMEDIATION ORDERS // PLEDGES AVAILABLE
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-mono text-[#2c3a2c]">
                      <span className="text-[#1f2a1f] font-black shrink-0">+{s.impact_pct}%</span>
                      <span className="leading-relaxed">
                        {s.text}{' '}
                        <span className="text-[#6b7263] text-xs">— {s.pledge}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[10px] font-mono text-[#6b7263]">
                  ALL VALUES ARE ESTIMATES // SOURCE ON FILE // FILE AN APPEAL TO PLEDGE THESE ORDERS
                </p>
              </div>
            )}
          </div>

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
      </div>
    </div>
  );
};