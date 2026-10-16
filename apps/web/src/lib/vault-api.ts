import type {
  InjunctionTask,
  VaultChargeResult,
  VaultLedgerPage,
  VaultLinkResult,
  VaultState,
} from '@ecocide/types';
import { authFetch } from './auth-client';

/**
 * Registry API client (endpoints keep their `/api/vault` names):
 * wallet, standing, archived assessments and the ledger.
 */

/** Fetch the signed-in citizen's registry: wallet, standing, dossiers and ledger. */
export async function fetchVault(): Promise<VaultState> {
  const res = await authFetch('/api/vault');
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'REGISTRY LOCKED' : `REGISTRY QUERY FAILED (${res.status})`);
  }
  return res.json();
}

/** Fetch a page of the wallet ledger for the "load more" list. */
export async function fetchVaultLedger(limit: number, offset: number): Promise<VaultLedgerPage> {
  const res = await authFetch(`/api/vault/ledger?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'REGISTRY LOCKED' : `LEDGER QUERY FAILED (${res.status})`);
  }
  return res.json();
}

/** Fetch the citizen's accumulated injunction tasks (newest first). */
export async function fetchInjunctionTasks(): Promise<InjunctionTask[]> {
  const res = await authFetch('/api/vault/injunction-tasks');
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'REGISTRY LOCKED' : `INJUNCTION QUERY FAILED (${res.status})`);
  }
  const body = (await res.json()) as { tasks: InjunctionTask[] };
  return body.tasks ?? [];
}

/**
 * The orders issued for one accepted verdict.
 *
 * `null` means "definitively not available to this caller" — the registry is
 * locked, or the verdict belongs to another citizen — and the caller should stop
 * asking. Anything else (a 5xx, a dropped connection) throws, so the caller can
 * tell a definitive answer from a transient blip worth retrying.
 */
export async function fetchInjunctionTasksForDossier(
  dossierId: string,
  signal?: AbortSignal
): Promise<InjunctionTask[] | null> {
  // The server narrows to this verdict, so the poll's cost is the matching rows
  // (usually none) rather than the citizen's whole worksheet.
  const res = await authFetch(
    `/api/vault/injunction-tasks?dossierId=${encodeURIComponent(dossierId)}`,
    { signal }
  );
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`INJUNCTION QUERY FAILED (${res.status})`);
  const body = (await res.json()) as { tasks: InjunctionTask[] };
  return body.tasks ?? [];
}

export interface InjunctionConfirmResult {
  confirmed: Array<{ id: string; points: number }>;
  bonusTotal: number;
  effectiveIndex: number;
  effectiveCaste: string;
}

/** Confirm completed injunction tasks; banked points lift the pooled index. */
export async function confirmInjunctionTasks(taskIds: string[]): Promise<InjunctionConfirmResult> {
  const res = await authFetch('/api/vault/injunction-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `INJUNCTION CONFIRM FAILED (${res.status})`);
  }
  return res.json();
}

/** Bind a freshly-scanned dossier to the vault (charges the certification fee). */
export async function linkDossierToVault(dossierId: string): Promise<VaultLinkResult> {
  const res = await authFetch('/api/vault/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dossierId }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `REGISTRY LINK FAILED (${res.status})`);
  }
  return res.json();
}

/**
 * Draw a fee from the vault.
 *
 * No amount is sent: the server owns the price list and derives the fee from the
 * dossier for a priced reason (`claim_fee`, `appeal_fee`), so a client cannot
 * underpay its own bill.
 */
export async function chargeVault(reason: string, ref?: string): Promise<VaultChargeResult> {
  const res = await authFetch('/api/vault/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, ref }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `REGISTRY CHARGE FAILED (${res.status})`);
  }
  return res.json();
}
