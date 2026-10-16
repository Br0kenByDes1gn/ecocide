import React, { useCallback, useEffect, useState } from 'react';
import type { InjunctionTask } from '@ecocide/types';
import { REGISTRY_COPY } from '@ecocide/lore';
import { ClipboardList, Loader2, Square, SquareCheckBig, Wallet } from 'lucide-react';
import { useVault } from '../lib/useVault';
import { splitWorksheet } from '../lib/injunction-worksheet';
import { confirmInjunctionTasks, fetchInjunctionTasks } from '../lib/vault-api';
import { formatVaultDate } from '../lib/vault-format';
import { RegistryUnlock } from './RegistryUnlock';
import { RegistrySidePanel } from './RegistrySidePanel';

interface InjunctionScreenProps {
  /** Open a linked assessment at /citizen/:id. */
  onOpenDossier: (id: string) => void;
  /** Start a fresh audit from the empty standing state. */
  onBeginAudit: () => void;
  /** Show only this verdict's orders (arrived from the injunction stamp). */
  dossierFilter?: string;
  /** Drop the verdict filter and show the whole worksheet. */
  onClearFilter: () => void;
}

type TaskState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; tasks: InjunctionTask[] };

/**
 * Environmental injunction worksheet (/injunction): the same two-section
 * footprint as the registry page — the citizen's accumulated corrective
 * actions on the left (60%), the registry side column on the right (40%).
 *
 * Tasks are appended server-side after every logged-in scan verdict, so this
 * page never calls Gemini itself; it only reads the stored list.
 */
export const InjunctionScreen: React.FC<InjunctionScreenProps> = ({
  onOpenDossier,
  onBeginAudit,
  dossierFilter,
  onClearFilter,
}) => {
  const { session, isPending, vault, refresh } = useVault();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [state, setState] = useState<TaskState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const tasks = await fetchInjunctionTasks();
      setChecked(new Set());
      setState({ status: 'ready', tasks });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'INJUNCTION TRANSMISSION FAILED',
      });
    }
  }, []);

  useEffect(() => {
    if (session && vault) void load();
  }, [session, vault, load]);

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

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tasks = state.status === 'ready' ? state.tasks : [];
  // The filter is a view concern; the bonus is pooled from every order on file
  // (see splitWorksheet for why they are derived together).
  const { visible, bonusTotal } = splitWorksheet(tasks, dossierFilter);
  const pendingSelected = visible.filter((t) => !t.completed && checked.has(t.id));

  const handleConfirm = async () => {
    if (pendingSelected.length === 0 || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await confirmInjunctionTasks(pendingSelected.map((t) => t.id));
      setChecked(new Set());
      await refresh();
      await load();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'CONFIRM FAILED');
    } finally {
      setConfirming(false);
    }
  };

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
                ({visible.filter((t) => t.completed).length}/{visible.length})
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={pendingSelected.length === 0 || confirming}
              className="ml-auto px-4 py-1.5 rounded-lg font-mono text-[11px] font-black tracking-widest uppercase bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-all cursor-pointer"
            >
              {confirming ? 'Filing...' : 'Confirm'}
            </button>
          </div>
          {confirmError && (
            <p className="px-5 pt-3 font-mono text-[11px] text-red-400 uppercase tracking-widest">
              ⚠ {confirmError}
            </p>
          )}

          {state.status === 'loading' && (
            <div className="px-5 py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              <p className="font-mono text-[11px] text-gray-500 uppercase tracking-widest animate-pulse">
                Retrieving orders...
              </p>
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

          {state.status === 'ready' && visible.length === 0 && (
            <div className="px-5 py-10 text-center space-y-4">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                No orders on file — run an audit while signed in to issue them.
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

          {state.status === 'ready' && visible.length > 0 && (
            <>
              {dossierFilter && (
                <div className="mx-5 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#8b5a2b]/50 bg-[#8b5a2b]/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#d9b98a]">
                  Orders issued for this verdict
                  <button
                    type="button"
                    onClick={onClearFilter}
                    className="ml-auto rounded border border-[#8b5a2b]/60 px-2 py-1 font-black hover:bg-[#8b5a2b]/20 transition-colors cursor-pointer"
                  >
                    Show all
                  </button>
                </div>
              )}
              <p className="px-5 pt-4 font-mono text-sm font-bold text-gray-200 tracking-wide">
                {visible.length} action{visible.length === 1 ? '' : 's'} on file
                {dossierFilter ? ' for this verdict' : ''} — newest first.
              </p>
              <p className="px-5 pt-1 font-mono text-[11px] text-gray-500 uppercase tracking-widest">
                {REGISTRY_COPY.injunction.hint}
              </p>
              <ul className="p-5 space-y-2">
                {visible.map((task) => {
                  const done = task.completed || checked.has(task.id);
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => !task.completed && toggleItem(task.id)}
                        disabled={task.completed}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border font-mono text-xs transition-all ${
                          done
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 cursor-default'
                            : 'bg-black/30 border-gray-800 text-gray-300 hover:border-cyan-500/40 cursor-pointer'
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
                              {task.action}
                            </span>
                            <span className="block mt-1 text-[11px] leading-snug text-gray-400">
                              {task.why}
                            </span>
                            <span className="block mt-1 text-[10px] uppercase tracking-widest text-gray-500">
                              Target: {task.replaces} · {task.category.replace(/_/g, ' ')} · Added {formatVaultDate(task.createdAt)}
                              {task.completed && task.points > 0 ? ` · +${task.points}` : ''}
                            </span>
                          </span>
                          <span className="flex flex-col gap-1 shrink-0 text-right">
                            <span
                              className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${
                                task.impact === 'high'
                                  ? 'text-red-300 border-red-500/50 bg-red-950/40'
                                  : task.impact === 'medium'
                                  ? 'text-amber-300 border-amber-500/50 bg-amber-950/40'
                                  : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40'
                              }`}
                            >
                              {task.impact}
                            </span>
                            <span className="px-2 py-0.5 rounded border border-gray-700 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                              {task.effort}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="px-5 pb-5 font-mono text-[11px] text-gray-500 uppercase tracking-widest">
                {visible.every((t) => t.completed) ? REGISTRY_COPY.injunction.cleared : REGISTRY_COPY.injunction.closing}
              </p>
            </>
          )}
        </div>

        <RegistrySidePanel vault={vault} onBeginAudit={onBeginAudit} onOpenDossier={onOpenDossier} bonus={bonusTotal} />
      </div>
    </div>
  );
};
