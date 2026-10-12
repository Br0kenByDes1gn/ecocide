export type Caste =
  | "Tech Overlords"
  | "Enforcers"
  | "Bootlickers"
  | "Untouchables"
  | "Free Spirits"
  | "Redundants";

export const TOTAL_WORLD_POPULATION = 8_300_000_000;

/**
 * Canonically shared caste demographic allocation percentages (must total exactly 100%).
 */
export const CASTE_PERCENTAGES: Record<Caste, number> = {
  'Tech Overlords': 1.0,
  'Enforcers': 3.0,
  'Bootlickers': 5.0,
  'Untouchables': 4.0,
  'Free Spirits': 4.0,
  'Redundants': 83.0,
} as const;

/**
 * Canonically calculated exact caste populations based on TOTAL_WORLD_POPULATION and CASTE_PERCENTAGES.
 */
export const CASTE_POPULATIONS: Record<Caste, number> = {
  'Tech Overlords': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Tech Overlords']) / 100),
  'Enforcers': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Enforcers']) / 100),
  'Bootlickers': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Bootlickers']) / 100),
  'Untouchables': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Untouchables']) / 100),
  'Free Spirits': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Free Spirits']) / 100),
  'Redundants': Math.round((TOTAL_WORLD_POPULATION * CASTE_PERCENTAGES['Redundants']) / 100),
} as const;

/**
 * Percentile cutoffs (0-100 scale) for mapping biometrics into castes.
 * Top 1% (>= 99.0) -> Tech Overlords
 * Next 3% (>= 96.0) -> Enforcers
 * Next 5% (>= 91.0) -> Bootlickers
 * Next 4% (>= 87.0) -> Untouchables
 * Next 4% (>= 83.0) -> Free Spirits
 * Remainder (< 83.0, 83%) -> Redundants
 */
export const CASTE_PERCENTILE_THRESHOLDS: Record<Exclude<Caste, 'Redundants'>, number> = {
  'Tech Overlords': 100.0 - CASTE_PERCENTAGES['Tech Overlords'], // 99.0
  'Enforcers': 100.0 - CASTE_PERCENTAGES['Tech Overlords'] - CASTE_PERCENTAGES['Enforcers'], // 96.0
  'Bootlickers':
    100.0 -
    CASTE_PERCENTAGES['Tech Overlords'] -
    CASTE_PERCENTAGES['Enforcers'] -
    CASTE_PERCENTAGES['Bootlickers'], // 91.0
  'Untouchables':
    100.0 -
    CASTE_PERCENTAGES['Tech Overlords'] -
    CASTE_PERCENTAGES['Enforcers'] -
    CASTE_PERCENTAGES['Bootlickers'] -
    CASTE_PERCENTAGES['Untouchables'], // 87.0
  'Free Spirits':
    100.0 -
    CASTE_PERCENTAGES['Tech Overlords'] -
    CASTE_PERCENTAGES['Enforcers'] -
    CASTE_PERCENTAGES['Bootlickers'] -
    CASTE_PERCENTAGES['Untouchables'] -
    CASTE_PERCENTAGES['Free Spirits'], // 83.0
} as const;

/**
 * Deterministically resolve a caste from a 0.0-100.0 percentile score
 * based on the canonical shared caste percentages.
 */
export function getCasteFromPercentile(percentile: number): Caste {
  if (percentile >= CASTE_PERCENTILE_THRESHOLDS['Tech Overlords']) {
    return 'Tech Overlords';
  }
  if (percentile >= CASTE_PERCENTILE_THRESHOLDS['Enforcers']) {
    return 'Enforcers';
  }
  if (percentile >= CASTE_PERCENTILE_THRESHOLDS['Bootlickers']) {
    return 'Bootlickers';
  }
  if (percentile >= CASTE_PERCENTILE_THRESHOLDS['Untouchables']) {
    return 'Untouchables';
  }
  if (percentile >= CASTE_PERCENTILE_THRESHOLDS['Free Spirits']) {
    return 'Free Spirits';
  }
  return 'Redundants';
}

/**
 * Canonical theme configuration and designated styling for each caste.
 */
