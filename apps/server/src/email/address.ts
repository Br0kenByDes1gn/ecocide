const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize and validate a user-supplied email address. Returns `undefined`
 * for anything that isn't a plausible address, so callers can silently skip
 * notification instead of failing the underlying action.
 */
export function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return undefined;
  return EMAIL_PATTERN.test(trimmed) ? trimmed : undefined;
}
