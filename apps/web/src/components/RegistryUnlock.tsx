import React, { useState } from 'react';
import { KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { REGISTRY_COPY } from '@ecocide/lore';
import { useVault } from '../lib/useVault';

interface RegistryUnlockProps {
  /** Called after a successful OTP verification (the registry account is unlocked). */
  onUnlocked: () => void;
}

/**
 * Email-OTP unlock form — the identity half of the registry account. Renders
 * the form only (no card chrome); callers supply the surrounding terminal
 * panel. Unlocking never charges anything; payment is a separate, explicit step.
 */
export const RegistryUnlock: React.FC<RegistryUnlockProps> = ({ onUnlocked }) => {
  const { isPending, status, error, requestOtp, verifyOtp, refresh } = useVault();
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (await requestOtp(email)) setStage('otp');
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length < 4) return;
    if (await verifyOtp(email, otp)) {
      void refresh();
      onUnlocked();
    }
  };

  const busy = status === 'sending' || status === 'verifying';

  if (isPending) {
    return (
      <div className="py-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
        <p className="font-mono text-xs text-cyan-300 tracking-widest uppercase">
          {REGISTRY_COPY.status.loading}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stage === 'email' && (
        <form onSubmit={submitEmail} className="space-y-3">
          <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            {REGISTRY_COPY.unlock.emailLabel}
          </label>
          <div className="flex items-center gap-2 bg-black/50 border border-gray-700 rounded-lg px-3 focus-within:border-cyan-500">
            <Mail className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={REGISTRY_COPY.unlock.emailPlaceholder}
              className="flex-1 bg-transparent py-2.5 font-mono text-sm text-gray-200 focus:outline-none"
              aria-label="Registry email address"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl font-mono text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg hover:shadow-cyan-500/30 disabled:opacity-60"
          >
            {status === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {REGISTRY_COPY.unlock.sendingCode}
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> {REGISTRY_COPY.unlock.sendCode}
              </>
            )}
          </button>
          <p className="text-center text-[10px] font-mono text-gray-600 uppercase">
            {REGISTRY_COPY.unlock.codeHint}
          </p>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={submitOtp} className="space-y-3">
          <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            {REGISTRY_COPY.unlock.accessCodeLabel} {email}
          </label>
          <div className="flex items-center gap-2 bg-black/50 border border-gray-700 rounded-lg px-3 focus-within:border-cyan-500">
            <KeyRound className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="flex-1 bg-transparent py-2.5 font-mono text-lg tracking-[0.5em] text-gray-100 focus:outline-none"
              aria-label="One-time access code"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={busy || otp.trim().length < 4}
            className="w-full py-3.5 rounded-xl font-mono text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg hover:shadow-cyan-500/30 disabled:opacity-60"
          >
            {status === 'verifying' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {REGISTRY_COPY.unlock.verifying}
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> {REGISTRY_COPY.unlock.verifyCode}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStage('email')}
            className="w-full text-[10px] font-mono text-gray-500 hover:text-cyan-400 uppercase tracking-widest cursor-pointer"
          >
            ← Use a different address
          </button>
        </form>
      )}

      {error && (
        <p className="text-center text-[11px] font-mono text-red-400 border border-red-500/40 bg-red-950/40 rounded-lg py-2 px-3">
          ⚠ {error}
        </p>
      )}
    </div>
  );
};
