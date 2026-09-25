import { describe, expect, it } from 'vitest';
import { generatePin, hashSecret, verifySecret } from '../../src/lib/password';

describe('password helpers', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashSecret('123456');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifySecret(hash, '123456')).toBe(true);
    expect(await verifySecret(hash, '654321')).toBe(false);
  });
  it('returns false for a missing hash or garbage hash', async () => {
    expect(await verifySecret(null, '123456')).toBe(false);
    expect(await verifySecret('not-a-hash', '123456')).toBe(false);
  });
  it('generates 6-digit PINs', () => {
    for (let i = 0; i < 500; i++) expect(generatePin()).toMatch(/^\d{6}$/);
  });
});
