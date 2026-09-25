import type { FastifyInstance } from 'fastify';
import type { MeResponse } from '@ve/shared';
import { AppError } from '../../lib/errors';
import { authOf } from '../../plugins/auth';
import { toPublicUser } from '../auth/dto';
import { findUserById } from '../auth/repo';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: app.authenticate }, async (req): Promise<MeResponse> => {
    const user = await findUserById(app.deps.db, authOf(req).userId);
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Login required');
    return { user: toPublicUser(user) };
  });
}
