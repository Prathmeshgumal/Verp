import { Badge } from '@mantine/core';
import type { AttendanceStatus } from '@ve/shared';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/labels';

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
