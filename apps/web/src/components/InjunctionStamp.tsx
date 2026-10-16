import React, { useEffect, useRef, useState } from 'react';
import { INJUNCTION_STAMP } from '@ecocide/lore';
import { soundFx } from '../lib/audio';

interface InjunctionStampProps {
  /** When the verdict was accepted — the stamp's file date. */
  acceptedAt?: string;
  /** Open the worksheet filtered to this verdict. */
  onOpen: () => void;
}

/**
 * The injunction stamp — the mark left on a dossier once its corrective orders
 * have been issued. Copy and ink both come from the lore pack (see
 * `INJUNCTION_STAMP`), so the stamp can never read as a verdict: it uses the
 * art bible's *archive* ink, which no tier uses.
 *
 * Visually it follows the tier stamp's idiom (TierStamp.tsx): ink-coloured text,
 * a hard border, a slight tilt and an inset shadow, as if pressed onto the paper
 * layer — and it lands with a short press animation (`stamp-land` in index.css,
 * which the global reduced-motion rule already flattens for citizens who ask for
 * less motion).
 */
export const InjunctionStamp: React.FC<InjunctionStampProps> = ({ acceptedAt, onOpen }) => {
  const [landed, setLanded] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    setLanded(true);
    soundFx.playLockIn();
  }, []);

  const ink = INJUNCTION_STAMP.ink;
  const filedOn = acceptedAt ? acceptedAt.slice(0, 10) : null;

  return (
    <button
      type="button"
      onClick={() => {
        soundFx.playClick();
        onOpen();
      }}
      title="Open the orders issued for this verdict"
      className={`${
        landed ? 'stamp-land' : 'opacity-0'
      } px-4 py-2 text-left font-mono font-black uppercase tracking-widest select-none transition-transform hover:scale-[1.03] cursor-pointer`}
      style={{
        // The resting tilt also appears as the animation's last keyframe, so
        // there is no jump when the animation ends (or is collapsed by
        // prefers-reduced-motion).
        transform: 'rotate(-2deg)',
        color: ink,
        border: `2px solid ${ink}`,
        backgroundColor: 'rgba(139,90,43,0.08)',
        boxShadow: 'inset 0 0 10px rgba(139,90,43,0.18)',
      }}
    >
      <span className="block text-[13px] leading-none">{INJUNCTION_STAMP.label}</span>
      {filedOn && (
        <span className="mt-1 block text-[9px] font-bold opacity-80">
          {INJUNCTION_STAMP.dated} {filedOn}
        </span>
      )}
    </button>
  );
};
