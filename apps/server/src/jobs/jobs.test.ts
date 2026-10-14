import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { OraclePayload } from '@ecocide/types';
import { getFaction } from '@ecocide/types';
import { createRepositories, initDb, runMigrations } from '../db/index.js';
import type { Repositories } from '../db/index.js';
import type { EmailMessage, Mailer } from '../email/index.js';
import { createInlineDispatcher } from './dispatcher.js';
import { createHandlers } from './handlers/index.js';
import type { JobContext } from './types.js';

interface FakeMailer extends Mailer {
  sent: EmailMessage[];
}

function fakeMailer(): FakeMailer {
  const sent: EmailMessage[] = [];
  return {
    enabled: true,
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
      return 'fake-message-id';
    },
    async verify() {
      return true;
    },
    close() {},
  };
}

const payload: OraclePayload = {
  user_profile: {
    caste: 'class-i',
    biocarbon_ratio: 98,
    life_stage: 'Champion',
    equipped_wealth: 'High-Tech Elite Gear',
    energy_level: 'Ruthless Command',
    apparent_presentation: 'Feminine',
    honorific_title: 'Provisional Subject #1',
  },
  prophecy: {
    headline: 'CLASSIFICATION RECORD LOGGED',
    paragraph_1: 'P1',
    paragraph_2: 'P2',
    paragraph_3: 'P3',
  },
};

let repositories: Repositories;
let closeDb: () => void;
let tempDir: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecocide-jobs-test-'));
  const conn = await initDb({ path: path.join(tempDir, 'dossiers.db') });
  await runMigrations(conn.db);
  repositories = createRepositories(conn.db);
  closeDb = conn.close;
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeDispatcher(mailer: FakeMailer) {
  const context: JobContext = { repositories, mailer, appBaseUrl: 'https://registry.test' };
  return createInlineDispatcher(createHandlers(context));
}

describe('job dispatch (inline mode)', () => {
  it('sends a verdict email for a stored dossier', async () => {
    const dossierId = await repositories.saveDossier(payload);
    const mailer = fakeMailer();

    await makeDispatcher(mailer).enqueue(
      'email:verdict',
      { dossierId, to: 'citizen@example.com' },
      { jobId: `email:verdict:${dossierId}` }
    );

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('citizen@example.com');
    expect(mailer.sent[0].subject).toContain(getFaction('class-i').name);
    expect(mailer.sent[0].html).toContain(`https://registry.test/arbitration/${dossierId}`);
  });

  it('sends an appeal-ruling email', async () => {
    const dossierId = await repositories.saveDossier(payload);
    const appealId = await repositories.saveAppeal({
      dossierId,
      appealText: 'please reconsider',
      accepted: true,
      newCaste: 'class-ii',
      newHonorificTitle: 'Re-Assigned Member',
      headline: 'APPEAL GRANTED',
      reason: 'documentation sufficient',
      scripture: ['a', 'b', 'c'],
      casteBefore: 'class-i',
      casteAfter: 'class-ii',
    });
    const mailer = fakeMailer();

    await makeDispatcher(mailer).enqueue(
      'email:appeal-ruling',
      { dossierId, appealId, to: 'citizen@example.com' },
      { jobId: `email:appeal-ruling:${appealId}` }
    );

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].subject).toContain('APPEAL RULING');
    expect(mailer.sent[0].subject).toContain('GRANTED');
    expect(mailer.sent[0].html).toContain(getFaction('class-i').name);
  });

  it('does not send when the dossier is missing', async () => {
    const mailer = fakeMailer();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await makeDispatcher(mailer).enqueue('email:verdict', { dossierId: 'missing', to: 'citizen@example.com' });

    warnSpy.mockRestore();
    expect(mailer.sent).toHaveLength(0);
  });

  it('swallows unknown-job and handler errors without throwing', async () => {
    const mailer = fakeMailer();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      makeDispatcher(mailer).enqueue('does:not:exist' as never, {} as never)
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });
});
