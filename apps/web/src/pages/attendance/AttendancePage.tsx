import { DownloadIcon } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AdminDayDto } from '@ve/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DataTable } from '../../components/DataTable';
import { CheckboxField, SelectField, TextField } from '../../components/Field';
import { PageHeader } from '../../components/PageHeader';
import { FlagBadges } from '../../components/FlagBadges';
import { PageError } from '../../components/PageState';
import { StatusBadge } from '../../components/StatusBadge';
import { saveBlob } from '../../lib/download';
import { errorMessage } from '../../lib/errors';
import { STATUS_LABEL } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { formatMinutes, formatTime, formatWorkDate, todayIn } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { AttendanceDrawer } from './AttendanceDrawer';
import { filtersFromParams, filtersToParams, type AttendanceFilters } from './attendanceFilters';

const PAGE_SIZE = 50;

export function AttendancePage() {
  const { api } = useServices();
  const tz = useCompanyTz();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params, todayIn(tz));
  const openDayId = params.get('day');
  const { page, ...query } = filters;
  const [exporting, setExporting] = useState(false);

  const list = useQuery({
    queryKey: queryKeys.attendance(filters),
    queryFn: () => api.listAttendance({ ...query, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const employees = useQuery({ queryKey: queryKeys.employees({}), queryFn: () => api.listEmployees({}) });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  function update(patch: Partial<AttendanceFilters>) {
    setParams(filtersToParams({ ...filters, page: 1, ...patch }), { replace: true });
  }

  function openDay(id: string) {
    const next = filtersToParams(filters);
    next.set('day', id);
    setParams(next);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const { blob, filename } = await api.exportAttendanceCsv(query);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error('Export failed', { description: errorMessage(err) });
    } finally {
      setExporting(false);
    }
  }

  const employeeOptions = [
    { value: '', label: 'All employees' },
    ...[...(employees.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ value: e.id, label: e.name })),
  ];
  const siteOptions = [{ value: '', label: 'All sites' }, ...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))];
  const statusOptions = [
    { value: '', label: 'Any status' },
    ...(Object.entries(STATUS_LABEL) as [string, string][]).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Attendance"
        description={list.data ? `${list.data.total} ${list.data.total === 1 ? 'day' : 'days'}` : '\u00a0'}
        actions={
          <Button variant="outline" loading={exporting} onClick={() => void exportCsv()}>
            {exporting ? null : <DownloadIcon />}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <TextField type="date" label="From" inputClassName="ve-num w-40" value={filters.from} onChange={(e) => update({ from: e.currentTarget.value })} />
        <TextField type="date" label="To" inputClassName="ve-num w-40" value={filters.to} onChange={(e) => update({ to: e.currentTarget.value })} />
        <SelectField
          label="Employee"
          className="w-48"
          data={employeeOptions}
          value={filters.employeeId ?? ''}
          onChange={(e) => update({ employeeId: e.currentTarget.value || undefined })}
        />
        <SelectField label="Site" className="w-44" data={siteOptions} value={filters.siteId ?? ''} onChange={(e) => update({ siteId: e.currentTarget.value || undefined })} />
        <SelectField
          label="Status"
          className="w-44"
          data={statusOptions}
          value={filters.status ?? ''}
          onChange={(e) => update({ status: (e.currentTarget.value || undefined) as AttendanceFilters['status'] })}
        />
        <CheckboxField
          label="Needs review only"
          className="h-9"
          checked={!!filters.needsReview}
          onChange={(checked) => update({ needsReview: checked || undefined })}
        />
      </div>

      {list.isError && !list.data ? (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<AdminDayDto>
          fetching={list.isFetching}
          rows={list.data?.items ?? []}
          rowKey={(d) => d.id}
          empty="No attendance for these filters"
          onRowClick={(d) => openDay(d.id)}
          paging={{ page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, onPageChange: (p) => setParams(filtersToParams({ ...filters, page: p })) }}
          columns={[
            { key: 'date', title: 'Date', render: (d) => <span className="whitespace-nowrap">{formatWorkDate(d.workDate)}</span> },
            {
              key: 'employee',
              title: 'Employee',
              render: (d) => (
                <div className="grid">
                  <button
                    type="button"
                    className="hover:text-brand-ink text-left font-medium transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDay(d.id);
                    }}
                  >
                    {d.employeeName}
                  </button>
                  {d.employeeCode ? <span className="text-muted-foreground text-xs">{d.employeeCode}</span> : null}
                </div>
              ),
            },
            { key: 'site', title: 'Site', render: (d) => d.siteName },
            { key: 'in', title: 'In', render: (d) => <span className="ve-num">{formatTime(d.checkInAt, tz)}</span> },
            { key: 'out', title: 'Out', render: (d) => <span className="ve-num">{d.checkOutAt ? formatTime(d.checkOutAt, tz) : '—'}</span> },
            { key: 'hours', title: 'Hours', render: (d) => <span className="ve-num">{formatMinutes(d.workedMinutes)}</span> },
            { key: 'status', title: 'Status', render: (d) => <StatusBadge status={d.status} /> },
            { key: 'flags', title: 'Flags', render: (d) => <FlagBadges flags={d.flags} needsReview={d.needsReview} /> },
          ]}
        />
      )}
      <AttendanceDrawer dayId={openDayId} onClose={() => setParams(filtersToParams(filters))} />
    </div>
  );
}
