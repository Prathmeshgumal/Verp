import { useDebouncedValue } from '@mantine/hooks';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EmployeeDto } from '@ve/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { EmployeeListParams } from '../../api/endpoints';
import { Button } from '@/components/ui/button';
import { DataTable } from '../../components/DataTable';
import { SelectField, TextField } from '../../components/Field';
import { PageHeader } from '../../components/PageHeader';
import { PageError } from '../../components/PageState';
import { Pill } from '../../components/Pill';
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
    <div className="grid gap-6">
      <PageHeader
        title="Employees"
        description={employees.data ? `${employees.data.length} ${employees.data.length === 1 ? 'person' : 'people'}` : '\u00a0'}
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon />
            Add employee
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Search"
          placeholder="Name, mobile or code"
          leftSection={<SearchIcon />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="w-72"
        />
        <SelectField
          label="Site"
          className="w-48"
          value={siteId}
          onChange={setSiteId}
          data={[{ value: '', label: 'All sites' }, ...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
        />
        <SelectField
          label="Status"
          className="w-36"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {employees.isError && !employees.data ? (
        <PageError error={employees.error} onRetry={() => void employees.refetch()} />
      ) : (
        <DataTable<EmployeeDto>
          fetching={employees.isFetching}
          rows={employees.data ?? []}
          rowKey={(e) => e.id}
          empty="No employees match"
          onRowClick={(e) => navigate(`/employees/${e.id}`)}
          columns={[
            {
              key: 'name',
              title: 'Name',
              render: (e) => (
                <Link to={`/employees/${e.id}`} className="hover:text-brand-ink font-medium transition-colors" onClick={(event) => event.stopPropagation()}>
                  {e.name}
                </Link>
              ),
            },
            { key: 'phone', title: 'Mobile', render: (e) => <span className="ve-num">{formatPhone(e.phone)}</span> },
            { key: 'code', title: 'Code', render: (e) => <span className="text-muted-foreground">{e.employeeCode ?? '—'}</span> },
            { key: 'site', title: 'Site', render: (e) => e.siteName ?? <span className="text-muted-foreground">No site</span> },
            {
              key: 'status',
              title: 'Status',
              render: (e) => {
                const s = employeeStatus(e);
                return <Pill tone={s.tone}>{s.label}</Pill>;
              },
            },
          ]}
        />
      )}

      <EmployeeCreateModal opened={adding} onClose={() => setAdding(false)} sites={sites.data ?? []} />
    </div>
  );
}
