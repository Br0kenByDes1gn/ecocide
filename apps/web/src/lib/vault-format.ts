import type { WalletLedgerReason } from '@ecocide/types';

/** Human-friendly labels for known ledger reasons. */
const REASON_LABELS: Record<string, string> = {
  seed: 'Universal Basic Allowance',
  claim_fee: 'Verdict Certification Fee',
  appeal_fee: 'Appeal Filing Fee',
  adjustment: 'System Adjustment',
};

/** Turns a ledger reason into a readable label (fallback: title-cased slug). */
export function ledgerReasonLabel(reason: WalletLedgerReason): string {
  const key = String(reason);
  if (REASON_LABELS[key]) return REASON_LABELS[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Credits (delta >= 0) versus debits. */
export function isCredit(delta: number): boolean {
  return delta >= 0;
}

/** Formats an integer credit amount with thousands separators and a sign. */
export function formatCredits(amount: number): string {
  const rounded = Math.trunc(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** UTC timestamp for ledger rows, e.g. `2026-10-05 13:42 UTC`. */
export function formatVaultDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} UTC`;
}
