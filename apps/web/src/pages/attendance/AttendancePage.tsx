import { DownloadIcon } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AdminDayDto, RefusedAttemptDto } from '@ve/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DataTable } from '../../components/DataTable';
import { CheckboxField, DateField, SelectField } from '../../components/Field';
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
import { RefusedDrawer } from '../refused/RefusedDrawer';
import { RefusedTable } from '../refused/RefusedTable';
import { AttendanceDrawer } from './AttendanceDrawer';
import { filtersFromParams, filtersToParams, type AttendanceFilters } from './attendanceFilters';

const PAGE_SIZE = 50;

type View = 'days' | 'refused';
const VIEWS: { value: View; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'refused', label: 'Refused attempts' },
];

/** Days / Refused attempts, as tabs over the same filters. */
function ViewTabs({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div role="tablist" aria-label="Show" className="bg-muted inline-flex rounded-lg p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          role="tab"
          aria-selected={view === v.value}
          onClick={() => onChange(v.value)}
          className={
            view === v.value
              ? 'bg-card text-foreground h-8 rounded-md px-3 text-sm font-medium shadow-xs'
              : 'text-muted-foreground hover:text-foreground h-8 rounded-md px-3 text-sm transition-colors'
          }
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function AttendancePage() {
  const { api } = useServices();
  const tz = useCompanyTz();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params, todayIn(tz));
  const view: View = params.get('view') === 'refused' ? 'refused' : 'days';
  const openDayId = params.get('day');
  const { page, ...query } = filters;
  const [exporting, setExporting] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<RefusedAttemptDto | null>(null);

  const list = useQuery({
    queryKey: queryKeys.attendance(filters),
    queryFn: () => api.listAttendance({ ...query, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: view === 'days',
  });
  const refusedFilters = { from: filters.from, to: filters.to, employeeId: filters.employeeId, siteId: filters.siteId, page };
  const refused = useQuery({
    queryKey: queryKeys.refused(refusedFilters),
    queryFn: () => api.listRefused({ ...refusedFilters, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: view === 'refused',
  });

  /** The URL for these filters, keeping the chosen view. */
  function paramsFor(f: AttendanceFilters, v: View = view): URLSearchParams {
    const next = filtersToParams(f);
    if (v === 'refused') next.set('view', 'refused');
    return next;
  }
  const employees = useQuery({ queryKey: queryKeys.employees({}), queryFn: () => api.listEmployees({}) });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  function update(patch: Partial<AttendanceFilters>) {
    setParams(paramsFor({ ...filters, page: 1, ...patch }), { replace: true });
  }

  function openDay(id: string) {
    const next = paramsFor(filters);
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
        description={
          view === 'refused'
            ? refused.data
              ? `${refused.data.total} refused ${refused.data.total === 1 ? 'attempt' : 'attempts'}`
              : '\u00a0'
            : list.data
              ? `${list.data.total} ${list.data.total === 1 ? 'day' : 'days'}`
              : '\u00a0'
        }
        actions={
          view === 'days' ? (
            <Button variant="outline" loading={exporting} onClick={() => void exportCsv()}>
              {exporting ? null : <DownloadIcon />}
              Export CSV
            </Button>
          ) : null
        }
      />

      <ViewTabs view={view} onChange={(v) => setParams(paramsFor({ ...filters, page: 1 }, v), { replace: true })} />

      <div className="flex flex-wrap items-end gap-3">
        <DateField label="From" className="w-40" value={filters.from} onChange={(from) => update({ from })} />
        <DateField label="To" className="w-40" value={filters.to} onChange={(to) => update({ to })} />
        <SelectField
          label="Employee"
          className="w-48"
          data={employeeOptions}
          value={filters.employeeId ?? ''}
          onChange={(v) => update({ employeeId: v || undefined })}
        />
        <SelectField label="Site" className="w-44" data={siteOptions} value={filters.siteId ?? ''} onChange={(v) => update({ siteId: v || undefined })} />
        {view === 'days' ? (
          <>
            <SelectField
              label="Status"
              className="w-44"
              data={statusOptions}
              value={filters.status ?? ''}
              onChange={(v) => update({ status: (v || undefined) as AttendanceFilters['status'] })}
            />
            <CheckboxField
              label="Needs review only"
              className="h-9"
              checked={!!filters.needsReview}
              onChange={(checked) => update({ needsReview: checked || undefined })}
            />
          </>
        ) : null}
      </div>

      {view === 'refused' ? (
        refused.isError && !refused.data ? (
          <PageError error={refused.error} onRetry={() => void refused.refetch()} />
        ) : (
          <RefusedTable
            rows={refused.data?.items ?? []}
            tz={tz}
            onOpen={setOpenAttempt}
            fetching={refused.isFetching}
            paging={{ page, pageSize: PAGE_SIZE, total: refused.data?.total ?? 0, onPageChange: (p) => setParams(paramsFor({ ...filters, page: p })) }}
          />
        )
      ) : list.isError && !list.data ? (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<AdminDayDto>
          fetching={list.isFetching}
          rows={list.data?.items ?? []}
          rowKey={(d) => d.id}
          empty="No attendance for these filters"
          onRowClick={(d) => openDay(d.id)}
          paging={{ page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, onPageChange: (p) => setParams(paramsFor({ ...filters, page: p })) }}
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
      <AttendanceDrawer dayId={openDayId} onClose={() => setParams(paramsFor(filters))} />
      <RefusedDrawer attempt={openAttempt} onClose={() => setOpenAttempt(null)} />
    </div>
  );
}