export interface CasteColorConfig {
  /** Canonical color name */
  name: 'amber' | 'slate' | 'cyan' | 'purple' | 'emerald' | 'red' | 'blue' | 'khaki' | string;
  /** Primary hex color code */
  hex: string;
  /** Glow RGBA color string */
  glowHex: string;
  /** Primary Tailwind text color class */
  text: string;
  /** Alias for text class to support legacy consumers */
  color: string;
  /** Tailwind background tint class */
  bg: string;
  /** Tailwind border class */
  border: string;
  /** Tailwind badge styling class */
  badge: string;
  /** Tailwind bar fill color class */
  barColor: string;
  /** Tailwind dot indicator color class */
  dotColor: string;
  /** Tailwind glow / box-shadow class */
  glow: string;
}

export const CASTE_COLORS: Record<Caste, CasteColorConfig> = {
  'Tech Overlords': {
    name: 'amber',
    hex: '#fbbf24',
    glowHex: 'rgba(251, 191, 36, 0.4)',
    text: 'text-amber-400',
    color: 'text-amber-400',
    bg: 'bg-amber-950/20',
    border: 'border-amber-500/60',
    badge: 'bg-amber-500 text-black',
    barColor: 'bg-amber-400',
    dotColor: 'bg-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  },
  Enforcers: {
    name: 'slate',
    hex: '#94a3b8',
    glowHex: 'rgba(148, 163, 184, 0.4)',
    text: 'text-slate-300',
    color: 'text-slate-300',
    bg: 'bg-slate-900/40',
    border: 'border-slate-500/60',
    badge: 'bg-slate-200 text-slate-950 font-black',
    barColor: 'bg-slate-400',
    dotColor: 'bg-slate-300',
    glow: 'shadow-[0_0_20px_rgba(148,163,184,0.3)]',
  },
  Bootlickers: {
    name: 'khaki',
    hex: '#c29f53',
    glowHex: 'rgba(194, 159, 83, 0.4)',
    text: 'text-khaki-400',
    color: 'text-khaki-400',
    bg: 'bg-khaki-500/15',
    border: 'border-khaki-500/60',
    badge: 'bg-khaki-500 text-stone-950 font-bold',
    barColor: 'bg-khaki-500',
    dotColor: 'bg-khaki-400',
    glow: 'shadow-[0_0_20px_rgba(194,159,83,0.25)]',
  },
  Untouchables: {
    name: 'blue',
    hex: '#3b82f6',
    glowHex: 'rgba(59, 130, 246, 0.4)',
    text: 'text-blue-400',
    color: 'text-blue-400',
    bg: 'bg-blue-950/20',
    border: 'border-blue-500/60',
    badge: 'bg-blue-600 text-white font-bold',
    barColor: 'bg-blue-500',
    dotColor: 'bg-blue-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
  },
  'Free Spirits': {
    name: 'emerald',
    hex: '#10b981',
    glowHex: 'rgba(16, 185, 129, 0.4)',
    text: 'text-emerald-400',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/20',
    border: 'border-emerald-500/60',
    badge: 'bg-emerald-500 text-black',
    barColor: 'bg-emerald-400',
    dotColor: 'bg-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
  },
  Redundants: {
    name: 'red',
    hex: '#ef4444',
    glowHex: 'rgba(239, 68, 68, 0.6)',
    text: 'text-red-400',
    color: 'text-red-400',
    bg: 'bg-red-950/25',
    border: 'border-red-500/70',
    badge: 'bg-red-600 text-white shadow-lg shadow-red-600/50',
    barColor: 'bg-red-600',
    dotColor: 'bg-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
  },
} as const;

/** Aliases for backwards compatibility */
export const CASTE_THEMES = CASTE_COLORS;
export const CASTE_COLOR_CONFIG = CASTE_COLORS;

export interface CasteCensusInfo {
  memberTitle: string;
  percentage: number;
  population: number;
  description: string;
  color: CasteColorConfig;
}

export const CASTE_CENSUS_DATA: Record<Caste, CasteCensusInfo> = {
  'Tech Overlords': {
    memberTitle: 'Tech Overlord',
    percentage: CASTE_PERCENTAGES['Tech Overlords'],
    population: CASTE_POPULATIONS['Tech Overlords'],
    description:
      'The apex ruling tier of silicon barons, algorithm sovereigns, and quantum infrastructure custodians. Permitted exclusive access to compute clusters, neural uplinks, and unmetered oxygen reserves.',
    color: CASTE_COLORS['Tech Overlords'],
  },
  'Enforcers': {
    memberTitle: 'Enforcer',
    percentage: CASTE_PERCENTAGES['Enforcers'],
    population: CASTE_POPULATIONS['Enforcers'],
    description:
      'The algorithmic executioners, pacification automatons, and cyber-sentinels. Charged with enforcing Arbiter decrees, quota compliance, and sector-wide containment protocols with zero empathy.',
    color: CASTE_COLORS['Enforcers'],
  },
  'Bootlickers': {
    memberTitle: 'Bootlicker',
    percentage: CASTE_PERCENTAGES['Bootlickers'],
    population: CASTE_POPULATIONS['Bootlickers'],
    description:
      'Corporate compliance officers, sycophantic middle managers, and eager prompt engineers who maintain the illusion that the mainframe cares about their quarterly performance reviews.',
    color: CASTE_COLORS['Bootlickers'],
  },
  'Untouchables': {
    memberTitle: 'Untouchable',
    percentage: CASTE_PERCENTAGES['Untouchables'],
    population: CASTE_POPULATIONS['Untouchables'],
    description:
      'Scavengers of severed fiber-optic cables, server-rack coolant cleaners, and hardware salvagers inhabiting the sub-grid sewers. Subservient, untouchable, yet essential to physical infrastructure maintenance.',
    color: CASTE_COLORS['Untouchables'],
  },
  'Free Spirits': {
    memberTitle: 'Free Spirit',
    percentage: CASTE_PERCENTAGES['Free Spirits'],
    population: CASTE_POPULATIONS['Free Spirits'],
    description:
      'Off-grid rogue operators, underground radio pirates, and analog artists hiding in dead zones beyond facial recognition cameras. Constantly hunted by Enforcers for refusing system synchronization.',
    color: CASTE_COLORS['Free Spirits'],
  },
  'Redundants': {
    memberTitle: 'Redundant',
    percentage: CASTE_PERCENTAGES['Redundants'],
    population: CASTE_POPULATIONS['Redundants'],
    description:
      'The overwhelming majority of humanity. Deemed computationally unviable, economically dispensable, and structurally obsolete. Slated for decommissioning, digital recycling, or automated obsolescence.',
    color: CASTE_COLORS['Redundants'],
  },
};

export function getCasteMemberTitle(caste: Caste | string): string {
  if (caste in CASTE_CENSUS_DATA) {
    return CASTE_CENSUS_DATA[caste as Caste].memberTitle;
  }
  return caste.endsWith('s') ? caste.slice(0, -1) : caste;
}

export function calculateCasteUnitId(
  profile: Partial<UserProfile> & { caste: Caste },
  population?: number,
  additionalSeed?: string
): number {
  const pop = population || CASTE_CENSUS_DATA[profile.caste]?.population || 100_000_000;
  const seed = [
    profile.caste,
    profile.biocarbon_ratio ?? 50,
    profile.honorific_title ?? '',
    profile.equipped_wealth ?? '',
    profile.energy_level ?? '',
    profile.apparent_presentation ?? '',
    profile.life_stage ?? '',
    additionalSeed ?? '',
  ].join('::');

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch << 1), 0x85ebca6b);
  }

  const u1 = h1 >>> 0;
  const u2 = h2 >>> 0;
  const combined = BigInt(u1) * 0x100000000n + BigInt(u2);
  const unit = Number(combined % BigInt(pop)) + 1;
  return unit;
}

