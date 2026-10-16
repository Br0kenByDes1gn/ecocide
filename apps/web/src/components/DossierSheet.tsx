import React from 'react';

export interface DossierSheetProps {
  /** Left column: the dark audit card (lens, tier, index, tiles). */
  card: React.ReactNode;
  /** Right column: the paper dossier panel. */
  panel: React.ReactNode;
}

/**
 * The two-column dossier sheet — the one place its layout is defined.
 *
 * Both the `/citizen` page and the PNG export (`lib/dossier-export.ts`) compose
 * their sheet through this, so the downloaded image is the page rather than a
 * lookalike. `min-w-0` on each column is load-bearing: a grid item defaults to
 * `min-width: auto`, and the audit card's lens canvas carries an intrinsic width
 * (the evidence photo's pixels), so without it the paper cannot shrink below the
 * photo and overflows a phone screen.
 */
export const DossierSheet: React.FC<DossierSheetProps> = ({ card, panel }) => (
  <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
    <div className="min-w-0">{card}</div>
    <div className="min-w-0 space-y-6">{panel}</div>
  </div>
);
