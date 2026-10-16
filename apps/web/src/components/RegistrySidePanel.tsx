import React, { useCallback, useEffect, useState } from 'react';
import type { VaultState, WalletLedgerEntry } from '@ecocide/types';
import { CASTE_COLORS, VAULT_ALLOWANCE, getCasteFromScore, getFaction } from '@ecocide/types';
import { REGISTRY_COPY, standingTrendLabel } from '@ecocide/lore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Coins,
  History,
  Loader2,
  LogOut,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useVault } from '../lib/useVault';
import { fetchVaultLedger } from '../lib/vault-api';
import {
  formatCarbonCredits,
  formatCarbonKg,
  formatVaultDate,
  isCredit,
  ledgerReasonLabel,
} from '../lib/vault-format';

const LEDGER_PAGE_SIZE = 25;

interface RegistrySidePanelProps {
  vault: VaultState;
  /** Start a fresh audit from the empty standing state. */
  onBeginAudit: () => void;
  /** Open a linked assessment (ledger record links). */
  onOpenDossier: (id: string) => void;
}

/**
 * The registry's left column, shared verbatim by /registry and /injunction:
 * the pooled carbon-neutrality-index hero above the demoted token account.
 */
export const RegistrySidePanel: React.FC<RegistrySidePanelProps> = ({
  vault,
  onBeginAudit,
  onOpenDossier,
}) => {
  const { logout } = useVault();
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const { wallet, stats, standing, injunction } = vault;
  const allowancePct = Math.max(0, Math.min(1, wallet.credits / VAULT_ALLOWANCE));
  const hasMore = entries.length < stats.transactionCount;

  const hasRecord = standing.assessmentCount > 0;
  // The server owns both numbers: the index comes from the verdicts, and honored
  // orders add a capped, diminishing amount (see injunctionStanding).
  const effectiveIndex = injunction.effectiveIndex;
  const effectiveCaste = getCasteFromScore(effectiveIndex);
  const effectiveFaction = getFaction(effectiveCaste);
  const effectiveColors = CASTE_COLORS[effectiveCaste];

  return (
    <div className="space-y-3 min-w-0">
      {/* Standing hero */}
      <div className="bg-[#121a14] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl space-y-5">
        {hasRecord ? (
          <>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                  {REGISTRY_COPY.standing.label}
                </div>
                <div className="flex items-end gap-2 mt-1">
                  <span className="font-mono text-5xl font-black text-teal-300 tracking-wide">
                    {effectiveIndex}
                  </span>
                  <span className="font-mono text-lg text-teal-500 pb-1">%</span>
                  <span
                    className={`font-mono text-xs font-bold uppercase tracking-widest pb-2 ${effectiveColors.text}`}
                  >
                    {effectiveFaction.name}
                  </span>
                </div>
                {/* The two numbers the index is made of: measured verdicts, and
                    the capped, diminishing contribution of honored chores. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-widest">
                  <span className="text-gray-400">
                    {REGISTRY_COPY.standing.fromVerdicts} {standing.index}%
                  </span>
                  {injunction.ordersHonored > 0 && (
                    <span className="text-emerald-300 border border-emerald-500/40 rounded-lg px-2 py-0.5 bg-emerald-950/40">
                      +{injunction.bonus.toFixed(1)} {REGISTRY_COPY.standing.fromOrders} (
                      {injunction.ordersHonored})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                {standing.delta === null ? (
                  <span className="text-[10px] font-mono text-gray-500 border border-gray-800 rounded-lg px-2.5 py-1.5 bg-gray-950 uppercase tracking-widest">
                    {REGISTRY_COPY.standing.noTrend}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-mono border rounded-lg px-2.5 py-1.5 bg-gray-950 flex items-center gap-1.5 uppercase tracking-widest ${
                      standing.delta > 0
                        ? 'text-emerald-300 border-emerald-500/40'
                        : standing.delta < 0
                        ? 'text-red-300 border-red-500/40'
                        : 'text-gray-400 border-gray-800'
                    }`}
                  >
                    {standing.delta > 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : standing.delta < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : null}
                    {standingTrendLabel(standing.delta)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="text-[10px] font-mono text-gray-400 hover:text-red-300 border border-gray-800 hover:border-red-500/50 px-3 py-1.5 rounded-lg bg-gray-950 transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-widest disabled:opacity-50"
                >
                  {signingOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Sign out
                </button>
              </div>
            </div>

            <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest">
              {REGISTRY_COPY.standing.caption}
            </p>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                <div className="font-mono text-sm font-bold text-gray-200">
                  {standing.assessmentCount}
                </div>
                <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                  {REGISTRY_COPY.standing.assessments}
                </div>
              </div>
              <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                <div className="font-mono text-sm font-bold text-gray-200">{standing.objectCount}</div>
                <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                  {REGISTRY_COPY.standing.objects}
                </div>
              </div>
              <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                <div
                  className={`font-mono text-sm font-bold ${
                    standing.hardFailCount > 0 ? 'text-red-300' : 'text-emerald-300'
                  }`}
                >
                  {standing.hardFailCount}
                </div>
                <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                  {REGISTRY_COPY.standing.hardFails}
                </div>
              </div>
              <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                <div className="font-mono text-sm font-bold text-gray-200 truncate px-1">
                  {standing.dominantMaterialFamily ?? '—'}
                </div>
                <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                  {REGISTRY_COPY.standing.dominantMaterial}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 font-mono text-[10px] text-gray-500 uppercase">
              <span className="truncate">
                {REGISTRY_COPY.standing.offender}:{' '}
                <span className="text-amber-300">{standing.topOffenderLabel ?? '—'}</span>
              </span>
              <span className="truncate text-gray-600">
                {REGISTRY_COPY.standing.filedBetween}:{' '}
                {standing.firstAuditAt ? formatVaultDate(standing.firstAuditAt) : '—'}
                {' / '}
                {standing.lastAuditAt ? formatVaultDate(standing.lastAuditAt) : '—'}
              </span>
            </div>
          </>
        ) : (
          <div className="py-4 text-center space-y-4">
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              {REGISTRY_COPY.standing.label}
            </div>
            <div className="font-mono text-lg font-bold text-gray-300 uppercase tracking-widest">
              {REGISTRY_COPY.standing.emptyTitle}
            </div>
            <p className="font-mono text-xs text-gray-500 max-w-md mx-auto">
              {REGISTRY_COPY.standing.emptyHint}
            </p>
            <button
              type="button"
              onClick={onBeginAudit}
              className="px-6 py-3 rounded-xl font-mono text-sm font-black tracking-widest uppercase bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg hover:shadow-cyan-500/30 transition-all cursor-pointer"
            >
              {REGISTRY_COPY.standing.emptyAction}
            </button>
          </div>
        )}
      </div>

      {/* Token account (demoted; the wallet half of the registry account) */}
      <div className="bg-[#121a14] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAccountOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-2 px-5 py-3.5 text-gray-300 font-mono text-xs tracking-widest uppercase hover:bg-cyan-950/20 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gray-500" />
            {REGISTRY_COPY.account.title}
            {!accountOpen && (
              <span className="text-gray-500">
                - {formatCarbonCredits(wallet.credits)} {REGISTRY_COPY.account.unit}
              </span>
            )}
          </span>
          {accountOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {accountOpen && (
          <div className="border-t border-gray-800">
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    {REGISTRY_COPY.account.balance}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Coins className="w-7 h-7 text-cyan-400" />
                    <span className="font-mono text-3xl font-black text-cyan-300 tracking-wide">
                      {formatCarbonCredits(wallet.credits)}
                    </span>
                    <span className="font-mono text-sm text-cyan-500">
                      {REGISTRY_COPY.account.unit.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-gray-600 uppercase">
                    {formatCarbonKg(wallet.credits)} — {REGISTRY_COPY.account.unitRate}
                  </div>
                </div>
                <div className="font-mono text-[10px] text-gray-600 uppercase">
                  {REGISTRY_COPY.account.allowance}: {formatCarbonCredits(VAULT_ALLOWANCE)}{' '}
                  {REGISTRY_COPY.account.unit}
                </div>
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
                    +{formatCarbonCredits(stats.totalCredited)}
                  </div>
                  <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                    {REGISTRY_COPY.account.credited}
                  </div>
                </div>
                <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                  <div className="font-mono text-sm font-bold text-red-300">
                    −{formatCarbonCredits(stats.totalSpent)}
                  </div>
                  <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                    {REGISTRY_COPY.account.spent}
                  </div>
                </div>
                <div className="bg-black/40 border border-gray-800 rounded-xl py-2.5">
                  <div className="font-mono text-sm font-bold text-gray-200">
                    {stats.transactionCount}
                  </div>
                  <div className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                    {REGISTRY_COPY.account.transactions}
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="border-t border-gray-800">
              <div className="flex items-center gap-2 px-5 py-3 text-gray-400 font-mono text-[11px] tracking-widest uppercase">
                <History className="w-3.5 h-3.5 text-gray-500" />
                {REGISTRY_COPY.account.ledgerTitle}
              </div>

              {entries.length === 0 ? (
                <div className="px-5 pb-8 text-center font-mono text-sm text-gray-500 uppercase">
                  {REGISTRY_COPY.account.ledgerEmpty}
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
                                  {' - '}
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
                            {formatCarbonCredits(Math.abs(entry.delta))}
                          </div>
                          <div className="font-mono text-[10px] text-gray-500">
                            BAL {formatCarbonCredits(entry.balanceAfter)}
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
                  {loadingMore ? 'LOADING...' : REGISTRY_COPY.account.loadOlder}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
