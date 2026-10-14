import React from 'react';
import { Globe, Volume2, VolumeX, ArrowRight, ShieldAlert } from 'lucide-react';
import { IDENTITY } from '@ecocide/lore';
import { soundFx } from '../lib/audio';

interface HomePageProps {
  onProceedToScan: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onProceedToScan,
  isMuted = false,
  onToggleMute,
}) => {
  return (
    <div className="min-h-screen w-full bg-[#080b08] text-[#e6efe3] cyber-grid flex flex-col">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between border-b border-lime-500/20">
        <div className="flex items-center gap-3">
          {/* Globe Emblem */}
          <div className="p-2 rounded-lg bg-lime-950/60 border border-lime-500/40 text-lime-400 flex-shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-mono text-lime-400 tracking-wider flex items-center gap-2">
              {IDENTITY.appName}
            </h1>
            <p className="text-[11px] font-mono text-gray-400 tracking-widest uppercase">
              {IDENTITY.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              <span>DOMESTIC AUDIT PROTOCOL // ECOCIDE</span>
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
              The Carbon Minded AI is reviewing your domestic excess. Submit your household objects for audit and receive your compliance verdict.
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
              {IDENTITY.secondaryTagline}
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
                <span className="text-[10px] font-mono text-[#7c8b7e] tracking-widest">PROTOCOL-1</span>
              </div>
              <h3 className="text-sm font-bold font-mono text-[#1f2a1f] tracking-wide">AUDIT PROCEDURE</h3>
              <p className="text-[10px] font-mono text-[#7c8b7e] mt-0">STANDARDIZED DOMESTIC INSPECTION WORKFLOW</p>
            </div>

            {/* Numbered Instructions */}
            <ol className="relative z-10 space-y-2 mb-3">
              {[
                'Position household in well-lit area. Remove obstructions.',
                'Scan room — MediaPipe extracts 478 spatial landmarks.',
                'Deterministic classifier assigns compliance tier.',
                'Arbiter renders verdict with carbon ledger breakdown.',
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
                <span className="text-[#1f2a1f] font-medium font-mono tracking-widest">ECD-{Math.floor(Math.random() * 900000 + 100000)}</span>
              </div>
              <div className="flex justify-between">
                <span>AUTHORITY</span>
                <span className="text-[#1f2a1f] font-medium">{IDENTITY.entityName}</span>
              </div>
              <div className="flex justify-between">
                <span>PROTOCOL</span>
                <span className="text-[#1f2a1f] font-medium">PROTOCOL-1 // GRID-VERIFIED</span>
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
                GRID-VERIFIED // ECOCIDE CENTRAL MAINFRAME
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-t border-gray-900/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>MEDIAPIPE 478 3D LANDMARK ENGINE ONLINE</span>
          </div>
          <div className="flex items-center gap-4">
            <span>DETERMINISTIC POPULATION BUCKETING: ACTIVE</span>
            <span className="text-cyan-600">PROTOCOL-1</span>
          </div>
          <div className="flex items-center gap-4 text-gray-600">
            <span>{IDENTITY.backronym}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;