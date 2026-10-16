import React, { useState } from 'react';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { REGISTRY_COPY } from '@ecocide/lore';
import { useVault } from '../lib/useVault';

interface RegistrySwitchAccountProps {
  /**
   * Called once the session has been cleared, so a caller can reset its own
   * stage (e.g. the payment terminal returning to its unlock step).
   */
  onSwitched?: () => void;
}

/**
 * The "you are signed in as …" row with an escape hatch.
 *
 * A wrong address is easy to enter by mistake, and the attributed-verdict gates
 * (claim, appeal) will rightly refuse it — so every place a session is *shown*
 * rather than entered must let the citizen switch. Signing out clears the shared
 * Better Auth session atom, so the surrounding screen's unlock gate reappears.
 */
export const RegistrySwitchAccount: React.FC<RegistrySwitchAccountProps> = ({ onSwitched }) => {
  const { vault, logout } = useVault();
  const [switching, setSwitching] = useState(false);

  const switchAccount = async () => {
    setSwitching(true);
    try {
      await logout();
      onSwitched?.();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="border border-emerald-500/30 bg-emerald-950/20 rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <span className="text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" /> {REGISTRY_COPY.terminal.unlocked}
        </span>
        <span className="text-gray-400 truncate text-right">{vault?.user.email}</span>
      </div>
      <button
        type="button"
        onClick={() => void switchAccount()}
        disabled={switching}
        className="w-full text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <LogOut className="w-3.5 h-3.5" />
        )}
        Not you? Use a different address
      </button>
    </div>
  );
};

export default RegistrySwitchAccount;
