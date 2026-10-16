import { describe, expect, it } from 'vitest';
import {
  formatCarbonCredits,
  formatCarbonKg,
  formatRoomType,
  formatVaultDate,
  isCredit,
  ledgerReasonLabel,
} from './vault-format';

describe('ledger reason labels', () => {
  it('maps known reasons to readable labels', () => {
    expect(ledgerReasonLabel('seed')).toBe('Universal Basic Allowance');
    expect(ledgerReasonLabel('claim_fee')).toBe('Verdict Certification Fee');
    expect(ledgerReasonLabel('appeal_fee')).toBe('Appeal Filing Fee');
    expect(ledgerReasonLabel('adjustment')).toBe('System Adjustment');
  });

  it('title-cases unknown reasons as a fallback', () => {
    expect(ledgerReasonLabel('bribe_payment' as never)).toBe('Bribe Payment');
    expect(ledgerReasonLabel('refund' as never)).toBe('Refund');
  });
});

describe('credit direction', () => {
  it('treats zero and positive deltas as credits', () => {
    expect(isCredit(0)).toBe(true);
    expect(isCredit(100)).toBe(true);
    expect(isCredit(-1)).toBe(false);
  });
});

describe('carbon credit formatting', () => {
  it('renders stored units as credits, two decimals', () => {
    // One credit is a hundred units and one tonne of CO2e.
    expect(formatCarbonCredits(700)).toBe('7.00');
    expect(formatCarbonCredits(30)).toBe('0.30');
    expect(formatCarbonCredits(3)).toBe('0.03');
    expect(formatCarbonCredits(0)).toBe('0.00');
    expect(formatCarbonCredits(-45)).toBe('−0.45');
  });

  it('renders the same amount in kilograms of CO2e', () => {
    expect(formatCarbonKg(700)).toBe('7,000 kg CO₂e');
    expect(formatCarbonKg(30)).toBe('300 kg CO₂e');
    expect(formatCarbonKg(1)).toBe('10 kg CO₂e');
    expect(formatCarbonKg(0)).toBe('0 kg CO₂e');
  });
});

describe('vault date formatting', () => {
  it('renders a UTC timestamp', () => {
    expect(formatVaultDate('2026-10-05T13:42:07.000Z')).toBe('2026-10-05 13:42 UTC');
  });

  it('passes through unparseable input', () => {
    expect(formatVaultDate('not-a-date')).toBe('not-a-date');
  });
});

describe('audit-area labels', () => {
  it('title-cases a recorded room type', () => {
    expect(formatRoomType('kitchen', 'Unspecified area')).toBe('Kitchen');
    expect(formatRoomType('living room', 'Unspecified area')).toBe('Living Room');
  });

  it('falls back when the scan carried no hint', () => {
    expect(formatRoomType(null, 'Unspecified area')).toBe('Unspecified area');
    expect(formatRoomType('   ', 'Unspecified area')).toBe('Unspecified area');
  });
});
