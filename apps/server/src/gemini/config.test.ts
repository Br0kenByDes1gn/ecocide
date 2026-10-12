import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_GEMINI_LOCATION,
  DEFAULT_GEMINI_MODEL,
  buildGoogleAuthOptions,
  createGeminiClient,
  geminiConfigured,
  geminiModeLabel,
  getGeminiLocation,
  getGeminiModel,
  getGeminiProject,
  resetGeminiClient,
  resolveGeminiMode,
} from './config.js';

const SA_KEY_JSON = JSON.stringify({ type: 'service_account', project_id: 'ecocide-test', client_email: 'sa@ecocide-test.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n' });

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides };
}

beforeEach(() => {
  resetGeminiClient();
});

describe('resolveGeminiMode (auto-detection)', () => {
  it('defaults to offline when nothing is configured', () => {
    expect(resolveGeminiMode(env({}))).toBe('off');
  });

  it('picks api mode when an API key is present', () => {
    expect(resolveGeminiMode(env({ GEMINI_API_KEY: 'AIza-test' }))).toBe('api');
  });

  it('picks vertex mode when project + inline SA key are present', () => {
    expect(resolveGeminiMode(env({ GEMINI_PROJECT: 'p1', GCP_SA_KEY: SA_KEY_JSON }))).toBe('vertex');
  });

  it('picks vertex mode when project + ADC file path are present', () => {
    expect(resolveGeminiMode(env({ GEMINI_PROJECT: 'p1', GOOGLE_APPLICATION_CREDENTIALS: '/tmp/sa.json' }))).toBe('vertex');
  });

  it('stays offline with a project but no credentials', () => {
    expect(resolveGeminiMode(env({ GEMINI_PROJECT: 'p1' }))).toBe('off');
  });

  it('honors the explicit GEMINI_MODE override', () => {
    expect(resolveGeminiMode(env({ GEMINI_MODE: 'vertex' }))).toBe('vertex');
    expect(resolveGeminiMode(env({ GEMINI_MODE: 'off', GEMINI_API_KEY: 'AIza-test' }))).toBe('off');
  });
});

describe('endpoint defaults', () => {
  it('defaults to the global endpoint when GEMINI_LOCATION is unset', () => {
    expect(DEFAULT_GEMINI_LOCATION).toBe('global');
    expect(getGeminiLocation(env({}))).toBe('global');
  });

  it('honors an explicit GEMINI_LOCATION override', () => {
    expect(getGeminiLocation(env({ GEMINI_LOCATION: 'asia-southeast1' }))).toBe('asia-southeast1');
    expect(getGeminiLocation(env({ GEMINI_LOCATION: 'us-central1' }))).toBe('us-central1');
  });

  it('defaults the model to gemini-3.8-flash and allows an override', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.8-flash');
    expect(getGeminiModel(env({}))).toBe('gemini-3.8-flash');
    expect(getGeminiModel(env({ GEMINI_MODEL: 'gemini-2.5-flash' }))).toBe('gemini-2.5-flash');
  });

  it('requires GEMINI_PROJECT in vertex mode', () => {
    expect(() => getGeminiProject(env({}))).toThrow('GEMINI_PROJECT');
    expect(getGeminiProject(env({ GEMINI_PROJECT: 'p1' }))).toBe('p1');
  });
});

describe('buildGoogleAuthOptions', () => {
  it('parses inline service-account JSON', () => {
    const opts = buildGoogleAuthOptions(env({ GCP_SA_KEY: SA_KEY_JSON }));
    expect(opts?.credentials).toMatchObject({ project_id: 'ecocide-test' });
  });

  it('throws on malformed GCP_SA_KEY', () => {
    expect(() => buildGoogleAuthOptions(env({ GCP_SA_KEY: 'not-json' }))).toThrow('valid service-account JSON');
  });

  it('returns undefined when only ADC is configured (resolved by google-auth-library)', () => {
    expect(buildGoogleAuthOptions(env({ GOOGLE_APPLICATION_CREDENTIALS: '/tmp/sa.json' }))).toBeUndefined();
  });
});

describe('createGeminiClient', () => {
  it('builds an api-key client without throwing', () => {
    const client = createGeminiClient(env({ GEMINI_API_KEY: 'AIza-test' }));
    expect(client).toBeDefined();
  });

  it('builds a vertex client with project + location + credentials without throwing', () => {
    const client = createGeminiClient(
      env({ GEMINI_PROJECT: 'ecocide-test', GEMINI_LOCATION: 'asia-southeast1', GCP_SA_KEY: SA_KEY_JSON })
    );
    expect(client).toBeDefined();
  });

  it('builds a vertex client relying on ADC when no inline key is given', () => {
    const client = createGeminiClient(
      env({ GEMINI_PROJECT: 'ecocide-test', GOOGLE_APPLICATION_CREDENTIALS: '/tmp/sa.json' })
    );
    expect(client).toBeDefined();
  });

  it('throws in offline mode', () => {
    expect(() => createGeminiClient(env({}))).toThrow(/offline/i);
  });

  it('memoizes the client across calls', () => {
    resetGeminiClient();
    const a = createGeminiClient(env({ GEMINI_API_KEY: 'k' }));
    const b = createGeminiClient(env({ GEMINI_API_KEY: 'k' }));
    expect(a).toBe(b);
  });
});

describe('status helpers', () => {
  it('geminiConfigured is false only in offline mode', () => {
    expect(geminiConfigured(env({}))).toBe(false);
    expect(geminiConfigured(env({ GEMINI_API_KEY: 'k' }))).toBe(true);
    expect(geminiConfigured(env({ GEMINI_PROJECT: 'p', GCP_SA_KEY: SA_KEY_JSON }))).toBe(true);
  });

  it('geminiModeLabel names the active billing path', () => {
    expect(geminiModeLabel(env({}))).toContain('simulation');
    expect(geminiModeLabel(env({ GEMINI_API_KEY: 'k' }))).toContain('AI Studio');
    expect(geminiModeLabel(env({ GEMINI_PROJECT: 'p1', GCP_SA_KEY: SA_KEY_JSON }))).toContain('Vertex AI · p1 · global');
  });
});