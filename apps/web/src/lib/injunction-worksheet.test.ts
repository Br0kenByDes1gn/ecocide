import { describe, expect, it } from 'vitest';
import type { InjunctionTask } from '@ecocide/types';
import { splitWorksheet } from './injunction-worksheet';

const BASE: InjunctionTask = {
  id: 't1',
  action: 'Retire the pods.',
  replaces: 'coffee pod',
  why: 'Less plastic.',
  category: 'reduce',
  impact: 'high',
  effort: 'easy',
  dossierId: 'dossier-a',
  createdAt: '2026-10-16T04:00:00.000Z',
  completed: false,
  completedAt: null,
  points: 0,
};

const task = (over: Partial<InjunctionTask>): InjunctionTask => ({ ...BASE, ...over });

describe('splitWorksheet', () => {
  /**
   * The filter comes from the injunction stamp, which opens the worksheet for one
   * verdict. The citizen's index is pooled from every completed order, so viewing
   * a single verdict must never look like it cost them points.
   */
  it('narrows the list without moving the bonus', () => {
    const tasks = [
      task({ id: 'a1', dossierId: 'dossier-a', completed: true, points: 8 }),
      task({ id: 'a2', dossierId: 'dossier-a' }),
      task({ id: 'b1', dossierId: 'dossier-b', completed: true, points: 64 }),
    ];

    const filtered = splitWorksheet(tasks, 'dossier-a');
    const all = splitWorksheet(tasks);

    expect(filtered.visible.map((t) => t.id)).toEqual(['a1', 'a2']);
    expect(filtered.bonusTotal).toBe(72); // a1 + b1, even though b1 is not shown
    expect(filtered.bonusTotal).toBe(all.bonusTotal);
  });

  it('shows everything when there is no filter', () => {
    const tasks = [task({ id: 'a1' }), task({ id: 'b1', dossierId: 'dossier-b' })];
    expect(splitWorksheet(tasks).visible).toHaveLength(2);
  });

  it('handles a verdict with no orders of its own', () => {
    const filtered = splitWorksheet([task({ id: 'a1', points: 4, completed: true })], 'dossier-empty');
    expect(filtered.visible).toEqual([]);
    expect(filtered.bonusTotal).toBe(4);
  });

  it('is empty-ready', () => {
    expect(splitWorksheet([], 'dossier-a')).toEqual({ visible: [], bonusTotal: 0 });
  });
});
