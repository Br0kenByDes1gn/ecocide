import React, { useState } from 'react';
import { CASTE_COLORS, getFaction } from '@ecocide/types';
import { REGISTRY_COPY } from '@ecocide/lore';
import { FileText, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { useVault } from '../lib/useVault';
import { formatRoomType, formatVaultDate } from '../lib/vault-format';
import { RegistryUnlock } from './RegistryUnlock';
import { RegistrySidePanel } from './RegistrySidePanel';

interface CarbonRegistryScreenProps {
  /** Open a linked assessment at /citizen/:id. */
  onOpenDossier: (id: string) => void;
  /** Start a fresh audit from the registry's empty state. */
  onBeginAudit: () => void;
}

/**
 * Carbon Registry page (/registry): the citizen's pooled carbon neutrality
 * index, the archive of every claimed assessment and — demoted beneath them —
 * the token account that pays the certification/appeal fees. Locked visitors
 * get the email-OTP unlock inline.
 */
export const CarbonRegistryScreen: React.FC<CarbonRegistryScreenProps> = ({
  onOpenDossier,
  onBeginAudit,
}) => {
  const { session, isPending, vault, refresh } = useVault();
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState<'date' | 'area' | null>(null);

  if (isPending) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest uppercase animate-pulse">
          {REGISTRY_COPY.status.loading}
        </div>
      </div>
    );
  }

  // Locked → unlock inline.
  if (!session && !vault) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0e1510] rounded-2xl border-2 border-cyan-500/40 p-6 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-5 text-cyan-300 font-mono text-xs font-bold tracking-widest uppercase">
          <Wallet className="w-4 h-4" />
          {REGISTRY_COPY.status.locked}
        </div>
        <RegistryUnlock onUnlocked={() => void refresh()} />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-[#121a14] rounded-2xl border border-gray-800 p-10 flex flex-col items-center gap-4 shadow-xl">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <div className="font-mono text-xs text-gray-300 tracking-widest uppercase animate-pulse">
          {REGISTRY_COPY.status.loading}
        </div>
      </div>
    );
  }

  const { standing, dossiers } = vault;
  const hasRecord = standing.assessmentCount > 0;

  const dossierDay = (createdAt: string) => formatVaultDate(createdAt);
  const dateOptions = [...new Set(dossiers.map((d) => dossierDay(d.createdAt)))];
  const areaKey = (roomType: string | null) => roomType ?? 'unknown';
  const areaOptions = [...new Set(dossiers.map((d) => areaKey(d.roomType)))];
  const visibleDossiers = dossiers.filter(
    (d) =>
      (!dateFilter || dossierDay(d.createdAt) === dateFilter) &&
      (!areaFilter || areaKey(d.roomType) === areaFilter)
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-cyan-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          {REGISTRY_COPY.name}
        </h2>
        <div className="font-mono text-xs text-gray-400 uppercase">
          {REGISTRY_COPY.header.registeredTo} <span className="text-gray-200">{vault.user.email}</span>
          {hasRecord && (
            <span className="text-gray-600">
              {' - '}
              {standing.assessmentCount} {REGISTRY_COPY.standing.assessments}
            </span>
          )}
        </div>
      </div>

      {/* Standing hero + assessment archive: 40/60 split like the arbitration dossier */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <RegistrySidePanel vault={vault} onBeginAudit={onBeginAudit} onOpenDossier={onOpenDossier} />

            {/* Assessment archive */}
      <div className="bg-[#121a14] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-800 text-gray-300 font-mono text-xs tracking-widest uppercase">
          <ShieldCheck className="w-4 h-4 text-gray-500" />
          {REGISTRY_COPY.archive.title} ({visibleDossiers.length})
          {dossiers.length > 0 && (
            <span className="ml-auto flex items-center gap-2 normal-case">
              <button
                type="button"
                onClick={() => setFilterOpen((o) => (o === 'date' ? null : 'date'))}
                className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                  dateFilter
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                    : filterOpen === 'date'
                    ? 'border-gray-600 text-gray-200'
                    : 'border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Date{dateFilter ? `: ${dateFilter}` : ''}
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen((o) => (o === 'area' ? null : 'area'))}
                className={`px-3 py-1.5 rounded-lg border font-mono text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                  areaFilter
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                    : filterOpen === 'area'
                    ? 'border-gray-600 text-gray-200'
                    : 'border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Audit area{areaFilter ? `: ${formatRoomType(areaFilter === 'unknown' ? null : areaFilter, REGISTRY_COPY.archive.roomUnknown)}` : ''}
              </button>
              {(dateFilter || areaFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter(null);
                    setAreaFilter(null);
                  }}
                  className="px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-gray-500 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </span>
          )}
        </div>
        {dossiers.length > 0 && (filterOpen === 'date' || filterOpen === 'area') && (
          <div className="px-5 py-2.5 border-b border-gray-800 space-y-2">
            {filterOpen === 'date' && (
              <div className="flex flex-wrap gap-2">
                {dateOptions.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDateFilter((d) => (d === day ? null : day))}
                    className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                      dateFilter === day
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                        : 'border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
            {filterOpen === 'area' && (
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter((a) => (a === area ? null : area))}
                    className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                      areaFilter === area
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                        : 'border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {formatRoomType(area === 'unknown' ? null : area, REGISTRY_COPY.archive.roomUnknown)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {visibleDossiers.length === 0 ? (
          <div className="px-5 py-10 text-center font-mono text-sm text-gray-500 uppercase">
            {dossiers.length === 0
              ? REGISTRY_COPY.archive.empty
              : 'No assessments match the selected filters'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/70">
            {visibleDossiers.map((d) => {
              const colors = CASTE_COLORS[d.caste];
              const thumb = d.evidenceUrl;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpenDossier(d.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cyan-950/20 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-950 border border-gray-800 shrink-0 flex items-center justify-center">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={getFaction(d.caste).name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className={`font-mono text-xs ${colors?.text ?? 'text-gray-400'}`}>
                        {getFaction(d.caste).name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-bold uppercase truncate ${
                          colors?.text ?? 'text-gray-200'
                        }`}
                      >
                        {getFaction(d.caste).name}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500 uppercase truncate">
                        {formatRoomType(d.roomType, REGISTRY_COPY.archive.roomUnknown)}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-gray-400 truncate">
                      {d.honorificTitle}
                    </div>
                    <div className="font-mono text-[9px] text-gray-600 uppercase">
                      {REGISTRY_COPY.archive.index} {d.biocarbonRatio}% ·{' '}
                      {REGISTRY_COPY.archive.objects} {d.objectCount} ·{' '}
                      {REGISTRY_COPY.archive.hardFails} {d.hardFailCount} ·{' '}
                      {formatVaultDate(d.createdAt)}
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-cyan-500 group-hover:text-cyan-300 uppercase tracking-widest shrink-0">
                    Open
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>

    </div>
  );
};
