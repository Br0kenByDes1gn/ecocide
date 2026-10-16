// ---------------------------------------------------------------------------
// The regression this guards: better-auth's `isPending` is `data === null` at
// fetch time, so for a logged-out visitor it returns to true on every background
// refetch (a tab becoming visible triggers one). A screen that treats it as a
// mount gate unmounts the unlock form and destroys the email and the code the
// citizen just typed. `registryPhase` reads the *first* resolution instead.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { registryPhase } from './registry-phase';

describe('registry phase', () => {
  it('shows the unlock form only once the session has actually answered', () => {
    expect(registryPhase({ sessionReady: false, session: null, vault: null })).toBe('loading');
    expect(registryPhase({ sessionReady: true, session: null, vault: null })).toBe('locked');
  });

  it('never falls back to the blocking state after the first resolution', () => {
    // This is the tab-switch regression: settled + no session is 'locked',
    // whether or not a refetch is in flight right now.
    for (const vault of [null, undefined]) {
      expect(registryPhase({ sessionReady: true, session: null, vault })).toBe('locked');
    }
  });

  it('separates a loading account from a failed one', () => {
    const session = { user: { id: 'u1' } };
    expect(registryPhase({ sessionReady: true, session, vault: null })).toBe('hydrating');
    expect(registryPhase({ sessionReady: true, session, vault: null, vaultError: 'HTTP 500' })).toBe(
      'failed'
    );
    // A retry that succeeds clears the failure.
    expect(
      registryPhase({ sessionReady: true, session, vault: { standing: {} }, vaultError: null })
    ).toBe('ready');
  });

  it('treats a record as ready even if an earlier attempt failed', () => {
    const session = { user: { id: 'u1' } };
    expect(
      registryPhase({ sessionReady: true, session, vault: { standing: {} }, vaultError: 'stale' })
    ).toBe('ready');
  });

  it('gates a signed-in citizen on the first resolution too', () => {
    // A session that arrived before the gate opened still waits for the flag.
    expect(
      registryPhase({ sessionReady: false, session: { user: { id: 'u1' } }, vault: { standing: {} } })
    ).toBe('loading');
  });
});
