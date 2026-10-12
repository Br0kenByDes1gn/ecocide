import { describe, expect, it } from 'vitest';
import { avatarRegistry } from './registry.js';
import type { AvatarProvider } from './types.js';

describe('AvatarProviderRegistry', () => {
  it('registers out-of-the-box providers', () => {
    const list = avatarRegistry.list();
    const ids = list.map((p) => p.id);

    expect(ids).toContain('gemini-image-vector');
    expect(ids).toContain('gemini-image-pixel');
    expect(ids).toContain('gemini-text-svg');
  });

  it('retrieves default or specific provider', () => {
    const vectorProvider = avatarRegistry.get('gemini-image-vector');
    expect(vectorProvider).toBeDefined();
    expect(vectorProvider.outputType).toBe('raster');

    const svgProvider = avatarRegistry.get('gemini-text-svg');
    expect(svgProvider).toBeDefined();
    expect(svgProvider.outputType).toBe('svg');
  });

  it('allows registering a third-party non-Google provider seamlessly', () => {
    const mockCustomProvider: AvatarProvider = {
      id: 'custom-sdxl-neural',
      name: 'Custom SDXL High-Speed Neural',
      outputType: 'raster',
      generate: async () => ({
        avatarUrl: 'data:image/png;base64,customSdxlAvatar',
        format: 'png',
        engineId: 'custom-sdxl-neural',
        sizeBytes: 1024,
      }),
    };

    avatarRegistry.register(mockCustomProvider);
    const retrieved = avatarRegistry.get('custom-sdxl-neural');
    expect(retrieved).toBe(mockCustomProvider);
    expect(retrieved.name).toBe('Custom SDXL High-Speed Neural');
  });
});
