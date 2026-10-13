import { GoogleGenAI } from '@google/genai';
import type { GoogleAuthOptions } from 'google-auth-library';

/**
 * Gemini engine configuration: Google's Vertex AI (billed to the GCP project's
 * Cloud billing account) or the Gemini Developer API (AI Studio billing via an
 * API key). Both share the same `@google/genai` SDK — only auth + endpoint
 * change (`aiplatform.googleapis.com` vs `generativelanguage.googleapis.com`).
 *
 * Mode resolution (GEMINI_MODE overrides auto-detection):
 *  - 'vertex' → GEMINI_PROJECT + either GCP_SA_KEY (inline service-account JSON)
 *               or GOOGLE_APPLICATION_CREDENTIALS / ambient ADC.
 *  - 'api'    → GEMINI_API_KEY.
 *  - 'off'    → deterministic local simulation (see lore/simulate).
 */

/**
 * Default endpoint location: the Vertex global endpoint (`global`). Gemini 3.x
 * models (and image generation) are currently served regionally only in a
 * subset of regions — as of Oct 2026 `gemini-3.8-flash` and
 * `gemini-2.5-flash-image` return NOT_FOUND on `asia-southeast1` and other
 * regional endpoints, while the global endpoint serves them. Set
 * GEMINI_LOCATION to a regional endpoint (e.g. `asia-southeast1`, Singapore)
 * once the models you use are available there.
 */
export const DEFAULT_GEMINI_LOCATION = 'global';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export type GeminiMode = 'vertex' | 'api' | 'off';

export function resolveGeminiMode(env: NodeJS.ProcessEnv = process.env): GeminiMode {
  const explicit = (env.GEMINI_MODE || '').toLowerCase();
  if (explicit === 'vertex' || explicit === 'api' || explicit === 'off') return explicit;

  const hasVertexCreds = !!(env.GCP_SA_KEY || env.GOOGLE_APPLICATION_CREDENTIALS);
  if (env.GEMINI_PROJECT && hasVertexCreds) return 'vertex';
  if (env.GEMINI_API_KEY) return 'api';
  return 'off';
}

export function getGeminiProject(env: NodeJS.ProcessEnv = process.env): string {
  const project = env.GEMINI_PROJECT;
  if (!project) throw new Error('GEMINI_PROJECT is required for Vertex AI mode');
  return project;
}

export function getGeminiLocation(env: NodeJS.ProcessEnv = process.env): string {
  return env.GEMINI_LOCATION || DEFAULT_GEMINI_LOCATION;
}

export function getGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

/**
 * Inline service-account JSON (GCP_SA_KEY) wins over ADC. When neither is
 * given, google-auth-library itself resolves GOOGLE_APPLICATION_CREDENTIALS,
 * `gcloud` ADC, or the metadata server — so callers may pass nothing.
 */
export function buildGoogleAuthOptions(env: NodeJS.ProcessEnv = process.env): GoogleAuthOptions | undefined {
  if (env.GCP_SA_KEY) {
    try {
      return { credentials: JSON.parse(env.GCP_SA_KEY) as GoogleAuthOptions['credentials'] };
    } catch {
      throw new Error('GCP_SA_KEY must be a valid service-account JSON string');
    }
  }
  return undefined;
}

/** True when a real Gemini engine (either mode) is reachable instead of simulation. */
export function geminiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveGeminiMode(env) !== 'off';
}

/** Human-readable engine status for boot logs / health output. */
export function geminiModeLabel(env: NodeJS.ProcessEnv = process.env): string {
  const mode = resolveGeminiMode(env);
  if (mode === 'vertex') {
    return `Vertex AI · ${getGeminiProject(env)} · ${getGeminiLocation(env)} (billed via Google Cloud)`;
  }
  if (mode === 'api') return 'Gemini Developer API · AI Studio billing';
  return 'offline simulation';
}

let cachedClient: GoogleGenAI | null = null;

/**
 * Shared, memoized client for every Gemini call in the server (oracle verdict,
 * appeal ruling, re-arbitration). Pass env explicitly in
 * tests; production always uses process.env.
 */
export function createGeminiClient(env: NodeJS.ProcessEnv = process.env): GoogleGenAI {
  if (cachedClient) return cachedClient;

  const mode = resolveGeminiMode(env);
  let client: GoogleGenAI;
  if (mode === 'vertex') {
    const googleAuthOptions = buildGoogleAuthOptions(env);
    client = new GoogleGenAI({
      vertexai: true,
      project: getGeminiProject(env),
      location: getGeminiLocation(env),
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });
  } else if (mode === 'api') {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for api-key mode');
    client = new GoogleGenAI({ apiKey });
  } else {
    throw new Error('Gemini client requested while the engine is offline — check geminiConfigured() first');
  }

  cachedClient = client;
  return client;
}

/** Test helper: forget the memoized client so a new env can take effect. */
export function resetGeminiClient(): void {
  cachedClient = null;
}