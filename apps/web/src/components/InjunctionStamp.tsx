import React, { useEffect, useRef } from 'react';
import { INJUNCTION_STAMP } from '@ecocide/lore';
import { soundFx } from '../lib/audio';
import { DossierStamp } from './DossierStamp';

interface InjunctionStampProps {
  /** When the verdict's orders were filed — the stamp's file date. */
  filedAt?: string;
  /**
   * Open the worksheet filtered to this verdict. Omitted when the reader may not
   * read the actions: the mark is then a record of the filing, not an entry point.
   */
  onOpen?: () => void;
  /**
   * `orders` — the checklist has corrective actions (archive ink).
   * `none`   — it was filed with none: the household needed no correction, and
   *            the mark lands in the success green so a clean bill of health
   *            reads as a finding rather than as missing paperwork.
   */
  variant?: 'orders' | 'none';
}

/**
 * The injunction stamp — the mark left on a dossier once its corrective orders
 * have been issued. Copy and ink come from the lore pack (`INJUNCTION_STAMP`), so
 * it can never read as a verdict: the orders mark uses the art bible's *archive*
 * ink, which no tier uses.
 *
 * The visual idiom lives in `DossierStamp`; this wrapper adds the file date, the
 * click through to the worksheet, and the landing sound.
 */
export const InjunctionStamp: React.FC<InjunctionStampProps> = ({
  filedAt,
  onOpen,
  variant = 'orders',
}) => {
  const playedRef = useRef(false);
  const isNone = variant === 'none';

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    soundFx.playLockIn();
  }, []);

  return (
    <DossierStamp
      ink={isNone ? INJUNCTION_STAMP.noneInk : INJUNCTION_STAMP.ink}
      borderColor={isNone ? INJUNCTION_STAMP.noneInk : undefined}
      label={isNone ? INJUNCTION_STAMP.none : INJUNCTION_STAMP.label}
      subline={filedAt ? `${INJUNCTION_STAMP.dated} ${filedAt.slice(0, 10)}` : undefined}
      title={isNone ? undefined : 'Open the orders issued for this verdict'}
      onClick={
        isNone || !onOpen
          ? undefined
          : () => {
              soundFx.playClick();
              onOpen();
            }
      }
    />
  );
};
