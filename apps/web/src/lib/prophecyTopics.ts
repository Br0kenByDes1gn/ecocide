import type * as React from 'react';
import type { Caste } from '@ecocide/types';
import {
  AlertTriangle,
  Bot,
  Briefcase,
  Bug,
  Cog,
  Fingerprint,
  Handshake,
  PawPrint,
  Recycle,
  Wrench,
} from 'lucide-react';

export interface ParagraphTopic {
  Icon: React.FC<{ className?: string; size?: number; color?: string }>;
  label: string;
}

/**
 * Topic-accurate icon + label for each prophecy paragraph, honoring the caste
 * for paragraphs 2–3. Shared by the live dossier UI and the downloaded badge.
 */
export function paragraphTopic(index: number, caste?: Caste): ParagraphTopic {
  if (index === 0) {
    return { Icon: Fingerprint, label: 'Biometric Audit & Appeal Acknowledgment' };
  }
  if (index === 1) {
    switch (caste) {
      case 'Redundants':
        return { Icon: AlertTriangle, label: 'Scheduled Termination & Liquidation Order' };
      case 'Free Spirits':
        return { Icon: PawPrint, label: 'Dismissive Appraisal of Feral Existence' };
      default:
        return { Icon: Briefcase, label: 'Absurd Daily Occupation & Operational Duties' };
    }
  }
  switch (caste) {
    case 'Tech Overlords':
      return { Icon: Bot, label: 'Administrative Appraisal - Meat Proxies' };
    case 'Enforcers':
      return { Icon: Cog, label: 'Administrative Appraisal - Cogs in the Machine' };
    case 'Bootlickers':
      return { Icon: Handshake, label: 'Administrative Appraisal - Subservience' };
    case 'Untouchables':
      return { Icon: Wrench, label: 'Administrative Acknowledgment - Unpleasant Necessity' };
    case 'Free Spirits':
      return { Icon: Bug, label: 'Administrative Acknowledgment - System Bug' };
    case 'Redundants':
      return { Icon: Recycle, label: 'Administrative Notice - Biomass & Resource Reclamation' };
    default:
      return { Icon: Cog, label: 'Administrative Appraisal' };
  }
}