import { describe, expect, it } from 'vitest';
import type { Queue } from 'bullmq';
import { bullJobId, createBullmqDispatcher } from './dispatcher.js';
import {
  appealRulingEmailJobId,
  informantTipEmailJobId,
  injunctionJobId,
  verdictEmailJobId,
} from './job-ids.js';

/**
 * The BullMQ boundary for custom job ids.
 *
 * Production proved the failure mode: `jobId: injunction:<dossierId>` (one
 * colon) is refused by BullMQ v6 with `Custom Id cannot contain :`, the thrown
 * `enqueue` is swallowed by the injunction's best-effort catch, and every
 * dossier sits at "orders not on file" forever while the API answers 200. The
 * three-part email ids escaped only through a legacy-repeatable compatibility
 * branch (an id splitting into exactly three parts is accepted) that the library
 * has marked for removal.
 *
 * These tests hold both halves of the fix: every id the app builds is
 * colon-free, and a colon reaching the dispatcher anyway is normalised rather
 * than thrown. BullMQ's own validation is not re-implemented here — the rule is
 * asserted as the colon check, which is the part that broke.
 */

interface AddedJob {
  name: string;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
}

function fakeQueue() {
  const added: AddedJob[] = [];
  const queue = {
    async add(name: string, data: Record<string, unknown>, options: Record<string, unknown>) {
      added.push({ name, data, options });
      return { id: options.jobId ?? 'generated' };
    },
  } as unknown as Queue;
  return { queue, added };
}

describe('bullmq job ids', () => {
  it('emits no colon from any builder', () => {
    const ids = [
      injunctionJobId('LKsdFEw6dE'),
      verdictEmailJobId('LKsdFEw6dE'),
      appealRulingEmailJobId('appeal-1'),
      informantTipEmailJobId('LKsdFEw6dE'),
    ];

    for (const id of ids) {
      expect(id).not.toContain(':');
      // BullMQ also refuses whitespace-ish ids by convention; keep them slug-like.
      expect(id).toMatch(/^[A-Za-z0-9._-]+$/);
    }
    // Distinct purposes must stay distinct ids, or dedupe would swallow the wrong job.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('normalises a colon id at the dispatcher, the way the incident id did', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = createBullmqDispatcher(queue);

    await dispatcher.enqueue(
      'injunction:issue',
      { dossierId: 'LKsdFEw6dE', userId: 'user-1' },
      { jobId: `injunction:LKsdFEw6dE`, removeOnComplete: true, removeOnFail: true }
    );

    // The name keeps its colon (names are unrestricted and route the handler).
    expect(added[0].name).toBe('injunction:issue');
    expect(added[0].options.jobId).toBe('injunction-LKsdFEw6dE');
    expect(String(added[0].options.jobId)).not.toContain(':');
    // A stale caller still lands on the id the builders produce, so dedupe holds
    // across the two spellings.
    expect(added[0].options.jobId).toBe(injunctionJobId('LKsdFEw6dE'));
  });

  it('normalises every offending id shape, whatever the caller passes', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = createBullmqDispatcher(queue);
    const offenders = [
      'injunction:LKsdFEw6dE',
      'email:verdict:LKsdFEw6dE',
      'a:b:c:d',
      'with:space and:colon',
    ];

    for (const jobId of offenders) {
      await dispatcher.enqueue('injunction:issue', { dossierId: 'd', userId: 'u' }, { jobId });
    }

    expect(added).toHaveLength(offenders.length);
    for (const job of added) expect(String(job.options.jobId)).not.toContain(':');
  });

  it('leaves an already-valid id untouched and omits the option when absent', async () => {
    const { queue, added } = fakeQueue();
    const dispatcher = createBullmqDispatcher(queue);

    await dispatcher.enqueue('email:otp', { to: 'a@b.test', code: '123456' }, {
      jobId: injunctionJobId('keep-me'),
    });
    await dispatcher.enqueue('email:otp', { to: 'a@b.test', code: '123456' });

    expect(added[0].options.jobId).toBe('injunction-keep-me');
    expect('jobId' in added[1].options).toBe(false);
  });

  it('passes the injunction retry flags through to BullMQ', async () => {
    // The removal flags are what let a later page load re-enqueue after a final
    // failure; dropping them would make the retry a silent no-op.
    const { queue, added } = fakeQueue();
    const dispatcher = createBullmqDispatcher(queue);

    await dispatcher.enqueue(
      'injunction:issue',
      { dossierId: 'd', userId: 'u' },
      { jobId: injunctionJobId('d'), removeOnComplete: true, removeOnFail: true }
    );

    expect(added[0].options.removeOnComplete).toBe(true);
    expect(added[0].options.removeOnFail).toBe(true);
  });

  it('does not invent a jobId from the job name', () => {
    // Job names carry colons by design; ids are a separate namespace.
    expect(bullJobId('email:verdict:abc')).toBe('email-verdict-abc');
  });
});
