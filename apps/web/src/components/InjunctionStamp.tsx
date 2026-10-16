import React, { useEffect, useRef } from 'react';
import { INJUNCTION_STAMP } from '@ecocide/lore';
import { soundFx } from '../lib/audio';
import { DossierStamp } from './DossierStamp';

interface InjunctionStampProps {
  /** When the verdict was accepted — the stamp's file date. */
  acceptedAt?: string;
  /** Open the worksheet filtered to this verdict. */
  onOpen: () => void;
}

/**
 * The injunction stamp — the mark left on a dossier once its corrective orders
 * have been issued. Copy and ink come from the lore pack (`INJUNCTION_STAMP`), so
 * it can never read as a verdict: it uses the art bible's *archive* ink, which no
 * tier uses.
 *
 * The visual idiom lives in `DossierStamp`; this wrapper adds the file date, the
 * click through to the worksheet, and the landing sound.
 */
export const InjunctionStamp: React.FC<InjunctionStampProps> = ({ acceptedAt, onOpen }) => {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    soundFx.playLockIn();
  }, []);

  return (
    <DossierStamp
      ink={INJUNCTION_STAMP.ink}
      label={INJUNCTION_STAMP.label}
      subline={acceptedAt ? `${INJUNCTION_STAMP.dated} ${acceptedAt.slice(0, 10)}` : undefined}
      title="Open the orders issued for this verdict"
      onClick={() => {
        soundFx.playClick();
        onOpen();
      }}
    />
  );
};
