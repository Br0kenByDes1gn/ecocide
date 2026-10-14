import { describe, expect, it } from 'vitest';
import { formatCredits, formatRoomType, formatVaultDate, isCredit, ledgerReasonLabel } from './vault-format';

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

describe('credit formatting', () => {
  it('adds thousands separators and keeps the sign', () => {
    expect(formatCredits(999750)).toBe('999,750');
    expect(formatCredits(1_000_000)).toBe('1,000,000');
    expect(formatCredits(-250)).toBe('-250');
    expect(formatCredits(0)).toBe('0');
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
