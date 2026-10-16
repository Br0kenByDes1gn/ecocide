import React, { useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { CheckCircle2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { downloadHouseholdDossierPng } from '../lib/dossierCardPng';
import { fullAuditReveal } from '../lib/useAuditReveal';
import { useVault } from '../lib/useVault';
import { soundFx } from '../lib/audio';
import { useInjunctionStamp } from '../lib/useInjunction';
import { DossierActions } from './DossierActions';
import { InjunctionStamp } from './InjunctionStamp';
import { HouseholdAuditCard } from './HouseholdAuditCard';
import { DossierProphecy } from './DossierProphecy';
import { PaperDossierHeader } from './PaperDossierHeader';
import { PaperInventoryTable } from './PaperInventoryTable';

interface CitizenDossierProps {
  payload: OraclePayload;
  evidenceUrl?: string;
  onReset: () => void;
  permalinkId?: string;
  sessionDate?: string;
  /** Open the injunction worksheet filtered to this verdict (absent where there is none). */
  onOpenInjunction?: (dossierId: string) => void;
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
  onOpenInjunction,
}) => {
  const { user_profile, prophecy, audit, suggestions } = payload;
  const reveal = fullAuditReveal(user_profile, audit);
  const { vault } = useVault();

  const caseId = permalinkId || payload.id || null;
  // Citizen ID mirrors the registry "Registered to" identity (vault account email).
  const citizenId = vault?.user.email ?? (permalinkId ? `#${permalinkId}` : null);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // Once the verdict is accepted the orders are issued in the background, so the
  // stamp waits for them: immediate on a later visit, a short poll on the visit
  // right after accepting.
  const injunction = useInjunctionStamp(permalinkId, Boolean(payload.acceptedAt));

  const handleDownloadCard = () => {
    downloadHouseholdDossierPng({ payload, permalinkId });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <HouseholdAuditCard payload={payload} evidenceUrl={evidenceUrl} reveal={reveal} hideInventory />

        <div className="space-y-6">
          <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-4 flex flex-col min-w-0 overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
            <PaperDossierHeader caseId={caseId} sessionDate={sessionDate} subtitle="IMPACT FINDINGS" citizenId={citizenId} largeIds subtitleBelowIds />
            <div className="relative mt-[11px] rounded-sm border border-[#cfc4a8] bg-[#fbf7ea] p-3">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setInventoryOpen((o) => !o);
                }}
                className="w-full flex items-center justify-between text-xs font-mono text-[#1f2a1f] hover:text-[#6b7263] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#6b7263]" />
                  AUDIT INVENTORY ({audit.items.length} ITEMS{audit.hardFails > 0 ? ` - ${audit.hardFails} FLAGGED` : ''})
                </span>
                {inventoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {inventoryOpen && (
                <PaperInventoryTable items={audit.items} evidenceUrl={evidenceUrl} />
              )}
            </div>
            <div className="relative mt-6">
              <DossierProphecy
                headline={prophecy.headline}
                text1={prophecy.paragraph_1}
                text2={prophecy.paragraph_2}
                text3={prophecy.paragraph_3}
                isTyping={false}
                caste={user_profile.caste}
                tone="paper"
              />
            </div>

            {/* Remediation orders / pledges available */}
            {suggestions.length > 0 && (
              <div
                className="relative mt-6 rounded-sm border border-[#cfc4a8] p-4"
                style={{ letterSpacing: '1px' }}
              >
                <div className="flex items-center gap-2 border-b border-[#cfc4a8] pb-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1f2a1f]" />
                  <h3 className="text-sm font-bold text-[#1f2a1f] tracking-wider uppercase">
                    REMEDIATION ORDERS - PLEDGES AVAILABLE
                  </h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#2c3a2c]">
                      <span className="text-[#1f2a1f] font-black shrink-0">+{s.impact_pct}%</span>
                      <span className="leading-relaxed">
                        {s.text}{' '}
                        <span className="text-[#6b7263] text-xs">— {s.pledge}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[10px] text-[#6b7263]">
                  ALL VALUES ARE ESTIMATES - SOURCE ON FILE - FILE AN APPEAL TO PLEDGE THESE ORDERS
                </p>
              </div>
            )}
            {injunction.status === 'issued' && permalinkId && (
              <div className="relative mt-6 flex justify-end">
                <InjunctionStamp
                  acceptedAt={payload.acceptedAt}
                  onOpen={() => onOpenInjunction(permalinkId)}
                />
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