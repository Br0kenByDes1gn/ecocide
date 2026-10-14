import React, { useMemo, useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { VAULT_APPEAL_FEE } from '@ecocide/types';
import { Gavel, Loader2, Send, ShieldCheck } from 'lucide-react';
import { AssetVaultPayment } from './AssetVaultPayment';

interface AppealScreenProps {
  payload: OraclePayload;
  permalinkId?: string;
  /** Called once the appeal has been filed — the ruling now lives on the records screen. */
  onSubmitted: () => void;
}

type Phase = 'pay' | 'form' | 'loading';

const MAX_PLEDGES = 3;

/**
 * Appeal filing screen (/appeal/:id): pay a (simulated) filing fee, pick
 * remediation pledges bound to the DETECTED ITEMS (the arbitration's
 * credibility meter watches how specific you are), file the appeal text, and
 * hand off to the Appeal Records screen.
 */
export const AppealScreen: React.FC<AppealScreenProps> = ({ payload, permalinkId, onSubmitted }) => {
  const { user_profile, suggestions } = payload;
  const [phase, setPhase] = useState<Phase>('pay');
  const [appeal, setAppeal] = useState('');
  const [pledges, setPledges] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const togglePledge = (index: number) => {
    setPledges((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (next.size < MAX_PLEDGES) next.add(index);
      return next;
    });
  };

  const credibility = useMemo(() => {
    const specific = appeal.trim().length >= 40;
    const feasible = pledges.size > 0;
    const impactful = [...pledges].some((i) => (suggestions[i]?.impact_pct ?? 0) >= 5);
    const score = [specific, feasible, impactful].filter(Boolean).length / 3;
    return { specific, feasible, impactful, score, bars: 3 - Math.round((1 - score) * 3) };
  }, [appeal, pledges, suggestions]);

  const submitAppeal = async () => {
    const base = appeal.trim();
    if (!base || phase === 'loading') return;
    if (!permalinkId) {
      setError('NO PERMANENT RECORD AVAILABLE FOR APPEAL.');
      return;
    }
    const pledgeLines = [...pledges].map((i) => suggestions[i]?.pledge).filter(Boolean);
    const fullAppeal = pledgeLines.length
      ? `${base}\n\nPLEDGES OFFERED: ${pledgeLines.join(' // ')}`
      : base;

    setPhase('loading');
    setError(null);
    try {
      const res = await fetch(`/api/citizen/${permalinkId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appeal: fullAppeal }),
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
        <h2 className="font-mono text-lg font-bold text-amber-400 tracking-widest uppercase flex items-center justify-center gap-2">
          <Gavel className="w-5 h-5 text-amber-400" />
          APPEAL BEFORE THE ARBITER
        </h2>
        <p className="font-mono text-xs text-gray-400">
          Current designation: <span className="text-amber-300 font-bold">{user_profile.honorific_title}</span>.
          Guilty until pledged.
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
        <div className="bg-[#121a14] rounded-2xl border border-amber-500/40 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <Gavel className="w-4 h-4 text-amber-400" />
            <h3 className="font-mono text-sm font-bold text-amber-300 tracking-wider uppercase">
              STATE YOUR CASE
            </h3>
          </div>

          {/* Pledge picker tied to detected items */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span>PICK REMEDIATION PLEDGES (BOUND TO AUDITED ITEMS)</span>
                <span className="text-amber-400">
                  {pledges.size}/{MAX_PLEDGES} SELECTED
                </span>
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => togglePledge(i)}
                  disabled={!pledges.has(i) && pledges.size >= MAX_PLEDGES}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border font-mono text-xs flex items-center gap-3 transition-all cursor-pointer ${
                    pledges.has(i)
                      ? 'bg-amber-950/50 border-amber-500/70 text-amber-200'
                      : 'bg-black/30 border-gray-800 text-gray-400 hover:border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-black shrink-0 ${
                      pledges.has(i) ? 'bg-amber-500 text-black border-amber-400' : 'border-gray-600'
                    }`}
                  >
                    {pledges.has(i) ? '✓' : ''}
                  </span>
                  <span className="flex-1 leading-snug">
                    {s.text}{' '}
                    <span className="text-gray-500">→ {s.target_label.toUpperCase()}</span>
                  </span>
                  <span className="text-teal-300 font-bold shrink-0">+{s.impact_pct}%</span>
                </button>
              ))}
            </div>
          )}

          {/* Credibility meter */}
          <div className="bg-black/40 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5">
              <span>CREDIBILITY METER</span>
              <span className={credibility.score >= 0.66 ? 'text-lime-300 font-bold' : 'text-amber-300 font-bold'}>
                {Math.round(credibility.score * 100)}%
              </span>
            </div>
            <div className="flex gap-1 mb-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < credibility.bars ? 'bg-amber-400' : 'bg-gray-800'}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
              <span className={credibility.specific ? 'text-green-400' : 'text-gray-600'}>
                SPECIFIC {credibility.specific ? '✓' : '✗'}
              </span>
              <span className={credibility.feasible ? 'text-green-400' : 'text-gray-600'}>
                FEASIBLE {credibility.feasible ? '✓' : '✗'}
              </span>
              <span className={credibility.impactful ? 'text-green-400' : 'text-gray-600'}>
                IMPACTFUL {credibility.impactful ? '✓' : '✗'}
              </span>
            </div>
          </div>

          <textarea
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
            rows={6}
            maxLength={1200}
            placeholder="Petition the Arbiter... Convince it that your classification is a monstrous clerical error. Grovel, argue, threaten, or flatter. It decides."
            className="w-full bg-black/40 border border-gray-700 rounded-xl p-4 text-gray-200 font-mono text-sm leading-relaxed focus:border-amber-500 focus:outline-none focus:shadow-[0_0_15px_rgba(245,158,11,0.2)] resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono text-gray-500">
              {appeal.trim().length}/1200 — THE ARBITER READS EVERY TOKEN
            </span>
            <button
              type="button"
              onClick={submitAppeal}
              disabled={!appeal.trim()}
              className="px-6 py-3 bg-[#ffb703] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/30"
            >
              <Send className="w-4 h-4" />
              SUBMIT APPEAL
            </button>
          </div>
          <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-teal-300" />
              SELECTED PLEDGES ARE APPENDED TO THE APPEAL RECORD.
            </div>
          {error && (
            <div className="text-xs font-mono text-red-400 animate-pulse">⚠ {error}</div>
          )}
        </div>
      )}

      {phase === 'loading' && (
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="font-mono text-xs text-gray-300 tracking-widest animate-pulse">
            THE ARBITER IS DELIBERATING YOUR APPEAL...
          </div>
        </div>
      )}
    </div>
  );
};