import type { AdminLogin, AuthTokens, EmployeeLogin, Role } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import type { UserRow } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { verifySecret } from '../../lib/password';
import {
  formatRefreshToken,
  hashToken,
  newRefreshSecret,
  parseRefreshToken,
  signAccessToken,
} from '../../lib/tokens';
import { toPublicUser } from './dto';
import * as repo from './repo';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS: Record<Role, number> = { employee: 180 * DAY_MS, admin: 30 * DAY_MS };
export const REFRESH_REUSE_GRACE_MS = 60 * 1000;

export interface SessionMeta {
  deviceId?: string;
  deviceModel?: string;
  userAgent?: string;
}

/** Full token set; routes decide whether refreshToken goes in the body or a cookie. */
export type IssuedTokens = Required<AuthTokens>;

const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 401, 'Wrong phone/email or PIN/password');
const locked = () => new AppError('ACCOUNT_LOCKED', 423, 'Too many wrong attempts. Try again later.');
const sessionExpired = () => new AppError('SESSION_EXPIRED', 401, 'Please log in again');

async function checkCredentials(
  deps: ResolvedDeps,
  user: UserRow | undefined,
  secret: string,
  field: 'pinHash' | 'passwordHash',
): Promise<UserRow> {
  const now = deps.clock();
  if (!user) {
    await verifySecret(null, secret);
    throw invalidCredentials();
  }
  const attempt = await repo.claimLoginAttempt(deps.db, user.id, now);
  if (attempt === undefined) throw locked();
  if (attempt > MAX_FAILED_LOGINS) {
    await repo.lockAccount(deps.db, user.id, new Date(now.getTime() + LOCK_MS));
    throw locked();
  }
  if (!(await verifySecret(user[field], secret))) {
    if (attempt === MAX_FAILED_LOGINS) await repo.lockAccount(deps.db, user.id, new Date(now.getTime() + LOCK_MS));
    throw invalidCredentials();
  }
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 403, 'Account is inactive');
  await repo.resetFailedLogins(deps.db, user.id);
  return user;
}

async function issueSession(deps: ResolvedDeps, user: UserRow, meta: SessionMeta): Promise<IssuedTokens> {
  const now = deps.clock();
  const secret = newRefreshSecret();
  const session = await repo.createSession(deps.db, {
    userId: user.id,
    refreshTokenHash: hashToken(secret),
    deviceId: meta.deviceId ?? null,
    deviceModel: meta.deviceModel ?? null,
    userAgent: meta.userAgent ?? null,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS[user.role]),
  });
  const accessToken = await signAccessToken(
    { sub: user.id, role: user.role, sid: session.id },
    deps.config.JWT_SECRET,
    now,
  );
  return { accessToken, refreshToken: formatRefreshToken(session.id, secret), user: toPublicUser(user) };
}

export async function loginEmployee(deps: ResolvedDeps, input: EmployeeLogin, meta: SessionMeta): Promise<IssuedTokens> {
  const found = await repo.findUserByPhone(deps.db, input.phone);
  const user = await checkCredentials(deps, found?.role === 'employee' ? found : undefined, input.pin, 'pinHash');
  return issueSession(deps, user, meta);
}

export async function loginAdmin(deps: ResolvedDeps, input: AdminLogin, meta: SessionMeta): Promise<IssuedTokens> {
  const found = await repo.findUserByEmail(deps.db, input.email);
  const user = await checkCredentials(deps, found?.role === 'admin' ? found : undefined, input.password, 'passwordHash');
  return issueSession(deps, user, meta);
}

export async function refresh(deps: ResolvedDeps, token: string): Promise<IssuedTokens> {
  const parsed = parseRefreshToken(token);
  if (!parsed) throw sessionExpired();
  const now = deps.clock();

  // Revocations must commit, so the transaction returns an outcome instead of throwing.
  const outcome = await deps.db.transaction(async (tx) => {
    const s = await repo.findSessionForUpdate(tx, parsed.sessionId);
    if (!s || s.revokedAt || s.expiresAt <= now) return { kind: 'expired' } as const;

    // The previous token stays usable for a short grace window after rotation, so a phone whose
    // refresh response was lost (or two requests racing) is not logged out. Retrying it rotates
    // again but never restarts the window. Any other reuse is treated as theft.
    const presented = hashToken(parsed.secret);
    const isCurrent = presented === s.refreshTokenHash;
    const withinGrace =
      presented === s.prevRefreshTokenHash &&
      s.rotatedAt !== null &&
      now.getTime() - s.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
    if (!isCurrent && !withinGrace) {
      await repo.revokeSession(tx, s.id, now);
      return { kind: 'expired' } as const;
    }

    const user = await repo.findUserById(tx, s.userId);
    if (!user || !user.isActive) {
      await repo.revokeSession(tx, s.id, now);
      return { kind: 'expired' } as const;
    }

    const secret = newRefreshSecret();
    await repo.rotateSession(tx, s.id, {
      refreshTokenHash: hashToken(secret),
      prevRefreshTokenHash: isCurrent ? s.refreshTokenHash : s.prevRefreshTokenHash,
      rotatedAt: isCurrent ? now : s.rotatedAt,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS[user.role]),
    });
    return { kind: 'ok', user, sessionId: s.id, secret } as const;
  });

  if (outcome.kind === 'expired') throw sessionExpired();

  const accessToken = await signAccessToken(
    { sub: outcome.user.id, role: outcome.user.role, sid: outcome.sessionId },
    deps.config.JWT_SECRET,
    now,
  );
  return {
    accessToken,
    refreshToken: formatRefreshToken(outcome.sessionId, outcome.secret),
    user: toPublicUser(outcome.user),
  };
}

/** Revokes the session if the token is valid; silently ignores anything else. */
export async function logout(deps: ResolvedDeps, token: string | undefined): Promise<void> {
  const parsed = token ? parseRefreshToken(token) : null;
  if (!parsed) return;
  const found = await repo.findSessionWithUser(deps.db, parsed.sessionId);
  if (found && found.session.refreshTokenHash === hashToken(parsed.secret)) {
    await repo.revokeSession(deps.db, parsed.sessionId, deps.clock());
  }
}
