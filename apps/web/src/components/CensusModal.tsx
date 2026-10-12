import React, { useEffect, useState } from 'react';
import type { Caste } from '@ecocide/types';
import {
  CASTE_CENSUS_DATA,
  CASTE_COLOR_CONFIG,
  CASTE_ORDER,
  TOTAL_WORLD_POPULATION,
  getCasteMemberTitle,
  getFaction,
  isOverflowCaste,
} from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { Users, X, AlertTriangle, Shield, CheckCircle2, ChevronLeft, ChevronRight, Activity, Radio, Cpu, Lock } from 'lucide-react';
import { soundFx } from '../lib/audio';

interface CensusModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCaste?: Caste;
  activeUnitId?: number;
}

/** Provisional per-faction census telemetry (TODO-LORE: move real copy into packages/lore). */
const CASTE_TELEMETRY: Record<
  Caste,
  {
    clearance: string;
    resources: string;
    ratio: string;
    mandate: string;
  }
> = Object.fromEntries(
  CASTE_ORDER.map((caste, i) => [
    caste,
    {
      clearance: `LEVEL ${'ABCDEF'[i] ?? 'N'} // PROVISIONAL ACCESS`,
      resources: 'STANDARD ALLOCATION // PROVISIONAL',
      ratio: `${CASTE_CENSUS_DATA[caste].percentage}% OF THE POPULATION`,
      mandate: 'Registered duty allocation — to be defined by the lore pack.',
    },
  ])
) as Record<
  Caste,
  {
    clearance: string;
    resources: string;
    ratio: string;
    mandate: string;
  }
>;

