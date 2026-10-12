import { GoogleGenAI } from '@google/genai';
import {
  type AvatarGenerationInput,
  type AvatarGenerationResult,
  type AvatarProvider,
  cleanBase64,
  getCasteStylePrompt,
} from './types.js';
import { calculateApiCost } from '../cost.js';
import { getCasteLifeStageTitle } from '@ecocide/types';
import { createGeminiClient, getGeminiModel } from '../gemini/config.js';

export class GeminiTextSvgProvider implements AvatarProvider {
  readonly id = 'gemini-text-svg';
  readonly name = 'Gemini 3.8 Flash (Text-to-SVG)';
  readonly outputType = 'svg' as const;

  async generate(input: AvatarGenerationInput): Promise<AvatarGenerationResult> {
    const { image, userProfile, targetSize = 256 } = input;

    const ai = createGeminiClient();
    const model = getGeminiModel();
    const { cleanBase64: photoData, mimeType } = cleanBase64(image);
    const casteLore = getCasteStylePrompt(userProfile.caste);

    const prompt = `
You are an elite dystopian vector graphics engineer and cyber-interface designer.
Create a complete, self-contained, valid SVG image depicting a stylized cyberpunk avatar badge for this citizen.

Citizen Biometrics & Traits:
- Caste: "${userProfile.caste}"
- Honorific Title: "${userProfile.honorific_title}"
- Apparent Presentation: "${userProfile.apparent_presentation}"
- Utility Grade: "${userProfile.life_stage}" (${getCasteLifeStageTitle(userProfile.caste, userProfile.life_stage)})
- Asset Value: "${userProfile.equipped_wealth}"
- Energy Level: "${userProfile.energy_level}"

Caste Visual Implants & Palette:
${casteLore}

CRITICAL SVG SPECIFICATIONS:
1. Root element MUST BE: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetSize} ${targetSize}" width="100%" height="100%">
2. Include <defs> with linear/radial gradients and neon glow filters (feGaussianBlur).
3. Draw a dark cyberpunk hexagonal or tech-bracket background frame (#06080d to #0d131f).
4. Draw the citizen portrait inside:
   - Approximate facial silhouette, hair cut/parting, and gaze expression observed in the reference photo.
   - Adorn with visible cybernetic implants: ocular HUD lenses, circuit traces, neon neck collar, tech brackets.
   - Use vibrant neon cyan, electric violet, amber or caste-specific colors.
   - Display a small high-tech HUD stamp at top or bottom (e.g. "// SECTOR: ${userProfile.caste.toUpperCase()}").
5. Return ONLY the raw valid SVG markup starting with <svg and ending with </svg>.
6. DO NOT wrap with markdown backticks or explanations. Output pure SVG XML only.
`;

    const startTime = performance.now();
    const response = await ai.models.generateContent({
      model,
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
      config: {
        temperature: 0.8,
      },
    });

    const durationMs = Math.round(performance.now() - startTime);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);

    if (!svgMatch) {
      throw new Error('Failed to parse valid SVG element from model output');
    }

    let svgContent = svgMatch[0].trim();
    // Ensure viewBox is set
    if (!svgContent.includes('viewBox')) {
      svgContent = svgContent.replace('<svg', `<svg viewBox="0 0 ${targetSize} ${targetSize}"`);
    }

    const encodedSvg = encodeURIComponent(svgContent)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');

    const avatarUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
    const sizeBytes = Buffer.byteLength(svgContent, 'utf8');

    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
    const thoughtsTokens = (response.usageMetadata as any)?.thoughtsTokenCount || 0;
    const totalTokens = response.usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens + thoughtsTokens);

    const cost = calculateApiCost(model, {
      promptTokens,
      candidatesTokens,
      thoughtsTokens,
    });

    return {
      avatarUrl,
      format: 'svg',
      engineId: this.id,
      sizeBytes,
      usage: {
        model,
        provider: 'google',
        promptTokens,
        candidatesTokens,
        thoughtsTokens,
        totalTokens,
        costUsd: cost.totalCostUsd,
        durationMs,
      },
    };
  }
}
