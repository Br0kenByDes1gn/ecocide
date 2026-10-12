import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, ArrowRight, FastForward, RotateCcw, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import { REGISTRY_QUOTES, type RegistryQuote } from '../data/quotes';
import { soundFx } from '../lib/audio';

interface AnimatedIntroProps {
  onProceedToScan: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenDebug?: () => void;
}

// Durations in milliseconds for each consecutive quote (doubled cadence, decaying to build anxiety)
const QUOTE_DURATIONS = [8400, 6200, 4400, 3000, 1900, 1200];
const TOTAL_QUOTES_COUNT = QUOTE_DURATIONS.length; // 6 quotes

// Distinct equalizer waveforms used by the "BUFFERING" indicator (cryptic telemetry bars)
const BUFFER_EQ_ANIMATIONS = ['eq-high', 'eq-tactical', 'eq-rhythm', 'eq-glitch', 'eq-organic', 'eq-heartbeat'];

function shuffleQuotes(quotes: RegistryQuote[]): RegistryQuote[] {
  const array = [...quotes];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const AnimatedIntro: React.FC<AnimatedIntroProps> = ({
  onProceedToScan,
  isMuted = false,
  onToggleMute,
  onOpenDebug,
}) => {
  const [shuffledQuotes, setShuffledQuotes] = useState<RegistryQuote[]>(() =>
    shuffleQuotes(REGISTRY_QUOTES).slice(0, TOTAL_QUOTES_COUNT)
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isClimaxReached, setIsClimaxReached] = useState<boolean>(false);
  const [glitchActive, setGlitchActive] = useState<boolean>(false);

  // Play quote progression timer
  useEffect(() => {
    if (isClimaxReached) return;

    if (currentIndex >= TOTAL_QUOTES_COUNT) {
      setIsClimaxReached(true);
      soundFx.playClimaxAlarm();
      return;
    }

    const duration = QUOTE_DURATIONS[currentIndex];
    soundFx.playTransmissionTick(currentIndex + 1);

    // Trigger subtle glitch burst on transition
    setGlitchActive(true);
    const glitchTimeout = setTimeout(() => setGlitchActive(false), 150);

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(glitchTimeout);
    };
  }, [currentIndex, isClimaxReached]);

  const handleSkip = () => {
    soundFx.playScannerBeep();
    setIsClimaxReached(true);
    soundFx.playClimaxAlarm();
  };

  const handleReplay = () => {
    soundFx.playScannerBeep();
    setShuffledQuotes(shuffleQuotes(REGISTRY_QUOTES).slice(0, TOTAL_QUOTES_COUNT));
    setCurrentIndex(0);
    setIsClimaxReached(false);
  };

  // Clicking anywhere on the quote card advances to the next transmission
  // (the progression effect below handles timing, glitch burst, and climax).
  const handleQuoteAdvance = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const currentQuote = shuffledQuotes[currentIndex] || shuffledQuotes[shuffledQuotes.length - 1];

  // Progressive anxiety theme colors
  const stageTheme = useMemo(() => {
    if (currentIndex <= 1) {
      return {
        badge: 'text-cyan-400 bg-cyan-950/50 border-cyan-500/40',
        cardBorder: 'border-cyan-500/40 shadow-cyan-950/40',
        quoteText: 'text-cyan-100',
        authorText: 'text-cyan-400',
        progressColor: 'bg-cyan-400',
        progressGlow: 'shadow-[0_0_6px_rgba(34,211,238,0.5)]',
        phase: 'REGISTRY PROTOCOL // STAGE 01',
      };
    }
    if (currentIndex <= 3) {
      return {
        badge: 'text-amber-400 bg-amber-950/50 border-amber-500/40',
        cardBorder: 'border-amber-500/50 shadow-amber-950/50',
        quoteText: 'text-amber-50',
        authorText: 'text-amber-400',
        progressColor: 'bg-amber-400',
        progressGlow: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]',
        phase: 'REGISTRY PROTOCOL // STAGE 02',
      };
    }
    return {
      badge: 'text-red-400 bg-red-950/60 border-red-500/60',
      cardBorder: 'border-red-500/70 shadow-red-950/70',
      quoteText: 'text-red-50',
      authorText: 'text-red-400',
      progressColor: 'bg-red-500',
      progressGlow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
      phase: 'REGISTRY PROTOCOL // STAGE 03',
    };
  }, [currentIndex]);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 relative select-none">
      {/* Top Protocol Status Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between border-b border-gray-800/80 pb-3 font-mono text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-semibold tracking-wider text-gray-300 hidden sm:inline">
            {isClimaxReached ? 'REGISTRY READY' : stageTheme.phase}
          </span>
          <span className="font-semibold tracking-wider text-gray-300 sm:hidden">
            {isClimaxReached ? 'READY' : `STAGE 0${Math.min(currentIndex + 1, TOTAL_QUOTES_COUNT)}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isClimaxReached && (
            <span className="text-gray-500 text-[11px] font-mono mr-1">
              {currentIndex + 1} / {TOTAL_QUOTES_COUNT}
            </span>
          )}

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-300 transition-colors cursor-pointer"
              title="Toggle Audio Engine"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          )}

          {!isClimaxReached && (
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-cyan-400 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Skip directly to designation scanner"
            >
              <span>SKIP</span>
              <FastForward className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Center Screen: Active Quote or Climax Prompt */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto w-full max-w-4xl mx-auto py-6">
        {isClimaxReached ? (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            {/* Pulsing Hazard Shield */}
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-red-600/20 rounded-full blur-xl animate-pulse" />
              <div className="relative p-5 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.4)]">
                <ShieldAlert className="w-14 h-14 sm:w-16 sm:h-16 animate-bounce" />
              </div>
            </div>

            {/* Warning Header */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/70 text-red-400 text-xs font-mono tracking-widest uppercase mb-4 shadow-sm shadow-red-950">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              <span>TERMINAL REGISTRATION PROTOCOL</span>
            </div>

            {/* Dramatic Climax Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-white mb-4 leading-tight">
              Registration is coming!
              <span className="block text-2xl sm:text-3xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 font-extrabold mt-1">
                Your file has been opened.
              </span>
            </h2>

            <p className="max-w-md text-sm sm:text-base font-mono text-gray-400 mb-8 leading-relaxed">
              The registry is finalizing its protocols. Step forward to submit your
              biometrics to the Carbon Minded AI.
            </p>

            {/* Big Action Button */}
            <button
              type="button"
              onClick={() => {
                soundFx.playScannerBeep();
                onProceedToScan();
              }}
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 sm:px-10 sm:py-5 rounded-xl font-mono text-base sm:text-lg font-bold text-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:shadow-[0_0_45px_rgba(6,182,212,0.9)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>INITIATE REGISTRATION</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </button>

            {/* Replay Transmission link */}
            <button
              type="button"
              onClick={handleReplay}
              className="mt-8 inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Registry Transmissions</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col justify-center">
            {/* Anxiety Speed Progress Bar */}
            <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden mb-8 border border-gray-800">
              <div
                className={`h-full transition-all duration-300 ${stageTheme.progressColor}`}
                style={{ width: `${((currentIndex + 1) / TOTAL_QUOTES_COUNT) * 100}%` }}
              />
            </div>

            {/* Quote Container */}
            <div
              key={currentQuote.id + '-' + currentIndex}
              onClick={handleQuoteAdvance}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleQuoteAdvance();
                }
              }}
              title="Next transmission"
              className={`relative p-6 sm:p-12 rounded-2xl bg-black/70 backdrop-blur-md border ${stageTheme.cardBorder} shadow-2xl transition-all duration-150 cursor-pointer ${
                glitchActive ? 'translate-x-1 scale-[0.99] filter contrast-125' : ''
              }`}
            >
              {/* Decorative Corner Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/60" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/60" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500/60" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500/60" />

              {/* Quote Glyph */}
              <div className="text-4xl sm:text-5xl font-serif text-gray-600 font-bold select-none mb-2">
                “
              </div>

              {/* The Quote Statement */}
              <blockquote
                className={`text-xl sm:text-2xl md:text-3xl font-medium font-mono leading-relaxed mb-8 ${stageTheme.quoteText} tracking-tight`}
              >
                {currentQuote.quote}
              </blockquote>

              {/* Author Metadata Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-800/80 pt-4">
                <div>
                  <div className={`text-base sm:text-lg font-bold font-mono ${stageTheme.authorText} flex items-center gap-2`}>
                    <span>{currentQuote.author}</span>
                  </div>
                  {currentQuote.title && (
                    <p className="text-xs sm:text-sm font-mono text-gray-400 mt-0.5">
                      {currentQuote.title}
                    </p>
                  )}
                </div>

                <div className="self-start sm:self-auto px-3 py-1 rounded bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-400">
                  DISCLOSED: <span className="text-gray-200">{currentQuote.date}</span>
                </div>
              </div>
            </div>

            {/* Data Buffering Indicator */}
            <div className="mt-8 flex items-center justify-center gap-3 text-[11px] font-mono text-gray-500 uppercase tracking-widest">
              <div className="flex items-end gap-1 h-5">
                {BUFFER_EQ_ANIMATIONS.map((eqAnimation, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-sm ${stageTheme.progressColor} ${stageTheme.progressGlow}`}
                    style={{
                      animation: `${eqAnimation} ${0.7 + (i % 4) * 0.18}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.09}s`,
                    }}
                  />
                ))}
              </div>
              <span>BUFFERING</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Subtle Status */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between text-[11px] font-mono text-gray-600 border-t border-gray-900/60 pt-3">
        <span>REGISTRY ARCHIVE: PROVISIONAL TRANSMISSIONS</span>
        <div className="flex items-center gap-3">
          {onOpenDebug && (
            <button
              type="button"
              onClick={onOpenDebug}
              className="text-[10px] text-amber-500/80 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400 bg-amber-950/40 px-2 py-0.5 rounded cursor-pointer transition-colors"
              title="Open Developer Testbench"
            >
              [DEV: DEBUG BENCH]
            </button>
          )}
          <span className="text-gray-500">PROTOCOL-1</span>
        </div>
      </div>
    </div>
  );
};
