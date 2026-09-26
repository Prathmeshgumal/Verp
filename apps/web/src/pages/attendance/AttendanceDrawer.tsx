import { Button, Drawer, Group, Paper, SimpleGrid, Stack, Text, Timeline, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlagBadges } from '../../components/FlagBadges';
import { PageError, PageLoader } from '../../components/PageState';
import { StatusBadge } from '../../components/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { attemptResultLabel } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { formatDateTime, formatMinutes, formatTime, formatWorkDate } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { DayMap } from './DayMap';
import { FixCheckoutForm } from './FixCheckoutForm';

export function AttendanceDrawer({ dayId, onClose }: { dayId: string | null; onClose: () => void }) {
  return (
    <Drawer opened={dayId !== null} onClose={onClose} position="right" size="lg" title="Attendance day" closeButtonProps={{ 'aria-label': 'Close' }}>
      {dayId ? <DayDetail key={dayId} dayId={dayId} /> : null}
    </Drawer>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text className="ve-num" fz={24} fw={600}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {detail}
      </Text>
    </Paper>
  );
}

const metres = (m: number | null) => (m == null ? '?' : `${Math.round(m)} m`);

function DayDetail({ dayId }: { dayId: string }) {
  const { api } = useServices();
  const tz = useCompanyTz();
  const queryClient = useQueryClient();
  const [fixing, setFixing] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.attendanceDay(dayId), queryFn: () => api.getAttendance(dayId) });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }

  const review = useMutation({
    mutationFn: () => api.markReviewed(dayId),
    onSuccess: () => {
      notifications.show({ color: 'ledgerGreen', message: 'Marked as reviewed' });
      refreshAll();
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Not done', message: errorMessage(err) }),
  });

  if (!detail.data) {
    return detail.isError ? <PageError error={detail.error} onRetry={() => void detail.refetch()} /> : <PageLoader />;
  }
  const { day, site, events } = detail.data;
  const clockFlagged = day.flags.includes('CLOCK_MISMATCH');

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{day.employeeName}</Title>
          <Text c="dimmed">{[day.employeeCode, formatWorkDate(day.workDate), day.siteName].filter(Boolean).join(' · ')}</Text>
        </div>
        <StatusBadge status={day.status} />
      </Group>
      <FlagBadges flags={day.flags} needsReview={day.needsReview} />

      <DayMap day={day} site={site} />
      <Text size="xs" c="dimmed">
        Green dot: check-in · Orange dot: check-out · Circle: allowed area ({site.radiusM} m)
      </Text>

      <SimpleGrid cols={2}>
        <Fact label="Checked in" value={formatTime(day.checkInAt, tz)} detail={`${metres(day.checkInDistanceM)} from the centre · accuracy ${metres(day.checkInAccuracyM)}`} />
        <Fact
          label="Checked out"
          value={day.checkOutAt ? formatTime(day.checkOutAt, tz) : '—'}
          detail={
            day.checkOutAt
              ? day.checkOutLat != null
                ? `${metres(day.checkOutDistanceM)} from the centre · accuracy ${metres(day.checkOutAccuracyM)}`
                : 'Set by an admin'
              : day.status === 'MISSED_CHECKOUT'
                ? 'No check-out recorded'
                : 'Still working'
          }
        />
      </SimpleGrid>
      <Text>
        Worked: <b className="ve-num">{formatMinutes(day.workedMinutes)}</b>
      </Text>

      <Group>
        {day.needsReview ? (
          <Button onClick={() => review.mutate()} loading={review.isPending}>
            Mark reviewed
          </Button>
        ) : day.reviewedAt ? (
          <Text size="sm" c="dimmed">
            Reviewed {formatDateTime(day.reviewedAt, tz)}
          </Text>
        ) : null}
        {day.status !== 'CHECKED_IN' && !fixing ? (
          <Button variant="default" onClick={() => setFixing(true)}>
            Fix check-out
          </Button>
        ) : null}
      </Group>
      {day.status === 'CHECKED_IN' ? (
        <Text size="sm" c="dimmed">
          Still checked in. The check-out can be fixed once the day is closed.
        </Text>
      ) : null}
      {fixing ? (
        <FixCheckoutForm
          day={day}
          tz={tz}
          onCancel={() => setFixing(false)}
          onDone={() => {
            setFixing(false);
            refreshAll();
          }}
        />
      ) : null}

      <Title order={4}>Attempts</Title>
      {events.length === 0 ? (
        <Text size="sm" c="dimmed">
          No attempts recorded.
        </Text>
      ) : (
        <Timeline bulletSize={14} lineWidth={2}>
          {events.map((ev) => (
            <Timeline.Item
              key={ev.id}
              color={ev.result === 'ACCEPTED' ? 'ledgerGreen' : 'ledgerOrange'}
              title={`${ev.type === 'IN' ? 'Check-in' : 'Check-out'} · ${attemptResultLabel(ev.result)}`}
            >
              <Text size="sm" className="ve-num">
                {formatDateTime(ev.serverTime, tz)}
              </Text>
              <Text size="xs" c="dimmed">
                {[
                  ev.distanceM != null ? `${metres(ev.distanceM)} from the centre` : null,
                  `accuracy ${metres(ev.accuracyM)}`,
                  ev.isMock ? 'fake GPS app' : null,
                  clockFlagged && ev.deviceTime ? `phone clock ${formatTime(ev.deviceTime, tz)}` : null,
                  ev.deviceModel,
                  ev.appVersion ? `app ${ev.appVersion}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Stack>
  );
}
