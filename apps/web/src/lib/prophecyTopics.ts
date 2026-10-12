import type { Caste } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import {
  Briefcase,
  ClipboardList,
  Cog,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react';

export interface ParagraphTopic {
  Icon: LucideIcon;
  label: string;
}

/** Icon key → lucide component map (lore stores keys, web maps them). */
const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  clipboard: ClipboardList,
  cog: Cog,
  fingerprint: Fingerprint,
};

/**
 * Topic-accurate icon + label for each prophecy paragraph, honoring the faction
 * for paragraphs 2–3 (labels and icon keys come from the lore pack). Shared by
 * the live dossier UI and the downloaded badge.
 */
export function paragraphTopic(index: number, caste?: Caste): ParagraphTopic {
  if (index === 0) {
    return { Icon: Fingerprint, label: 'Biometric Audit' };
  }
  const faction = caste ? getFaction(caste) : undefined;
  const topic = index === 1 ? faction?.topics.p2 : faction?.topics.p3;
  return {
    Icon: (topic && ICON_MAP[topic.icon]) || Cog,
    label: topic?.label || 'Registry Assessment',
  };
}