import React, { useMemo, useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { VAULT_APPEAL_FEE } from '@ecocide/types';
import { Loader2, Recycle, Send, ShieldCheck } from 'lucide-react';
import { RegistryPayment } from './RegistryPayment';
import { DossierBarcode } from './PaperDossierHeader';
import { useVault } from '../lib/useVault';

interface AppealScreenProps {
  payload: OraclePayload;
  permalinkId?: string;
  sessionDate?: string;
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
export const AppealScreen: React.FC<AppealScreenProps> = ({ payload, permalinkId, sessionDate, onSubmitted }) => {
  const { user_profile, suggestions } = payload;
  const { vault } = useVault();const [phase, setPhase] = useState<Phase>('pay');
  const [appeal, setAppeal] = useState('');
  const [pledges, setPledges] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const caseId = permalinkId || payload.id || null;
  // Citizen ID mirrors the registry "Registered to" identity (vault account email).
  const citizenId = vault?.user.email ?? (permalinkId ? `#${permalinkId}` : null);

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
      {phase === 'pay' && (
        <RegistryPayment
          feeLabel="APPEAL FILING FEE"
          amount={VAULT_APPEAL_FEE}
          reason="appeal_fee"
          chargeRef={permalinkId}
          onPaid={() => setPhase('form')}
        />
      )}

      {phase === 'form' && (
        <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-4 sm:p-6 shadow-xl space-y-5 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Recycle className="w-16 h-16 shrink-0" style={{ color: '#2f7d3a' }} />
              <div className="flex flex-col justify-center h-[3.45rem] min-w-0 gap-0">
                <div className="text-xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight">
                  PLANETARY AUDIT BUREAU
                </div>
              </div>
            </div>
            <DossierBarcode caseId={caseId} sessionDate={sessionDate} large />
          </div>
          <div className="relative -mt-[20px] text-center border-b border-[#cfc4a8] pb-3">
            <h3 className="text-2xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight">
              STATE YOUR CASE
            </h3>
          </div>
          <div className="relative mt-1 flex items-center justify-between gap-2">
            <span
              className="text-[17px] font-black uppercase tracking-widest text-[#6b7263] whitespace-nowrap"
              style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
            >
              Case ID - {caseId ? `#${caseId}` : 'UNAVAILABLE'}
            </span>
            {citizenId && (
              <span
                className="text-[17px] font-black uppercase tracking-widest text-[#6b7263] whitespace-nowrap"
                style={{ fontFamily: "'Special Elite', ui-monospace, monospace", letterSpacing: '1px' }}
              >
                Citizen ID - {citizenId}
              </span>
            )}
          </div>
          <div className="relative mt-1 text-center space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight">
              APPEAL BEFORE THE ARBITER
            </h2>
            <p className="text-sm text-[#6b7263]">
              Current designation:{' '}
              <span className="text-[#1f2a1f] font-bold">{user_profile.honorific_title}</span>.
              Guilty until pledged.
            </p>
          </div>

          {/* Pledge picker tied to detected items */}
          {suggestions.length > 0 && (
            <div className="relative space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#6b7263]">
                <span>PICK REMEDIATION PLEDGES (BOUND TO AUDITED ITEMS)</span>
                <span className="text-[#865D13] font-bold">
                  {pledges.size}/{MAX_PLEDGES} SELECTED
                </span>
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => togglePledge(i)}
                  disabled={!pledges.has(i) && pledges.size >= MAX_PLEDGES}
                  className={`w-full text-left px-3 py-2.5 rounded-sm border text-sm flex items-center gap-3 transition-all cursor-pointer ${
                    pledges.has(i)
                      ? 'bg-[#efe3c8] border-[#865D13] text-[#1f2a1f]'
                      : 'bg-[#fbf7ea] border-[#cfc4a8] text-[#2c3a2c] hover:border-[#865D13] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`relative w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                      pledges.has(i) ? 'border-[#865D13] bg-[#fbf7ea]' : 'border-[#b9ad8f]'
                    }`}
                  >
                    {pledges.has(i) && (
                      <svg
                        viewBox="0 0 24 24"
                        className="pen-check absolute -inset-1.5 w-7 h-7 overflow-visible"
                        aria-hidden
                      >
                        <path
                          d="M4 11 L10 17 L22 3"
                          fill="none"
                          stroke="#1f2a1f"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 leading-snug">
                    {s.text}{' '}
                    <span className="text-[#6b7263]">→ {s.target_label.toUpperCase()}</span>
                  </span>
                  <span className="text-[#2f7d3a] text-base font-black shrink-0">+{s.impact_pct}%</span>
                </button>
              ))}
            </div>
          )}

          {/* Credibility meter */}
          <div className="relative bg-[#fbf7ea] rounded-sm p-3 border border-[#cfc4a8]">
            <div className="flex items-center justify-between text-xs text-[#6b7263] uppercase tracking-wider mb-1.5">
              <span>CREDIBILITY METER</span>
              <span className={credibility.score >= 0.66 ? 'text-[#2f7d3a] font-bold' : 'text-[#865D13] font-bold'}>
                {Math.round(credibility.score * 100)}%
              </span>
            </div>
            <div className="flex gap-1 mb-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1"
                  style={{ backgroundColor: i < credibility.bars ? '#b45309' : '#d8cdb2' }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <span className={credibility.specific ? 'text-[#2f7d3a]' : 'text-[#9a8f74]'}>
                SPECIFIC {credibility.specific ? '✓' : '✗'}
              </span>
              <span className={credibility.feasible ? 'text-[#2f7d3a]' : 'text-[#9a8f74]'}>
                FEASIBLE {credibility.feasible ? '✓' : '✗'}
              </span>
              <span className={credibility.impactful ? 'text-[#2f7d3a]' : 'text-[#9a8f74]'}>
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
            className="relative w-full bg-[#fbf7ea] border border-[#b9ad8f] rounded-sm p-4 text-[#1f2a1f] text-base leading-relaxed focus:border-[#865D13] focus:outline-none resize-none"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-xs text-[#6b7263]">
              {appeal.trim().length}/1200 — THE ARBITER READS EVERY TOKEN
            </span>
            <button
              type="button"
              onClick={submitAppeal}
              disabled={!appeal.trim()}
              className="px-6 py-3 bg-transparent border-2 border-[#1f2a1f] hover:bg-[#1f2a1f] hover:text-[#fbf7ea] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#1f2a1f] text-[#1f2a1f] font-black rounded-sm text-base tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              SUBMIT APPEAL
            </button>
          </div>
          <div className="relative text-xs text-[#6b7263] flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#2f7d3a]" />
              SELECTED PLEDGES ARE APPENDED TO THE APPEAL RECORD.
            </div>
          {error && (
            <div className="relative text-xs text-[#c2322b] animate-pulse">⚠ {error}</div>
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