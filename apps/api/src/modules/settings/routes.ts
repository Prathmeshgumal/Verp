import type { FastifyInstance } from 'fastify';
import { settingsUpdateSchema } from '@ve/shared';
import { authOf } from '../../plugins/auth';
import { getSettings } from './repo';
import { patchSettings } from './service';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async () => getSettings(app.deps.db));
  app.patch('/settings', async (req) =>
    patchSettings(app.deps, authOf(req).userId, settingsUpdateSchema.parse(req.body)),
  );
}
