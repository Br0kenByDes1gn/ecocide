// ---------------------------------------------------------------------------
// The remediation block must never list the same commitment twice, and must never
// lose a pledge that was granted: applying a granted appeal re-arbitrates the
// dossier and replaces its suggestions, so an accepted pledge can be absent from
// the suggestion list entirely.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import type { AcceptedPledge, Suggestion } from '@ecocide/types';
import { splitPledges } from './pledges';

const suggestion = (pledge: string, impact_pct = 5): Suggestion => ({
  text: `Replace ${pledge}`,
  target_label: pledge,
  pledge,
  impact_pct,
});

const accepted = (pledge: string, grantedAt = '2026-10-16T00:00:00.000Z'): AcceptedPledge => ({
  text: `Replace ${pledge}`,
  pledge,
  impact_pct: 7,
  grantedAt,
});

describe('pledge groups', () => {
  it('puts everything in unpledged when nothing was granted', () => {
    const suggestions = [suggestion('soap bar'), suggestion('copper pot set')];
    const groups = splitPledges(suggestions, []);
    expect(groups.pledged).toEqual([]);
    expect(groups.unpledged.map((s) => s.pledge)).toEqual(['soap bar', 'copper pot set']);
  });

  it('moves a granted pledge out of the unpledged list', () => {
    const suggestions = [suggestion('soap bar'), suggestion('copper pot set')];
    const groups = splitPledges(suggestions, [accepted('soap bar')]);
    expect(groups.pledged.map((p) => p.pledge)).toEqual(['soap bar']);
    expect(groups.unpledged.map((s) => s.pledge)).toEqual(['copper pot set']);
  });

  it('keeps a granted pledge that re-arbitration dropped from the suggestions', () => {
    // The whole reason pledged is stored rather than looked up.
    const groups = splitPledges([suggestion('denim jeans')], [accepted('soap bar')]);
    expect(groups.pledged.map((p) => p.pledge)).toEqual(['soap bar']);
    expect(groups.unpledged.map((s) => s.pledge)).toEqual(['denim jeans']);
  });

  it('does not double-list a pledge the citizen phrased differently in case', () => {
    const groups = splitPledges([suggestion('Soap Bar')], [accepted('  soap bar ')]);
    expect(groups.unpledged).toEqual([]);
    expect(groups.pledged).toHaveLength(1);
  });

  it('treats a missing accepted list as nothing granted', () => {
    const groups = splitPledges([suggestion('soap bar')], undefined);
    expect(groups.pledged).toEqual([]);
    expect(groups.unpledged).toHaveLength(1);
  });
});
