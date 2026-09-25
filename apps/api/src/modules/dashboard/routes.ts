import type { FastifyInstance } from 'fastify';
import { getDashboardToday } from './service';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/today', async () => getDashboardToday(app.deps));
}