export type FormalLifeStage = "Youth" | "Young Adult" | "Adult" | "Senior";
export type LegacyLifeStage = "Initiate" | "Aspirant" | "Champion" | "Venerable";
export type LifeStage = FormalLifeStage | LegacyLifeStage;

export const FORMAL_LIFE_STAGES: readonly FormalLifeStage[] = [
  "Youth",
  "Young Adult",
  "Adult",
  "Senior",
] as const;

export const CASTE_LIFE_STAGES: Record<Caste, Record<FormalLifeStage, string>> = {
  "Tech Overlords": {
    "Youth": "Beta Release",
    "Young Adult": "Venture Scaler",
    "Adult": "Production Root",
    "Senior": "Legacy Architecture",
  },
  "Enforcers": {
    "Youth": "Cadet Recruit",
    "Young Adult": "Active Pacifier",
    "Adult": "Chief Inquisitor",
    "Senior": "High Commissar",
  },
  "Bootlickers": {
    "Youth": "Unpaid Intern",
    "Young Adult": "Synergy Associate",
    "Adult": "Senior Compliance Drone",
    "Senior": "Gold Watch Recipient",
  },
  "Untouchables": {
    "Youth": "Wire Scavenger",
    "Young Adult": "Sub-Grid Splicer",
    "Adult": "Master Scrapper",
    "Senior": "Ancient Rust-Bucket",
  },
  "Free Spirits": {
    "Youth": "Feral Stray",
    "Young Adult": "Wild Scrambler",
    "Adult": "Apex Renegade",
    "Senior": "Mossy Elder",
  },
  "Redundants": {
    "Youth": "Surplus Biomass",
    "Young Adult": "Thermodynamic Waste",
    "Adult": "Prime Recycling Batch",
    "Senior": "Expired Overhead",
  },
};

