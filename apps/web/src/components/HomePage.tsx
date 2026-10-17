import React, { useState } from 'react';
import { Globe, Volume2, VolumeX, ArrowRight, ShieldAlert, Wallet, Bug } from 'lucide-react';
import { IDENTITY, REGISTRY_COPY, ADJUDICATORS_ON_DUTY } from '@ecocide/lore';
import { soundFx } from '../lib/audio';

interface HomePageProps {
  onProceedToScan: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onGoRegistry?: () => void;
  /** Open the credits page (/adjudicators). */
  onOpenAbout?: () => void;
  /** Open the system-status page (/grid). */
  onOpenGrid?: () => void;
  onOpenDebug?: () => void;
  isDev?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  onProceedToScan,
  isMuted = false,
  onToggleMute,
  onGoRegistry,
  onOpenAbout,
  onOpenGrid,
  onOpenDebug,
  isDev = false,
}) => {
  // One stable case reference per visit (the Bureau does not renumber cases on re-render).
  const [caseRef] = useState(() => Math.floor(Math.random() * 900000 + 100000));
  return (
    <div className="min-h-screen w-full bg-[#080b08] text-[#e6efe3] cyber-grid flex flex-col">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2 border-b border-lime-500/25">
        <div className="flex items-center gap-3 min-w-0">
          {/* ECOCIDE Brand */}
          <div className="p-2 rounded-lg bg-lime-950/60 border border-lime-500/40 text-lime-400 flex-shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold font-mono text-lime-400 tracking-wider flex items-center gap-2 whitespace-nowrap">
              {IDENTITY.appName}
            </h1>
            <p className="hidden sm:block text-[11px] font-mono text-gray-400 tracking-widest">
              {IDENTITY.tagline.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Debug bench (dev only) */}
          {isDev && onOpenDebug && (
            <button
              type="button"
              onClick={onOpenDebug}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 bg-amber-950/60 hover:bg-amber-900/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Development Audit Bench (/debug)"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">[DEV]</span>
              <span className="hidden lg:inline">DEBUG BENCH</span>
            </button>
          )}

          {/* Carbon Registry */}
          {onGoRegistry && (
            <button
              type="button"
              onClick={onGoRegistry}
              className="text-xs font-mono text-lime-400 hover:text-lime-300 border border-lime-500/50 hover:border-lime-400 bg-lime-950/40 hover:bg-lime-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title={`Open your ${REGISTRY_COPY.name} (/registry)`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{REGISTRY_COPY.navLabel.toUpperCase()}</span>
            </button>
          )}

          {/* Audio Toggle */}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-300 transition-colors cursor-pointer"
              title="Toggle Audio Engine"
              aria-label={isMuted ? 'Enable audio' : 'Disable audio'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-red-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 flex flex-col lg:flex-row items-start justify-between gap-3 lg:gap-6">
        {/* Left Side: Headline + Copy + CTA */}
        <div className="w-full lg:w-5/12 lg:pr-6 flex flex-col justify-center min-h-0">
          <div className="max-w-xl">
            {/* Protocol Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-950/60 border border-lime-500/40 text-lime-400 text-xs font-mono tracking-widest uppercase mb-4">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>DOMESTIC AUDIT PROTOCOL</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black font-mono tracking-tight text-white leading-tight mb-3">
              YOUR HOUSEHOLD HAS BEEN
              <span className="block text-lg sm:text-xl md:text-2xl lg:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-lime-300 to-lime-400 font-extrabold mt-0.5">
                CHARGED WITH ECOCIDE.
              </span>
            </h2>

            {/* Supporting Copy */}
            <p className="text-sm font-mono text-gray-400 mb-4 leading-relaxed max-w-md">
              The {IDENTITY.entityName} is reviewing your domestic excess. Submit your household
              objects for audit and receive your compliance verdict.
            </p>

            {/* Primary CTA Button */}
            <button
              type="button"
              onClick={() => {
                soundFx.playScannerBeep();
                onProceedToScan();
              }}
              className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-mono text-sm font-bold text-black uppercase tracking-wider bg-gradient-to-r from-lime-400 via-lime-300 to-lime-400 hover:from-lime-300 hover:to-lime-200 shadow-[0_0_25px_rgba(180,255,57,0.6)] hover:shadow-[0_0_35px_rgba(180,255,57,0.8)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b08]"
            >
              <span>BEGIN AUDIT</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>

            {/* Secondary tagline */}
            <p className="mt-3 text-xs font-mono text-gray-500 tracking-wider text-center sm:text-left">
              {IDENTITY.secondaryLine}
            </p>
          </div>
        </div>

        {/* Right Side: Paper Dossier Panel */}
        <div className="w-full lg:w-7/12 flex items-start justify-center lg:justify-end min-h-0">
          <div className="paper-layer w-full max-w-lg rounded-xl p-3 sm:p-4 lg:p-5 relative overflow-hidden">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              pointerEvents: 'none',
            }} />

            {/* Top tape strip */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-[#8b5a2b]/60 rotate-1 -translate-y-1/2 rounded" />

            {/* Document Header */}
            <div className="relative z-10 mb-3 border-b border-[#e0d6bb] pb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-[#7c8b7e] tracking-widest uppercase">CASE FILE</span>
                <span className="text-[10px] font-mono text-[#7c8b7e] tracking-widest">{IDENTITY.auditProtocol}</span>
              </div>
              <h3 className="text-sm font-bold font-mono text-[#1f2a1f] tracking-wide">AUDIT PROCEDURE</h3>
              <p className="text-[10px] font-mono text-[#7c8b7e] mt-0">STANDARDIZED DOMESTIC INSPECTION WORKFLOW</p>
            </div>

            {/* Numbered Instructions */}
            <ol className="relative z-10 space-y-2 mb-3">
              {[
                'Photograph the room in good light. Do not tidy up; the Arbiter prefers evidence.',
                'The audit engine inventories your objects — labels, counts, materials.',
                'Deterministic compliance math scores every item. No model touches the arithmetic.',
                'The Arbiter renders a verdict with a carbon-ledger breakdown.',
                'Pledge binding habit changes to appeal the ruling.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 group">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-[#1f2a1f]/30 flex items-center justify-center text-sm font-bold font-mono text-[#1f2a1f] group-hover:border-[#c2322b] group-hover:text-[#c2322b] transition-colors">
                    {i + 1}
                  </span>
                  <span className="text-sm font-mono text-[#1f2a1f] leading-relaxed pt-1">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            {/* Document Metadata */}
            <div className="relative z-10 border-t border-[#e0d6bb] pt-2 space-y-1 text-[10px] font-mono text-[#7c8b7e]">
              <div className="flex justify-between">
                <span>CLASSIFICATION</span>
                <span className="text-[#1f2a1f] font-medium">DOMESTIC AUDIT</span>
              </div>
              <div className="flex justify-between">
                <span>CASE REF</span>
                <span className="text-[#1f2a1f] font-medium font-mono tracking-widest">ECD-{caseRef}</span>
              </div>
              <div className="flex justify-between">
                <span>AUTHORITY</span>
                <span className="text-[#1f2a1f] font-medium">{IDENTITY.entityName}</span>
              </div>
              <div className="flex justify-between">
                <span>PROTOCOL</span>
                <span className="text-[#1f2a1f] font-medium">{IDENTITY.auditProtocol} // GRID-VERIFIED</span>
              </div>
              <div className="flex justify-between border-t border-[#e0d6bb] pt-1.5">
                <span>ALL VALUES</span>
                <span className="text-[#1f2a1f] font-medium">ESTIMATES // SOURCE ON FILE</span>
              </div>
            </div>

            {/* Red Rubber Stamp */}
            <div className="relative z-10 mt-3 flex justify-end">
              <div className="stamp-final-notice rounded-lg px-4 py-2 transform rotate-3 hover:rotate-2 transition-transform duration-300 cursor-default">
                <div className="font-bold font-mono text-sm tracking-wider uppercase">
                  FINAL NOTICE
                </div>
                <div className="text-[10px] font-mono tracking-widest mt-0.5">
                  PENDING AUDIT
                </div>
              </div>
            </div>

            {/* Barcode strip */}
            <div className="relative z-10 mt-2 pt-2 border-t border-[#e0d6bb]">
              <div className="flex items-end gap-1 h-8 mx-auto max-w-xs" style={{ opacity: 0.6 }}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((_, i) => (
                  <div
                    key={i}
                    className="w-[2px] bg-[#1f2a1f]"
                    style={{ height: `${15 + (i * 7) % 25}%` }}
                  />
                ))}
              </div>
              <p className="text-[8px] font-mono text-[#7c8b7e] text-center mt-0.5 tracking-widest">
                GRID-VERIFIED // ECOCIDE CENTRAL ARCHIVE
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 border-t border-gray-900/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-gray-500">
          <button
            type="button"
            onClick={onOpenGrid}
            disabled={!onOpenGrid}
            className="flex items-center gap-2 transition-colors hover:text-lime-400 cursor-pointer disabled:cursor-default disabled:hover:text-gray-500"
            title="Open the Planetary Grid (/grid)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            <span>OBJECT AUDIT ENGINE ONLINE | {IDENTITY.entityName.toUpperCase()}</span>
          </button>
          <div className="flex items-center gap-4">
            <span>DETERMINISTIC COMPLIANCE MATH: ACTIVE</span>
            <button
              type="button"
              onClick={onOpenAbout}
              disabled={!onOpenAbout}
              className="whitespace-nowrap text-lime-700 transition-colors hover:text-lime-400 cursor-pointer disabled:cursor-default disabled:hover:text-lime-700"
              title="Meet the staff on duty (/adjudicators)"
            >
              {ADJUDICATORS_ON_DUTY}
            </button>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <span className="hidden lg:inline">{IDENTITY.backronym}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;