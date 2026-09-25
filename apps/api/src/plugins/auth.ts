import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@ve/shared';
import type { ResolvedDeps } from '../app';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';
import { findSessionWithUser } from '../modules/auth/repo';

export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
  name: string;
  siteId: string | null;
}

const unauthorized = () => new AppError('UNAUTHORIZED', 401, 'Login required');

/** Verifies the bearer token AND reloads user + session so revocation/deactivation is immediate. */
export function makeAuthenticate(deps: ResolvedDeps) {
  return async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const now = deps.clock();
    const claims = await verifyAccessToken(header.slice(7), deps.config.JWT_SECRET, now);
    if (!claims) throw unauthorized();
    const row = await findSessionWithUser(deps.db, claims.sid);
    if (!row || row.user.id !== claims.sub || row.session.revokedAt || row.session.expiresAt <= now) {
      throw unauthorized();
    }
    if (!row.user.isActive) throw new AppError('ACCOUNT_INACTIVE', 403, 'Account is inactive');
    req.auth = {
      userId: row.user.id,
      role: row.user.role,
      sessionId: row.session.id,
      name: row.user.name,
      siteId: row.user.siteId,
    };
  };
}

/** Role comes from the database (via authenticate), never from the client. */
export function requireRole(role: Role) {
  return async (req: FastifyRequest): Promise<void> => {
    if (req.auth?.role !== role) throw new AppError('FORBIDDEN', 403, 'Not allowed');
  };
}

export function authOf(req: FastifyRequest): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
