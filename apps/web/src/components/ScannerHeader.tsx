import React from 'react';
import { Volume2, VolumeX, Globe } from 'lucide-react';
import { IDENTITY } from '@ecocide/lore';

interface ScannerHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onNavigateHome: () => void;
  onGoVault: () => void;
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
  currentStep = 1,
  totalSteps = 5,
  stepLabel = 'DOMESTIC AUDIT // STEP 01',
  onSkip,
}) => {
  return (
    <header className="w-full max-w-[1200px] mx-auto py-3 border-b border-lime-500/20 bg-[#080b08]">
      {/* Main header row */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-3">
        {/* Left: ECOCIDE Brand with Globe */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-3 sm:gap-4 cursor-pointer group select-none flex-shrink-0"
          title="Return to Home"
        >
          <div className="p-2 rounded-none bg-lime-950/60 border border-lime-500/40 text-lime-400 group-hover:border-lime-400 group-hover:shadow-[0_0_15px_rgba(180,255,57,0.4)] transition-all flex-shrink-0">
            <Globe className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-lime-400 tracking-wider flex items-center gap-2 whitespace-nowrap">
              {IDENTITY.appName}
              <span className="text-xs text-gray-500 font-normal">v0.1</span>
            </h1>
            <p className="text-[11px] font-mono text-gray-400 tracking-widest uppercase whitespace-nowrap">
              {IDENTITY.tagline.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Right: Audio Toggle */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
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
              DOMESTIC AUDIT // STEP 01
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
              <span>SKIP</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default ScannerHeader;