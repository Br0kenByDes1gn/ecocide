import React from 'react';
import { Volume2, VolumeX, Globe, Bug, Wallet } from 'lucide-react';
import { IDENTITY, REGISTRY_COPY } from '@ecocide/lore';

interface ScannerHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onNavigateHome: () => void;
  onGoRegistry: () => void;
  onOpenDebug?: () => void;
  IS_DEV?: boolean;
  currentStep?: number;
  totalSteps?: number;
  stepLabel?: string;
  onSkip?: () => void;
}

export const ScannerHeader: React.FC<ScannerHeaderProps> = ({
  isMuted,
  onToggleMute,
  onNavigateHome,
  onGoRegistry,
  onOpenDebug,
  IS_DEV,
  currentStep = 1,
  totalSteps = 2,
  stepLabel = 'CAPTURE EVIDENCE',
  onSkip,
}) => {
  return (
    <header className="w-full max-w-[1200px] mx-auto py-3 border-b border-lime-500/20 bg-[#080b08]">
      {/* Main header row */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-3">
        {/* Left: ECOCIDE Brand with Globe */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-3 sm:gap-4 cursor-pointer group select-none min-w-0"
          title="Return to Home"
        >
          <div className="p-2 rounded-none bg-lime-950/60 border border-lime-500/40 text-lime-400 group-hover:border-lime-400 group-hover:shadow-[0_0_15px_rgba(180,255,57,0.4)] transition-all flex-shrink-0">
            <Globe className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-lime-400 tracking-wider flex items-center gap-2 whitespace-nowrap">
              {IDENTITY.appName}
              <span className="hidden sm:inline text-xs text-gray-500 font-normal">v{IDENTITY.appVersion}</span>
            </h1>
            <p className="hidden sm:block text-[11px] font-mono text-gray-400 tracking-widest uppercase whitespace-nowrap">
              {IDENTITY.tagline.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {IS_DEV && onOpenDebug && (
            <button
              type="button"
              onClick={onOpenDebug}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 bg-amber-950/60 hover:bg-amber-900/60 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Development Audit Bench (/debug)"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">[DEV]</span>
              <span className="hidden lg:inline">DEBUG</span>
            </button>
          )}
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
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-lime-500/20 my-3" />

      {/* Audit Progress Strip */}
      <div className="bg-[#0c110d] border border-lime-500/20 rounded-lg px-4 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2.5 py-1 text-[10px] font-mono text-lime-400 border border-lime-500/40 rounded bg-lime-500/10">
              DOMESTIC AUDIT // STEP {String(currentStep).padStart(2, '0')} — {stepLabel}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }, (_, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === currentStep;
                const isComplete = stepNum < currentStep;
                return (
                  <div key={stepNum} className="flex items-center gap-1">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-mono font-bold transition-all ${isComplete
                      ? 'bg-lime-500 border-lime-500 text-black'
                      : isActive
                        ? 'bg-transparent border-lime-500 text-lime-400 animate-pulse'
                        : 'bg-transparent border-gray-600 text-gray-500'
                      }`}>
                      {isComplete ? '✓' : stepNum}
                    </div>
                    {stepNum < totalSteps && (
                      <div className={`w-6 h-0.5 rounded ${isComplete ? 'bg-lime-500' : 'bg-gray-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-gray-400 hover:text-lime-400 border border-gray-700 hover:border-lime-500/50 rounded-lg bg-gray-900/50 transition-colors cursor-pointer"
            >
              <span>SKIP CAMERA</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default ScannerHeader;