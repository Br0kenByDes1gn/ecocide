// ---------------------------------------------------------------------------
// The exported case card is the page itself — the sheet is mounted from
// `DossierSheet` / `HouseholdAuditCard` / `PaperDossierPanel` and rasterised, so
// there is no second design to drift. What *can* drift is the handful of values
// the capture derives, so those are pure and pinned here: everything the file
// says about a household must come from the pack and the payload, never from a
// constant written for the export.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { FACTIONS, getFaction, simulateTierRoom, type Caste } from '@ecocide/types';
import {
  EXPORT_BACKGROUND,
  EXPORT_SCALE,
  EXPORT_SHEET_WIDTH,
  dossierExportFilename,
  dossierExportModel,
} from './dossier-export';

const sourceFor = (caste: Caste) => ({
  payload: simulateTierRoom(caste).payload,
  permalinkId: 'AbC123xYz9',
});

describe('dossier export', () => {
  it('names the file after the dossier, so one case file is one household', () => {
    expect(dossierExportFilename('AbC123xYz9')).toBe('ecocide_case_file_abc123xyz9.png');
    // A dossier without a permalink still yields a usable name.
    expect(dossierExportFilename(undefined)).toBe('ecocide_case_file_x.png');
  });

  it('derives every household-specific string from the pack and the payload', () => {
    for (const caste of FACTIONS.map((f) => f.id as Caste)) {
      const source = sourceFor(caste);
      const model = dossierExportModel(source);
      const faction = getFaction(caste);
      expect(model.factionName).toBe(faction.name);
      expect(model.stampText).toBe(faction.stampText);
      expect(model.dispositionLabel).toBe(faction.disposition.label);
    }
  });

  it('reports the tier the payload was actually filed under', () => {
    // Guard against the export ever reading a tier of its own choosing.
    for (const caste of FACTIONS.map((f) => f.id as Caste)) {
      const source = sourceFor(caste);
      expect(dossierExportModel(source).factionName).toBe(source.payload.user_profile.caste
        ? getFaction(source.payload.user_profile.caste).name
        : '');
    }
  });

  it('captures a fixed desktop sheet at 2x, whatever the visitor is using', () => {
    const model = dossierExportModel(sourceFor('disaster-zone'));
    expect(model.sheetWidth).toBe(EXPORT_SHEET_WIDTH);
    expect(model.scale).toBe(EXPORT_SCALE);
    expect(EXPORT_SHEET_WIDTH).toBeGreaterThanOrEqual(1024);
    expect(EXPORT_SCALE).toBe(2);
    // The sheet's own stage, so the dark card is not on transparency.
    expect(model.background).toBe(EXPORT_BACKGROUND);
    expect(EXPORT_BACKGROUND).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
