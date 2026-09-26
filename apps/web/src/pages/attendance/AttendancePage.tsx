import { Anchor, Button, Checkbox, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AdminDayDto } from '@ve/shared';
import { DataTable } from 'mantine-datatable';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
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
      notifications.show({ color: 'red', title: 'Export failed', message: errorMessage(err) });
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
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Attendance</Title>
          <Text c="dimmed">{list.data ? `${list.data.total} ${list.data.total === 1 ? 'day' : 'days'}` : ' '}</Text>
        </div>
        <Button variant="default" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      </Group>

      <Group align="flex-end" gap="sm">
        <TextInput type="date" label="From" value={filters.from} onChange={(e) => update({ from: e.currentTarget.value })} />
        <TextInput type="date" label="To" value={filters.to} onChange={(e) => update({ to: e.currentTarget.value })} />
        <NativeSelect
          label="Employee"
          data={employeeOptions}
          value={filters.employeeId ?? ''}
          onChange={(e) => update({ employeeId: e.currentTarget.value || undefined })}
        />
        <NativeSelect label="Site" data={siteOptions} value={filters.siteId ?? ''} onChange={(e) => update({ siteId: e.currentTarget.value || undefined })} />
        <NativeSelect
          label="Status"
          data={statusOptions}
          value={filters.status ?? ''}
          onChange={(e) => update({ status: (e.currentTarget.value || undefined) as AttendanceFilters['status'] })}
        />
        <Checkbox
          label="Needs review only"
          checked={!!filters.needsReview}
          onChange={(e) => update({ needsReview: e.currentTarget.checked || undefined })}
          mb={8}
        />
      </Group>

      {list.isError && !list.data ? (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<AdminDayDto>
          withTableBorder
          borderRadius="md"
          minHeight={240}
          highlightOnHover
          fetching={list.isFetching}
          records={list.data?.items ?? []}
          idAccessor="id"
          totalRecords={list.data?.total ?? 0}
          recordsPerPage={PAGE_SIZE}
          page={page}
          onPageChange={(p) => setParams(filtersToParams({ ...filters, page: p }))}
          noRecordsText="No attendance for these filters"
          onRowClick={({ record }) => openDay(record.id)}
          columns={[
            { accessor: 'workDate', title: 'Date', render: (d) => formatWorkDate(d.workDate) },
            {
              accessor: 'employeeName',
              title: 'Employee',
              render: (d) => (
                <Stack gap={0}>
                  <Anchor
                    component="button"
                    type="button"
                    fw={600}
                    ta="left"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDay(d.id);
                    }}
                  >
                    {d.employeeName}
                  </Anchor>
                  {d.employeeCode ? (
                    <Text size="xs" c="dimmed">
                      {d.employeeCode}
                    </Text>
                  ) : null}
                </Stack>
              ),
            },
            { accessor: 'siteName', title: 'Site' },
            { accessor: 'checkInAt', title: 'In', render: (d) => <span className="ve-num">{formatTime(d.checkInAt, tz)}</span> },
            { accessor: 'checkOutAt', title: 'Out', render: (d) => <span className="ve-num">{d.checkOutAt ? formatTime(d.checkOutAt, tz) : '—'}</span> },
            { accessor: 'workedMinutes', title: 'Hours', render: (d) => <span className="ve-num">{formatMinutes(d.workedMinutes)}</span> },
            { accessor: 'status', title: 'Status', render: (d) => <StatusBadge status={d.status} /> },
            { accessor: 'flags', title: 'Flags', render: (d) => <FlagBadges flags={d.flags} needsReview={d.needsReview} /> },
          ]}
        />
      )}
      <AttendanceDrawer dayId={openDayId} onClose={() => setParams(filtersToParams(filters))} />
    </Stack>
  );
}
