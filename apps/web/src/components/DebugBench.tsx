import React, { useMemo, useState } from 'react';
import type { Caste, OraclePayload } from '@ecocide/types';
import { CASTE_COLORS, CASTE_ORDER, getFaction, simulateTierRoom } from '@ecocide/types';
import { ArrowLeft, Bug } from 'lucide-react';
import { CitizenDossier } from './CitizenDossier';
import { soundFx } from '../lib/audio';

interface DebugBenchProps {
  onExit: () => void;
}

/**
 * Development audit bench (/debug): six deterministic EXHIBIT ROOMS, one per
 * tier, hand-composed from the lore archetype catalog and verified to land in
 * their art-direction bands (factions.test / DebugBench.test). Lets you
 * preview verdicts, the dossier card and every lens without tokens or a
 * camera. Dev-only (App.tsx guards it).
 */
export const DebugBench: React.FC<DebugBenchProps> = ({ onExit }) => {
  const [selected, setSelected] = useState<Caste | null>(null);

  const payload = useMemo<OraclePayload | null>(() => {
    if (!selected) return null;
    return simulateTierRoom(selected).payload;
  }, [selected]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Bug className="w-5 h-5" />
          </span>
          <div>
            <h1 className="font-mono text-base font-bold text-amber-400 tracking-widest uppercase">
              AUDIT BENCH // EXHIBIT ROOMS
            </h1>
            <p className="text-[11px] font-mono text-gray-500">
              DETERMINISTIC OFFLINE PRESETS — ONE ROOM PER TIER. NO TOKENS, NO CAMERA.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-mono text-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          EXIT BENCH
        </button>
      </div>

      {!payload || !selected ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CASTE_ORDER.map((caste) => {
            const scan = simulateTierRoom(caste);
            const faction = getFaction(caste);
            const colors = CASTE_COLORS[caste];
            return (
              <button
                key={caste}
                type="button"
                onClick={() => {
                  soundFx.playBeep();
                  setSelected(caste);
                }}
                className={`text-left p-4 rounded-2xl border-2 bg-[#121a14] hover:scale-[1.02] transition-all cursor-pointer ${colors.border} ${colors.glow}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`font-mono text-xs font-black uppercase tracking-wider ${colors.color}`}>
                    {faction.name}
                  </span>
                  <span className="text-[9px] font-mono text-gray-500">{faction.stampText}</span>
                </div>
                <div className="font-mono text-3xl font-black tracking-widest">
                  <span className={colors.color}>{scan.ratio}%</span>
                </div>
                <div className="text-[11px] font-mono text-gray-400 mt-1">
                  {scan.payload.user_profile.honorific_title} // {scan.audit.items.length} ITEMS //{' '}
                  {scan.audit.hardFails} HARD FAILS
                </div>
                <div className="text-[10px] font-mono text-gray-600 mt-2 leading-snug">
                  VERDICT: {scan.audit.roomType?.toUpperCase() ?? 'ROOM'} // {scan.payload.prophecy.headline}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-mono text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            BACK TO ROOMS
          </button>
          <CitizenDossier payload={payload} onReset={() => setSelected(null)} />
        </>
      )}
    </div>
  );
};