import React from 'react';
import { getFaction } from '@ecocide/types';
import { DISPOSITION_COPY } from '@ecocide/lore';
import { DossierStamp } from './DossierStamp';

interface DispositionStampProps {
  /** Internal tier id (the pack resolves name, colours and copy). */
  caste: string;
  onClick: () => void;
}

/**
 * The Bureau's disposition mark for this household — the second stamp on the
 * dossier, opposite the injunction's. It carries no date: it is not a filing, it
 * is a statement of what the Bureau intends to do with you.
 *
 * Colour follows the art bible: the tier's hex outlines the stamp while the
 * lettering uses the tier's matte `stampInk`, because three of the six hexes are
 * far too bright to read as ink on the paper layer (§3.2). The copy — label,
 * emoji, and the detail it opens — comes from the pack.
 */
export const DispositionStamp: React.FC<DispositionStampProps> = ({ caste, onClick }) => {
  const faction = getFaction(caste);
  const { label, emoji } = faction.disposition;

  return (
    <DossierStamp
      ink={faction.stampInk}
      borderColor={faction.colors.hex}
      label={label}
      emoji={emoji}
      title={DISPOSITION_COPY.open}
      onClick={onClick}
    />
  );
};
