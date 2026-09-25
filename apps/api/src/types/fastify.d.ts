import 'fastify';
import type { ResolvedDeps } from '../app';
import type { AuthContext } from '../plugins/auth';

declare module 'fastify' {
  interface FastifyInstance {
    deps: ResolvedDeps;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
