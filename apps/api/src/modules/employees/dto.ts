import type { EmployeeDto } from '@ve/shared';
import type { UserRow } from '../../db/schema';

export function toEmployeeDto(u: UserRow, siteName: string | null): EmployeeDto {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone ?? '',
    employeeCode: u.employeeCode,
    siteId: u.siteId,
    siteName,
    isActive: u.isActive,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
