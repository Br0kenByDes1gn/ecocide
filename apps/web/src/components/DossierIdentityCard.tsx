import React, { useMemo, useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import {
  CASTE_CENSUS_DATA,
  CASTE_ORDER,
  CASTE_THEMES,
  calculateCasteUnitId,
  getCasteMemberTitle,
  isOverflowCaste,
} from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { ArrowRightLeft, Info, RefreshCw, ScanFace, Shield, Sparkles, Users } from 'lucide-react';
import { soundFx } from '../lib/audio';
import type { AvatarSynthesisState } from '../lib/useAvatarSynthesis';
import type { IdentityRevealState } from '../lib/useIdentityReveal';
import { AnimatedFaceMesh } from './AnimatedFaceMesh';
import { CensusModal } from './CensusModal';

/** Pulsing placeholder shown while a stat is waiting to be revealed. */
const Placeholder: React.FC<{ className?: string }> = ({ className = 'w-16 h-2.5' }) => (
  <span
    aria-hidden
    className={`inline-block rounded bg-gray-800/90 animate-pulse ${className}`}
  />
);

interface DossierIdentityCardProps {
  payload: OraclePayload;
  portraitUrl: string;
  permalinkId?: string;
  avatar: AvatarSynthesisState;
  /** Reveal state; the static /citizen page passes the fully-revealed state. */
  reveal: IdentityRevealState;
  /** Header label; the arbitration page overrides with its own flavor text. */
  headerLabel?: string;
  /** Compact summary-bar form (mesh + ratio + title only) used by the arbitration flow. */
  compact?: boolean;
  /** Whether the compact card is clickable to expand back to full size. */
  interactive?: boolean;
  onExpand?: () => void;
}

/**
 * The biometric identity card shared by the static /citizen dossier and the
 * animated /arbitration reveal. Fully presentational: the reveal state decides
 * whether each stat shows its value, types along, or waits as a placeholder.
 *
 * In `compact` mode the same card morphs into a slim summary bar showing only
 * the mesh thumbnail, honorific title and Biocarbon Compliance Ratio; when
 * `interactive` it becomes clickable (one-way) to expand back to full size.
 */
export const DossierIdentityCard: React.FC<DossierIdentityCardProps> = ({
  payload,
  portraitUrl,
  permalinkId,
  avatar,
  reveal,
  headerLabel = `${IDENTITY.appName} // SUBJECT ID DOSSIER`,
  compact = false,
  interactive = false,
  onExpand,
}) => {
  const { user_profile } = payload;
  const casteTheme = CASTE_THEMES[user_profile.caste] || CASTE_THEMES[CASTE_ORDER[0]];
  const casteMemberName = getCasteMemberTitle(user_profile.caste);
  const casteCensus = CASTE_CENSUS_DATA[user_profile.caste] || CASTE_CENSUS_DATA[CASTE_ORDER[0]];
  const unitId = useMemo(() => {
    return calculateCasteUnitId(user_profile, casteCensus.population, permalinkId || undefined);
  }, [user_profile, casteCensus.population, permalinkId]);

  const [isCensusModalOpen, setIsCensusModalOpen] = useState(false);

  const { avatarUrl, avatarStatus, activeView } = avatar;

  const clickable = interactive && compact && !!onExpand;

  // Render a revealed (possibly partially typed) value, or a placeholder while hidden
  const stat = (text: string | null, placeholderClassName = 'w-16 h-2.5') =>
    text ? <>{text}</> : <Placeholder className={placeholderClassName} />;

  return (
    <div className="space-y-6">
      {/* Citizen ID Card Badge */}
      <div
        onClick={clickable ? onExpand : undefined}
        role={clickable ? 'button' : undefined}
        title={clickable ? 'Expand dossier to full size' : undefined}
        className={`relative bg-[#0c0e17] rounded-2xl border-2 ${casteTheme.border} overflow-hidden shadow-2xl transition-all duration-700 ${
          clickable
            ? 'cursor-pointer hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:border-cyan-400/80'
            : ''
        } ${compact ? 'p-3' : 'p-6'}`}
      >
        <div
          className={`absolute inset-0 scanlines pointer-events-none transition-opacity duration-700 ${
            compact ? 'opacity-20' : 'opacity-40'
          }`}
        />

        {clickable && (
          <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[9px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-1.5 py-0.5 rounded z-10">
            <ArrowRightLeft className="w-2.5 h-2.5" />
            EXPAND DOSSIER
          </div>
        )}

        {/* Card Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between border-b border-gray-800 pb-4 gap-2 overflow-hidden transition-all duration-500 ${
            compact ? 'max-h-0 opacity-0 border-b-transparent p-0' : 'max-h-24 opacity-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${casteTheme.color}`} />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-400">
              {headerLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500">
            <span>RECORD // {permalinkId ? `#${permalinkId}` : 'CLASSIFIED'}</span>
          </div>
        </div>

        {/* Identity & Biometric Stats */}
        <div
          className={`grid grid-cols-12 gap-6 transition-all duration-700 ${
            compact ? 'mt-1 gap-3 items-center' : 'mt-6'
          }`}
        >
          {/* Portrait Column */}
          <div
            className={`flex items-center transition-all duration-700 ${
              compact ? 'col-span-12 sm:col-span-3 justify-start' : 'sm:col-span-5 flex-col sm:justify-center'
            }`}
          >
            <div
              className={`relative rounded-xl overflow-hidden border-2 border-cyan-500/50 shadow-inner group transition-all duration-700 ${
                compact
                  ? 'w-20 h-20 sm:w-24 sm:h-24'
                  : 'w-48 h-48 sm:w-full sm:h-auto sm:aspect-square'
              } ${reveal.meshVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              {/* In-frame mesh ⇄ avatar toggle (when the avatar is unlocked) */}
              {avatarStatus === 'completed' && avatarUrl && (
                <button
                  type="button"
                  onClick={() => avatar.setActiveView(activeView === 'avatar' ? 'snapshot' : 'avatar')}
                  aria-label={activeView === 'avatar' ? 'Show biometric mesh' : 'Show holographic avatar'}
                  title={activeView === 'avatar' ? 'Switch to biometric mesh' : 'Switch to holographic avatar'}
                  className={`absolute z-20 rounded-full bg-black/75 backdrop-blur-sm border text-gray-200 shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                    activeView === 'avatar'
                      ? 'border-cyan-500/60 hover:text-cyan-300 hover:border-cyan-400'
                      : 'border-purple-500/60 hover:text-purple-300 hover:border-purple-400'
                  } ${compact ? 'top-1 right-1 w-5 h-5' : 'top-2 right-2 w-7 h-7'}`}
                >
                  {activeView === 'avatar' ? (
                    <ScanFace className={`text-cyan-400 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                  ) : (
                    <Sparkles className={`text-purple-400 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                  )}
                </button>
              )}

              {activeView === 'avatar' && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Holographic Citizen Avatar"
                  className="w-full h-full object-cover transition-all duration-700"
                />
              ) : payload.landmarks && payload.landmarks.length > 0 ? (
                <AnimatedFaceMesh
                  mode="landmarks"
                  landmarks={payload.landmarks}
                  sourceImage={portraitUrl}
                  style={payload.portraitStyle || 'neon-hologram'}
                  casteColor={casteTheme.hex}
                  className="w-full h-full transition-all duration-700"
                  alt="Animated Biometric Mesh Portrait"
                />
              ) : (
                <AnimatedFaceMesh
                  mode="overlay"
                  src={portraitUrl}
                  casteColor={casteTheme.hex}
                  className="w-full h-full transition-all duration-700"
                  alt="Animated Biometric Mesh Portrait"
                />
              )}

              {/* Status Overlay when synthesizing */}
              {!compact && avatarStatus === 'synthesizing' && (
                <div className="absolute inset-x-2 bottom-2 bg-black/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-purple-500/60 shadow-lg shadow-purple-950/60">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold text-purple-300">
                    <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                    SYNTHESIZING HOLOGRAPHIC AVATAR...
                  </div>
                  <div className="w-full bg-gray-900/90 h-1.5 rounded-full mt-1.5 overflow-hidden border border-purple-900/40">
                    <div className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 h-full animate-pulse w-3/4 rounded-full" />
                  </div>
                </div>
              )}

              {/* Bottom Label when avatar is active */}
              {!compact && activeView === 'avatar' && avatarUrl && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-center text-[10px] font-mono text-purple-300 border border-purple-500/40 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  HOLOGRAPHIC AVATAR // VERIFIED
                </div>
              )}

              {/* Bottom Label when snapshot is active and not synthesizing */}
              {!compact && activeView === 'snapshot' && avatarStatus !== 'synthesizing' && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-center text-[10px] font-mono text-cyan-400 border border-cyan-500/30 flex items-center justify-center gap-1">
                  <ScanFace className="w-3 h-3 text-cyan-400" />
                  BIOMETRIC MESH // VERIFIED
                </div>
              )}
            </div>

            {/* Biocarbon Compliance Ratio card (full mode, below portrait) */}
            {!compact && (
              <div className="w-full mt-3 bg-black/60 p-2.5 rounded-lg border border-gray-800 text-center font-mono">
                <div className="text-[10px] text-gray-400 uppercase">BIOCARBON COMPLIANCE RATIO</div>
                <div className={`text-2xl font-black tracking-widest ${casteTheme.color}`}>
                  {stat(reveal.complianceText, 'w-24 h-5')}
                </div>
              </div>
            )}
          </div>

          {/* Details & Attributes */}
          <div
            className={`flex flex-col justify-center min-w-0 transition-all duration-700 ${
              compact ? 'col-span-12 sm:col-span-9 space-y-1.5' : 'sm:col-span-7 justify-between space-y-4'
            }`}
          >
            {/* Stats Frame Title: Prominent Caste Member Badge & Caste Census Size */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-gray-800/80 overflow-hidden transition-all duration-500 ${
                compact ? 'max-h-0 opacity-0 border-b-transparent p-0' : 'max-h-32 opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-sm sm:text-base font-black px-3.5 py-1.5 rounded-lg uppercase tracking-wider ${casteTheme.badge} shadow-md`}
                >
                  {casteMemberName}
                </span>
                {isOverflowCaste(user_profile.caste) && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-400 animate-pulse">
                    ⚠ OVERFLOW REGISTRY
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playBeep();
                  setIsCensusModalOpen(true);
                }}
                className="font-mono text-xs text-gray-400 bg-black/70 hover:bg-black px-3 py-1.5 rounded-lg border border-gray-800 hover:border-cyan-500/70 hover:text-cyan-300 transition-all flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                title="View the Global Population Census distribution"
              >
                <span className="text-gray-500 group-hover:text-cyan-400 text-[11px] font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  CENSUS:
                </span>
                <span className="text-gray-200 group-hover:text-white font-bold tracking-wide">
                  Unit {unitId.toLocaleString()} of {casteCensus.population.toLocaleString()}
                </span>
                <Info className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 ml-0.5 opacity-80 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            {/* Compact ratio + title row (bar layout) */}
            {compact && (
              <div className="flex items-baseline justify-between gap-3 min-w-0">
                <div className="text-[10px] text-gray-400 uppercase whitespace-nowrap">
                  BIOCARBON COMPLIANCE
                </div>
                <div className={`text-xl sm:text-2xl font-black tracking-widest ${casteTheme.color}`}>
                  {stat(reveal.complianceText, 'w-20 h-5')}
                </div>
              </div>
            )}

            {/* Official Honorific Title */}
            <div className="min-w-0">
              <div
                className={`text-xs font-mono text-gray-400 transition-all duration-500 ${
                  compact ? 'hidden' : ''
                }`}
              >
                OFFICIAL HONORIFIC TITLE
              </div>
              <div
                className={`font-bold font-mono text-white tracking-wide mt-0.5 transition-all duration-700 ${
                  compact
                    ? 'text-lg sm:text-xl line-clamp-1'
                    : 'text-xl sm:text-2xl break-words'
                }`}
              >
                {stat(reveal.titleText, 'w-2/3 h-5')}
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div
              className={`grid grid-cols-2 gap-3 text-xs font-mono overflow-hidden transition-all duration-500 ${
                compact ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
              }`}
            >
              <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                <span className="text-gray-500 block">PRESENTATION</span>
                <span className="text-gray-200 font-semibold break-words">
                  {stat(reveal.presentationText, 'w-20 h-2.5')}
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                <span className="text-gray-500 block">UTILITY GRADE</span>
                <span
                  className="text-gray-200 font-semibold break-words"
                  title={`Demographic Category: ${user_profile.life_stage}`}
                >
                  {stat(reveal.utilityText, 'w-24 h-2.5')}
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                <span className="text-gray-500 block">ASSET VALUE</span>
                <span className="text-gray-200 font-semibold break-words">
                  {stat(reveal.assetText, 'w-28 h-2.5')}
                </span>
              </div>
              <div className="bg-black/40 p-2.5 rounded-lg border border-gray-800/80">
                <span className="text-gray-500 block">ENERGY LEVEL</span>
                <span className="text-gray-200 font-semibold break-words">
                  {stat(reveal.energyText, 'w-24 h-2.5')}
                </span>
              </div>
            </div>

            {/* Futuristic Barcode Stamp */}
            <div
              className={`pt-2 border-t border-gray-800 flex justify-between items-center text-[10px] font-mono text-gray-500 overflow-hidden transition-all duration-500 ${
                compact ? 'max-h-0 opacity-0 border-t-transparent' : 'max-h-10 opacity-100'
              }`}
            >
              <span>{permalinkId ? `CITIZEN ID: #${permalinkId}` : `HEX: 0x${user_profile.biocarbon_ratio.toString(16).toUpperCase()}FF`}</span>
              <div className="tracking-[4px] font-bold text-gray-400">||||| | |||| ||| |</div>
              <span>GRID-VERIFIED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Global Census Distribution Matrix Modal */}
      <CensusModal
        isOpen={isCensusModalOpen}
        onClose={() => setIsCensusModalOpen(false)}
        activeCaste={user_profile.caste}
        activeUnitId={unitId}
      />
    </div>
  );
};