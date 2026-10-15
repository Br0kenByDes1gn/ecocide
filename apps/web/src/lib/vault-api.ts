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

/** Draw a fixed fee from the vault (e.g. the appeal filing fee). */
export async function chargeVault(
  amount: number,
  reason: string,
  ref?: string
): Promise<VaultChargeResult> {
  const res = await authFetch('/api/vault/charge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, reason, ref }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `REGISTRY CHARGE FAILED (${res.status})`);
  }
  return res.json();
}
