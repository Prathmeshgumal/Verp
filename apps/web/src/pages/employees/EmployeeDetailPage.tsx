import { Anchor, Badge, Button, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlagBadges } from '../../components/FlagBadges';
import { PageError, PageLoader } from '../../components/PageState';
import { PinModal } from '../../components/PinModal';
import { StatusBadge } from '../../components/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { employeeStatus, formatPhone } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { addDays, formatDateTime, formatMinutes, formatTime, formatWorkDate, todayIn } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { EmployeeEditForm } from './EmployeeEditForm';

type Action = 'resetPin' | 'revoke' | 'unlock' | 'toggleActive';
type Confirmable = Exclude<Action, 'unlock'>;

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { api } = useServices();
  const tz = useCompanyTz();
  const queryClient = useQueryClient();
  const today = todayIn(tz);
  const from = addDays(today, -29);
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);

  const employeeQ = useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
  const sitesQ = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const daysQ = useQuery({
    queryKey: queryKeys.attendance({ employeeId: id, from, to: today }),
    queryFn: () => api.listAttendance({ from, to: today, employeeId: id, page: 1, pageSize: 100 }),
  });

  const action = useMutation({
    mutationFn: async (kind: Action): Promise<string | null> => {
      if (kind === 'resetPin') return (await api.resetPin(id)).pin;
      if (kind === 'revoke') await api.revokeSessions(id);
      else if (kind === 'unlock') await api.unlockEmployee(id);
      else await api.updateEmployee(id, { isActive: !employeeQ.data?.isActive });
      return null;
    },
    onSuccess: (pin, kind) => {
      setConfirming(null);
      if (pin) setNewPin(pin);
      else {
        const done: Record<Exclude<Action, 'resetPin'>, string> = {
          revoke: 'Logged out on all phones',
          unlock: 'Unlocked',
          toggleActive: employeeQ.data?.isActive ? 'Employee deactivated' : 'Employee activated',
        };
        notifications.show({ color: 'ledgerGreen', message: done[kind as Exclude<Action, 'resetPin'>] });
      }
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (err) => {
      setConfirming(null);
      notifications.show({ color: 'red', title: 'Not done', message: errorMessage(err) });
    },
  });

  if (!employeeQ.data) {
    return employeeQ.isError ? <PageError error={employeeQ.error} onRetry={() => void employeeQ.refetch()} /> : <PageLoader />;
  }
  const e = employeeQ.data;
  const status = employeeStatus(e);

  const confirmText: Record<Confirmable, { title: string; message: string; confirmLabel: string; danger?: boolean }> = {
    resetPin: {
      title: 'Reset PIN?',
      message: `${e.name} will need the new PIN to log in. They are logged out on every phone now.`,
      confirmLabel: 'Reset PIN',
    },
    revoke: {
      title: 'Log out everywhere?',
      message: `${e.name} will have to log in again with their PIN.`,
      confirmLabel: 'Log out everywhere',
    },
    toggleActive: e.isActive
      ? {
          title: 'Deactivate employee?',
          message: `${e.name} will not be able to log in or mark attendance. Past records stay.`,
          confirmLabel: 'Deactivate',
          danger: true,
        }
      : { title: 'Activate employee?', message: `${e.name} can log in again with their PIN.`, confirmLabel: 'Activate' },
  };

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/employees" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Employees
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            <Title order={1}>{e.name}</Title>
            <Badge color={status.color} variant="light">
              {status.label}
            </Badge>
          </Group>
          <Text c="dimmed" className="ve-num">
            {formatPhone(e.phone)}
            {e.employeeCode ? ` · ${e.employeeCode}` : ''}
          </Text>
        </Stack>
        <Group gap="xs">
          <Button variant="default" onClick={() => setConfirming('resetPin')}>
            Reset PIN
          </Button>
          <Button variant="default" onClick={() => setConfirming('revoke')}>
            Log out everywhere
          </Button>
          {status.label === 'Locked' ? (
            <Button variant="default" loading={action.isPending && action.variables === 'unlock'} onClick={() => action.mutate('unlock')}>
              Unlock
            </Button>
          ) : null}
          <Button variant={e.isActive ? 'outline' : 'filled'} color={e.isActive ? 'red' : undefined} onClick={() => setConfirming('toggleActive')}>
            {e.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper withBorder p="md" radius="md">
          <Title order={3} mb="sm">
            Details
          </Title>
          <EmployeeEditForm key={e.id} employee={e} sites={sitesQ.data ?? []} />
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Title order={3} mb="sm">
            Phones logged in
          </Title>
          {e.sessions.length === 0 ? (
            <Text c="dimmed">Not logged in on any phone.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Logged in</Table.Th>
                  <Table.Th>Last used</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {e.sessions.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>{s.deviceModel ?? 'Unknown phone'}</Table.Td>
                    <Table.Td>{formatDateTime(s.createdAt, tz)}</Table.Td>
                    <Table.Td>{formatDateTime(s.lastUsedAt, tz)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={3}>Last 30 days</Title>
          <Anchor component={Link} to={`/attendance?from=${from}&to=${today}&employeeId=${id}`}>
            Open in Attendance
          </Anchor>
        </Group>
        {daysQ.isError ? (
          <PageError error={daysQ.error} onRetry={() => void daysQ.refetch()} />
        ) : !daysQ.data ? (
          <PageLoader />
        ) : daysQ.data.items.length === 0 ? (
          <Text c="dimmed">No attendance in the last 30 days.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Site</Table.Th>
                <Table.Th>In</Table.Th>
                <Table.Th>Out</Table.Th>
                <Table.Th>Hours</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {daysQ.data.items.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td>{formatWorkDate(d.workDate)}</Table.Td>
                  <Table.Td>{d.siteName}</Table.Td>
                  <Table.Td className="ve-num">{formatTime(d.checkInAt, tz)}</Table.Td>
                  <Table.Td className="ve-num">{d.checkOutAt ? formatTime(d.checkOutAt, tz) : '—'}</Table.Td>
                  <Table.Td className="ve-num">{formatMinutes(d.workedMinutes)}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <StatusBadge status={d.status} />
                      <FlagBadges flags={d.flags} needsReview={d.needsReview} />
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {confirming ? (
        <ConfirmDialog
          opened
          {...confirmText[confirming]}
          busy={action.isPending}
          onConfirm={() => action.mutate(confirming)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {newPin ? <PinModal opened name={e.name} pin={newPin} onClose={() => setNewPin(null)} /> : null}
    </Stack>
  );
}
