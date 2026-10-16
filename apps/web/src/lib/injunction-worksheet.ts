import type { InjunctionTask } from '@ecocide/types';
import { injunctionRewardUnits } from '@ecocide/types';

/**
 * Split the worksheet's orders into what the checklist shows and what the
 * standing is worth.
 *
 * The verdict filter is a **view** concern only. The citizen's pooled standing is
 * computed from every completed order on file, so narrowing the list to one
 * verdict must not appear to lower their index — hence the totals are derived
 * together, here, where that invariant can be tested. The same holds for the
 * credits: what is banked and what is still on the board are properties of the
 * citizen's whole worksheet, not of the filtered list.
 */
export function splitWorksheet(
  tasks: InjunctionTask[],
  dossierFilter?: string
): { visible: InjunctionTask[]; bonusTotal: number; earnedUnits: number; boardUnits: number } {
  const completed = tasks.filter((task) => task.completed);
  const pending = tasks.filter((task) => !task.completed);
  return {
    visible: dossierFilter ? tasks.filter((task) => task.dossierId === dossierFilter) : tasks,
    bonusTotal: completed.reduce((sum, task) => sum + task.points, 0),
    // What each completed order actually paid, as recorded when it was confirmed.
    earnedUnits: completed.reduce((sum, task) => sum + (task.rewardUnits ?? 0), 0),
    // What the outstanding ones are worth, priced by the same rule the server pays.
    boardUnits: pending.reduce(
      (sum, task) => sum + injunctionRewardUnits(task.impact, task.effort, task.action),
      0
    ),
  };
}

/** What one action pays: the recorded amount once banked, otherwise the quote. */
export function taskRewardUnits(task: InjunctionTask): number {
  return task.completed
    ? task.rewardUnits ?? 0
    : injunctionRewardUnits(task.impact, task.effort, task.action);
}
