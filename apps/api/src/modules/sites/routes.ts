import type { FastifyInstance } from 'fastify';
import { siteCreateSchema, siteUpdateSchema } from '@ve/shared';
import { idParamsSchema } from '../../lib/params';
import { authOf } from '../../plugins/auth';
import { toSiteDto } from './dto';
import { listSites } from './repo';
import { createSite, getSite, updateSite } from './service';

export async function sitesRoutes(app: FastifyInstance) {
  app.get('/sites', async () => (await listSites(app.deps.db)).map(toSiteDto));

  app.post('/sites', async (req, reply) => {
    const site = await createSite(app.deps, authOf(req).userId, siteCreateSchema.parse(req.body));
    return reply.status(201).send(site);
  });

  app.get('/sites/:id', async (req) => getSite(app.deps, idParamsSchema.parse(req.params).id));

  app.patch('/sites/:id', async (req) =>
    updateSite(app.deps, authOf(req).userId, idParamsSchema.parse(req.params).id, siteUpdateSchema.parse(req.body)),
  );
}
