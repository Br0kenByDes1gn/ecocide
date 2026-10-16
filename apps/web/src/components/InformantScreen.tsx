import React, { useState } from 'react';
import type { OraclePayload } from '@ecocide/types';
import { INFORMANT_COPY, REGISTRY_COPY } from '@ecocide/lore';
import { ArrowLeft, Gift, Loader2, Mail, Send, UserSearch } from 'lucide-react';
import { formatCarbonCredits } from '../lib/vault-format';
import { useVault } from '../lib/useVault';
import { submitInformantEvidence, type InformantEvidenceResult } from '../lib/vault-api';
import { RegistrySwitchAccount } from './RegistrySwitchAccount';
import { RegistryUnlock } from './RegistryUnlock';

interface InformantScreenProps {
  payload: OraclePayload;
  permalinkId?: string;
  /** Return to the verdict dossier after the bounty is shown. */
  onDone: () => void;
}

/** Subtle paper-noise texture (same recipe as the verdict page). */
const PAPER_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

type Phase = 'form' | 'filing' | 'success';

/**
 * Informant submission screen (`/inform/:id`) — the third act on a verdict,
 * beside claiming and appealing.
 *
 * The citizen surrenders evidence of *another* household's consumption
 * offences. A registry account is required first (the bounty is paid into a
 * wallet), then the accused address is entered; the verdict is attributed to it
 * and only that household may claim or appeal it.
 */
export const InformantScreen: React.FC<InformantScreenProps> = ({ payload, permalinkId, onDone }) => {
  const { session, sessionReady, refresh } = useVault();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InformantEvidenceResult | null>(null);

  const caseId = permalinkId || payload.id || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permalinkId || !email.trim() || phase === 'filing') return;
    setPhase('filing');
    setError(null);
    try {
      const res = await submitInformantEvidence(permalinkId, email.trim());
      setResult(res);
      await refresh();
      setPhase('success');
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message =
        code === 'self'
          ? INFORMANT_COPY.errorSelf
          : code === 'invalid_email'
            ? INFORMANT_COPY.errorInvalid
            : INFORMANT_COPY.errorGeneric;
      setError(message);
      setPhase('form');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-lime-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <UserSearch className="w-5 h-5 text-lime-400" />
          {INFORMANT_COPY.name}
        </h2>
        <p className="font-mono text-xs text-gray-400">
          {INFORMANT_COPY.anonymity}
        </p>
      </div>

      {/* The bounty lands in the signed-in wallet — make it switchable before filing. */}
      {session && phase === 'form' && <RegistrySwitchAccount />}

      {phase === 'success' && result ? (
        <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-6 sm:p-8 shadow-xl overflow-hidden text-center space-y-4">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: PAPER_NOISE }}
          />
          <div className="relative flex flex-col items-center gap-3">
            <Gift className="w-10 h-10 text-[#2f7d3a]" />
            <h3 className="text-2xl font-black uppercase tracking-widest text-[#1f2a1f]">
              {INFORMANT_COPY.success.title}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-[#2c3a2c]">
              {INFORMANT_COPY.success.body}
            </p>

            <div className="mt-2 rounded-sm border border-[#b9ad8f] bg-[#efe3c8] px-6 py-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b7263]">
                {INFORMANT_COPY.success.rewardLabel}
              </div>
              <div className="mt-1 text-3xl font-black text-[#2f7d3a]">
                +{formatCarbonCredits(result.rewardUnits)}{' '}
                <span className="text-base">{REGISTRY_COPY.account.unit}</span>
              </div>
              {result.wallet && (
                <div className="mt-1 text-[11px] font-mono uppercase tracking-widest text-[#6b7263]">
                  {INFORMANT_COPY.success.balanceLabel}:{' '}
                  <span className="text-[#1f2a1f]">{formatCarbonCredits(result.wallet.credits)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onDone}
              className="mt-3 px-6 py-3 bg-transparent border-2 border-[#1f2a1f] hover:bg-[#1f2a1f] hover:text-[#fbf7ea] text-[#1f2a1f] font-black rounded-sm text-sm tracking-widest uppercase flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {INFORMANT_COPY.success.done}
            </button>
          </div>
        </div>
      ) : !sessionReady ? (
        <div className="py-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
        </div>
      ) : !session ? (
        <div className="w-full max-w-md mx-auto bg-[#0e1510] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl">
          <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold tracking-widest uppercase border-b border-gray-800 pb-3 mb-5">
            <Mail className="w-4 h-4" />
            Unlock your Carbon Registry
          </div>
          <p className="mb-4 text-center font-mono text-[11px] leading-relaxed text-gray-400">
            {INFORMANT_COPY.unlockNote}
          </p>
          <RegistryUnlock onUnlocked={() => void refresh()} />
        </div>
      ) : (
        <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-5 sm:p-6 shadow-xl space-y-5 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: PAPER_NOISE }}
          />
          <div className="relative border-b border-[#cfc4a8] pb-3">
            <h3 className="text-2xl font-black uppercase tracking-widest text-[#1f2a1f] leading-tight">
              {INFORMANT_COPY.title}
            </h3>
            <span className="text-xs font-mono uppercase tracking-widest text-[#6b7263]">
              Case ID — {caseId ? `#${caseId}` : 'UNAVAILABLE'}
            </span>
          </div>

          <div className="relative space-y-3 text-[#2c3a2c]">
            {INFORMANT_COPY.address.map((line) => (
              <p key={line} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          <form onSubmit={submit} className="relative space-y-3">
            <label
              htmlFor="informant-subject-email"
              className="block text-[10px] font-mono uppercase tracking-widest text-[#6b7263]"
            >
              {INFORMANT_COPY.emailLabel}
            </label>
            <div className="flex items-center gap-2 rounded-sm border border-[#b9ad8f] bg-[#fbf7ea] px-3 focus-within:border-[#865D13]">
              <Mail className="w-4 h-4 shrink-0 text-[#865D13]" />
              <input
                id="informant-subject-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={INFORMANT_COPY.emailPlaceholder}
                className="flex-1 bg-transparent py-2.5 text-base text-[#1f2a1f] focus:outline-none"
                aria-label={INFORMANT_COPY.emailLabel}
              />
            </div>

            <button
              type="submit"
              disabled={phase === 'filing' || !email.trim()}
              className="w-full py-3.5 rounded-sm border-2 border-[#1f2a1f] bg-[#1f2a1f] text-[#fbf7ea] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all hover:bg-transparent hover:text-[#1f2a1f] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {phase === 'filing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {INFORMANT_COPY.submitting}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {INFORMANT_COPY.submit}
                </>
              )}
            </button>

            {error && (
              <p className="text-center text-xs font-mono text-[#c2322b]">⚠ {error}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default InformantScreen;
