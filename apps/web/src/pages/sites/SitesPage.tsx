import { Anchor, Badge, Button, Group, Stack, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { SiteDto } from '@ve/shared';
import { DataTable } from 'mantine-datatable';
import { Link, useNavigate } from 'react-router';
import { PageError } from '../../components/PageState';
import { queryKeys } from '../../lib/queryKeys';
import { useServices } from '../../services';

export function SitesPage() {
  const { api } = useServices();
  const navigate = useNavigate();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1}>Sites</Title>
        <Button component={Link} to="/sites/new" leftSection={<IconPlus size={18} />}>
          Add site
        </Button>
      </Group>
      {sites.isError && !sites.data ? (
        <PageError error={sites.error} onRetry={() => void sites.refetch()} />
      ) : (
        <DataTable<SiteDto>
          withTableBorder
          borderRadius="md"
          minHeight={200}
          highlightOnHover
          fetching={sites.isFetching}
          records={sites.data ?? []}
          idAccessor="id"
          noRecordsText="No sites yet"
          onRowClick={({ record }) => navigate(`/sites/${record.id}`)}
          columns={[
            {
              accessor: 'name',
              title: 'Name',
              render: (s) => (
                <Anchor component={Link} to={`/sites/${s.id}`} fw={600} onClick={(event) => event.stopPropagation()}>
                  {s.name}
                </Anchor>
              ),
            },
            { accessor: 'address', title: 'Address', render: (s) => s.address ?? '—' },
            { accessor: 'radiusM', title: 'Allowed distance', render: (s) => <span className="ve-num">{s.radiusM} m</span> },
            {
              accessor: 'isActive',
              title: 'Status',
              render: (s) => (
                <Badge color={s.isActive ? 'ledgerGreen' : 'gray'} variant="light">
                  {s.isActive ? 'In use' : 'Not in use'}
                </Badge>
              ),
            },
          ]}
        />
      )}
    </Stack>
  );
}
