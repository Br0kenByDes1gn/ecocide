import { describe, expect, it } from 'vitest';
import type { InjunctionTask } from '@ecocide/types';
import { injunctionRewardUnits } from '@ecocide/types';
import { splitWorksheet, taskRewardUnits } from './injunction-worksheet';

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
  rewardUnits: 0,
};

const task = (over: Partial<InjunctionTask>): InjunctionTask => ({ ...BASE, ...over });

/** The quote for one pending task, straight from the shared rule. */
const boardUnitsPart = (task: InjunctionTask): number =>
  injunctionRewardUnits(task.impact, task.effort, task.action);

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
    expect(splitWorksheet([], 'dossier-a')).toEqual({
      visible: [],
      bonusTotal: 0,
      earnedUnits: 0,
      boardUnits: 0,
    });
  });

  it('totals the credits banked and still on the board, across every order on file', () => {
    const tasks = [
      task({ id: 'done-a', completed: true, points: 16, rewardUnits: 27, dossierId: 'dossier-a' }),
      task({ id: 'done-b', completed: true, points: 4, rewardUnits: 5, dossierId: 'dossier-b' }),
      task({ id: 'todo', impact: 'high', effort: 'hard', dossierId: 'dossier-b' }),
    ];

    // Filtering to one verdict must not change what is banked or available.
    for (const filter of [undefined, 'dossier-a', 'dossier-b']) {
      const { earnedUnits, boardUnits } = splitWorksheet(tasks, filter);
      expect(earnedUnits).toBe(32);
      // The outstanding order is quoted by the same rule the server pays by.
      expect(boardUnits).toBeGreaterThanOrEqual(5);
      expect(boardUnits).toBeLessThanOrEqual(50);
    }

    // A pending order shows its quote; a confirmed one shows what it actually paid.
    const pending = tasks[2];
    expect(taskRewardUnits(pending)).toBe(boardUnitsPart(pending));
    expect(taskRewardUnits(tasks[0])).toBe(27);
  });
});
