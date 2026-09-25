import type { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/auth';
import { settingsRoutes } from './settings/routes';

/** Everything registered here is served under /admin and requires an active admin. */
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireRole('admin'));
  await app.register(settingsRoutes);
}
