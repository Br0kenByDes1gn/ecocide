import React from 'react';
import { getFaction } from '@ecocide/types';
import { DISPOSITION_COPY } from '@ecocide/lore';
import type { LucideIcon } from 'lucide-react';
import { loreIcon } from '../lib/lore-icons';
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
 * lettering and the glyphs use the tier's matte `stampInk`, because three of the
 * six hexes are far too bright to read as ink on the paper layer (§3.2). The copy
 * comes from the pack; the glyphs are line icons resolved from the pack's keys
 * (`disposition.icons`), never colour emoji.
 */
export const DispositionStamp: React.FC<DispositionStampProps> = ({ caste, onClick }) => {
  const faction = getFaction(caste);
  const { label, icons } = faction.disposition;
  const Glyphs = icons.map(loreIcon).filter((Icon): Icon is LucideIcon => Boolean(Icon));

  return (
    <DossierStamp
      ink={faction.stampInk}
      borderColor={faction.colors.hex}
      label={label}
      icons={Glyphs}
      title={DISPOSITION_COPY.open}
      onClick={onClick}
    />
  );
};
