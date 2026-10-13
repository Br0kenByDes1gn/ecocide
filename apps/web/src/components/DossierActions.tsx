import React, { useState } from 'react';
import { Check, Download, RefreshCw, Share2 } from 'lucide-react';
import { getFaction } from '@ecocide/types';
import type { OraclePayload } from '@ecocide/types';

export interface DossierShareMeta {
  permalinkId?: string;
  honorificTitle: string;
  factionName: string;
  stampText: string;
  ratio: number;
  itemsScanned: number;
}

interface DossierActionsProps {
  onReset: () => void;
  onDownload: () => void;
  /** Pass the whole payload; the share text is derived from the lore pack. */
  payload?: OraclePayload;
  share: DossierShareMeta;
}

/**
 * Bottom action row shared by the static /citizen page. The share/transmit
 * link always points at the static /citizen/:id permalink so recipients land
 * on the shareable dossier.
 */
export const DossierActions: React.FC<DossierActionsProps> = ({ onReset, onDownload, payload, share }) => {
  const [copied, setCopied] = useState(false);

  const factionName = payload
    ? getFaction(payload.user_profile.caste).name
    : share.factionName || 'CLASSIFIED HOUSEHOLD';

  const handleShare = async () => {
    const shareUrl = share.permalinkId
      ? `${window.location.origin}/citizen/${share.permalinkId}`
      : window.location.href;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({
          title: `Household Dossier: ${share.honorificTitle}`,
          text: `ECOCIDE VERDICT: ${share.honorificTitle} classified as ${factionName} (${share.stampText}) with a Household Sustainability Index of ${share.ratio}% — ${share.itemsScanned} items audited!`,
          url: shareUrl,
        });
      }
    } catch (e) {
      console.warn('Share/clipboard action failed:', e);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onReset}
        className="px-5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-700 rounded-xl font-mono text-xs flex items-center gap-2 transition-colors"
      >
        <RefreshCw className="w-4 h-4 text-lime-400" />
        AUDIT ANOTHER HOUSEHOLD
      </button>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDownload}
          className="px-5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl font-mono text-xs flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          DOWNLOAD CASE CARD
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="px-5 py-3 bg-[#b4ff39] hover:bg-lime-300 text-black font-bold rounded-xl font-mono text-xs flex items-center gap-2 transition-all shadow-lg hover:shadow-lime-500/20"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              LINK COPIED!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              TRANSMIT VERDICT
            </>
          )}
        </button>
      </div>
    </div>
  );
};