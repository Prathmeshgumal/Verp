import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { attendanceSubmitSchema, idempotencyKeySchema } from '@ve/shared';
import { AppError } from '../../lib/errors';
import { authOf, requireRole } from '../../plugins/auth';
import { submitAttendance, type AttendanceKind } from './service';

export async function attendanceRoutes(app: FastifyInstance) {
  const guard = { preHandler: [app.authenticate, requireRole('employee')] };

  const handler = (kind: AttendanceKind) => async (req: FastifyRequest, reply: FastifyReply) => {
    const key = idempotencyKeySchema.safeParse(req.headers['idempotency-key']);
    if (!key.success) {
      throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key header (UUID) is required');
    }
    const body = attendanceSubmitSchema.parse(req.body);
    const outcome = await submitAttendance(app.deps, kind, {
      employeeId: authOf(req).userId,
      idempotencyKey: key.data,
      body,
      ip: req.ip,
    });
    return reply.status(outcome.status).send(outcome.body);
  };

  app.post('/attendance/check-in', guard, handler('IN'));
  app.post('/attendance/check-out', guard, handler('OUT'));
}
