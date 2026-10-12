import { describe, expect, it, vi } from 'vitest';
import type { CitizenRecord } from '@ecocide/types';
import { createMailer, loadMailConfig, normalizeEmail, vaultOtpEmail, verdictEmail } from './index.js';

function makeRecord(): CitizenRecord {
  return {
    id: 'abc123',
    createdAt: new Date().toISOString(),
    profile: {
      caste: 'class-i',
      biocarbon_ratio: 98,
      life_stage: 'Champion',
      equipped_wealth: 'High-Tech Elite Gear',
      energy_level: 'Ruthless Command',
      apparent_presentation: 'Feminine',
      honorific_title: 'Provisional Subject #1',
    },
    prophecy: {
      headline: 'CRITICAL ANOMALY DETECTED',
      paragraph_1: 'P1',
      paragraph_2: 'P2',
      paragraph_3: 'P3',
    },
  };
}

describe('email address validation', () => {
  it('normalizes valid addresses and rejects junk', () => {
    expect(normalizeEmail('  citizen@example.com ')).toBe('citizen@example.com');
    expect(normalizeEmail('not-an-email')).toBeUndefined();
    expect(normalizeEmail('a b@example.com')).toBeUndefined();
    expect(normalizeEmail('missing@domain')).toBeUndefined();
    expect(normalizeEmail(42)).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});

describe('mailer', () => {
  it('is disabled and logs (jsonTransport) when SMTP is unconfigured', async () => {
    const mailer = createMailer(loadMailConfig({}));
    expect(mailer.enabled).toBe(false);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const messageId = await mailer.send({
      to: 'citizen@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
    const verified = await mailer.verify();
    mailer.close();
    logSpy.mockRestore();

    expect(messageId).toBeDefined();
    expect(verified).toBe(true);
  });

  it('enables SMTP when a host is configured', () => {
    const config = loadMailConfig({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465' });
    expect(config.enabled).toBe(true);
    expect(config.secure).toBe(true); // port 465 defaults to TLS
  });
});

describe('verdict email template', () => {
  it('renders subject, permalink and biocarbon ratio', () => {
    const rendered = verdictEmail(makeRecord(), 'https://arbiter.test');
    const permalink = 'https://arbiter.test/arbitration/abc123';

    expect(rendered.subject).toContain('Class I');
    expect(rendered.subject).toContain('Provisional Subject #1');
    expect(rendered.html).toContain(permalink);
    expect(rendered.text).toContain(permalink);
    expect(rendered.html).toContain('98%');
  });
});

describe('vault OTP email template', () => {
  it('renders the access code in subject, html and text', () => {
    const rendered = vaultOtpEmail('424242', 10);
    expect(rendered.subject).toContain('424242');
    expect(rendered.html).toContain('424242');
    expect(rendered.text).toContain('424242');
    expect(rendered.text).toContain('10 minutes');
  });
});
