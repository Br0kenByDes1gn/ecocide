import type { Caste } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { ListChecks, ScanSearch, type LucideIcon } from 'lucide-react';
import { loreIcon } from './lore-icons';

export interface ParagraphTopic {
  Icon: LucideIcon;
  label: string;
}

/**
 * Topic-accurate icon + label for each verdict paragraph, honoring the faction
 * for paragraphs 2–3 (labels and icon keys come from the lore pack). Shared by
 * the live dossier UI and the downloaded card.
 *
 * Keys resolve through the shared lore icon map, so a topic key and a disposition
 * key naming the same thing always draw the same glyph.
 */
export function paragraphTopic(index: number, caste?: Caste): ParagraphTopic {
  if (index === 0) {
    return { Icon: ScanSearch, label: 'Audit Summary' };
  }
  const faction = caste ? getFaction(caste) : undefined;
  const topic = index === 1 ? faction?.topics.p2 : faction?.topics.p3;
  return {
    Icon: loreIcon(topic?.icon) || ListChecks,
    label: topic?.label || 'Registry Assessment',
  };
}
