import React, { useCallback, useEffect, useState } from 'react';
import type { InjunctionChecklist } from '@ecocide/types';
import { REGISTRY_COPY } from '@ecocide/lore';
import { ClipboardList, Loader2, Square, SquareCheckBig, Wallet } from 'lucide-react';
import { useVault } from '../lib/useVault';
import { RegistryUnlock } from './RegistryUnlock';
import { RegistrySidePanel } from './RegistrySidePanel';

interface InjunctionScreenProps {
  /** Open a linked assessment at /citizen/:id. */
  onOpenDossier: (id: string) => void;
  /** Start a fresh audit from the empty standing state. */
  onBeginAudit: () => void;
  /** Preferred dossier id (?citizen=); falls back to the most recent filing. */
  citizenId?: string | null;
}

type ChecklistState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dossierId: string; checklist: InjunctionChecklist };

/**
 * Environmental injunction worksheet (/injunction): the same two-section
 * footprint as the registry page — a Gemini-generated corrective-action
 * checklist on the left (60%), the registry side column on the right (40%).
 */
export const InjunctionScreen: React.FC<InjunctionScreenProps> = ({
  onOpenDossier,
  onBeginAudit,
  citizenId,
}) => {
  const { session, isPending, vault, refresh } = useVault();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [state, setState] = useState<ChecklistState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      let id = citizenId;
      if (!id) {
        const recent = await fetch('/api/citizens/recent?limit=1');
        if (!recent.ok) throw new Error(`Archive server responded with ${recent.status}`);
        const records = (await recent.json()) as Array<{ id: string }>;
        id = records[0]?.id ?? null;
      }
      if (!id) {
        setState({ status: 'empty' });
        return;
      }
      const res = await fetch(`/api/citizen/${id}/injunction`, { method: 'POST' });
      if (!res.ok) throw new Error(`Injunction server responded with ${res.status}`);
      const checklist = (await res.json()) as InjunctionChecklist;
      setChecked(new Set());
      setState({ status: 'ready', dossierId: id, checklist });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'INJUNCTION TRANSMISSION FAILED',
      });
    }
  }, [citizenId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isPending) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest uppercase animate-pulse">
          {REGISTRY_COPY.status.loading}
        </div>
      </div>
    );
  }

  // Locked → unlock inline.
  if (!session && !vault) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0e1510] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-5 text-cyan-300 font-mono text-xs font-bold tracking-widest uppercase">
          <Wallet className="w-4 h-4" />
          {REGISTRY_COPY.status.locked}
        </div>
        <RegistryUnlock onUnlocked={() => void refresh()} />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest uppercase animate-pulse">
          {REGISTRY_COPY.status.loading}
        </div>
      </div>
    );
  }

  const toggleItem = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const items = state.status === 'ready' ? state.checklist.items : [];
  const allChecked = items.length > 0 && checked.size >= items.length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {/* Environmental injunction checklist (60%) */}
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 shadow-xl overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800 text-gray-300 font-mono text-xs tracking-widest uppercase">
            <ClipboardList className="w-4 h-4 text-gray-500" />
            {REGISTRY_COPY.injunction.title}{' '}
            {state.status === 'ready' && (
              <span className="text-gray-500">
                ({checked.size}/{items.length})
              </span>
            )}
          </div>

          {state.status === 'loading' && (
            <div className="px-5 py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              <p className="font-mono text-[11px] text-gray-500 uppercase tracking-widest animate-pulse">
                Drafting corrective actions...
              </p>
            </div>
          )}

          {state.status === 'empty' && (
            <div className="px-5 py-10 text-center space-y-4">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                No household on file — file an audit to issue orders.
              </p>
              <button
                type="button"
                onClick={onBeginAudit}
                className="px-6 py-3 rounded-xl font-mono text-sm font-black tracking-widest uppercase bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg hover:shadow-cyan-500/30 transition-all cursor-pointer"
              >
                Begin audit
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="px-5 py-10 text-center space-y-4">
              <p className="font-mono text-xs text-red-400 uppercase tracking-widest">
                ⚠ {state.message}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="px-6 py-2.5 rounded-xl font-mono text-xs font-black tracking-widest uppercase border border-cyan-500/50 text-cyan-300 hover:bg-cyan-950/40 transition-all cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {state.status === 'ready' && (
            <>
              <p className="px-5 pt-4 font-mono text-sm font-bold text-gray-200 tracking-wide">
                {state.checklist.headline}
              </p>
              <p className="px-5 pt-1 font-mono text-[11px] text-gray-500 uppercase tracking-widest">
                {REGISTRY_COPY.injunction.hint}
              </p>
              <ul className="p-5 space-y-2">
                {state.checklist.items.map((item, i) => {
                  const done = checked.has(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => toggleItem(i)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border font-mono text-xs transition-all cursor-pointer ${
                          done
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                            : 'bg-black/30 border-gray-800 text-gray-300 hover:border-cyan-500/40'
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          {done ? (
                            <SquareCheckBig className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className={`block font-bold leading-snug ${done ? 'line-through opacity-70' : ''}`}>
                              {item.action}
                            </span>
                            <span className="block mt-1 text-[11px] leading-snug text-gray-400">
                              {item.why}
                            </span>
                            <span className="block mt-1 text-[10px] uppercase tracking-widest text-gray-500">
                              Target: {item.replaces} · {item.category.replace(/_/g, ' ')}
                            </span>
                          </span>
                          <span className="flex flex-col gap-1 shrink-0 text-right">
                            <span
                              className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
                                item.impact === 'high'
                                  ? 'text-red-300 border-red-500/50 bg-red-950/40'
                                  : item.impact === 'medium'
                                  ? 'text-amber-300 border-amber-500/50 bg-amber-950/40'
                                  : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40'
                              }`}
                            >
                              {item.impact}
                            </span>
                            <span className="px-2 py-0.5 rounded border border-gray-700 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                              {item.effort}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="px-5 pb-5 font-mono text-[11px] text-gray-500 uppercase tracking-widest">
                {allChecked ? REGISTRY_COPY.injunction.cleared : state.checklist.closing_line}
              </p>
            </>
          )}
        </div>

        <RegistrySidePanel vault={vault} onBeginAudit={onBeginAudit} onOpenDossier={onOpenDossier} />
      </div>
    </div>
  );
};
