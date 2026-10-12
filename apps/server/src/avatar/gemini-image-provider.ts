import sharp from 'sharp';
import {
  type AvatarGenerationInput,
  type AvatarGenerationResult,
  type AvatarProvider,
  cleanBase64,
  getCasteStylePrompt,
} from './types.js';
import { calculateApiCost } from '../cost.js';
import { getCasteLifeStageTitle } from '@ecocide/types';
import { createGeminiClient } from '../gemini/config.js';

export class GeminiImageProvider implements AvatarProvider {
  readonly id: string;
  readonly name: string;
  readonly outputType = 'raster' as const;
  private style: 'vector' | 'pixel';

  constructor(style: 'vector' | 'pixel') {
    this.style = style;
    this.id = style === 'vector' ? 'gemini-image-vector' : 'gemini-image-pixel';
    this.name = style === 'vector' ? 'Gemini 2.5 Image (Flat Vector)' : 'Gemini 2.5 Image (32-Bit Pixel)';
  }

  async generate(input: AvatarGenerationInput): Promise<AvatarGenerationResult> {
    const { image, userProfile, targetSize = 256 } = input;

    const ai = createGeminiClient();
    const { cleanBase64: photoData, mimeType } = cleanBase64(image);
    const castePrompt = getCasteStylePrompt(userProfile.caste);

    let styleInstruction = '';
    if (this.style === 'vector') {
      styleInstruction = `
Style: Crisp cyberpunk flat vector graphic avatar badge, 256x256 icon aesthetic.
- Modern cel-shaded vector art with clean sharp outlines and minimalist cybernetic details.
- Bold neon rim lighting, saturated cybernetic accent colors, clean dark high-tech background.
- Retain recognizable facial resemblance, hair silhouette, and expression from the reference image.
- Avoid hyper-photorealism; aim for premium cyberpunk vector character illustration.`;
    } else {
      styleInstruction = `
Style: Authentic 32-bit retro cyberpunk pixel art avatar badge, 256x256 icon aesthetic.
- Sharp pixel clusters, retro arcade terminal dithering, glowing neon pixels.
- Pixelated cybernetic implants, glowing ocular eyepiece, dark digital matrix grid background.
- Retain recognizable facial structure, hair silhouette, and expression from the reference photo in clean pixel art.
- Crisp 16/32-bit video game character portrait aesthetic.`;
    }

    const prompt = `
Task: Transform this person's portrait into a high-tier cyberpunk avatar badge for a future AI-dominated society.

Citizen Telemetry:
- Caste: "${userProfile.caste}"
- Honorific Title: "${userProfile.honorific_title}"
- Apparent Presentation: "${userProfile.apparent_presentation}"
- Utility Grade: "${userProfile.life_stage}" (${getCasteLifeStageTitle(userProfile.caste, userProfile.life_stage)})
- Asset Value: "${userProfile.equipped_wealth}"
- Energy Level: "${userProfile.energy_level}"

Caste Implants & Lore:
${castePrompt}

${styleInstruction}
`;

    const startTime = performance.now();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: photoData,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const durationMs = Math.round(performance.now() - startTime);
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image was returned by Gemini Image model');
    }

    const rawBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

    // Resize down to exactly 256x256 and compress to compact PNG
    const resizedBuffer = await sharp(rawBuffer)
      .resize(targetSize, targetSize, {
        fit: 'cover',
        position: 'center',
      })
      .png({ compressionLevel: 9, effort: 7 })
      .toBuffer();

    const base64Out = resizedBuffer.toString('base64');
    const avatarUrl = `data:image/png;base64,${base64Out}`;

    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = response.usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens);

    const cost = calculateApiCost('gemini-2.5-flash-image', {
      promptTokens,
      candidatesTokens,
    });

    return {
      avatarUrl,
      format: 'png',
      engineId: this.id,
      sizeBytes: resizedBuffer.length,
      usage: {
        model: 'gemini-2.5-flash-image',
        provider: 'google',
        promptTokens,
        candidatesTokens,
        thoughtsTokens: 0,
        totalTokens,
        costUsd: cost.totalCostUsd,
        durationMs,
      },
    };
  }
}
