import React, { useCallback, useEffect, useState } from 'react';
import type { CitizenAppeal, CitizenRecord, OraclePayload } from '@ecocide/types';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gavel,
  History,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface AppealRecordsScreenProps {
  permalinkId?: string;
  /** The verdict has been accepted → the ruling is final and actions are closed. */
  accepted?: boolean;
  /** Rejected rulings: file a brand-new appeal. */
  onNewAppeal: () => void;
  /** Rejected rulings: accept the current verdict and replay its arbitration. */
  onAcceptCurrent: () => void;
  /** Accepted rulings: apply the re-classification and replay with the new caste. */
  onApplyAccepted: (record: OraclePayload) => void;
}

/**
 * Appeal Records screen (/appeals/:id): every appeal filing and its ruling,
 * stored persistently against the dossier. The latest ruling is displayed
 * prominently; older appeals are browsable in a history accordion.
 */
export const AppealRecordsScreen: React.FC<AppealRecordsScreenProps> = ({
  permalinkId,
  accepted = false,
  onNewAppeal,
  onAcceptCurrent,
  onApplyAccepted,
}) => {
  const [appeals, setAppeals] = useState<CitizenAppeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!permalinkId) return;
    fetch(`/api/citizen/${permalinkId}/appeals`)
      .then((res) => {
        if (!res.ok) throw new Error(`Appeals server responded with ${res.status}`);
        return res.json() as Promise<CitizenAppeal[]>;
      })
      .then(setAppeals)
      .catch((e) => {
        console.warn('Could not load appeal records:', e);
        setError('COULD NOT LOAD APPEAL RECORDS FROM THE ARCHIVE');
      });
  }, [permalinkId]);

  const latest = appeals?.[0] ?? null;
  const history = appeals ? appeals.slice(1) : [];

  const handleApplyAccepted = useCallback(async () => {
    if (!permalinkId || !latest || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/citizen/${permalinkId}/appeals/${latest.id}/apply`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Apply server responded with ${res.status}`);
      const data = (await res.json()) as { record: CitizenRecord };
      onApplyAccepted(toOraclePayload(data.record));
    } catch (e) {
      console.warn('Applying appeal failed:', e);
      setError('FAILED TO APPLY RECLASSIFICATION. THE ARBITER IS INDISPOSED.');
      setApplying(false);
    }
  }, [permalinkId, latest, applying, onApplyAccepted]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;
  };

  if (error && !appeals) {
    return (
      <div className="w-full max-w-3xl mx-auto text-center font-mono text-red-400 text-sm animate-pulse py-10">
        ⚠ {error}
      </div>
    );
  }

  if (!appeals) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest animate-pulse">
          RETRIEVING APPEAL RECORDS...
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 text-center shadow-xl space-y-4">
        <Gavel className="w-8 h-8 text-purple-400 mx-auto" />
        <div className="font-mono text-sm text-gray-300">NO APPEALS HAVE BEEN FILED FOR THIS CITIZEN.</div>
        {accepted ? (
          <div className="text-xs font-mono text-lime-300/90 tracking-widest uppercase">
            Verdict accepted — ruling final, appeals closed
          </div>
        ) : (
          <button
            type="button"
            onClick={onNewAppeal}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase cursor-pointer shadow-lg"
          >
            FILE FIRST APPEAL
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-purple-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          APPEAL RECORDS
        </h2>
        <p className="font-mono text-xs text-gray-400">
          PERMANENT ARCHIVE OF EVERY PETITION BEFORE THE ARBITER — RECORD // #{permalinkId}
        </p>
      </div>

      {/* Latest ruling — prominent */}
      <div
        className={`rounded-2xl border-2 p-8 shadow-2xl space-y-4 ${
          latest.accepted ? 'bg-emerald-950/40 border-emerald-500/60' : 'bg-red-950/40 border-red-500/60'
        }`}
      >
        <div className="flex items-center gap-3">
          {latest.accepted ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : (
            <XCircle className="w-8 h-8 text-red-400" />
          )}
          <h3
            className={`font-mono text-lg font-black tracking-widest uppercase ${
              latest.accepted ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            APPEAL {latest.accepted ? 'ACCEPTED' : 'REJECTED'}
          </h3>
        </div>

        {latest.accepted && latest.newCaste && (
          <div className="font-mono text-sm text-gray-200">
            <span className="text-gray-400">RECLASSIFICATION:</span>{' '}
            <span className="text-emerald-300 font-bold uppercase">{latest.newCaste}</span>
            {latest.newHonorificTitle && (
              <>
                {' '}
                — <span className="text-gray-300">{latest.newHonorificTitle}</span>
              </>
            )}
          </div>
        )}

        <div className="font-mono text-[10px] text-gray-500">
          FILED {formatDate(latest.createdAt)} // PRIOR DESIGNATION: {latest.casteBefore.toUpperCase()}
          {latest.casteAfter ? ` → PROPOSED: ${latest.casteAfter.toUpperCase()}` : ''}
        </div>

        <p className="font-mono text-sm leading-relaxed text-gray-300">{latest.reason}</p>

        {error && <div className="text-xs font-mono text-red-400 animate-pulse">⚠ {error}</div>}

        <div className="flex flex-wrap gap-3 pt-2">
          {accepted ? (
            <div className="text-xs font-mono text-lime-300/90 tracking-widest uppercase">
              Verdict accepted — ruling final, appeals closed
            </div>
          ) : latest.accepted ? (
            <button
              type="button"
              onClick={handleApplyAccepted}
              disabled={applying}
              className="flex-1 min-w-[220px] px-6 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/30"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> APPLYING...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" /> SEE NEW VERDICT
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onNewAppeal}
                className="flex-1 min-w-[180px] px-6 py-4 bg-purple-600 hover:bg-purple-500 text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Gavel className="w-5 h-5" /> APPEAL AGAIN
              </button>
              <button
                type="button"
                onClick={onAcceptCurrent}
                className="flex-1 min-w-[180px] px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl font-mono text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <ShieldCheck className="w-5 h-5" /> SEE VERDICT
              </button>
            </>
          )}
        </div>
      </div>

      {/* Browsable history */}
      {history.length > 0 && (
        <div className="bg-[#121a14] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left font-mono text-xs tracking-widest uppercase text-gray-300 hover:bg-gray-900 cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              PREVIOUS APPEALS ({history.length})
            </span>
            {historyOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {historyOpen && (
            <div className="border-t border-gray-800 divide-y divide-gray-800/70">
              {history.map((entry) => (
                <div key={entry.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-gray-500">
                    <span className={entry.accepted ? 'text-emerald-400' : 'text-red-400'}>
                      {entry.accepted ? 'ACCEPTED' : 'REJECTED'} — {formatDate(entry.createdAt)}
                    </span>
                    {entry.accepted && entry.newCaste && (
                      <span className="uppercase font-bold text-emerald-400/80">→ {entry.newCaste}</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-gray-400 leading-relaxed italic">
                    “{entry.appealText}”
                  </p>
                  <p className="font-mono text-xs text-gray-500 leading-relaxed">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Maps the server CitizenRecord into the web OraclePayload shape. */
function toOraclePayload(record: CitizenRecord): OraclePayload {
  return {
    user_profile: record.user_profile || record.profile,
    prophecy: record.prophecy,
    audit: record.audit,
    suggestions: record.suggestions,
    id: record.id,
    evidenceUrl: record.evidenceUrl,
    acceptedAt: record.acceptedAt,
    injunctionFiledAt: record.injunctionFiledAt,
    injunctionOrders: record.injunctionOrders ?? 0,
  };
}