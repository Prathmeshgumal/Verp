import { describe, expect, it } from 'vitest';
import {
  formatRefreshToken,
  hashToken,
  newRefreshSecret,
  parseRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/lib/tokens';

const secret = 'test-secret-that-is-at-least-32-characters';
const claims = { sub: '5b0f7a3e-2a7b-4f5e-9d59-1c2b3a4d5e6f', role: 'employee' as const, sid: '0e6a6f0c-8f3d-4a8a-9d1e-2b3c4d5e6f70' };
const now = new Date('2026-09-25T04:00:00Z');

describe('access tokens', () => {
  it('round-trips claims', async () => {
    const t = await signAccessToken(claims, secret, now);
    expect(await verifyAccessToken(t, secret, now)).toEqual(claims);
  });
  it('expires after 15 minutes', async () => {
    const t = await signAccessToken(claims, secret, now);
    expect(await verifyAccessToken(t, secret, new Date(now.getTime() + 14 * 60_000))).not.toBeNull();
    expect(await verifyAccessToken(t, secret, new Date(now.getTime() + 16 * 60_000))).toBeNull();
  });
  it('rejects a wrong secret or tampered token', async () => {
    const t = await signAccessToken(claims, secret, now);
    expect(await verifyAccessToken(t, 'x'.repeat(40), now)).toBeNull();
    expect(await verifyAccessToken(t.slice(0, -2) + 'aa', secret, now)).toBeNull();
    expect(await verifyAccessToken('garbage', secret, now)).toBeNull();
  });
});

describe('refresh tokens', () => {
  it('formats and parses', () => {
    const s = newRefreshSecret();
    expect(s.length).toBeGreaterThanOrEqual(43);
    expect(parseRefreshToken(formatRefreshToken(claims.sid, s))).toEqual({ sessionId: claims.sid, secret: s });
  });
  it.each(['', 'abc', 'not-a-uuid.secret', `${claims.sid}.`])('rejects %s', (t) => {
    expect(parseRefreshToken(t)).toBeNull();
  });
  it('hashes deterministically', () => {
    expect(hashToken('a')).toBe(hashToken('a'));
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
