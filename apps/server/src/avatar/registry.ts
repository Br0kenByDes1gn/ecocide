import type { AvatarEngineId, UserProfile } from '@ecocide/types';
import { GeminiImageProvider } from './gemini-image-provider.js';
import { GeminiTextSvgProvider } from './gemini-text-svg-provider.js';
import type { AvatarGenerationInput, AvatarGenerationResult, AvatarProvider } from './types.js';

class AvatarProviderRegistry {
  private providers = new Map<string, AvatarProvider>();

  constructor() {
    // Register standard out-of-the-box providers
    this.register(new GeminiImageProvider('vector'));
    this.register(new GeminiImageProvider('pixel'));
    this.register(new GeminiTextSvgProvider());
  }

  register(provider: AvatarProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`[AvatarRegistry] Registered provider: ${provider.name} (${provider.id})`);
  }

  get(id?: string): AvatarProvider {
    const defaultId = process.env.AVATAR_ENGINE || 'gemini-text-svg';
    const targetId = id || defaultId;
    const provider = this.providers.get(targetId);

    if (!provider) {
      console.warn(`[AvatarRegistry] Provider "${targetId}" not found, falling back to default.`);
      return this.providers.get('gemini-text-svg') || Array.from(this.providers.values())[0];
    }

    return provider;
  }

  list(): Array<{ id: string; name: string; outputType: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      outputType: p.outputType,
    }));
  }
}

export const avatarRegistry = new AvatarProviderRegistry();

export async function synthesizeAvatar(
  input: AvatarGenerationInput,
  engineId?: string
): Promise<AvatarGenerationResult> {
  const provider = avatarRegistry.get(engineId);
  console.log(`[AvatarEngine] Dispatching avatar synthesis to "${provider.name}" (${provider.id})...`);
  return await provider.generate(input);
}
