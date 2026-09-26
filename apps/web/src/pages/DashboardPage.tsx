import { Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageError, PageLoader } from '../components/PageState';
import { queryKeys } from '../lib/queryKeys';
import { formatTime, formatWorkDate } from '../lib/time';
import { useCompanyTz } from '../lib/useCompanySettings';
import { useServices } from '../services';

/** Earlier than any record: the dashboard's missed/review counts cover all time. */
export const ALL_TIME_FROM = '2020-01-01';

interface Stat {
  label: string;
  value: number;
  href?: string;
  tone?: string;
}

function StatCard({ label, value, href, tone }: Stat) {
  const body: ReactNode = (
    <>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text className="ve-num" fz={32} fw={600} c={tone}>
        {value}
      </Text>
    </>
  );
  return href ? (
    <Paper component={Link} to={href} withBorder p="md" radius="md" style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Paper>
  ) : (
    <Paper withBorder p="md" radius="md">
      {body}
    </Paper>
  );
}

export function DashboardPage() {
  const { api } = useServices();
  const tz = useCompanyTz();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });

  if (!query.data) {
    return query.isError ? <PageError error={query.error} onRetry={() => void query.refetch()} /> : <PageLoader />;
  }
  const d = query.data;
  const upToToday = `from=${ALL_TIME_FROM}&to=${d.workDate}`;
  const stats: Stat[] = [
    { label: 'Active employees', value: d.activeEmployees },
    { label: 'Checked in today', value: d.checkedInToday },
    { label: 'Working now', value: d.workingNow },
    { label: 'Completed today', value: d.completedToday },
    { label: 'Not yet in', value: d.notYetIn },
    { label: 'Missed check-outs', value: d.missedCheckouts, href: `/attendance?${upToToday}&status=MISSED_CHECKOUT`, tone: 'ledgerOrange.6' },
    { label: 'Needs review', value: d.needsReview, href: `/attendance?${upToToday}&needsReview=true`, tone: 'red.7' },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Today</Title>
          <Text c="dimmed">{formatWorkDate(d.workDate)}</Text>
        </div>
        <Text size="sm" c="dimmed">
          Updated {formatTime(new Date(query.dataUpdatedAt).toISOString(), tz)}
          {query.isError ? ' · could not refresh, retrying' : ''}
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Title order={3} mb="sm">
          Working now
        </Title>
        {d.working.length === 0 ? (
          <Text c="dimmed">Nobody is checked in right now.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Site</Table.Th>
                <Table.Th>Checked in</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.working.map((w) => (
                <Table.Tr key={w.employeeId}>
                  <Table.Td>{w.name}</Table.Td>
                  <Table.Td>{w.siteName}</Table.Td>
                  <Table.Td className="ve-num">{formatTime(w.checkInAt, tz)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
