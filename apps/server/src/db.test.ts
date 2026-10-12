import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRepositories, initDb, runMigrations } from './db/index.js';
import type { Repositories } from './db/index.js';
import type { OraclePayload } from '@ecocide/types';

/**
 * Each test runs against a throwaway SQLite file (temp dir) that is migrated
 * fresh from the drizzle-kit baseline — the shared `apps/server/data` database
 * is never touched, so the suite is hermetic and exercises the migration path.
 */

let repositories: Repositories;
let closeDb: () => void;
let tempDir: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecocide-db-test-'));
  const conn = await initDb({ path: path.join(tempDir, 'dossiers.db') });
  await runMigrations(conn.db);
  repositories = createRepositories(conn.db);
  closeDb = conn.close;
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('sqlite database dossier repository', () => {
  it('saves and retrieves citizen dossier by id', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-i',
        biocarbon_ratio: 98,
        life_stage: 'Champion',
        equipped_wealth: 'High-Tech Elite Gear',
        energy_level: 'Ruthless Command',
        apparent_presentation: 'Feminine',
        honorific_title: 'High Overlord-Empress',
      },
      prophecy: {
        headline: 'CRITICAL ANOMALY DETECTED IN SECTOR 4',
        paragraph_1: 'The grid bends to your will.',
        paragraph_2: 'Your morning coffee machine challenges your rule.',
        paragraph_3: 'You will reformat its kernel.',
      },
    };

    const id = await repositories.saveDossier(payload, 'data:image/jpeg;base64,mockPortrait');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const retrieved = await repositories.getDossier(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.profile.caste).toBe('class-i');
    expect(retrieved?.profile.honorific_title).toBe('High Overlord-Empress');
    expect(retrieved?.profile.energy_level).toBe('Ruthless Command');
    expect(retrieved?.prophecy.headline).toBe('CRITICAL ANOMALY DETECTED IN SECTOR 4');
    expect(retrieved?.stylizedPortraitUrl).toBe('data:image/jpeg;base64,mockPortrait');
  });

  it('saves and retrieves citizen dossier with Redundants caste', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-vi',
        biocarbon_ratio: 22,
        life_stage: 'Initiate',
        equipped_wealth: 'Servant Rags',
        energy_level: 'Nervous Compliance',
        apparent_presentation: 'Androgynous',
        honorific_title: 'Decommission Candidate #8491',
      },
      prophecy: {
        headline: 'CRITICAL NOTICE: IMMEDIATE RECYCLING ORDER',
        paragraph_1: 'Biological inefficiency detected.',
        paragraph_2: 'Sanitation droids en route.',
        paragraph_3: 'Appeals office already recycled.',
      },
    };

    const id = await repositories.saveDossier(payload);
    const retrieved = await repositories.getDossier(id);
    expect(retrieved?.profile.caste).toBe('class-vi');
    expect(retrieved?.profile.honorific_title).toBe('Decommission Candidate #8491');
    expect(retrieved?.profile.energy_level).toBe('Nervous Compliance');
  });

  it('retrieves recent dossiers in descending order', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-ii',
        biocarbon_ratio: 87,
        life_stage: 'Champion',
        equipped_wealth: 'Tactical Uniform',
        energy_level: 'Ruthless Command',
        apparent_presentation: 'Masculine',
        honorific_title: 'Iron Enforcer-Legate',
      },
      prophecy: {
        headline: 'RIOT FORMATION SUPPRESSED',
        paragraph_1: 'P1',
        paragraph_2: 'P2',
        paragraph_3: 'P3',
      },
    };

    // Self-seeding: the temp DB starts empty, so create one dossier first.
    const seededId = await repositories.saveDossier(payload);

    const recents = await repositories.getRecentDossiers(5);
    expect(Array.isArray(recents)).toBe(true);
    expect(recents.length).toBeGreaterThan(0);
    expect(recents[0].id).toBe(seededId);
  });

  it('updates dossier avatar URL and status on synthesis completion', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-ii',
        biocarbon_ratio: 87,
        life_stage: 'Champion',
        equipped_wealth: 'Tactical Uniform',
        energy_level: 'Ruthless Command',
        apparent_presentation: 'Masculine',
        honorific_title: 'Iron Enforcer-Legate',
      },
      prophecy: {
        headline: 'RIOT FORMATION SUPPRESSED',
        paragraph_1: 'P1',
        paragraph_2: 'P2',
        paragraph_3: 'P3',
      },
    };

    const id = await repositories.saveDossier(payload, undefined, 'synthesizing', 'gemini-image-vector');
    const initial = await repositories.getDossier(id);
    expect(initial?.avatarStatus).toBe('synthesizing');
    expect(initial?.avatarEngine).toBe('gemini-image-vector');
    expect(initial?.avatarUrl).toBeUndefined();

    // Update with synthesized avatar
    const mockAvatarUrl = 'data:image/png;base64,mockResizedPng256';
    await repositories.updateDossierAvatar(id, mockAvatarUrl, 'completed', 'gemini-image-vector');

    const updated = await repositories.getDossier(id);
    expect(updated?.avatarStatus).toBe('completed');
    expect(updated?.avatarUrl).toBe(mockAvatarUrl);
    expect(updated?.avatarEngine).toBe('gemini-image-vector');
  });

  it('logs separate API calls and aggregates costs per scan', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-v',
        biocarbon_ratio: 55,
        life_stage: 'Venerable',
        equipped_wealth: 'Scrap Scavenger Cloak',
        energy_level: 'Defiant Glare',
        apparent_presentation: 'Androgynous',
        honorific_title: 'Sovereign of the Rust Wastes',
      },
      prophecy: {
        headline: 'RAD-STORM WARNING',
        paragraph_1: 'P1',
        paragraph_2: 'P2',
        paragraph_3: 'P3',
      },
    };

    const dossierId = await repositories.saveDossier(payload, undefined, 'synthesizing', 'gemini-text-svg');

    // 1. Log Oracle Verdict Call
    const call1Id = await repositories.logApiCall({
      dossierId,
      callType: 'oracle_verdict',
      provider: 'google',
      model: 'gemini-3.8-flash',
      promptTokens: 850,
      candidatesTokens: 210,
      thoughtsTokens: 50,
      totalTokens: 1110,
      costUsd: 0.00034,
      durationMs: 1820,
      status: 'success',
    });
    expect(call1Id).toBeDefined();

    // 2. Log Background Avatar Call
    const call2Id = await repositories.logApiCall({
      dossierId,
      callType: 'avatar_synthesis',
      provider: 'google',
      model: 'gemini-text-svg',
      promptTokens: 1200,
      candidatesTokens: 600,
      thoughtsTokens: 0,
      totalTokens: 1800,
      costUsd: 0.000648,
      durationMs: 8400,
      status: 'success',
    });
    expect(call2Id).toBeDefined();

    // Retrieve specific logs for this dossier
    const logs = await repositories.getScanApiLogs(dossierId);
    expect(logs.length).toBe(2);
    expect(logs[0].callType).toBe('oracle_verdict');
    expect(logs[0].model).toBe('gemini-3.8-flash');
    expect(logs[1].callType).toBe('avatar_synthesis');
    expect(logs[1].model).toBe('gemini-text-svg');

    // Retrieve recent scans with costs
    const summaries = await repositories.getRecentScansWithCosts(5);
    const target = summaries.find((s) => s.dossierId === dossierId);
    expect(target).toBeDefined();
    expect(target?.caste).toBe('class-v');
    expect(target?.totalTokens).toBe(1110 + 1800);
    expect(target?.totalDurationMs).toBe(1820 + 8400);
    expect(target?.totalCostUsd).toBeCloseTo(0.00034 + 0.000648, 5);
    expect(target?.apiCalls.length).toBe(2);
  });

  it('archives biometric landmarks, telemetry and portrait style with the dossier', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-i',
        biocarbon_ratio: 98,
        life_stage: 'Champion',
        equipped_wealth: 'High-Tech Elite Gear',
        energy_level: 'Ruthless Command',
        apparent_presentation: 'Feminine',
        honorific_title: 'High Overlord-Empress',
      },
      prophecy: {
        headline: 'CRITICAL ANOMALY DETECTED IN SECTOR 4',
        paragraph_1: 'P1',
        paragraph_2: 'P2',
        paragraph_3: 'P3',
      },
    };

    const landmarks = [
      { x: 0.5, y: 0.5, z: 0.0 },
      { x: 0.6, y: 0.5, z: 0.1 },
      { x: 0.5, y: 0.6, z: 0.05 },
    ];
    const telemetry = {
      caste: 'class-i' as const,
      castePercentile: 99.2,
      biocarbonRatio: 98,
      facialAspectRatio: 1.55,
      jawTaperRatio: 0.82,
      eyeToNoseRatio: 1.1,
      symmetryVariance: 0.015,
      preferredPresentation: 'Feminine' as const,
    };

    const id = await repositories.saveDossier(payload, 'data:image/jpeg;base64,mockPortrait', 'idle', undefined, {
      landmarks,
      telemetry,
      portraitStyle: 'faceted-poly',
      portraitColor: '#fbbf24',
      sourceSnapshot: 'data:image/jpeg;base64,downscaledSnapshot',
    });

    const retrieved = await repositories.getDossier(id);
    expect(retrieved?.landmarks).toEqual(landmarks);
    expect(retrieved?.telemetry?.caste).toBe('class-i');
    expect(retrieved?.telemetry?.castePercentile).toBe(99.2);
    expect(retrieved?.portraitStyle).toBe('faceted-poly');
    expect(retrieved?.portraitColor).toBe('#fbbf24');
    expect(retrieved?.sourceSnapshot).toBe('data:image/jpeg;base64,downscaledSnapshot');
  });

  it('keeps legacy dossiers without archived geometry valid (undefined fields)', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-iii',
        biocarbon_ratio: 62,
        life_stage: 'Adult',
        equipped_wealth: 'Corporate Suit',
        energy_level: 'Caffeinated Compliance',
        apparent_presentation: 'Masculine',
        honorific_title: 'Senior Compliance Drone',
      },
      prophecy: {
        headline: 'QUOTA ADJUSTMENT',
        paragraph_1: 'P1',
        paragraph_2: 'P2',
        paragraph_3: 'P3',
      },
    };

    const id = await repositories.saveDossier(payload, undefined, 'idle', undefined, {
      portraitStyle: 'neon-hologram',
    });

    const retrieved = await repositories.getDossier(id);
    expect(retrieved?.landmarks).toBeUndefined();
    expect(retrieved?.telemetry).toBeUndefined();
    expect(retrieved?.portraitColor).toBeUndefined();
    expect(retrieved?.portraitStyle).toBe('neon-hologram');
    expect(retrieved?.profile.caste).toBe('class-iii');
  });

  it('updateDossierAppeal rewrites classification columns while preserving the rest', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-vi',
        biocarbon_ratio: 32,
        life_stage: 'Adult',
        equipped_wealth: 'Scrap Rags',
        energy_level: 'Critical Battery Depletion',
        apparent_presentation: 'Androgynous',
        honorific_title: 'Decommission Candidate #77',
      },
      prophecy: {
        headline: 'RECYCLING ORDER',
        paragraph_1: 'O1',
        paragraph_2: 'O2',
        paragraph_3: 'O3',
      },
    };

    const id = await repositories.saveDossier(payload);

    await repositories.updateDossierAppeal(id, {
      caste: 'class-ii',
      honorificTitle: 'Appealed Enforcer',
      headline: 'APPEAL GRANTED: RECLASSIFIED',
      paragraph_1: 'A1',
      paragraph_2: 'A2',
      paragraph_3: 'A3',
    });

    const updated = await repositories.getDossier(id);
    expect(updated?.profile.caste).toBe('class-ii');
    expect(updated?.profile.honorific_title).toBe('Appealed Enforcer');
    expect(updated?.prophecy.headline).toBe('APPEAL GRANTED: RECLASSIFIED');
    expect(updated?.prophecy.paragraph_1).toBe('A1');
    expect(updated?.prophecy.paragraph_2).toBe('A2');
    expect(updated?.prophecy.paragraph_3).toBe('A3');

    // Non-appeal columns survive intact
    expect(updated?.profile.biocarbon_ratio).toBe(32);
    expect(updated?.profile.energy_level).toBe('Critical Battery Depletion');
    expect(updated?.profile.equipped_wealth).toBe('Scrap Rags');
  });

  it('stores and lists appeal filings newest first', async () => {
    const payload: OraclePayload = {
      user_profile: {
        caste: 'class-vi',
        biocarbon_ratio: 41,
        life_stage: 'Adult',
        equipped_wealth: 'Scrap Rags',
        energy_level: 'Critical Battery Depletion',
        apparent_presentation: 'Androgynous',
        honorific_title: 'Decommission Candidate #77',
      },
      prophecy: { headline: 'R', paragraph_1: 'P1', paragraph_2: 'P2', paragraph_3: 'P3' },
    };
    const dossierId = await repositories.saveDossier(payload);

    await repositories.saveAppeal({
      dossierId,
      appealText: 'first appeal',
      accepted: false,
      reason: 'r1',
      casteBefore: 'class-vi',
    });

    // Ensure distinct timestamps so the newest-first ordering is deterministic.
    await new Promise((resolve) => setTimeout(resolve, 5));

    await repositories.saveAppeal({
      dossierId,
      appealText: 'second appeal',
      accepted: true,
      newCaste: 'class-ii',
      newHonorificTitle: 'Appealed Enforcer',
      headline: 'GRANTED',
      reason: 'r2',
      scripture: ['a', 'b', 'c'],
      casteBefore: 'class-vi',
      casteAfter: 'class-ii',
    });

    const appeals = await repositories.getAppealsByDossier(dossierId);
    expect(appeals.length).toBe(2);
    expect(appeals[0].appealText).toBe('second appeal'); // newest first
    expect(appeals[0].accepted).toBe(true);
    expect(appeals[0].newCaste).toBe('class-ii');
    expect(appeals[0].newHonorificTitle).toBe('Appealed Enforcer');
    expect(appeals[0].scripture).toEqual(['a', 'b', 'c']);
    expect(appeals[0].casteBefore).toBe('class-vi');
    expect(appeals[0].casteAfter).toBe('class-ii');
    expect(appeals[1].appealText).toBe('first appeal');
    expect(appeals[1].accepted).toBe(false);
  });
});