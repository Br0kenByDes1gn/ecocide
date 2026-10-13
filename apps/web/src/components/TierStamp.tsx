import React from 'react';
import type { Caste } from '@ecocide/types';
import { getFaction } from '@ecocide/types';

interface TierStampProps {
  caste: Caste;
  /** Compact = ink chip used in rows; full = the rotated dossier stamp. */
  compact?: boolean;
}

/**
 * The tier stamp — a client-side SVG rubber-stamp emblem (art §10, flat
 * vector style). Color + stamp text come from the lore pack so the stamp
 * is never wrong.
 */
export const TierStamp: React.FC<TierStampProps> = ({ caste, compact = false }) => {
  const faction = getFaction(caste);
  const color = faction.colors.hex;
  const ink = faction.stampInk;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono font-black text-[9px] tracking-widest select-none"
        style={{
          color: ink,
          border: `1.5px solid ${ink}`,
          backgroundColor: 'rgba(0,0,0,0.25)',
          transform: 'rotate(-2deg)',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.4)',
        }}
      >
        {faction.stampText}
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 160 160"
      className="w-24 h-24 sm:w-28 sm:h-28 select-none"
      role="img"
      aria-label={`Stamp: ${faction.stampText}`}
      style={{ filter: `drop-shadow(0 0 10px ${faction.colors.glowHex})` }}
    >
      <g transform="rotate(-6 80 80)">
        {/* outer ring */}
        <circle cx="80" cy="80" r="74" fill="none" stroke={color} strokeWidth="3" opacity="0.9" />
        <circle cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="1" opacity="0.45" strokeDasharray="4 3" />
        {/* inner disc */}
        <circle cx="80" cy="80" r="62" fill={color} opacity="0.06" />
        <circle cx="80" cy="80" r="62" fill="none" stroke={ink} strokeWidth="2.5" opacity="0.85" />

        {/* recycling arrows mark */}
        <g fill="none" stroke={ink} strokeWidth="2.5" opacity="0.85">
          {[0, 120, 240].map((rot) => (
            <path
              key={rot}
              transform={`rotate(${rot} 80 72)`}
              d="M80 72 l-9 15 h6 v10 h6 v-10 h6 z"
            />
          ))}
        </g>
        <circle cx="80" cy="72" r="7" fill="none" stroke={ink} strokeWidth="2" opacity="0.85" />

        {/* stamp text */}
        <text
          x="80"
          y="108"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontWeight="900"
          fontSize={faction.stampText.length > 12 ? 11 : 15}
          letterSpacing="2"
          fill={ink}
        >
          {faction.stampText}
        </text>

        {/* worn edge ticks */}
        <g stroke={ink} strokeWidth="1" opacity="0.5">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={80 + Math.cos(a) * 72}
                y1={80 + Math.sin(a) * 72}
                x2={80 + Math.cos(a) * 76}
                y2={80 + Math.sin(a) * 76}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
};