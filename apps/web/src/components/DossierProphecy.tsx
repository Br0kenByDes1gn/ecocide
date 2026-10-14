import React from 'react';
import type { Caste } from '@ecocide/types';
import { ChevronsUpDown, FastForward, Sparkles } from 'lucide-react';
import { paragraphTopic } from '../lib/prophecyTopics';

interface DossierProphecyProps {
  headline: string;
  text1: string;
  text2: string;
  text3: string;
  isTyping: boolean;
  /** The citizen's caste — used to pick topic-accurate icons for paragraphs 2–3. */
  caste?: Caste;
  /**
   * Optional custom status line. When omitted, the standard telemetry stream
   * line is shown while typing. The arbitration page uses this to display its
   * audit status while the stat reveal is still running.
   */
  statusLine?: string | null;
  /** Larger text for the arbitration reveal ("lg" = text-lg). */
  fontSize?: 'sm' | 'lg';
  /** Per-paragraph collapsed flags (arbitration flow). */
  paragraphCollapsed?: boolean[];
  /** Per-paragraph one-way expanded flags (arbitration flow). */
  paragraphExpanded?: boolean[];
  /** Whether collapsed paragraphs are clickable to expand (after completion). */
  interactive?: boolean;
  onExpandParagraph?: (index: number) => void;
  /** When provided, renders a right-aligned fast-forward button on the status row. */
  onFastForward?: () => void;
  /** Label for the fast-forward button (only rendered when onFastForward is set). */
  fastForwardLabel?: string;
}

const CLAIM_ACCENTS = ['border-teal-400', 'border-amber-400', 'border-emerald-400'];
const ACCENT_TEXT = ['text-teal-400', 'text-amber-400', 'text-emerald-400'];

/**
 * The sarcastic prophecy section: headline + three progressively typed
 * paragraphs. In arbitration mode it renders at a larger font and each
 * paragraph can collapse to its first visual line and expand back on click.
 */
export const DossierProphecy: React.FC<DossierProphecyProps> = ({
  headline,
  text1,
  text2,
  text3,
  isTyping,
  caste,
  statusLine,
  fontSize = 'sm',
  paragraphCollapsed,
  paragraphExpanded,
  interactive = false,
  onExpandParagraph,
  onFastForward,
  fastForwardLabel = 'ACCELERATE',
}) => {
  const texts = [text1, text2, text3];
  const effectiveStatusLine =
    statusLine !== undefined ? statusLine : isTyping ? 'RECEIVING AUDIT TELEMETRY STREAM...' : null;

  const paragraphClass = (index: number) => {
    const collapsed = Boolean(paragraphCollapsed?.[index]);
    const expanded = Boolean(paragraphExpanded?.[index]);
    const isCollapsed = collapsed && !expanded;
    const clickable = interactive && isCollapsed && !!onExpandParagraph;

    return [
      'relative bg-black/30 p-3 rounded-lg border-l-2 overflow-hidden transition-all duration-700',
      CLAIM_ACCENTS[index % CLAIM_ACCENTS.length],
      `font-mono ${fontSize === 'lg' ? 'text-lg' : 'text-sm'} leading-relaxed text-gray-300`,
      isCollapsed ? 'max-h-[5.25rem] line-clamp-2' : 'max-h-[40rem]',
      clickable ? 'cursor-pointer hover:bg-black/40 hover:border-cyan-300/70' : '',
    ].join(' ');
  };

  return (
    <div className="bg-[#121a14] rounded-2xl border border-gray-800 p-6 space-y-4 shadow-xl">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h3 className="font-mono text-sm font-bold text-amber-400 tracking-wider uppercase">
          ARBITER VERDICT // {headline}
        </h3>
      </div>

      <div className="space-y-4">
        {texts.map((text, index) => {
          const collapsed = Boolean(paragraphCollapsed?.[index]);
          const expanded = Boolean(paragraphExpanded?.[index]);
          const isCollapsed = collapsed && !expanded;
          const clickable = interactive && isCollapsed && !!onExpandParagraph;
          const topic = paragraphTopic(index, caste);
          const TopicIcon = topic.Icon;
          return (
            <p
              key={index}
              onClick={clickable ? () => onExpandParagraph?.(index) : undefined}
              role={clickable ? 'button' : undefined}
              title={clickable ? 'Expand paragraph to full verdict text' : topic.label}
              aria-label={topic.label}
              className={paragraphClass(index)}
              style={
                isCollapsed
                  ? {
                      WebkitMaskImage: 'linear-gradient(to bottom, black 52%, transparent 88%)',
                      maskImage: 'linear-gradient(to bottom, black 52%, transparent 88%)',
                    }
                  : undefined
              }
            >
              <TopicIcon
                className={`inline-block w-5 h-5 shrink-0 mr-2.5 align-middle ${ACCENT_TEXT[index % ACCENT_TEXT.length]}`}
                aria-hidden
              />
              {text}
              {clickable && (
                <span
                  className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-md bg-black/70 border border-cyan-500/40 text-cyan-300 shadow-lg"
                  aria-hidden
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </span>
              )}
            </p>
          );
        })}
      </div>

      {effectiveStatusLine && (
        <div className="text-xs font-mono text-cyan-400 animate-pulse flex items-center justify-between gap-3 pt-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="truncate">{effectiveStatusLine}</span>
          </span>
          {onFastForward && (
            <button
              type="button"
              onClick={onFastForward}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan-500/50 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/70 hover:text-cyan-200 transition-all font-mono text-[10px] uppercase tracking-wider cursor-pointer"
              title="Fast-forward straight to the full dossier"
            >
              <FastForward className="w-3.5 h-3.5" />
              {fastForwardLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};