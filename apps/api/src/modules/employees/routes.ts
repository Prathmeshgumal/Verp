import type { FastifyInstance } from 'fastify';
import { employeeCreateSchema, employeeListQuerySchema, employeeUpdateSchema } from '@ve/shared';
import { idParamsSchema } from '../../lib/params';
import { authOf } from '../../plugins/auth';
import {
  createEmployee,
  getEmployee,
  listEmployees,
  resetPin,
  revokeEmployeeSessions,
  unlockEmployee,
  updateEmployee,
} from './service';

export async function employeesRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const idOf = (params: unknown) => idParamsSchema.parse(params).id;

  app.get('/employees', async (req) => listEmployees(deps, employeeListQuerySchema.parse(req.query)));

  app.post('/employees', async (req, reply) => {
    const created = await createEmployee(deps, authOf(req).userId, employeeCreateSchema.parse(req.body));
    return reply.status(201).send(created);
  });

  app.get('/employees/:id', async (req) => getEmployee(deps, idOf(req.params)));

  app.patch('/employees/:id', async (req) =>
    updateEmployee(deps, authOf(req).userId, idOf(req.params), employeeUpdateSchema.parse(req.body)),
  );

  app.post('/employees/:id/reset-pin', async (req) => resetPin(deps, authOf(req).userId, idOf(req.params)));

  app.post('/employees/:id/revoke-sessions', async (req, reply) => {
    await revokeEmployeeSessions(deps, authOf(req).userId, idOf(req.params));
    return reply.status(204).send();
  });

  app.post('/employees/:id/unlock', async (req, reply) => {
    await unlockEmployee(deps, authOf(req).userId, idOf(req.params));
    return reply.status(204).send();
  });
}
