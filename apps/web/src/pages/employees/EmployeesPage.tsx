import { Anchor, Badge, Button, Group, NativeSelect, Stack, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EmployeeDto } from '@ve/shared';
import { DataTable } from 'mantine-datatable';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { EmployeeListParams } from '../../api/endpoints';
import { PageError } from '../../components/PageState';
import { employeeStatus, formatPhone } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { useServices } from '../../services';
import { EmployeeCreateModal } from './EmployeeCreateModal';

type StatusFilter = 'active' | 'inactive' | 'all';

export function EmployeesPage() {
  const { api } = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [adding, setAdding] = useState(false);

  const params: EmployeeListParams = {
    q: q || undefined,
    siteId: siteId || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
  };
  const employees = useQuery({
    queryKey: queryKeys.employees(params),
    queryFn: () => api.listEmployees(params),
    placeholderData: keepPreviousData,
  });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1}>Employees</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setAdding(true)}>
          Add employee
        </Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="Search"
          placeholder="Name, mobile or code"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={260}
        />
        <NativeSelect
          label="Site"
          value={siteId}
          onChange={(event) => setSiteId(event.currentTarget.value)}
          data={[{ value: '', label: 'All sites' }, ...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
        />
        <NativeSelect
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.currentTarget.value as StatusFilter)}
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
        />
      </Group>

      {employees.isError && !employees.data ? (
        <PageError error={employees.error} onRetry={() => void employees.refetch()} />
      ) : (
        <DataTable<EmployeeDto>
          withTableBorder
          borderRadius="md"
          minHeight={200}
          highlightOnHover
          fetching={employees.isFetching}
          records={employees.data ?? []}
          idAccessor="id"
          noRecordsText="No employees match"
          onRowClick={({ record }) => navigate(`/employees/${record.id}`)}
          columns={[
            {
              accessor: 'name',
              title: 'Name',
              render: (e) => (
                <Anchor component={Link} to={`/employees/${e.id}`} fw={600} onClick={(event) => event.stopPropagation()}>
                  {e.name}
                </Anchor>
              ),
            },
            { accessor: 'phone', title: 'Mobile', render: (e) => <span className="ve-num">{formatPhone(e.phone)}</span> },
            { accessor: 'employeeCode', title: 'Code', render: (e) => e.employeeCode ?? '—' },
            { accessor: 'siteName', title: 'Site', render: (e) => e.siteName ?? 'No site' },
            {
              accessor: 'status',
              title: 'Status',
              render: (e) => {
                const s = employeeStatus(e);
                return (
                  <Badge color={s.color} variant="light">
                    {s.label}
                  </Badge>
                );
              },
            },
          ]}
        />
      )}

      <EmployeeCreateModal opened={adding} onClose={() => setAdding(false)} sites={sites.data ?? []} />
    </Stack>
  );
}
