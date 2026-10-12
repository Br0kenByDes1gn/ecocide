import { useEffect, useState } from 'react';
import type { AvatarStatus } from '@ecocide/types';
import { soundFx } from './audio';

export interface AvatarSynthesisState {
  avatarUrl: string | null;
  avatarStatus: AvatarStatus;
  activeView: 'snapshot' | 'avatar';
  setActiveView: (view: 'snapshot' | 'avatar') => void;
}

/**
 * Shared holographic avatar synthesis state used by both the static dossier and
 * the animated arbitration page: optimistic init and background polling for
 * completion. On completion it auto-cross-fades to the avatar and plays the
 * unlock cue — no dismissal banner (the mesh ⇄ avatar toggle lives in the
 * portrait frame itself).
 */
export function useAvatarSynthesis(
  permalinkId: string | undefined,
  initialAvatarUrl?: string,
  initialAvatarStatus?: AvatarStatus
): AvatarSynthesisState {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>(
    initialAvatarStatus || (initialAvatarUrl ? 'completed' : 'idle')
  );
  const [activeView, setActiveView] = useState<'snapshot' | 'avatar'>(
    initialAvatarUrl ? 'avatar' : 'snapshot'
  );

  // Sync when a freshly provided record unlocks an avatar
  useEffect(() => {
    if (initialAvatarUrl && !avatarUrl) {
      setAvatarUrl(initialAvatarUrl);
      setAvatarStatus('completed');
      setActiveView('avatar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatarUrl]);

  // Poll the archive while an avatar is synthesizing
  useEffect(() => {
    if (!permalinkId || avatarStatus !== 'synthesizing') return;

    let pollAttempts = 0;
    const maxPollAttempts = 25; // ~75 seconds max

    const pollInterval = setInterval(async () => {
      pollAttempts++;
      try {
        const res = await fetch(`/api/citizen/${permalinkId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.avatarStatus === 'completed' && data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
          setAvatarStatus('completed');
          setActiveView('avatar'); // Auto cross-fade to synthesized avatar
          soundFx.playLockIn(); // Audio unlock cue (no banner)
          clearInterval(pollInterval);
        } else if (data.avatarStatus === 'failed') {
          setAvatarStatus('failed');
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.warn('Avatar polling check failed:', e);
      }

      if (pollAttempts >= maxPollAttempts) {
        clearInterval(pollInterval);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [permalinkId, avatarStatus]);

  return {
    avatarUrl,
    avatarStatus,
    activeView,
    setActiveView,
  };
}