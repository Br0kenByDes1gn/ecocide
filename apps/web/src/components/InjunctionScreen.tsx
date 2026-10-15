import React, { useState } from 'react';
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
}

/**
 * Environmental injunction worksheet (/injunction): the same two-section
 * footprint as the registry page — binding orders with a compliance checklist
 * on the left (60%), the registry side column on the right (40%).
 */
export const InjunctionScreen: React.FC<InjunctionScreenProps> = ({
  onOpenDossier,
  onBeginAudit,
}) => {
  const { session, isPending, vault, refresh } = useVault();
  const [checked, setChecked] = useState<Set<number>>(new Set());

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

  const items = REGISTRY_COPY.injunction.items;
  const allChecked = checked.size >= items.length;

  const toggleItem = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {/* Environmental injunction checklist (60%) */}
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 shadow-xl overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800 text-gray-300 font-mono text-xs tracking-widest uppercase">
            <ClipboardList className="w-4 h-4 text-gray-500" />
            {REGISTRY_COPY.injunction.title} ({checked.size}/{items.length})
          </div>
          <p className="px-5 pt-4 font-mono text-[11px] text-gray-500 uppercase tracking-widest">
            {REGISTRY_COPY.injunction.hint}
          </p>
          <ul className="p-5 space-y-2">
            {items.map((item, i) => {
              const done = checked.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleItem(i)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border font-mono text-xs flex items-center gap-3 transition-all cursor-pointer ${
                      done
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-black/30 border-gray-800 text-gray-300 hover:border-cyan-500/40'
                    }`}
                  >
                    {done ? (
                      <SquareCheckBig className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-600 shrink-0" />
                    )}
                    <span className={`leading-snug ${done ? 'line-through opacity-70' : ''}`}>
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {allChecked && (
            <p className="px-5 pb-5 font-mono text-[11px] text-emerald-300 uppercase tracking-widest">
              {REGISTRY_COPY.injunction.cleared}
            </p>
          )}
        </div>

        <RegistrySidePanel vault={vault} onBeginAudit={onBeginAudit} onOpenDossier={onOpenDossier} />
      </div>
    </div>
  );
};
