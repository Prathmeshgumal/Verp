import type { FastifyInstance } from 'fastify';
import { attendanceListQuerySchema, fixCheckoutSchema } from '@ve/shared';
import { idParamsSchema } from '../../lib/params';
import { authOf } from '../../plugins/auth';
import {
  exportAttendanceCsv,
  fixCheckout,
  getAttendanceDetail,
  listAttendance,
  markReviewed,
} from './admin-service';

export async function adminAttendanceRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const idOf = (params: unknown) => idParamsSchema.parse(params).id;

  app.get('/attendance', async (req) => listAttendance(deps, attendanceListQuerySchema.parse(req.query)));

  app.get('/attendance/export.csv', async (req, reply) => {
    const q = attendanceListQuerySchema.parse(req.query);
    const csv = await exportAttendanceCsv(deps, q);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="attendance_${q.from}_${q.to}.csv"`)
      .send(csv);
  });

  app.get('/attendance/:id', async (req) => getAttendanceDetail(deps, idOf(req.params)));

  app.patch('/attendance/:id/checkout', async (req) =>
    fixCheckout(deps, authOf(req).userId, idOf(req.params), fixCheckoutSchema.parse(req.body)),
  );

  app.post('/attendance/:id/review', async (req) => markReviewed(deps, authOf(req).userId, idOf(req.params)));
}
