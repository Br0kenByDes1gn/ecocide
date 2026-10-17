import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Globe } from 'lucide-react';
import { GRID_COPY, IDENTITY } from '@ecocide/lore';
import { AssetWireframe } from './AssetWireframe';
import { makeGridLogLine, type GridLogLine } from '../lib/status-log';

/**
 * Stable prop for the planet: one model, spinning. A module constant so the
 * canvas effect (which reads its props once, at mount) never re-seeds.
 */
const PLANET_MODELS = ['earth_wireframe'] as const;

/** How often one predefined message is appended. */
const TICK_MS = 3200;
/** The log keeps this many lines; older ones scroll away. */
const MAX_LINES = 60;
/** Lines already on the page when it opens. */
const SEED_LINES = 4;

const LEVEL_STYLES: Record<GridLogLine['level'], { text: string; marker: string }> = {
  nominal: { text: 'text-gray-300', marker: 'text-lime-300 border-lime-500/40 bg-lime-950/40' },
  notice: { text: 'text-gray-100', marker: 'text-amber-300 border-amber-500/40 bg-amber-950/40' },
  alert: { text: 'text-red-100', marker: 'text-red-300 border-red-500/40 bg-red-950/40' },
};

/** Fill the first `count` messages, newest first, timestamped as recent history. */
function seedLines(count: number): GridLogLine[] {
  const now = Date.now();
  const out: GridLogLine[] = [];
  for (let n = 0; n < count; n++) {
    const index = count - 1 - n;
    out.push(
      makeGridLogLine({ now: new Date(now - n * TICK_MS), rand: Math.random, index })
    );
  }
  return out;
}

interface GridScreenProps {
  /** Open the credits page (/adjudicators) — the Bureau's staff. */
  onOpenAdjudicators: () => void;
}

/**
 * The Planetary Grid (`/grid`) — the Arbiter's live oversight of the planet: a
 * rotating earth wireframe (the scanner's projection in `spin` mode, at a larger
 * size), a readout strip, and an activity log streaming the predefined
 * transmissions from `GRID_COPY.log`.
 *
 * The log pauses while the tab is hidden so a background tab is not a busy loop,
 * and the animation falls back to a static frame under reduced motion (handled
 * inside {@link AssetWireframe}). Newest lines sit at the top.
 */
export const GridScreen: React.FC<GridScreenProps> = ({ onOpenAdjudicators }) => {
  const [lines, setLines] = useState<GridLogLine[]>(() => seedLines(SEED_LINES));
  const [eventsPerMin, setEventsPerMin] = useState(() => 96 + Math.floor(Math.random() * 40));
  const sweepRef = useRef(SEED_LINES);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const index = sweepRef.current++;
      setLines((prev) => {
        // Newest on top, so a plain prepend keeps the log readable without any
        // scrolling; the oldest lines fall off the bottom at MAX_LINES.
        const next = [makeGridLogLine({ now: new Date(), rand: Math.random, index }), ...prev];
        return next.length > MAX_LINES ? next.slice(0, MAX_LINES) : next;
      });
      setEventsPerMin((prev) =>
        Math.min(999, Math.max(60, prev + Math.floor(Math.random() * 15) - 5))
      );
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h2 className="font-mono text-lg font-bold text-lime-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <Globe className="w-5 h-5 text-lime-400" />
          {GRID_COPY.name}
        </h2>
        <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">
          {GRID_COPY.subtitle}
        </p>
        <p className="mx-auto max-w-2xl font-mono text-[11px] leading-relaxed text-gray-500">
          {GRID_COPY.intro}
        </p>
      </div>

      {/* Planet + readouts */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-label="Planetary wireframe feed"
          className="relative min-h-[380px] overflow-hidden rounded-xl border border-lime-500/25 bg-[#070a08] sm:min-h-[460px] lg:min-h-[540px]"
        >
          <AssetWireframe
            models={PLANET_MODELS}
            motion="spin"
            fit={0.72}
            className="absolute inset-0 h-full w-full"
          />

          {/* HUD corners */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
            <div className="flex items-start justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span className="rounded border border-lime-500/40 bg-black/60 px-2 py-1 text-lime-400">
                Terra · live feed
              </span>
              <span className="rounded border border-gray-700 bg-black/60 px-2 py-1 text-gray-400">
                {IDENTITY.auditProtocol}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2 font-mono text-[10px] uppercase tracking-widest">
              <span className="flex items-center gap-1.5 rounded border border-lime-500/30 bg-black/60 px-2 py-1 text-lime-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" />
                Grid-verified
              </span>
              <span className="rounded border border-gray-700 bg-black/60 px-2 py-1 text-gray-400">
                Sweeps {sweepRef.current}
              </span>
            </div>
          </div>
        </section>

        <section aria-label="Grid readouts" className="rounded-xl border border-gray-800 bg-[#121a14] p-4">
          <div className="grid grid-cols-2 gap-2">
            {GRID_COPY.readouts.map((readout) => (
              <div
                key={readout.label}
                className="min-w-0 rounded-lg border border-gray-800 bg-black/40 px-3 py-2.5"
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-gray-500">
                  {readout.label}
                </div>
                <div className="mt-0.5 truncate font-mono text-sm font-bold text-gray-200">
                  {readout.value}
                </div>
              </div>
            ))}
            {/* The one readout that actually moves. */}
            <div className="col-span-2 flex items-center justify-between rounded-lg border border-lime-500/40 bg-lime-950/30 px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-widest text-lime-400/80">
                {GRID_COPY.liveLabel}
              </div>
              <div className="font-mono text-lg font-black tabular-nums text-lime-300">
                {eventsPerMin}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Activity log */}
      <section aria-label="Grid activity log" className="overflow-hidden rounded-xl border border-gray-800 bg-[#0e1510]">
        <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-300">
            <Activity className="w-4 h-4 text-lime-400" />
            {GRID_COPY.log.title}
          </div>
          <span className="flex items-center gap-1.5 rounded border border-lime-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-lime-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" />
            {GRID_COPY.log.live}
          </span>
        </div>

        <div className="h-64 divide-y divide-gray-900 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed">
          {lines.length === 0 ? (
            <div className="py-6 text-center uppercase tracking-widest text-gray-600">
              {GRID_COPY.log.empty}
            </div>
          ) : (
            lines.map((line) => {
              const style = LEVEL_STYLES[line.level];
              return (
                <div key={line.id} className="flex items-start gap-2.5 py-1.5">
                  <span className="shrink-0 tabular-nums text-gray-600">{line.time}</span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-bold tracking-widest ${style.marker}`}
                  >
                    {GRID_COPY.log.levels[line.level]}
                  </span>
                  <span className={`min-w-0 break-words ${style.text}`}>{line.text}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Operator strip — who runs the grid. */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-800 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-gray-500 sm:flex-row">
          <span>
            Object audit engine online · {IDENTITY.auditProtocol}
          </span>
          <button
            type="button"
            onClick={onOpenAdjudicators}
            className="inline-flex items-center gap-1.5 rounded-lg border border-lime-500/50 bg-lime-950/40 px-3 py-1.5 text-lime-400 transition-colors hover:border-lime-400 hover:text-lime-300 cursor-pointer"
            title="Meet the current staff on duty (/adjudicators)"
          >
            {GRID_COPY.staffOnDuty}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default GridScreen;