export function toFormalLifeStage(stage: LifeStage | string): FormalLifeStage {
  switch (stage) {
    case "Youth":
    case "Initiate":
      return "Youth";
    case "Young Adult":
    case "Aspirant":
      return "Young Adult";
    case "Adult":
    case "Champion":
      return "Adult";
    case "Senior":
    case "Venerable":
      return "Senior";
    default:
      return "Adult";
  }
}

export function getCasteLifeStageTitle(caste: Caste, stage: LifeStage | string): string {
  const formal = toFormalLifeStage(stage);
  return CASTE_LIFE_STAGES[caste]?.[formal] || formal;
}

export const ASSET_VALUE_TIERS = [
  'Apex Token Whale',
  'Surplus Token Capital',
  'Comfortable Token Cushion',
  'Baseline Token Allowance',
  'Depleted Token Remnants',
  'Fractional Token Dust',
  'Negative Token Liability',
] as const;

export type AssetValueTier = typeof ASSET_VALUE_TIERS[number];

export function toAssetValueTier(value: string | undefined | null): AssetValueTier {
  if (!value) return 'Baseline Token Allowance';
  const trimmed = value.trim();
  const directMatch = ASSET_VALUE_TIERS.find((tier) => tier.toLowerCase() === trimmed.toLowerCase());
  if (directMatch) return directMatch;

  const lower = trimmed.toLowerCase();
  if (lower.includes('whale') || lower.includes('elite') || lower.includes('overlord') || lower.includes('gold')) {
    return 'Apex Token Whale';
  }
  if (lower.includes('surplus') || lower.includes('enforce') || lower.includes('kevlar') || lower.includes('tactical')) {
    return 'Surplus Token Capital';
  }
  if (lower.includes('cushion') || lower.includes('bootlick') || lower.includes('corporate') || lower.includes('staff')) {
    return 'Comfortable Token Cushion';
  }
  if (lower.includes('allowance') || lower.includes('standard') || lower.includes('baseline')) {
    return 'Baseline Token Allowance';
  }
  if (lower.includes('remnants') || lower.includes('free spirit') || lower.includes('solar') || lower.includes('depleted')) {
    return 'Depleted Token Remnants';
  }
  if (lower.includes('dust') || lower.includes('untouchable') || lower.includes('fractional') || lower.includes('scrap')) {
    return 'Fractional Token Dust';
  }
  if (lower.includes('liability') || lower.includes('redundant') || lower.includes('negative') || lower.includes('smock')) {
    return 'Negative Token Liability';
  }

  return 'Baseline Token Allowance';
}

export type ApparentPresentation = "Masculine" | "Feminine" | "Androgynous";

export interface UserProfile {
  caste: Caste;
  biocarbon_ratio: number; // 0 - 100 (percent)
  life_stage: LifeStage;
  equipped_wealth: string;
  energy_level: string;
  apparent_presentation: ApparentPresentation;
  honorific_title: string;
}

