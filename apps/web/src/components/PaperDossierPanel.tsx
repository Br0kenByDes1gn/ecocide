import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { INJUNCTION_STAMP, PALETTE, REMEDIATION_COPY } from '@ecocide/lore';
import { CheckCircle2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { soundFx } from '../lib/audio';
import { splitPledges } from '../lib/pledges';
import { DispositionStamp } from './DispositionStamp';
import { DossierProphecy } from './DossierProphecy';
import { InjunctionStamp } from './InjunctionStamp';
import { PaperDossierHeader } from './PaperDossierHeader';
import { PaperInventoryTable } from './PaperInventoryTable';

export interface PaperDossierPanelProps {
  payload: OraclePayload;
  /** Served URL of the archived evidence photo (inventory thumbnails). */
  evidenceUrl?: string;
  /** Permalink id; the injunction mark is only rendered when there is one. */
  permalinkId?: string;
  sessionDate?: string;
  /** Registry email shown as the citizen id (falls back to the permalink). */
  citizenId?: string | null;
  /** Issuance state for this verdict, from `useInjunctionStamp`. */
  injunction: { status: 'idle' | 'waiting' | 'issued' };
  /** Open the orders worksheet filtered to this verdict. */
  onOpenInjunction?: (dossierId: string) => void;
  /** Open the disposition file. */
  onOpenDisposition: () => void;
  /**
   * Inventory disclosure. Controlled so the page keeps its toggle while the PNG
   * export can hand the reader the whole case file at once.
   */
  inventoryOpen: boolean;
  onToggleInventory: () => void;
}

/**
 * The paper half of a dossier: bureau header and case IDs, the mark space, the
 * audit inventory, the Arbiter's copy and the remediation orders.
 *
 * It lives in its own component because two things render it — the `/citizen`
 * page and the PNG export (`lib/dossier-export.ts`), which rasterises the live
 * DOM rather than repainting a second design. Anything added here lands in both,
 * which is the only way the downloaded file stays the page.
 */
export const PaperDossierPanel: React.FC<PaperDossierPanelProps> = ({
  payload,
  evidenceUrl,
  permalinkId,
  sessionDate,
  citizenId = null,
  injunction,
  onOpenInjunction,
  onOpenDisposition,
  inventoryOpen,
  onToggleInventory,
}) => {
  const { user_profile, prophecy, audit, suggestions } = payload;
  const caseId = permalinkId || payload.id || null;
  // What the tribunal granted lives on the file, not in the suggestion list: a
  // granted appeal re-arbitrates the dossier and replaces those suggestions.
  const pledgeGroups = splitPledges(suggestions, payload.acceptedPledges);

  return (
    <div className="paper-layer relative rounded-xl border border-[#d9cfb6] p-4 flex flex-col min-w-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      <PaperDossierHeader
        caseId={caseId}
        sessionDate={sessionDate}
        subtitle="IMPACT FINDINGS"
        citizenId={citizenId}
        largeIds
        subtitleBelowIds
      />

      {/*
        Reserved space under IMPACT FINDINGS — always present, so the paper
        never reflows when the mark arrives. The Bureau's disposition mark
        for this household sits on the left from the moment the verdict
        exists; the right side holds the pending line while the Arbiter
        drafts the orders, then the injunction stamp itself. Wraps rather
        than collides on a narrow screen.
      */}
      <div className="relative mt-3 flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2">
        <DispositionStamp caste={user_profile.caste} onClick={onOpenDisposition} />
        {injunction.status === 'issued' && permalinkId && onOpenInjunction ? (
          <InjunctionStamp
            acceptedAt={payload.acceptedAt}
            onOpen={() => onOpenInjunction(permalinkId)}
          />
        ) : injunction.status === 'waiting' ? (
          <p
            className="animate-pulse text-right font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: INJUNCTION_STAMP.ink }}
          >
            {INJUNCTION_STAMP.pending}
          </p>
        ) : null}
      </div>

      <div className="relative mt-[11px] rounded-sm border border-[#cfc4a8] bg-[#fbf7ea] p-3">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onToggleInventory();
          }}
          className="w-full flex items-center justify-between text-xs font-mono text-[#1f2a1f] hover:text-[#6b7263] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#6b7263]" />
            AUDIT INVENTORY ({audit.items.length} ITEMS
            {audit.hardFails > 0 ? ` - ${audit.hardFails} FLAGGED` : ''})
          </span>
          {inventoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {inventoryOpen && <PaperInventoryTable items={audit.items} evidenceUrl={evidenceUrl} />}
      </div>

      <div className="relative mt-6">
        <DossierProphecy
          headline={prophecy.headline}
          text1={prophecy.paragraph_1}
          text2={prophecy.paragraph_2}
          text3={prophecy.paragraph_3}
          isTyping={false}
          caste={user_profile.caste}
          tone="paper"
        />
      </div>

      {/*
        Remediation orders — the verdict's pledges, split by what the tribunal
        granted and what was never pledged. Acceptance closes the file, so the
        footer stops inviting an appeal at that point (see REMEDIATION_COPY).
      */}
      {pledgeGroups.pledged.length + pledgeGroups.unpledged.length > 0 && (
        <div className="relative mt-6 rounded-sm border border-[#cfc4a8] p-4" style={{ letterSpacing: '1px' }}>
          <div className="flex items-center gap-2 border-b border-[#cfc4a8] pb-3">
            <CheckCircle2 className="w-5 h-5 text-[#1f2a1f]" />
            <h3 className="text-sm font-bold text-[#1f2a1f] tracking-wider uppercase">
              {REMEDIATION_COPY.title}
            </h3>
          </div>

          {pledgeGroups.pledged.length > 0 && (
            <>
              <PledgeGroupHead label={REMEDIATION_COPY.pledged} tone="pledged" />
              <ul className="mt-3 space-y-3">
                {pledgeGroups.pledged.map((p, i) => (
                  <li key={`pledged-${i}`} className="flex items-start gap-3 text-sm text-[#2c3a2c]">
                    <span className="shrink-0 font-black" style={{ color: PLEDGE_GREEN }}>
                      +{p.impact_pct}%
                    </span>
                    <span className="leading-relaxed">
                      {p.text} <span className="text-[#6b7263] text-xs">— {p.pledge}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-widest" style={{ color: PLEDGE_GREEN }}>
                        {REMEDIATION_COPY.granted} {p.grantedAt.slice(0, 10)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pledgeGroups.unpledged.length > 0 && (
            <>
              <PledgeGroupHead label={REMEDIATION_COPY.unpledged} tone="plain" />
              <ul className="mt-3 space-y-3">
                {pledgeGroups.unpledged.map((s, i) => (
                  <li key={`unpledged-${i}`} className="flex items-start gap-3 text-sm text-[#2c3a2c]">
                    <span className="text-[#1f2a1f] font-black shrink-0">+{s.impact_pct}%</span>
                    <span className="leading-relaxed">
                      {s.text} <span className="text-[#6b7263] text-xs">— {s.pledge}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-4 text-[10px] text-[#6b7263] uppercase">
            {payload.acceptedAt ? REMEDIATION_COPY.footerFinal : REMEDIATION_COPY.footerOpen}
          </p>
        </div>
      )}
    </div>
  );
};

/** Green: the art bible defines it for accepted pledges and success states. */
const PLEDGE_GREEN = PALETTE.success;

/** Sub-head that separates the granted pledges from the ones still offered. */
const PledgeGroupHead: React.FC<{ label: string; tone: 'pledged' | 'plain' }> = ({ label, tone }) => (
  <div
    className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
    style={{ color: tone === 'pledged' ? PLEDGE_GREEN : '#6b7263' }}
  >
    {tone === 'pledged' && <CheckCircle2 className="w-3.5 h-3.5" />}
    {label}
  </div>
);
