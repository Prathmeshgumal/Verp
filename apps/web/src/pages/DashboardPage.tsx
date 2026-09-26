import { Group, Paper, SimpleGrid, Stack, Switch, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageError, PageLoader } from '../components/PageState';
import { queryKeys } from '../lib/queryKeys';
import { formatTime, formatWorkDate } from '../lib/time';
import { useCompanyTz } from '../lib/useCompanySettings';
import { useServices } from '../services';
import { AttendanceDrawer } from './attendance/AttendanceDrawer';
import { visibleDays } from './today/workingMap';
import { WorkingMap } from './today/WorkingMap';

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
      <Text size="xs" c="dimmed" lh={1.3}>
        {label}
      </Text>
      <Text className="ve-num" fz={26} fw={600} lh={1.2} mt={4} c={tone}>
        {value}
      </Text>
    </>
  );
  return href ? (
    <Paper component={Link} to={href} withBorder px="md" py="sm" radius="md" style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Paper>
  ) : (
    <Paper withBorder px="md" py="sm" radius="md">
      {body}
    </Paper>
  );
}

export function DashboardPage() {
  const { api } = useServices();
  const tz = useCompanyTz();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [showFinished, setShowFinished] = useState(false);
  const [openDayId, setOpenDayId] = useState<string | null>(null);

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

      <SimpleGrid cols={{ base: 2, sm: 4, xl: 7 }} spacing="sm">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </SimpleGrid>

      <div className="ve-today">
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm" wrap="nowrap">
            <Title order={3}>On site today</Title>
            <Switch size="xs" label="Also show finished today" checked={showFinished} onChange={(event) => setShowFinished(event.currentTarget.checked)} />
          </Group>
          {d.mapDays.length === 0 ? (
            <Text size="sm" c="dimmed" mb="sm">
              No one has checked in yet today.
            </Text>
          ) : null}
          <WorkingMap days={visibleDays(d.mapDays, showFinished)} sites={sites.data ?? []} tz={tz} onOpen={setOpenDayId} height={380} />
        </Paper>

        <Paper withBorder p="md" radius="md" className="ve-today-list">
          <Title order={3} mb="sm">
            Working now
          </Title>
          {d.working.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nobody is checked in right now.
            </Text>
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
      </div>
      {openDayId ? <AttendanceDrawer dayId={openDayId} onClose={() => setOpenDayId(null)} /> : null}
    </Stack>
  );
}
