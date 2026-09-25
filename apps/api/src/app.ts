import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config';
import type { Db } from './db/client';
import { systemClock, type Clock } from './lib/clock';
import { errorHandler, notFoundHandler } from './lib/errors';
import { adminRoutes } from './modules/admin';
import { authRoutes } from './modules/auth/routes';
import { meRoutes } from './modules/me/routes';
import { makeAuthenticate } from './plugins/auth';

export interface AppDeps {
  config: Config;
  db: Db;
  clock?: Clock;
}

export interface ResolvedDeps {
  config: Config;
  db: Db;
  clock: Clock;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const resolved: ResolvedDeps = { ...deps, clock: deps.clock ?? systemClock };
  const app = Fastify({
    logger: {
      level: deps.config.LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
    },
    trustProxy: deps.config.TRUST_PROXY,
    genReqId: () => randomUUID(),
    bodyLimit: 64 * 1024,
  });

  app.decorate('deps', resolved);
  app.decorateRequest('auth', null);
  app.decorate('authenticate', makeAuthenticate(resolved));

  await app.register(helmet);
  await app.register(cors, { origin: [deps.config.WEB_ORIGIN], credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
