import type { FastifyInstance } from 'fastify';
import { myAttendanceQuerySchema, type MeResponse } from '@ve/shared';
import { AppError } from '../../lib/errors';
import { authOf, requireRole } from '../../plugins/auth';
import { toPublicUser } from '../auth/dto';
import { findUserById } from '../auth/repo';
import { getMyAttendance, getToday } from './service';

export async function meRoutes(app: FastifyInstance) {
  const employeeOnly = { preHandler: [app.authenticate, requireRole('employee')] };

  app.get('/me', { preHandler: app.authenticate }, async (req): Promise<MeResponse> => {
    const user = await findUserById(app.deps.db, authOf(req).userId);
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Login required');
    return { user: toPublicUser(user) };
  });

  app.get('/me/today', employeeOnly, async (req) => getToday(app.deps, authOf(req).userId));

  app.get('/me/attendance', employeeOnly, async (req) =>
    getMyAttendance(app.deps, authOf(req).userId, myAttendanceQuerySchema.parse(req.query)),
  );
}
