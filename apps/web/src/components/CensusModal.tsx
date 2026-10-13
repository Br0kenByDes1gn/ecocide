import React, { useEffect, useState } from 'react';
import type { Caste, CensusReport } from '@ecocide/types';
import { CASTE_COLOR_CONFIG, CASTE_ORDER, getFaction } from '@ecocide/types';
import { IDENTITY } from '@ecocide/lore';
import { Users, X, Shield, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { soundFx } from '../lib/audio';

interface CensusModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCaste?: Caste;
}

/**
 * Tier census modal (art §7/§12.7): the LIVE share of audited households per
 * tier, read from the server. Counts are shown only once enough audits exist
 * (50+); before that the modal stays deadpan-neutral. Never invented
 * percentages.
 */
export const CensusModal: React.FC<CensusModalProps> = ({ isOpen, onClose, activeCaste }) => {
  const [selectedTab, setSelectedTab] = useState<Caste>(activeCaste || CASTE_ORDER[0]);
  const [report, setReport] = useState<CensusReport | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTab(activeCaste || CASTE_ORDER[0]);
      fetch('/api/census')
        .then((res) => (res.ok ? (res.json() as Promise<CensusReport>) : null))
        .then(setReport)
        .catch(() => setReport(null));
    }
  }, [isOpen, activeCaste]);

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
  const handlePrev = () => handleTabChange(CASTE_ORDER[(currentIndex - 1 + CASTE_ORDER.length) % CASTE_ORDER.length]);
  const handleNext = () => handleTabChange(CASTE_ORDER[(currentIndex + 1) % CASTE_ORDER.length]);

  const selectedInfo = getFaction(selectedTab);
  const selectedConfig = CASTE_COLOR_CONFIG[selectedTab];
  const sufficient = Boolean(report?.sufficient);
  const total = report?.total ?? 0;
  const entryFor = (caste: Caste) => report?.entries.find((e) => e.caste === caste);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-[#0e1510] border-2 border-lime-500/40 rounded-2xl shadow-[0_0_50px_rgba(180,255,57,0.15)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 scanlines pointer-events-none opacity-20" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 bg-gray-950/70 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-lime-950/60 border border-lime-500/40 text-lime-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-white tracking-wide">
                CENSUS MANDATE 2026.4 // SHARE OF HOUSEHOLDS AUDITED SO FAR
              </h2>
              <p className="text-xs font-mono text-gray-400">
                {sufficient
                  ? `TOTAL AUDITED: ${total.toLocaleString()} HOUSEHOLDS`
                  : `AUDIT QUOTA NOT YET REACHED (${total.toLocaleString()} / 50)`}
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
          {!sufficient && (
            <div className="bg-black/60 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3 text-xs text-gray-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                CENSUS DATA INSUFFICIENT. The Bureau publishes tier shares only after at least 50
                households have been audited. Your audit will count toward the total; do not be
                modest about it.
              </span>
            </div>
          )}

          {activeCaste && (
            <div className="bg-black/60 border border-lime-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-lime-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">YOUR REGISTERED TIER</div>
                  <div className={`text-sm sm:text-base font-bold ${CASTE_COLOR_CONFIG[activeCaste].text}`}>
                    {getFaction(activeCaste).name}
                  </div>
                </div>
              </div>
              {sufficient && (
                <span className="text-xs text-gray-300">
                  {entryFor(activeCaste)?.count.toLocaleString() ?? 0} audited households ·{' '}
                  <span className="text-lime-300 font-bold">{entryFor(activeCaste)?.sharePct ?? 0}%</span>
                </span>
              )}
            </div>
          )}

          {/* Proportional distribution bar (only when sufficient) */}
          {sufficient && (
            <div>
              <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                <span className="uppercase tracking-wider font-semibold text-[11px]">Share of audited households</span>
                <span className="text-[11px]">{total.toLocaleString()} Total Audited</span>
              </div>
              <div className="w-full h-3.5 rounded-lg overflow-hidden flex bg-gray-900 border border-gray-800 shadow-inner">
                {CASTE_ORDER.map((caste) => {
                  const config = CASTE_COLOR_CONFIG[caste];
                  const entry = entryFor(caste);
                  const pct = entry?.sharePct ?? 0;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={caste}
                      style={{ width: `${pct}%` }}
                      className={`${config.barColor} h-full opacity-85 hover:opacity-100 cursor-pointer transition-opacity`}
                      title={`${getFaction(caste).name}: ${pct}% (${entry?.count} households)`}
                      onClick={() => handleTabChange(caste)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tier tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
            {CASTE_ORDER.map((caste) => {
              const config = CASTE_COLOR_CONFIG[caste];
              const isSelected = selectedTab === caste;
              const isUserCaste = activeCaste === caste;
              const entry = entryFor(caste);
              return (
                <button
                  key={caste}
                  type="button"
                  onClick={() => handleTabChange(caste)}
                  className={`relative px-2 py-2 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center ${
                    isSelected
                      ? `${config.border} ${config.bg} ${config.text} ${config.glow} ring-1 ring-lime-400/70`
                      : 'bg-[#0c0f1a] border-gray-800/80 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  {isUserCaste && (
                    <span className="absolute -top-1.5 -right-1 px-1 py-0.2 bg-lime-500 text-black font-black text-[8px] rounded uppercase tracking-tighter shadow-sm">
                      YOU
                    </span>
                  )}
                  <span className="truncate w-full text-[11px] leading-tight">{getFaction(caste).name}</span>
                  <span className="text-[10px] font-normal opacity-75">
                    {sufficient ? `${entry?.sharePct ?? 0}%` : `${getFaction(caste).minScore}+`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active tab detail */}
          <div className={`rounded-2xl border-2 ${selectedConfig.border} ${selectedConfig.bg} p-5 sm:p-6 space-y-4 transition-all shadow-xl`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`text-sm sm:text-base font-black px-3.5 py-1.5 rounded-lg uppercase tracking-wider ${selectedConfig.badge} shadow-lg`}>
                  {selectedInfo.name}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  INDEX {selectedInfo.minScore}+ // STAMP: {selectedInfo.stampText}
                </span>
                {activeCaste === selectedTab && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-lime-300 bg-lime-950/90 px-2.5 py-1 rounded-md border border-lime-500/60">
                    YOUR CURRENT TIER
                  </span>
                )}
              </div>
              {sufficient && (
                <div className="flex items-center gap-3 text-xs bg-black/60 px-3 py-1.5 rounded-lg border border-gray-800">
                  <span className="text-gray-400">
                    Audited: <strong className="text-white">{(entryFor(selectedTab)?.count ?? 0).toLocaleString()}</strong>
                  </span>
                  <span className="text-gray-600">//</span>
                  <span className={`font-bold ${selectedConfig.text}`}>{entryFor(selectedTab)?.sharePct ?? 0}%</span>
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">TIER LORE // CASE-FILE SCENE</div>
              <p className="text-sm sm:text-base text-gray-200 leading-relaxed">{selectedInfo.censusDescription}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="bg-black/60 p-3 rounded-xl border border-gray-800">
                <span className="text-gray-500 block text-[10px] uppercase">VERDICT LINE</span>
                <span className="text-gray-200 font-bold break-words italic">“{selectedInfo.verdictLine}”</span>
              </div>
              <div className="bg-black/60 p-3 rounded-xl border border-gray-800">
                <span className="text-gray-500 block text-[10px] uppercase">STAMP INK (PAPER LAYER)</span>
                <span className="text-gray-200 font-bold break-words" style={{ color: selectedInfo.stampInk }}>
                  {selectedInfo.stampText}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded bg-black/40 hover:bg-black/80 border border-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV TIER</span>
              </button>
              <span className="text-[11px] text-gray-500">{currentIndex + 1} of {CASTE_ORDER.length} Tiers</span>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1 rounded bg-black/40 hover:bg-black/80 border border-gray-800"
              >
                <span>NEXT TIER</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10 text-xs font-mono">
          <div className="text-gray-500 text-[11px]">
            CENSUS 2026 // AUDITED HOUSEHOLDS ONLY — REGISTERED BY {IDENTITY.entityName.toUpperCase()}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#b4ff39] hover:bg-lime-300 text-black font-bold tracking-wider transition-colors cursor-pointer"
          >
            ACKNOWLEDGE
          </button>
        </div>
      </div>
    </div>
  );
};