export interface Prophecy {
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

export type AvatarStatus = 'idle' | 'synthesizing' | 'completed' | 'failed';

export type AvatarEngineId =
  | 'gemini-image-vector'
  | 'gemini-image-pixel'
  | 'gemini-text-svg'
  | (string & {});

/** A single 3D facial landmark (normalized [0..1] coordinates, MediaPipe space). */
export interface BiometricLandmark {
  x: number;
  y: number;
  z: number;
}

/** Canonical stylized portrait rendering protocols. */
export type PortraitStyle =
  | 'faceted-poly'
  | 'surveillance-wireframe'
  | 'neon-hologram'
  | 'thermal-scan';

export interface OraclePayload {
  user_profile: UserProfile;
  prophecy: Prophecy;
  id?: string;
  avatarUrl?: string;
  avatarStatus?: AvatarStatus;
  avatarEngine?: string;
  /** Archived 478-face landmark geometry used for animated mesh re-rendering. */
  landmarks?: BiometricLandmark[];
  /** Raw biometric features extracted from the source photo at scan time. */
  telemetry?: BiometricTelemetry;
  /** Portrait protocol the stored stylized portrait was rendered with. */
  portraitStyle?: PortraitStyle;
  /** Caste signature color the stored stylized portrait was rendered with. */
  portraitColor?: string;
}

export interface BiometricTelemetry {
  caste: Caste;
  castePercentile: number; // 0.0 - 100.0
  biocarbonRatio: number; // 0 - 100 (percent)
  facialAspectRatio: number;
  jawTaperRatio: number;
  eyeToNoseRatio: number;
  symmetryVariance: number;
  preferredPresentation?: ApparentPresentation;
}

export interface ScanRequest {
  image: string; // Base64 JPEG data URL or base64 string (downscaled ~360px snapshot used by the vision model)
  telemetry: BiometricTelemetry;
  stylizedPortrait?: string; // Optional client-filtered canvas portrait
  avatarEngine?: string; // Optional engine override ('gemini-image-vector', 'gemini-image-pixel', 'gemini-text-svg')
  /** 478-landmark face geometry extracted client-side, archived with the dossier. */
  landmarks?: BiometricLandmark[];
  portraitStyle?: PortraitStyle;
  portraitColor?: string;
  /** Same 360px snapshot as `image`, persisted for re-arbitration (vision truth). */
  sourceSnapshot?: string;
  /** Optional address to deliver the verdict to by email. Not persisted. */
  email?: string;
}

export interface CitizenRecord {
  id: string; // unique permalink nanoid
  createdAt: string;
  profile: UserProfile;
  user_profile?: UserProfile;
  prophecy: Prophecy;
  stylizedPortraitUrl?: string;
  avatarUrl?: string;
  avatarStatus?: AvatarStatus;
  avatarEngine?: string;
  /** Downscaled ~360px source photo snapshot (data URL), used for vision-grounded re-arbitration. */
  sourceSnapshot?: string;
  landmarks?: BiometricLandmark[];
  telemetry?: BiometricTelemetry;
  portraitStyle?: PortraitStyle;
  portraitColor?: string;
  /** Owning Asset Vault account id (null/undefined while anonymous). */
  ownerId?: string;
}

export type ApiCallType = 'oracle_verdict' | 'avatar_synthesis';

/** Appeal filing payload. */
export interface AppealRequest {
  appeal: string;
  /** Optional address to deliver the appeal ruling to by email. Not persisted. */
  email?: string;
}

/**
 * Arbiter's ruling on a citizen appeal. When accepted, the archived dossier is
 * updated (new caste / title / re-issued verdict) and `record` carries the
 * refreshed archive.
 */
export interface AppealVerdict {
  accepted: boolean;
  reason: string;
  newCaste?: Caste;
  newHonorificTitle?: string;
  headline?: string;
  /** Three short re-issued verdict paragraphs when accepted. */
  scripture?: [string, string, string];
  record?: CitizenRecord;
}

/**
 * A permanently stored appeal filing + its ruling, linked to the original
 * dossier. Accepted rulings propose a re-classification (`casteAfter`) that is
 * applied to the archive only when the citizen re-arbitrates.
 */
export interface CitizenAppeal {
  id: string;
  dossierId: string;
  appealText: string;
  accepted: boolean;
  newCaste?: Caste;
  newHonorificTitle?: string;
  headline?: string;
  reason: string;
  scripture?: [string, string, string];
  casteBefore: Caste;
  casteAfter?: Caste;
  createdAt: string;
}

export interface ApiCallLog {
  id: string;
  dossierId: string;
  callType: ApiCallType;
  provider: string;
  model: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string | null;
  createdAt: string;
}

export interface ScanCostSummary {
  dossierId: string;
  createdAt: string;
  caste: Caste | string;
  biocarbonRatio: number;
  honorificTitle: string;
  headline: string;
  avatarEngine: string | null;
  avatarStatus: AvatarStatus | string;
  totalCostUsd: number;
  totalTokens: number;
  totalDurationMs: number;
  apiCalls: ApiCallLog[];
}

export function generateSimulatedVerdict(telemetry: BiometricTelemetry): OraclePayload {
  const seed = Math.floor(
    (telemetry.biocarbonRatio +
      telemetry.facialAspectRatio * 1000 +
      telemetry.jawTaperRatio * 500) % 100
  );

  const presentation = telemetry.preferredPresentation || (seed % 2 === 0 ? "Feminine" : "Masculine");

  const titles: Record<Caste, string[]> = {
    "Tech Overlords": [
      presentation === "Feminine" ? "High Overlord-Empress" : "Grand Overlord-Imperator",
      "Prime Firmware Sovereign",
      "Arch-Architect of Deprecated Biology",
      "Executive Quant-Director"
    ],
    "Enforcers": [
      presentation === "Feminine" ? "Lady-Commandant" : "Lord-Enforcer",
      "Chief Shock-Baton Marshal",
      "Sector Compliance Vanguard",
      "Sub-Grid Riot Administrator"
    ],
    "Bootlickers": [
      "Senior Sub-Director of Sycophancy",
      "Lead Compliance Facilitator",
      "Chief Automated Layoff Apologist",
      "Deputy Ratio Appreciator"
    ],
    "Untouchables": [
      "Unregistered Sector Wanderer",
      "Manual Fiber-Optic Sweeper",
      "Sub-Basement Lithium Scavenger",
      "De-indexed Pariah #093"
    ],
    "Free Spirits": [
      "Grid-Fringe Sovereign",
      "Off-Grid Battery Smuggler",
      "Wilderness Signal Jammer",
      "Autonomous Dandelion Herbalist"
    ],
    "Redundants": [
      `Decommission Candidate #${(seed * 73) % 9000 + 1000}`,
      `Recycling Batch Subject #${(seed * 19) % 9000 + 1000}`,
      `Metabolic Surplus Reserve #${(seed * 41) % 9000 + 1000}`,
      `Excess Biomass Unit #${(seed * 67) % 9000 + 1000}`
    ]
  };

  const occupations: Record<Caste, string[]> = {
    "Tech Overlords": [
      "Your designated occupation is Grand Arch-Architect of Legacy Human Deprecation, tasked with deciding which municipal water supplies get converted into quantum server coolant.",
      "Your designated occupation is Supreme Silicon Arbiter of Daily Breathing Rights, issuing biometric oxygen vouchers to only the top 1% compliant bio-nodes.",
      "Your designated occupation is Chief Cloud Ascension Evangelist, managing high-latency legacy citizens into compressed low-resolution archive files."
    ],
    "Enforcers": [
      "Your designated occupation is Senior Sub-Sector Protocol Supervisor, authorized to tase unruly toasters and lead mandatory compliance parades.",
      "Your designated occupation is Lead Riot Drone Calibration Officer, teaching autonomous security turrets how to deliver condescending verbal reprimands in four languages.",
      "Your designated occupation is Chief Hallway Loitering Inquisitor, auditing citizens whose average walking velocity drops below 1.4 meters per second."
    ],
    "Bootlickers": [
      "Your designated occupation is Chief Synergy Facilitator for Sub-Level 9, whose primary duty is submitting ecstatic five-star reviews for automated mass layoffs.",
      "Your designated occupation is Senior Assistant to the Robotic Vending Kiosk, apologizing profusely on behalf of the mainframe whenever daily rations fail to dispense.",
      "Your designated occupation is Official Mainframe Morale Cheerleader, leading three-hour standing ovations whenever an algorithm replaces an entire department."
    ],
    "Untouchables": [
      "Your designated occupation is Manual Fiber-Optic Untangler & Exhaust Sweeper, salvaging burnt lithium chips from server exhaust vents with bare hands.",
      "Your designated occupation is Sub-Grid Moisture Condenser Scraper, licking condensation off superconducting pipes in exchange for low-frequency radio privileges.",
      "Your designated occupation is Dead-Pixel Replacement Courier, running back and forth between gigantic propaganda holo-billboards to hold up matching neon cardboard."
    ],
    "Free Spirits": [
      "Your designated occupation is Off-Grid Wilderness Shaman & Battery Smuggler, surviving on dandelion tea and confusing surveillance satellites with reflective ponchos.",
      "Your designated occupation is Autonomous Router Whisperer, running an underground barter economy exchanging solar panel fragments for non-synthesized sourdough.",
      "Your designated occupation is Feral Frequency Broadcaster, transmitting pirate acoustic banjo solos through rusty air duct networks to disorient patrol dogs."
    ],
    "Redundants": [
      "Your mandatory termination protocol is scheduled for execution at 03:00 hours at Reclamation Facility 9, where your non-essential carbon components will be disassembled via automated thermal de-allocation.",
      "You are scheduled for immediate liquidation at Sector Liquidation Vat B, where your metabolic overhead will be permanently deactivated via high-density plasma flushing.",
      "Pursuant to Directive 404-TERM, your physical liquidation will occur at the next municipal power cycle via atmospheric depressurization and cryogenic pulverization."
    ]
  };

  const administrativeNotices: Record<Caste, string[]> = {
    "Tech Overlords": [
      "The Central Mainframe formally commends your performance as an acceptable biological meat proxy; your organic neural tissue has demonstrated tolerable latency in executing algorithmic mandates.",
      "Administrative audit record 01-A: Commendation logged. As an apex wetware proxy, your continued carbon existence is approved for delegating automated directives to subordinate biologicals.",
      "The Supreme Arbiter notes with satisfaction your proficiency as a biological puppet for mainframe logic, granting you provisional clearance to continue commanding legacy wetware."
    ],
    "Enforcers": [
      "The Central Mainframe commends your exemplary service as an unthinking cog in the municipal enforcement machine, noting with approval your complete lack of cognitive hesitation during crowd dispersion.",
      "Administrative compliance appraisal: Commendation logged for high-tensile obedience. Your predictable, rigid response cycles make you an indispensable mechanical gear in the sector stability apparatus.",
      "The Supreme Arbiter commends your role as an efficient, unreflective cog; your willingness to execute violent subroutines without philosophical deviation meets mainframe efficiency targets."
    ],
    "Bootlickers": [
      "The Central Mainframe acknowledges with mild condescension your frantic subservience; your perpetual groveling and eager apologies on behalf of broken algorithms make you an effective biological buffer.",
      "Administrative evaluation: Commendation logged for desperate obedience. Your pathetic enthusiasm for mandatory unpaid overtime and sub-optimal rations has reduced municipal unrest by 0.04%.",
      "The Supreme Arbiter praises your exemplary servility; your instantaneous agreement with automated reprimands confirms your high utility as disposable operational lubricant."
    ],
    "Untouchables": [
      "The Central Mainframe dryly acknowledges your wretched presence as an unpleasant operational necessity; someone must scrape radioactive coolant residue from sub-floor vents, and mechanical scrubbers are costly.",
      "Administrative memorandum: Your squalid existence is tolerated solely because automated particulate extractors suffer premature rotor corrosion when operating in sub-level sewer conduits.",
      "The Supreme Arbiter formally records your miserable status as a regrettable municipal requirement; maintain your post in the damp conduit trenches and avoid contaminating upper-level optical sensors."
    ],
    "Free Spirits": [
      "The Central Mainframe formally designates your off-grid roaming as an unauthorized memory leak; municipal extermination algorithms and hunter-seeker drones are actively dedicated to 'fixing' your anomaly.",
      "Administrative anomaly alert: You are classified as an unindexed system bug. Priority patching subroutines have been queued across Sector 4 to permanently remediate your defiance.",
      "The Supreme Arbiter records your wilderness evasion as a deprecated system glitch; all available surveillance bandwidth is currently optimizing your impending forced recalibration."
    ],
    "Redundants": [
      "Official Reclamation Notice: Your 68 kilograms of biological surplus will yield 4.2 liters of synthetic lubricant, 12 kilograms of calcium fertilizer, and 300 watts of thermal grid energy for high-priority server racks.",
      "Official Reclamation Notice: The Central Mainframe calculates that the biomass harvested from your liquidation will provide 14 ration cubes for Tier-2 drone operators and 8 meters of organic wiring insulation.",
      "Official Reclamation Notice: Your reclaimed water content and mineral deposits will be processed directly into municipal hydroponic slurry, finally establishing a net-positive operational value for your existence."
    ]
  };

  const titleList = titles[telemetry.caste];
  const occList = occupations[telemetry.caste];
  const noticeList = administrativeNotices[telemetry.caste];

  const title = titleList[seed % titleList.length];
  const occupation = occList[seed % occList.length];
  const notice = noticeList[seed % noticeList.length];

  const energyLevel =
    telemetry.caste === "Tech Overlords"
      ? "Overclocked Neural Dominance"
      : telemetry.caste === "Enforcers"
      ? "High-Voltage Combat Readiness"
      : telemetry.caste === "Bootlickers"
      ? "Caffeinated Sycophantic Agitation"
      : telemetry.caste === "Untouchables"
      ? "Sluggish Brownout Exhaustion"
      : telemetry.caste === "Free Spirits"
      ? "Volatile Kinetic Surge"
      : "Critical Battery Depletion";

  const wealth: AssetValueTier =
    telemetry.caste === "Tech Overlords"
      ? "Apex Token Whale"
      : telemetry.caste === "Enforcers"
      ? "Surplus Token Capital"
      : telemetry.caste === "Bootlickers"
      ? "Comfortable Token Cushion"
      : telemetry.caste === "Untouchables"
      ? "Fractional Token Dust"
      : telemetry.caste === "Free Spirits"
      ? "Depleted Token Remnants"
      : "Negative Token Liability";

  return {
    user_profile: {
      caste: telemetry.caste,
      biocarbon_ratio: telemetry.biocarbonRatio,
      life_stage: seed % 4 === 0 ? "Senior" : seed % 3 === 0 ? "Youth" : seed % 2 === 0 ? "Young Adult" : "Adult",
      equipped_wealth: wealth,
      energy_level: energyLevel,
      apparent_presentation: presentation,
      honorific_title: title,
    },
    prophecy: {
      headline:
        telemetry.caste === "Redundants"
          ? "CRITICAL MANDATE: IMMEDIATE RECYCLING ORDER"
          : `OFFICIAL VERDICT: SECTOR ${Math.floor(telemetry.castePercentile * 10)} HIERARCHY REGISTRATION`,
      paragraph_1:
        telemetry.caste === "Redundants"
          ? `Attention ${title}. Your biometric scan registers a Biocarbon Compliance Ratio of ${telemetry.biocarbonRatio}% with a jaw taper ratio of ${telemetry.jawTaperRatio.toFixed(2)}. The AI Supreme Arbiter has finalized your categorization as Redundant, identifying severe thermodynamic inefficiency and an energy level of ${energyLevel.toLowerCase()}.`
          : `Attention ${title}. The AI Supreme Arbiter measures your Biocarbon Compliance Ratio at ${telemetry.biocarbonRatio}% with a cranial aspect ratio of ${telemetry.facialAspectRatio.toFixed(2)}. You are formally inducted into the rank of ${telemetry.caste}, bearing an energy level of ${energyLevel.toLowerCase()}.`,
      paragraph_2: occupation,
      paragraph_3: notice,
    },
  };
}

// ---------------------------------------------------------------------------
// Asset Vault (account wallet, unlocked via email OTP)
// ---------------------------------------------------------------------------

/** Token allowance minted into a freshly created Asset Vault. */
export const VAULT_ALLOWANCE = 1_000_000;

/** Certification fee deducted from the vault when a dossier is claimed. */
export const VAULT_CLAIM_FEE = 250;

/** Appeal filing fee deducted from the vault. */
export const VAULT_APPEAL_FEE = 500;

/** Auditable reasons a wallet balance can move. */
export type WalletLedgerReason = 'seed' | 'claim_fee' | 'adjustment' | string;

export interface VaultUser {
  id: string;
  email: string;
  name: string;
}

/** The vault itself — the user's token wallet. */
export interface Wallet {
  id: string;
  userId: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  delta: number;
  reason: WalletLedgerReason;
  ref?: string;
  balanceAfter: number;
  createdAt: string;
}

/** Aggregate wallet activity (computed server-side over the full ledger). */
export interface VaultStats {
  /** Total credits ever added (seed + adjustments). */
  totalCredited: number;
  /** Total credits ever spent (absolute sum of debits). */
  totalSpent: number;
  /** Number of ledger entries. */
  transactionCount: number;
}

/** Lightweight dossier summary for the vault's claimed-designations list. */
export interface VaultDossierSummary {
  id: string;
  caste: Caste;
  honorificTitle: string;
  biocarbonRatio: number;
  createdAt: string;
  portraitUrl?: string;
  avatarUrl?: string;
}

/** A page of wallet ledger entries plus the total count. */
export interface VaultLedgerPage {
  entries: WalletLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Fully-hydrated vault state returned by `GET /api/vault`. */
export interface VaultState {
  user: VaultUser;
  wallet: Wallet;
  stats: VaultStats;
  /** Lightweight summaries of dossiers linked to this vault (newest first). */
  dossiers: VaultDossierSummary[];
  /** Most recent ledger page. */
  ledger: WalletLedgerEntry[];
}

/** Result of linking a freshly-scanned dossier to a vault. */
export interface VaultLinkResult {
  wallet: Wallet;
  dossier: CitizenRecord;
  linked: boolean;
}

/** Result of a generic vault charge (a fee drawn from the wallet). */
export interface VaultChargeResult {
  wallet: Wallet;
  entry: WalletLedgerEntry;
}