export const CensusModal: React.FC<CensusModalProps> = ({
  isOpen,
  onClose,
  activeCaste,
  activeUnitId,
}) => {
  const [selectedTab, setSelectedTab] = useState<Caste>(activeCaste || CASTE_ORDER[0]);

  // When modal opens, automatically select the user's active designation tab
  useEffect(() => {
    if (isOpen) {
      setSelectedTab(activeCaste || CASTE_ORDER[0]);
    }
  }, [isOpen, activeCaste]);

  // Handle ESC key press
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

  const handleClose = () => {
    soundFx.playClick();
    onClose();
  };

  const handleTabChange = (caste: Caste) => {
    soundFx.playClick();
    setSelectedTab(caste);
  };

  const currentIndex = CASTE_ORDER.indexOf(selectedTab);
  const handlePrev = () => {
    const nextIdx = (currentIndex - 1 + CASTE_ORDER.length) % CASTE_ORDER.length;
    handleTabChange(CASTE_ORDER[nextIdx]);
  };
  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % CASTE_ORDER.length;
    handleTabChange(CASTE_ORDER[nextIdx]);
  };

  const selectedInfo = CASTE_CENSUS_DATA[selectedTab];
  const selectedConfig = CASTE_COLOR_CONFIG[selectedTab];
  const selectedTelemetry = CASTE_TELEMETRY[selectedTab];
  const isSelectedUserCaste = activeCaste === selectedTab;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Dialog Window */}
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-[#090b14] border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 scanlines pointer-events-none opacity-25" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-950/70 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-white tracking-wide flex items-center gap-2">
                GLOBAL POPULATION CENSUS
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hidden sm:inline">
                  DIRECTIVE 01
                </span>
              </h2>
              <p className="text-xs font-mono text-gray-400">
                TOTAL REGISTERED POPULATION: <span className="text-cyan-300 font-bold">{TOTAL_WORLD_POPULATION.toLocaleString()}</span> SUBJECTS (100.0%)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Close Census (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative z-10 text-gray-300 font-mono">
          {/* Active Citizen Callout (when active caste is known) */}
          {activeCaste && (
            <div className="bg-black/60 border border-cyan-500/40 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">YOUR REGISTERED ALLOCATION</div>
                  <div className="text-sm sm:text-base font-bold text-white flex flex-wrap items-center gap-2">
                    <span className={CASTE_COLOR_CONFIG[activeCaste].text}>
                      {getCasteMemberTitle(activeCaste)}
                    </span>
                    {activeUnitId && (
                      <span className="text-xs font-normal text-gray-300">
                        // Unit #{activeUnitId.toLocaleString()} of {CASTE_CENSUS_DATA[activeCaste].population.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange(activeCaste)}
                className="text-xs px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 self-start sm:self-center transition-colors cursor-pointer flex items-center gap-1"
                title="Jump directly to your designation tab"
              >
                <span>{CASTE_CENSUS_DATA[activeCaste].percentage}% of Humanity</span>
                <span className="text-cyan-400 font-bold ml-1">→ VIEW TAB</span>
              </button>
            </div>
          )}

          {/* Demographic Proportional Distribution Bar (Clickable slices) */}
          <div>
            <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
              <span className="uppercase tracking-wider font-semibold text-[11px]">Demographic Proportion Bar (Click slice to jump)</span>
              <span className="text-[11px]">{(TOTAL_WORLD_POPULATION / 1e9).toFixed(1)} Billion Total</span>
            </div>
            <div className="w-full h-3.5 rounded-lg overflow-hidden flex bg-gray-900 border border-gray-800 shadow-inner cursor-pointer">
              {CASTE_ORDER.map((caste) => {
                const info = CASTE_CENSUS_DATA[caste];
                const config = CASTE_COLOR_CONFIG[caste];
                const isSelected = selectedTab === caste;
                return (
                  <button
                    key={caste}
                    type="button"
                    onClick={() => handleTabChange(caste)}
                    style={{ width: `${info.percentage}%` }}
                    className={`${config.barColor} h-full transition-all hover:opacity-100 ${
                      isSelected ? 'ring-2 ring-white z-10 opacity-100' : 'opacity-80 hover:opacity-95'
                    }`}
                    title={`${info.memberTitle}: ${info.percentage}% (${info.population.toLocaleString()} citizens) - Click to inspect`}
                  />
                );
              })}
            </div>
          </div>

          {/* Caste Tabs Navigation Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                Select Classification:
              </span>
              <span className="text-[10px] text-gray-500 hidden sm:inline">
                Click any tab to view registered quotas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
              {CASTE_ORDER.map((caste) => {
                const info = CASTE_CENSUS_DATA[caste];
                const config = CASTE_COLOR_CONFIG[caste];
                const isSelected = selectedTab === caste;
                const isUserCaste = activeCaste === caste;

                return (
                  <button
                    key={caste}
                    type="button"
                    onClick={() => handleTabChange(caste)}
                    className={`relative px-2 py-2 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center ${
                      isSelected
                        ? `${config.border} ${config.bg} ${config.text} ${config.glow} ring-1 ring-cyan-400/80`
                        : 'bg-[#0c0f1a] border-gray-800/80 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                    }`}
                  >
                    {isUserCaste && (
                      <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-cyan-500 text-black font-black text-[8px] rounded uppercase tracking-tighter shadow-sm">
                        YOU
                      </span>
                    )}
                    <span className="truncate w-full text-[11px] leading-tight">
                      {info.memberTitle}
                    </span>
                    <span className="text-[10px] font-normal opacity-75">
                      {info.percentage.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Tab Detailed View Card */}
          <div
            className={`rounded-2xl border-2 ${selectedConfig.border} ${selectedConfig.bg} p-5 sm:p-6 space-y-5 transition-all shadow-xl`}
          >
            {/* Header: Caste Title, Quota & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`text-sm sm:text-base font-black px-3.5 py-1.5 rounded-lg uppercase tracking-wider ${selectedConfig.badge} shadow-lg`}
                >
                  {selectedInfo.memberTitle}
                </span>
                <span className="text-xs sm:text-sm text-gray-400 font-mono">
                  ({getFaction(selectedTab).name})
                </span>
                {isSelectedUserCaste && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 bg-cyan-950/90 px-2.5 py-1 rounded-md border border-cyan-500/60 shadow-sm shadow-cyan-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    YOUR CURRENT DESIGNATION
                  </span>
                )}
                {isOverflowCaste(selectedTab) && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/90 px-2.5 py-1 rounded-md border border-red-500 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    OVERFLOW QUOTA
                  </span>
                )}
              </div>

              {/* Population & Quota Badge */}
              <div className="flex items-center gap-3 text-xs bg-black/60 px-3 py-1.5 rounded-lg border border-gray-800">
                <span className="text-gray-400">
                  Global Quota: <strong className="text-white">{selectedInfo.percentage.toFixed(1)}%</strong>
                </span>
                <span className="text-gray-600">//</span>
                <span className={`font-bold ${selectedConfig.text}`}>
                  {selectedInfo.population.toLocaleString()}{' '}
                  <span className="text-gray-500 font-normal">subjects</span>
                </span>
              </div>
            </div>

            {/* If user's active unit is on this tab, show Unit Callout */}
            {isSelectedUserCaste && activeUnitId && (
              <div className="bg-cyan-950/40 border border-cyan-500/50 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>AUTHENTICATED UNIT REGISTRATION:</span>
                </div>
                <div className="font-mono text-white font-bold tracking-wide">
                  Unit #{activeUnitId.toLocaleString()} of {selectedInfo.population.toLocaleString()}
                </div>
              </div>
            )}

            {/* Description Paragraph */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                DEMOGRAPHIC CLASSIFICATION // SOCIETAL ROLE
              </div>
              <p className="text-sm sm:text-base text-gray-200 leading-relaxed font-sans">
                {selectedInfo.description}
              </p>
            </div>

            {/* Telemetry & Systemic Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-black/60 p-3 rounded-xl border border-gray-800 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">SECURITY CLEARANCE</span>
                  <span className="text-gray-200 font-bold break-words">{selectedTelemetry.clearance}</span>
                </div>
              </div>

              <div className="bg-black/60 p-3 rounded-xl border border-gray-800 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">RESOURCE ALLOCATION</span>
                  <span className="text-gray-200 font-bold break-words">{selectedTelemetry.resources}</span>
                </div>
              </div>

              <div className="bg-black/60 p-3 rounded-xl border border-gray-800 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">POPULATION RATIO</span>
                  <span className={`font-bold ${selectedConfig.text} break-words`}>{selectedTelemetry.ratio}</span>
                </div>
              </div>

              <div className="bg-black/60 p-3 rounded-xl border border-gray-800 flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">SYSTEMIC MANDATE</span>
                  <span className="text-gray-200 font-medium break-words text-[11px] leading-snug">
                    {selectedTelemetry.mandate}
                  </span>
                </div>
              </div>
            </div>

            {/* Previous / Next Tab Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded bg-black/40 hover:bg-black/80 border border-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV CLASS</span>
              </button>

              <span className="text-[11px] text-gray-500">
                {currentIndex + 1} of {CASTE_ORDER.length} Classes
              </span>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded bg-black/40 hover:bg-black/80 border border-gray-800"
              >
                <span>NEXT CLASS</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10 text-xs font-mono">
          <div className="text-gray-500 text-[11px] text-center sm:text-left">
            CENSUS 2026 // CLASSIFICATIONS REGISTERED BY {IDENTITY.entityName.toUpperCase()}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold tracking-wider transition-colors cursor-pointer"
          >
            ACKNOWLEDGE
          </button>
        </div>
      </div>
    </div>
  );
};
