import type { AttendanceStatus } from '@ve/shared';
import { STATUS_LABEL, STATUS_TONE } from '../lib/labels';
import { Pill } from './Pill';

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}
