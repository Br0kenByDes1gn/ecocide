import { useCallback, useEffect, useState } from 'react';
import type { VaultLinkResult, VaultState } from '@ecocide/types';
import { authClient, setAuthToken } from './auth-client';
import { fetchVault, linkDossierToVault } from './vault-api';

export type VaultStatus = 'idle' | 'sending' | 'verifying' | 'linking' | 'unlocked' | 'error';

/** True inside a Capacitor native shell, where cookies are cross-origin. */
function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Carbon Registry session + wallet state (API payload keeps its `Vault*`
 * names). Hydrates from the Better Auth session and exposes the OTP unlock,
 * assessment-link and sign-out actions.
 */
export function useVault() {
  const { data: session, isPending } = authClient.useSession();
  const [vault, setVault] = useState<VaultState | null>(null);
  const [status, setStatus] = useState<VaultStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVault(await fetchVault());
    } catch {
      // Not signed in yet — nothing to hydrate.
    }
  }, []);

  useEffect(() => {
    if (session) void refresh();
    else setVault(null);
  }, [session, refresh]);

  const requestOtp = useCallback(async (email: string): Promise<boolean> => {
    setStatus('sending');
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    });
    if (err) {
      setError(err.message || 'TRANSMISSION FAILED — RETRY');
      setStatus('error');
      return false;
    }
    setStatus('idle');
    return true;
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string): Promise<boolean> => {
    setStatus('verifying');
    setError(null);
    const { data, error: err } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: otp.trim(),
    });
    if (err || !data) {
      setError(err?.message || 'INVALID ACCESS CODE');
      setStatus('error');
      return false;
    }
    // Web authenticates via the HttpOnly cookie; native shells keep the token.
    if (isNativeShell() && data.token) setAuthToken(data.token);
    setStatus('idle');
    return true;
  }, []);

  const link = useCallback(
    async (dossierId: string): Promise<VaultLinkResult | null> => {
      setStatus('linking');
      setError(null);
      try {
        const result = await linkDossierToVault(dossierId);
        await refresh();
        setStatus('unlocked');
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'REGISTRY LINK FAILED');
        setStatus('error');
        return null;
      }
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    try {
      await authClient.signOut({});
    } finally {
      setAuthToken(null);
      setVault(null);
      setStatus('idle');
    }
  }, []);

  return {
    session,
    isPending,
    vault,
    status,
    error,
    requestOtp,
    verifyOtp,
    link,
    refresh,
    logout,
  };
}
