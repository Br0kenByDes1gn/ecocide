import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { REGISTRY_COPY } from '@ecocide/lore';

/**
 * The two states a registry-backed screen shows before its record arrives.
 *
 * Shared by `/registry` and `/injunction` so the chrome and the copy cannot
 * drift, and so the failure state exists at all: a registry fetch that fails used
 * to leave a spinner turning forever, with no way to ask again.
 */

/** Waiting for the session answer, or for the record. */
export const RegistryLoadingPanel: React.FC = () => (
  <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    <div className="font-mono text-xs text-gray-300 tracking-widest uppercase animate-pulse">
      {REGISTRY_COPY.status.loading}
    </div>
  </div>
);

/** Signed in, but the record would not load — say so and offer the retry. */
export const RegistryFailedPanel: React.FC<{
  message?: string | null;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-red-500/40 p-10 flex flex-col items-center gap-4 shadow-xl">
    <AlertTriangle className="w-8 h-8 text-red-400" />
    <div className="font-mono text-xs text-red-300 tracking-widest uppercase text-center">
      {REGISTRY_COPY.status.failed}
    </div>
    {message && <p className="text-center font-mono text-[11px] text-gray-500">{message}</p>}
    <button
      type="button"
      onClick={onRetry}
      className="px-5 py-3 rounded-xl font-mono text-xs font-black tracking-widest uppercase flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg hover:shadow-cyan-500/30 transition-all cursor-pointer"
    >
      <RefreshCw className="w-4 h-4" />
      {REGISTRY_COPY.status.retry}
    </button>
  </div>
);
