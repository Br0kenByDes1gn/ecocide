import type { WalletLedgerReason } from '@ecocide/types';
import { unitsToCredits, unitsToKg } from '@ecocide/types';
import { REGISTRY_COPY } from '@ecocide/lore';

/** Turns a ledger reason into a readable label (fallback: title-cased slug). */
export function ledgerReasonLabel(reason: WalletLedgerReason): string {
  const key = String(reason);
  const known = REGISTRY_COPY.account.reasons as Record<string, string | undefined>;
  if (known[key]) return known[key] as string;
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Credits (delta >= 0) versus debits. */
export function isCredit(delta: number): boolean {
  return delta >= 0;
}

/**
 * Credit units → carbon credits, to two decimals: `30` → `0.30`.
 *
 * The ledger counts units (1/100 of a credit) so it can stay integer; a citizen
 * reads credits, and one credit is one tonne of CO₂e.
 */
export function formatCarbonCredits(units: number): string {
  const credits = unitsToCredits(Math.trunc(units));
  const sign = credits < 0 ? '−' : '';
  return `${sign}${Math.abs(credits).toFixed(2)}`;
}

/** The same amount in kilograms CO₂e, e.g. `300 kg CO₂e`. */
export function formatCarbonKg(units: number): string {
  const kg = Math.round(unitsToKg(Math.trunc(units)));
  return `${kg.toLocaleString('en-US')} kg CO₂e`;
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

/**
 * Readable audit-area label for an archived assessment, e.g. `kitchen` →
 * `Kitchen`. Falls back to the supplied label when the scan had no hint.
 */
export function formatRoomType(roomType: string | null, fallback: string): string {
  const room = (roomType || '').trim();
  if (!room) return fallback;
  return room.replace(/\b\w/g, (m) => m.toUpperCase());
}
