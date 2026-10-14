import React, { useState } from 'react';
import { Check, Download, RefreshCw, Share2 } from 'lucide-react';

export interface DossierShareMeta {
  permalinkId?: string;
  honorificTitle: string;
  casteMemberName: string;
  unitId: number;
  population: number;
  biocarbonRatio: number;
}

interface DossierActionsProps {
  onReset: () => void;
  onDownload: () => void;
  share: DossierShareMeta;
}

/**
 * Bottom action row shared by the static /citizen page and the animated
 * /arbitration page. The share/transmit link always points at the static
 * /citizen/:id permalink so recipients land on the shareable dossier.
 */
export const DossierActions: React.FC<DossierActionsProps> = ({ onReset, onDownload, share }) => {
  const [copied, setCopied] = useState(false);

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
          title: `Citizen Dossier: ${share.honorificTitle}`,
          text: `CARBON MINDED AI VERDICT: Designated as ${share.casteMemberName} (Unit ${share.unitId.toLocaleString()} of ${share.population.toLocaleString()}) with a Biocarbon Compliance Ratio of ${share.biocarbonRatio}%!`,
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
        <RefreshCw className="w-4 h-4 text-cyan-400" />
        SCAN ANOTHER CITIZEN
      </button>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDownload}
          className="px-5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl font-mono text-xs flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          DOWNLOAD BADGE
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl font-mono text-xs flex items-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/20"
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