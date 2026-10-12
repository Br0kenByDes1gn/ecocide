import React, { useMemo } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { CASTE_CENSUS_DATA, calculateCasteUnitId, getCasteMemberTitle } from '@ecocide/types';
import { downloadCitizenDossierPng } from '../lib/dossierCardPng';
import { useAvatarSynthesis } from '../lib/useAvatarSynthesis';
import { fullIdentityReveal } from '../lib/useIdentityReveal';
import { useProphecyTypewriter } from '../lib/useProphecyTypewriter';
import { DossierActions } from './DossierActions';
import { DossierIdentityCard } from './DossierIdentityCard';
import { DossierProphecy } from './DossierProphecy';

interface CitizenDossierProps {
  payload: OraclePayload;
  portraitUrl: string;
  onReset: () => void;
  permalinkId?: string;
}

/**
 * Static citizen dossier shown at /citizen/:id (also the permalink target of
 * the share buttons). Composes the shared dossier building blocks with the
 * identity card fully revealed and the narrative revealing immediately.
 */
export const CitizenDossier: React.FC<CitizenDossierProps> = ({
  payload,
  portraitUrl,
  onReset,
  permalinkId,
}) => {
  const { user_profile, prophecy } = payload;

  const avatar = useAvatarSynthesis(permalinkId, payload.avatarUrl, payload.avatarStatus);
  const reveal = fullIdentityReveal(user_profile);
  const typewriter = useProphecyTypewriter(prophecy);

  const casteMemberName = getCasteMemberTitle(user_profile.caste);
  const casteCensus = CASTE_CENSUS_DATA[user_profile.caste] || CASTE_CENSUS_DATA['Bootlickers'];
  const unitId = useMemo(() => {
    return calculateCasteUnitId(user_profile, casteCensus.population, permalinkId || undefined);
  }, [user_profile, casteCensus.population, permalinkId]);

  const handleDownloadCard = () => {
    downloadCitizenDossierPng({
      userProfile: user_profile,
      prophecy,
      permalinkId,
      portraitUrl,
      avatarUrl: avatar.avatarUrl,
      activeView: avatar.activeView,
      unitId,
      population: casteCensus.population,
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <DossierIdentityCard
        payload={payload}
        portraitUrl={portraitUrl}
        permalinkId={permalinkId}
        avatar={avatar}
        reveal={reveal}
      />

      <DossierProphecy
        headline={prophecy.headline}
        text1={typewriter.text1}
        text2={typewriter.text2}
        text3={typewriter.text3}
        isTyping={typewriter.isTyping}
        caste={user_profile.caste}
      />

      <DossierActions
        onReset={onReset}
        onDownload={handleDownloadCard}
        share={{
          permalinkId,
          honorificTitle: user_profile.honorific_title,
          casteMemberName,
          unitId,
          population: casteCensus.population,
          biocarbonRatio: user_profile.biocarbon_ratio,
        }}
      />
    </div>
  );
};