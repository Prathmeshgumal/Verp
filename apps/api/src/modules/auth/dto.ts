import type { PublicUser } from '@ve/shared';
import type { UserRow } from '../../db/schema';

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, role: u.role, name: u.name, phone: u.phone, email: u.email, siteId: u.siteId };
}
