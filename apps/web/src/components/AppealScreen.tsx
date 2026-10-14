import React, { useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { VAULT_APPEAL_FEE } from '@ecocide/types';
import { Gavel, Loader2, Send } from 'lucide-react';
import { AssetVaultPayment } from './AssetVaultPayment';

interface AppealScreenProps {
  payload: OraclePayload;
  permalinkId?: string;
  /** Called once the appeal has been filed — the ruling now lives on the records screen. */
  onSubmitted: () => void;
}

type Phase = 'pay' | 'form' | 'loading';

/**
 * Appeal filing screen (/appeal/:id): pay a (simulated) filing fee, file your
 * appeal text, then hand off to the Appeal Records screen, which displays the
 * Arbiter's ruling and offers the re-arbitration / new appeal actions.
 */
export const AppealScreen: React.FC<AppealScreenProps> = ({ payload, permalinkId, onSubmitted }) => {
  const { user_profile } = payload;
  const [phase, setPhase] = useState<Phase>('pay');
  const [appeal, setAppeal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitAppeal = async () => {
    if (!appeal.trim() || phase === 'loading') return;
    if (!permalinkId) {
      setError('NO PERMANENT RECORD AVAILABLE FOR APPEAL.');
      return;
    }
    setPhase('loading');
    setError(null);
    try {
      const res = await fetch(`/api/citizen/${permalinkId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appeal: appeal.trim() }),
      });
      if (!res.ok) throw new Error(`Appeal server responded with ${res.status}`);
      onSubmitted();
    } catch (e) {
      console.warn('Appeal submission failed:', e);
      setError('APPEAL TRANSMISSION FAILED. THE ARBITER IS TEMPORARILY INDISPOSED.');
      setPhase('form');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-purple-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <Gavel className="w-5 h-5 text-purple-400" />
          APPEAL BEFORE THE ARBITER
        </h2>
        <p className="font-mono text-xs text-gray-400">
          Current designation: <span className="text-purple-300 font-bold">{user_profile.caste}</span> —{' '}
          {user_profile.honorific_title}. Challenge it if you dare.
        </p>
      </div>

      {phase === 'pay' && (
        <AssetVaultPayment
          feeLabel="APPEAL FILING FEE"
          amount={VAULT_APPEAL_FEE}
          reason="appeal_fee"
          chargeRef={permalinkId}
          onPaid={() => setPhase('form')}
        />
      )}

      {phase === 'form' && (
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <Gavel className="w-4 h-4 text-purple-400" />
            <h3 className="font-mono text-sm font-bold text-purple-300 tracking-wider uppercase">
              STATE YOUR CASE
            </h3>
          </div>
          <textarea
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
            rows={6}
            maxLength={1200}
            placeholder="Petition the Arbiter... Convince it that your classification is a monstrous clerical error. Grovel, argue, threaten, or flatter. It decides."
            className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-gray-200 font-mono text-sm leading-relaxed focus:border-purple-500 focus:outline-none focus:shadow-[0_0_15px_rgba(255,183,3,0.2)] resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono text-gray-500">
              {appeal.trim().length}/1200 — THE ARBITER READS EVERY TOKEN
            </span>
            <button
              type="button"
              onClick={submitAppeal}
              disabled={!appeal.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/30"
            >
              <Send className="w-4 h-4" />
              SUBMIT APPEAL
            </button>
          </div>
          {error && (
            <div className="text-xs font-mono text-red-400 animate-pulse">⚠ {error}</div>
          )}
        </div>
      )}

      {phase === 'loading' && (
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <div className="font-mono text-xs text-gray-300 tracking-widest animate-pulse">
            THE ARBITER IS DELIBERATING YOUR APPEAL...
          </div>
        </div>
      )}
    </div>
  );
};