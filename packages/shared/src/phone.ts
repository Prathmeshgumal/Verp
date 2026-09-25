const ALLOWED = /^[\d\s+\-().]+$/;
const INDIA = '91';

/**
 * Normalizes user-typed phone numbers to E.164 ("+919876543210").
 * Numbers without a country code are treated as Indian.
 * Returns null when the input cannot be a valid phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !ALLOWED.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, '');
  let international = trimmed.replace(/[\s()]/g, '').startsWith('+');
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (international) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith(INDIA)) return `+${digits}`;
  if (digits.length === 10) return `+${INDIA}${digits}`;
  return null;
}
