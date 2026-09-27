import type { RefusedAttemptDto } from '@ve/shared';
import { DataTable, SimpleTable, type Column } from '../../components/DataTable';
import { refusedWhere } from '../../lib/refused';
import { formatTime, formatWorkDate } from '../../lib/time';

interface Props {
  rows: RefusedAttemptDto[];
  tz: string;
  onOpen: (attempt: RefusedAttemptDto) => void;
  fetching?: boolean;
  /** Leave out the name column on one employee's own page. */
  showName?: boolean;
  /** Inside a panel: no frame of its own; the date opens the attempt. */
  plain?: boolean;
  paging?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
}

const REASON = { OUTSIDE_SITE: 'Outside the site', LOW_ACCURACY: 'Location not accurate' } as const;

/** Refused attempts, one per row; a row opens the attempt on a map. */
export function RefusedTable({ rows, tz, onOpen, fetching, showName = true, plain = false, paging }: Props) {
  const columns: Column<RefusedAttemptDto>[] = [
    {
      key: 'when',
      title: 'When',
      render: (a) => (
        <button
          type="button"
          className="hover:text-brand-ink text-left whitespace-nowrap transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(a);
          }}
        >
          {formatWorkDate(a.workDate)} <span className="ve-num text-muted-foreground">{formatTime(a.serverTime, tz)}</span>
        </button>
      ),
    },
    ...(showName ? [{ key: 'employee', title: 'Employee', render: (a: RefusedAttemptDto) => <span className="font-medium">{a.name}</span> }] : []),
    { key: 'type', title: 'Tried to', render: (a) => (a.type === 'IN' ? 'Check in' : 'Check out') },
    {
      key: 'reason',
      title: 'Refused because',
      render: (a) => (
        <span className="text-danger inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-danger size-1.5 rounded-full" />
          {REASON[a.result]}
        </span>
      ),
    },
    { key: 'where', title: 'Where', render: (a) => <span className="text-muted-foreground">{refusedWhere(a)}</span> },
  ];
  if (plain) return <SimpleTable columns={columns} rows={rows} rowKey={(a) => a.id} />;
  return <DataTable<RefusedAttemptDto> columns={columns} rows={rows} rowKey={(a) => a.id} onRowClick={onOpen} empty="No refused attempts for these filters" fetching={fetching} paging={paging} />;
}
