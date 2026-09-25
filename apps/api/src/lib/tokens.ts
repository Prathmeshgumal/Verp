import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@ve/shared';

export const ACCESS_TTL_SECONDS = 15 * 60;

export interface AccessClaims {
  sub: string;
  role: Role;
  sid: string;
}

const encoder = new TextEncoder();

export async function signAccessToken(claims: AccessClaims, secret: string, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: claims.role, sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_SECONDS)
    .sign(encoder.encode(secret));
}

export async function verifyAccessToken(token: string, secret: string, now: Date): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ['HS256'],
      currentDate: now,
    });
    const { sub, role, sid } = payload;
    if (typeof sub !== 'string' || typeof sid !== 'string') return null;
    if (role !== 'admin' && role !== 'employee') return null;
    return { sub, role, sid };
  } catch {
    return null;
  }
}

export function newRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const sessionId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!UUID.test(sessionId) || secret.length < 20) return null;
  return { sessionId, secret };
}
