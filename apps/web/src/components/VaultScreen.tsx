import React, { useCallback, useEffect, useState } from 'react';
import type { WalletLedgerEntry } from '@ecocide/types';
import { CASTE_COLORS, VAULT_ALLOWANCE } from '@ecocide/types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History,
  Loader2,
  LogOut,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useVault } from '../lib/useVault';
import { fetchVaultLedger } from '../lib/vault-api';
import { formatCredits, formatVaultDate, isCredit, ledgerReasonLabel } from '../lib/vault-format';
import { VaultUnlock } from './VaultUnlock';

interface VaultScreenProps {
  /** Open a linked dossier at /citizen/:id. */
  onOpenDossier: (id: string) => void;
}

const LEDGER_PAGE_SIZE = 25;

/**
 * Asset Vault page (/vault): the citizen's token balance, aggregate stats, a
 * paginated transaction ledger and their claimed designations. Locked visitors
 * get the email-OTP unlock inline.
 */
export const VaultScreen: React.FC<VaultScreenProps> = ({ onOpenDossier }) => {
  const { session, isPending, vault, refresh, logout } = useVault();
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setEntries(vault?.ledger ?? []);
  }, [vault]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLedgerError(null);
    try {
      const page = await fetchVaultLedger(LEDGER_PAGE_SIZE, entries.length);
      setEntries((prev) => [...prev, ...page.entries]);
    } catch (e) {
      setLedgerError(e instanceof Error ? e.message : 'LEDGER QUERY FAILED');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, entries.length]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }, [logout]);

  if (isPending) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#0f121d] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest animate-pulse">
          CONSULTING THE ASSET VAULT...
        </div>
      </div>
    );
  }

  // Locked → unlock inline.
  if (!session && !vault) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0c0e17] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-5 text-cyan-300 font-mono text-xs font-bold tracking-widest">
          <Wallet className="w-4 h-4" />
          ACCESS ASSET VAULT
        </div>
        <VaultUnlock onUnlocked={() => void refresh()} />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#0f121d] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest animate-pulse">
          OPENING VAULT RECORDS...
        </div>
      </div>
    );
  }

  const { wallet, stats, dossiers } = vault;
  const allowancePct = Math.max(0, Math.min(1, wallet.credits / VAULT_ALLOWANCE));
  const hasMore = entries.length < stats.transactionCount;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-cyan-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <Wallet className="w-5 h-5 text-cyan-400" />
          ASSET VAULT
        </h2>
        <p className="font-mono text-xs text-gray-400">
          REGISTERED TO <span className="text-gray-200">{vault.user.email}</span>
        </p>
      </div>

      {/* Balance + stats */}
      <div className="bg-[#0f121d] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              Available Balance
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Coins className="w-7 h-7 text-cyan-400" />
              <span className="font-mono text-4xl font-black text-cyan-300 tracking-wide">
                {formatCredits(wallet.credits)}
              </span>
              <span className="font-mono text-sm text-cyan-500">CREDITS</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="self-start sm:self-auto text-[10px] font-mono text-gray-400 hover:text-red-300 border border-gray-800 hover:border-red-500/50 px-3 py-1.5 rounded-lg bg-gray-950 transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-widest disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Sign out
          </button>
        </div>

        <div className="h-2 rounded-full bg-black/60 border border-gray-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
            style={{ width: `${allowancePct * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
            <div className="font-mono text-sm font-bold text-emerald-300">
              +{formatCredits(stats.totalCredited)}
            </div>
            <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">Credited</div>
          </div>
          <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
            <div className="font-mono text-sm font-bold text-red-300">
              −{formatCredits(stats.totalSpent)}
            </div>
            <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">Spent</div>
          </div>
          <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
            <div className="font-mono text-sm font-bold text-gray-200">{stats.transactionCount}</div>
            <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
              Transactions
            </div>
          </div>
        </div>
        <p className="text-center font-mono text-[10px] text-gray-600">
          ALLOCATED LINE OF CREDIT: {formatCredits(VAULT_ALLOWANCE)} CREDITS
        </p>
      </div>

      {/* Transactions */}
      <div className="bg-[#0f121d] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800 text-gray-300 font-mono text-xs tracking-widest uppercase">
          <History className="w-4 h-4 text-gray-500" />
          Transaction Ledger
        </div>

        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center font-mono text-sm text-gray-500">
            NO TRANSACTIONS LOGGED.
          </div>
        ) : (
          <div className="divide-y divide-gray-800/70">
            {entries.map((entry) => {
              const credit = isCredit(entry.delta);
              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                        credit
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                          : 'bg-red-950/40 border-red-500/40 text-red-400'
                      }`}
                    >
                      {credit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-gray-200 truncate">
                        {ledgerReasonLabel(entry.reason)}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500 truncate">
                        {formatVaultDate(entry.createdAt)}
                        {entry.ref && (
                          <>
                            {' // '}
                            <button
                              type="button"
                              onClick={() => onOpenDossier(entry.ref as string)}
                              className="text-cyan-500 hover:text-cyan-300 cursor-pointer uppercase"
                            >
                              Record {entry.ref}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono text-sm font-bold ${
                        credit ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {credit ? '+' : '−'}
                      {formatCredits(Math.abs(entry.delta))}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">
                      BAL {formatCredits(entry.balanceAfter)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ledgerError && (
          <div className="px-5 py-3 text-center font-mono text-[11px] text-red-400 border-t border-red-500/30 bg-red-950/30">
            ⚠ {ledgerError}
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="w-full px-5 py-3 font-mono text-[11px] tracking-widest uppercase text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/20 border-t border-gray-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {loadingMore ? 'LOADING...' : 'LOAD OLDER TRANSACTIONS'}
          </button>
        )}
      </div>

      {/* Claimed designations */}
      <div className="bg-[#0f121d] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800 text-gray-300 font-mono text-xs tracking-widest uppercase">
          <ShieldCheck className="w-4 h-4 text-gray-500" />
          Claimed Designations ({dossiers.length})
        </div>
        {dossiers.length === 0 ? (
          <div className="px-5 py-10 text-center font-mono text-sm text-gray-500">
            NO DESIGNATIONS CLAIMED YET.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {dossiers.map((d) => {
              const colors = CASTE_COLORS[d.caste];
              const thumb = d.portraitUrl || d.avatarUrl;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpenDossier(d.id)}
                  className="flex items-center gap-3 text-left bg-black/40 border border-gray-800 hover:border-cyan-500/50 rounded-xl p-3 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-950 border border-gray-800 shrink-0 flex items-center justify-center">
                    {thumb ? (
                      <img src={thumb} alt={d.caste} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`font-mono text-xs ${colors?.text ?? 'text-gray-400'}`}>
                        {d.caste.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-mono text-xs font-bold uppercase truncate ${colors?.text ?? 'text-gray-200'}`}>
                      {d.caste}
                    </div>
                    <div className="font-mono text-[10px] text-gray-400 truncate">{d.honorificTitle}</div>
                    <div className="font-mono text-[9px] text-gray-600">
                      BCR {d.biocarbonRatio}% · {formatVaultDate(d.createdAt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
