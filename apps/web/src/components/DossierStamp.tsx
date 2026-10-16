import React, { useEffect, useRef, useState } from 'react';

export interface DossierStampProps {
  /** Ink for the lettering — the art bible's matte ink, not the UI colour. */
  ink: string;
  /** Border + wash colour, normally the tier's hex (art §3.2/§7). */
  borderColor?: string;
  /** The stamped phrase (the pack supplies it). */
  label: string;
  /** Optional glyph that rides the stamp, e.g. a disposition emoji. */
  emoji?: string;
  /** Optional second line under the label, e.g. "FILED 2026-10-16". */
  subline?: string;
  /** Tooltip. */
  title?: string;
  /** Makes the stamp a control; without it the mark is inert. */
  onClick?: () => void;
}

/**
 * A stamp on the paper dossier — the shared visual idiom (art §10's flat
 * rubber-stamp look: hard border, slight tilt, inset shadow, mono caps).
 *
 * Both marks on the dossier use this: the injunction stamp (archive ink, a file
 * date, clickable through to the worksheet) and the caste disposition mark (the
 * tier's colour, an emoji, no date, opens its own file). Keeping one component
 * is the only reason the two can't drift apart.
 *
 * It lands with a short press (`stamp-land` in index.css); the global
 * reduced-motion rule flattens that for citizens who ask for less motion. The
 * resting tilt is also the animation's last keyframe, so there is no jump when
 * the animation ends or is collapsed.
 */
export const DossierStamp: React.FC<DossierStampProps> = ({
  ink,
  borderColor,
  label,
  emoji,
  subline,
  title,
  onClick,
}) => {
  const [landed, setLanded] = useState(false);
  const landedRef = useRef(false);

  useEffect(() => {
    if (landedRef.current) return;
    landedRef.current = true;
    setLanded(true);
  }, []);

  const edge = borderColor ?? ink;
  const className = `${
    landed ? 'stamp-land' : 'opacity-0'
  } px-4 py-2 text-left font-mono font-black uppercase tracking-widest select-none transition-transform hover:scale-[1.03] ${
    onClick ? 'cursor-pointer' : 'cursor-default'
  }`;

  const style: React.CSSProperties = {
    transform: 'rotate(-2deg)',
    color: ink,
    border: `2px solid ${edge}`,
    backgroundColor: `color-mix(in srgb, ${edge} 10%, transparent)`,
    boxShadow: `inset 0 0 10px color-mix(in srgb, ${edge} 18%, transparent)`,
  };

  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[13px] leading-none">
        {emoji && <span aria-hidden="true">{emoji}</span>}
        <span>{label}</span>
      </span>
      {subline && <span className="mt-1 block text-[9px] font-bold opacity-80">{subline}</span>}
    </>
  );

  if (!onClick) {
    return (
      <span title={title} className={className} style={style}>
        {body}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} className={className} style={style}>
      {body}
    </button>
  );
};
