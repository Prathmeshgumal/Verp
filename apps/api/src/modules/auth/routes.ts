import type { FastifyInstance, FastifyReply } from 'fastify';
import { adminLoginSchema, employeeLoginSchema, refreshSchema } from '@ve/shared';
import type { Config } from '../../config';
import { AppError } from '../../lib/errors';
import { loginAdmin, loginEmployee, logout, refresh, SESSION_TTL_MS } from './service';

export const REFRESH_COOKIE = 've_rt';
const COOKIE_PATH = '/auth';
const loginRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

function setRefreshCookie(reply: FastifyReply, token: string, config: Config): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: Math.floor(SESSION_TTL_MS.admin / 1000),
  });
}

export async function authRoutes(app: FastifyInstance) {
  const deps = app.deps;

  app.post('/auth/employee/login', loginRateLimit, async (req) => {
    const body = employeeLoginSchema.parse(req.body);
    return loginEmployee(deps, body, {
      deviceId: body.deviceId,
      deviceModel: body.deviceModel,
      userAgent: req.headers['user-agent'],
    });
  });

  app.post('/auth/admin/login', loginRateLimit, async (req, reply) => {
    const body = adminLoginSchema.parse(req.body);
    const tokens = await loginAdmin(deps, body, {
      deviceId: body.deviceId,
      deviceModel: body.deviceModel,
      userAgent: req.headers['user-agent'],
    });
    if (body.client === 'web') {
      setRefreshCookie(reply, tokens.refreshToken, deps.config);
      return { accessToken: tokens.accessToken, user: tokens.user };
    }
    return tokens;
  });

  app.post('/auth/refresh', async (req, reply) => {
    const cookieToken = req.cookies[REFRESH_COOKIE];
    const body = refreshSchema.parse(req.body ?? {});
    const token = cookieToken ?? body.refreshToken;
    if (!token) throw new AppError('SESSION_EXPIRED', 401, 'Please log in again');
    const tokens = await refresh(deps, token);
    if (cookieToken) {
      setRefreshCookie(reply, tokens.refreshToken, deps.config);
      return { accessToken: tokens.accessToken, user: tokens.user };
    }
    return tokens;
  });

  app.post('/auth/logout', async (req, reply) => {
    const body = refreshSchema.parse(req.body ?? {});
    await logout(deps, req.cookies[REFRESH_COOKIE] ?? body.refreshToken);
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return reply.status(204).send();
  });
}
