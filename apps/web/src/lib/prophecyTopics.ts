import type { Caste } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import {
  ClipboardList,
  Gavel,
  Leaf,
  ListChecks,
  Recycle,
  ScanSearch,
  Scale,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface ParagraphTopic {
  Icon: LucideIcon;
  label: string;
}

/** Icon key → lucide component map (lore stores keys, web maps them). */
const ICON_MAP: Record<string, LucideIcon> = {
  scan: ScanSearch,
  recycle: Recycle,
  clipboard: ClipboardList,
  gavel: Gavel,
  scale: Scale,
  zap: Zap,
  trash: Trash2,
  leaf: Leaf,
  list: ListChecks,
};

/**
 * Topic-accurate icon + label for each verdict paragraph, honoring the faction
 * for paragraphs 2–3 (labels and icon keys come from the lore pack). Shared by
 * the live dossier UI and the downloaded card.
 */
export function paragraphTopic(index: number, caste?: Caste): ParagraphTopic {
  if (index === 0) {
    return { Icon: ScanSearch, label: 'Audit Summary' };
  }
  const faction = caste ? getFaction(caste) : undefined;
  const topic = index === 1 ? faction?.topics.p2 : faction?.topics.p3;
  return {
    Icon: (topic && ICON_MAP[topic.icon]) || ListChecks,
    label: topic?.label || 'Registry Assessment',
  };
}