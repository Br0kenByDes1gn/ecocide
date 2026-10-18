import React, { useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { downloadHouseholdDossier } from '../lib/dossier-export';
import { fullAuditReveal } from '../lib/useAuditReveal';
import { useVault } from '../lib/useVault';
import type { LensId } from '../lib/audit-lenses';
import { useInjunctionStamp } from '../lib/useInjunction';
import { DossierActions } from './DossierActions';
import { DispositionModal } from './DispositionModal';
import { DossierSheet } from './DossierSheet';
import { HouseholdAuditCard } from './HouseholdAuditCard';
import { PaperDossierPanel } from './PaperDossierPanel';

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
  const { user_profile, audit } = payload;
  const reveal = fullAuditReveal(user_profile, audit);
  const { vault } = useVault();

  // Citizen ID mirrors the registry "Registered to" identity (vault account email).
  const citizenId = vault?.user.email ?? (permalinkId ? `#${permalinkId}` : null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [dispositionOpen, setDispositionOpen] = useState(false);
  // The page owns the chosen lens so the PNG export can reproduce it.
  const [lens, setLens] = useState<LensId>('neon-outline');
  const [preparingPng, setPreparingPng] = useState(false);

  // Once the verdict is accepted the orders are issued in the background, so the
  // stamp waits for them: immediate on a later visit, a short poll on the visit
  // right after accepting. The public record's filing state is what a reader who
  // may not open the orders (a shared permalink, a locked registry) sees instead.
  const injunction = useInjunctionStamp(permalinkId, Boolean(payload.acceptedAt), {
    filed: Boolean(payload.injunctionFiledAt),
    orders: payload.injunctionOrders ?? 0,
  });

  const handleDownloadCard = async () => {
    if (preparingPng) return;
    setPreparingPng(true);
    try {
      await downloadHouseholdDossier({
        payload,
        permalinkId,
        evidenceUrl,
        sessionDate,
        citizenId,
        lens,
        // The export carries the same mark it always did; the newest states are
        // the page's own copy and are not painted into the downloaded card.
        injunctionStatus:
          injunction.status === 'issued'
            ? 'issued'
            : injunction.status === 'waiting'
            ? 'waiting'
            : 'idle',
      });
    } catch (e) {
      console.error('[Dossier] PNG export failed:', e);
    } finally {
      setPreparingPng(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
      <DossierSheet
        card={
          <HouseholdAuditCard
            payload={payload}
            evidenceUrl={evidenceUrl}
            reveal={reveal}
            lens={lens}
            onLensChange={setLens}
            hideInventory
          />
        }
        panel={
          <>
            <PaperDossierPanel
              payload={payload}
              evidenceUrl={evidenceUrl}
              permalinkId={permalinkId}
              sessionDate={sessionDate}
              citizenId={citizenId}
              injunction={injunction}
              onOpenInjunction={onOpenInjunction}
              onRetryInjunction={injunction.canRetry ? injunction.retry : undefined}
              onOpenDisposition={() => setDispositionOpen(true)}
              inventoryOpen={inventoryOpen}
              onToggleInventory={() => setInventoryOpen((o) => !o)}
            />

            <DossierActions
              onReset={onReset}
              onDownload={handleDownloadCard}
              busy={preparingPng}
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
          </>
        }
      />

      <DispositionModal
        isOpen={dispositionOpen}
        onClose={() => setDispositionOpen(false)}
        caste={user_profile.caste}
        index={user_profile.biocarbon_ratio}
      />
    </div>
  );
};