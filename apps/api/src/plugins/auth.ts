import type { Role } from '@ve/shared';

export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
  name: string;
  siteId: string | null;
}
