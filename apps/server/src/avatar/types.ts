import type { AvatarEngineId, UserProfile } from '@ecocide/types';

export interface AvatarGenerationInput {
  image: string; // Base64 reference image (with or without data URL prefix)
  userProfile: UserProfile;
  apiKey?: string;
  targetSize?: number; // default 256
}

export interface ApiCallUsage {
  model: string;
  provider: string;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface AvatarGenerationResult {
  avatarUrl: string; // data:image/png;base64,... or data:image/svg+xml;utf8,...
  format: 'png' | 'svg' | 'webp';
  engineId: AvatarEngineId | string;
  sizeBytes: number;
  usage?: ApiCallUsage;
}

export interface AvatarProvider {
  readonly id: string;
  readonly name: string;
  readonly outputType: 'raster' | 'svg';
  generate(input: AvatarGenerationInput): Promise<AvatarGenerationResult>;
}

export function cleanBase64(imageBase64: string): { cleanBase64: string; mimeType: string } {
  let mimeType = 'image/jpeg';
  let cleanData = imageBase64;
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    const mimeMatch = parts[0].match(/:(.*?)$/);
    if (mimeMatch) mimeType = mimeMatch[1];
    cleanData = parts[1];
  }
  return { cleanBase64: cleanData, mimeType };
}

export function getCasteStylePrompt(caste: string): string {
  switch (caste) {
    case 'Tech Overlords':
      return 'Ornate neural cyberware, polished golden and violet cyber implants, glowing cyan ocular iris, sleek nano-fiber executive armor with high collar, holographic crest, subtle quantum energy field.';
    case 'Enforcers':
      return 'Heavy matte-black tactical battle armor, angular orange HUD targeting monocle, reinforced cybernetic jaw, sub-dermal combat plating, militaristic grim determination.';
    case 'Bootlickers':
      return 'Corporate compliance collar with pulsating green status indicator, bureaucratic data tether, nervous obedient grin, pressed synthetic corporate uniform, submissive posture.';
    case 'Untouchables':
      return 'Scavenged rusted optical lens, exposed copper wiring, jury-rigged cyberware, weathered thermal hood, soot stains, dim flickering amber glow, hardened survivor glare.';
    case 'Free Spirits':
      return 'Bioluminescent geometric facial markings, scavenged solar goggles, wild hair, organic vine-woven cyber implants, defiant wild smirk, glowing turquoise and magenta hues.';
    case 'Redundants':
    default:
      return 'Red barcode decommission tattoo stamped on cheek or neck, cracked terminal visor, fading utilitarian jumpsuit, glitching holographic noise, exhausted yet resilient expression.';
  }
}
