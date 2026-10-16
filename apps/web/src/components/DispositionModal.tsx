import React, { useEffect } from 'react';
import { CASTE_ORDER, getFaction } from '@ecocide/types';
import { DISPOSITION_COPY } from '@ecocide/lore';
import { FileText, X, type LucideIcon } from 'lucide-react';
import { loreIcon } from '../lib/lore-icons';
import { soundFx } from '../lib/audio';

interface DispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Internal tier id. */
  caste: string;
  /** The household's own Household Sustainability Index. */
  index: number;
}

/**
 * The disposition mark's file: what the Bureau intends to do with this household.
 *
 * Opened from the caste stamp on the dossier, which is only a label — the detail
 * is here. Everything rendered comes from the pack: the tier's name colours and
 * one-line verdict, and its `disposition` (label, icon keys, detail). The glyphs
 * are line icons resolved from those keys, so they take the tier's ink rather than
 * carrying a colour of their own. The band is derived from the tiers' own
 * `minScore` bounds rather than hard-coded, so a taxonomy change cannot leave a
 * stale range on screen.
 */
export const DispositionModal: React.FC<DispositionModalProps> = ({
  isOpen,
  onClose,
  caste,
  index,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const faction = getFaction(caste);
  const { label, detail, icons } = faction.disposition;
  const Glyphs = icons.map(loreIcon).filter((Icon): Icon is LucideIcon => Boolean(Icon));

  const handleClose = () => {
    soundFx.playClick();
    onClose();
  };

  // The band is this tier's floor up to just below the next-better tier's floor.
  const bands = getFactionBandText(caste);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={DISPOSITION_COPY.title}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] bg-[#0e1510] rounded-2xl flex flex-col overflow-hidden border-2"
        style={{ borderColor: faction.colors.hex, boxShadow: `0 0 50px ${faction.colors.glowHex}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 scanlines pointer-events-none opacity-20" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/70 p-4 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 rounded-lg border"
              style={{ borderColor: faction.colors.hex, color: faction.colors.hex }}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-bold tracking-wide text-white sm:text-base">
                {DISPOSITION_COPY.title}
              </h2>
              <p className="font-mono text-xs text-gray-400 uppercase">{faction.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={`${DISPOSITION_COPY.close} (Esc)`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 font-mono">
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-black uppercase tracking-widest"
              style={{
                color: faction.stampInk,
                border: `2px solid ${faction.colors.hex}`,
                backgroundColor: `color-mix(in srgb, ${faction.colors.hex} 10%, transparent)`,
              }}
            >
              <span aria-hidden="true" className="flex items-center gap-1">
                {Glyphs.map((Icon, i) => (
                  <Icon key={i} className="h-4 w-4" strokeWidth={2.5} />
                ))}
              </span>
              {label}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-gray-800 py-3 text-[11px] uppercase tracking-widest text-gray-400">
            <span>
              {DISPOSITION_COPY.band}:{' '}
              <span className="text-gray-200">{bands}</span>
            </span>
            <span>
              {DISPOSITION_COPY.index}:{' '}
              <span className="font-black" style={{ color: faction.colors.hex }}>
                {index}
              </span>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-gray-200">{detail}</p>

          <div className="border-t border-gray-800 pt-3">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">
              {DISPOSITION_COPY.verdict}
            </div>
            <p className="mt-1 text-sm text-gray-300">{faction.verdictLine}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The tier's band as displayed text, derived from the pack's own bounds: a tier
 * covers its `minScore` up to one below the next-better tier's floor. The order
 * comes from the pack (`CASTE_ORDER`), so adding or re-banding a tier updates
 * this with no edit here.
 */
function getFactionBandText(caste: string): string {
  const position = CASTE_ORDER.indexOf(caste as (typeof CASTE_ORDER)[number]);
  const tier = getFaction(caste);
  const upper = position > 0 ? getFaction(CASTE_ORDER[position - 1]).minScore - 1 : 100;
  return `${tier.minScore}–${upper}`;
}
