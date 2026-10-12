import type { AvatarEngineId, UserProfile } from '@ecocide/types';
import { getFaction } from '@ecocide/lore';

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
  return getFaction(caste).stylePrompt;
}
