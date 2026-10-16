import type { InjunctionTask } from '@ecocide/types';

/**
 * Split the worksheet's orders into what the checklist shows and what the
 * standing is worth.
 *
 * The verdict filter is a **view** concern only. The citizen's pooled standing is
 * computed from every completed order on file, so narrowing the list to one
 * verdict must not appear to lower their index — hence the two are derived
 * together, here, where that invariant can be tested.
 */
export function splitWorksheet(
  tasks: InjunctionTask[],
  dossierFilter?: string
): { visible: InjunctionTask[]; bonusTotal: number } {
  return {
    visible: dossierFilter ? tasks.filter((task) => task.dossierId === dossierFilter) : tasks,
    bonusTotal: tasks.filter((task) => task.completed).reduce((sum, task) => sum + task.points, 0),
  };
}
