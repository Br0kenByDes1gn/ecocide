import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useVault } from '../lib/useVault';
import { chargeVault, linkDossierToVault } from '../lib/vault-api';
import { VaultUnlock } from './VaultUnlock';

interface AssetVaultPaymentProps {
  /** Fee caption, e.g. "APPEAL FILING FEE". */
  feeLabel: string;
  /** Credits drawn from the vault. */
  amount: number;
  /** Ledger reason for a plain charge, e.g. "appeal_fee". */
  reason: string;
  /** Ledger reference for a plain charge (e.g. the dossier id). */
  chargeRef?: string;
  /**
   * When set, the payment binds this dossier to the vault and charges the
   * certification fee (the claim flow). Otherwise a plain `reason` charge is made.
   */
  bindDossierId?: string;
  /** Called once the payment succeeds. */
  onPaid: () => void;
}

type Stage = 'unlock' | 'confirm' | 'working' | 'done';

/**
 * Shared Asset Vault payment terminal.
 *
 * A locked vault first unlocks via {@link VaultUnlock} (email OTP); an already
 * unlocked wallet goes straight to the AUTHORIZE step. Authorization then either
 * binds the dossier (claim) or draws a fixed fee (appeal) from the wallet
 * ledger. Unlocking never charges — payment is always explicit. No real charge
 * is ever made.
 */
export const AssetVaultPayment: React.FC<AssetVaultPaymentProps> = ({
  feeLabel,
  amount,
  reason,
  chargeRef,
  bindDossierId,
  onPaid,
}) => {
  const { session, vault, refresh } = useVault();

  const [stage, setStage] = useState<Stage>('unlock');
  const [payError, setPayError] = useState<string | null>(null);
  const doneRef = useRef(false);

  // A signed-in citizen skips the unlock and lands on the authorize step.
  useEffect(() => {
    if (session && stage === 'unlock') setStage('confirm');
  }, [session, stage]);

  const pay = useCallback(async () => {
    setStage('working');
    setPayError(null);
    try {
      if (bindDossierId) {
        await linkDossierToVault(bindDossierId);
      } else {
        await chargeVault(amount, reason, chargeRef);
      }
      await refresh();
      setStage('done');
      if (!doneRef.current) {
        doneRef.current = true;
        setTimeout(onPaid, 700);
      }
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'PAYMENT FAILED');
      setStage('confirm');
    }
  }, [bindDossierId, amount, reason, chargeRef, refresh, onPaid]);

  return (
    <div className="w-full max-w-md mx-auto bg-[#0c0e17] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-5">
        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold tracking-widest">
          <Lock className="w-4 h-4" />
          ASSET VAULT TERMINAL
        </div>
        <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/40 rounded px-1.5 py-0.5">
          SEC-CHANNEL // 9
        </span>
      </div>

      <div className="text-center mb-5">
        <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">{feeLabel}</div>
        <div className="text-4xl font-black font-mono text-cyan-300 tracking-wide mt-1">
          {amount.toLocaleString()}
          <span className="text-lg text-cyan-500"> CREDITS</span>
        </div>
        <div className="text-[10px] font-mono text-gray-500 mt-1">
          DRAWN FROM YOUR ASSET VAULT
        </div>
      </div>

      {stage === 'unlock' && <VaultUnlock onUnlocked={() => setStage('confirm')} />}

      {stage === 'confirm' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-mono border border-emerald-500/30 bg-emerald-950/20 rounded-lg px-3 py-2">
            <span className="text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> VAULT UNLOCKED
            </span>
            <span className="text-gray-400 truncate max-w-[60%] text-right">{vault?.user.email}</span>
          </div>
          {vault && (
            <p className="text-center font-mono text-[11px] text-gray-500">
              BALANCE: <span className="text-cyan-300">{vault.wallet.credits.toLocaleString()}</span> CREDITS
            </p>
          )}
          <button
            type="button"
            onClick={() => void pay()}
            className="w-full py-3.5 rounded-xl font-mono text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg hover:shadow-cyan-500/30"
          >
            <CreditCard className="w-4 h-4" /> AUTHORIZE PAYMENT
          </button>
        </div>
      )}

      {stage === 'working' && (
        <div className="py-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
          <p className="font-mono text-xs text-cyan-300 tracking-widest uppercase">
            {bindDossierId ? 'Binding dossier to vault...' : 'Debiting vault ledger...'}
          </p>
        </div>
      )}

      {stage === 'done' && (
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
          <p className="font-mono text-sm font-bold text-emerald-300 tracking-widest uppercase">
            Payment Authorized
          </p>
          {vault && (
            <p className="font-mono text-xs text-gray-400">
              BALANCE: <span className="text-cyan-300">{vault.wallet.credits.toLocaleString()}</span> CREDITS
            </p>
          )}
        </div>
      )}

      {payError && (
        <p className="mt-4 text-center text-[11px] font-mono text-red-400 border border-red-500/40 bg-red-950/40 rounded-lg py-2 px-3">
          ⚠ {payError}
        </p>
      )}

      <p className="text-center text-[10px] font-mono text-gray-600 mt-4">
        SIMULATION TERMINAL // NO REAL CHARGE WILL BE MADE
      </p>
    </div>
  );
};
