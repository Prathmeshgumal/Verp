import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '../../auth/AuthContext';
import { createSubmitDeps } from '../../attendance/deps';
import { formatDuration, formatHhMm, formatLongDate, formatTime, minutesSince } from '../../attendance/format';
import { homeView, type HomeView } from '../../attendance/homeState';
import { outcomeView, type AttendanceAction } from '../../attendance/messages';
import { queryKeys } from '../../attendance/queryKeys';
import { resumePendingOnLaunch, submitAttendance, type SubmitOutcome, type SubmitStep } from '../../attendance/submitFlow';
import { useNow } from '../../attendance/useNow';
import { openAppSettings, openLocationSettings } from '../../native/location';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { BusyView } from './BusyView';
import { MenuSheet } from './MenuSheet';
import { ResultView } from './ResultView';

type Phase =
  | { kind: 'idle' }
  | { kind: 'busy'; step: SubmitStep | 'starting' }
  | { kind: 'result'; action: AttendanceAction; outcome: SubmitOutcome };

export function HomeScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const user = useUser();
  const queryClient = useQueryClient();
  const now = useNow();
  const deps = useMemo(() => createSubmitDeps(api, t), [api, t]);
  const todayQuery = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [menuOpen, setMenuOpen] = useState(false);
  const inFlight = useRef(false);
  const resumed = useRef(false);
  const today = todayQuery.data;

  useEffect(() => {
    if (!today || resumed.current) return;
    resumed.current = true;
    resumePendingOnLaunch(today, deps).catch((err: unknown) => console.warn('home: resume failed', err));
  }, [today, deps]);

  // Android drops alarms on reboot or force-stop; re-arm the check-out reminder whenever Home sees an open day.
  const openDay = today?.day?.status === 'CHECKED_IN' ? today : null;
  useEffect(() => {
    if (!openDay) return;
    deps.reminder.schedule(openDay).catch((err: unknown) => console.warn('home: reminder re-arm failed', err));
  }, [openDay, deps]);

  const run = useCallback(
    async (action: AttendanceAction) => {
      if (inFlight.current || !today) return;
      inFlight.current = true;
      setPhase({ kind: 'busy', step: 'starting' });
      try {
        const outcome = await submitAttendance(action, today, deps, (step) => setPhase({ kind: 'busy', step }));
        setPhase({ kind: 'result', action, outcome });
      } catch (err) {
        console.warn('home: submit failed', err);
        setPhase({ kind: 'result', action, outcome: { code: 'NETWORK' } });
      } finally {
        inFlight.current = false;
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
    [today, deps, queryClient],
  );

  if (todayQuery.isPending) return <Loading />;
  if (!today) {
    return (
      <Screen>
        <ErrorState onRetry={() => void todayQuery.refetch()} />
      </Screen>
    );
  }

  const { view, missedYesterday } = homeView(today);
  const firstName = user.name.split(' ')[0] ?? user.name;
  const result = phase.kind === 'result' ? outcomeView(phase.outcome.code, phase.action, phase.outcome.result) : null;

  function onResultAction() {
    if (phase.kind !== 'result' || !result) return;
    const action = phase.action;
    setPhase({ kind: 'idle' });
    if (result.action === 'retry') void run(action);
    if (result.action === 'openAppSettings') openAppSettings().catch((e: unknown) => console.warn(e));
    if (result.action === 'openLocationSettings') openLocationSettings().catch((e: unknown) => console.warn(e));
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text color={colors.muted} style={{ fontSize: 15 }}>
            {formatLongDate(now, t)}
          </Text>
          <Text variant="h1" style={{ fontSize: 26 }}>
            {t('home.greeting', { name: firstName })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.menu')}
          onPress={() => setMenuOpen(true)}
          style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="menu" size={26} />
        </Pressable>
      </View>

      {missedYesterday ? (
        <View style={{ marginHorizontal: 20, marginTop: 20 }}>
          <Banner tone="warn" icon="alert" title={t('home.missedTitle')} body={t('home.missedBody')} />
        </View>
      ) : null}

      <StatusCard view={view} now={now} />

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 16 }}>
        {view.kind === 'checkIn' ? (
          <>
            <Button label={t('home.checkIn')} variant="checkIn" size="big" icon="checkIn" onPress={() => void run('checkIn')} />
            <Text color={colors.muted} style={{ textAlign: 'center', fontSize: 17 }}>
              {t('home.checkInHint')}
            </Text>
          </>
        ) : null}
        {view.kind === 'working' ? (
          <>
            <Button label={t('home.checkOut')} variant="checkOut" size="big" icon="checkOut" onPress={() => void run('checkOut')} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <Icon name="bell" size={20} color={colors.muted} />
              <Text color={colors.muted} style={{ fontSize: 16 }}>
                {t('home.reminderAt', { time: formatHhMm(today.reminderTime, t) })}
              </Text>
            </View>
          </>
        ) : null}
        {view.kind === 'done' ? (
          <Card style={{ borderRadius: 28, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={48} color={colors.checkIn} strokeWidth={2.4} />
            </View>
            <Text variant="h1" style={{ fontSize: 32 }}>
              {t('home.doneTitle')}
            </Text>
            <Text variant="monoLarge">
              {`${formatTime(view.checkInAt, t, false)} – ${view.checkOutAt ? formatTime(view.checkOutAt, t, false) : '?'}`}
            </Text>
            {view.workedMinutes != null ? (
              <Text color={colors.muted} style={{ fontSize: 18 }}>
                {t('home.worked', { duration: formatDuration(view.workedMinutes, t) })}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {view.kind === 'noSite' ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
            <Icon name="person" size={40} color={colors.muted} />
            <Text variant="h2">{t('home.noSiteTitle')}</Text>
            <Text color={colors.muted}>{t('home.noSiteBody')}</Text>
          </Card>
        ) : null}
      </View>

      <Modal
        visible={phase.kind !== 'idle'}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (phase.kind === 'result') setPhase({ kind: 'idle' });
        }}
      >
        {phase.kind === 'busy' ? <BusyView step={phase.step} /> : null}
        {result ? <ResultView view={result} onAction={onResultAction} /> : null}
      </Modal>
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </Screen>
  );
}

function StatusCard({ view, now }: { view: HomeView; now: Date }) {
  const { t } = useTranslation();
  if (view.kind === 'checkIn') {
    return (
      <Card style={{ marginHorizontal: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pin" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="small" color={colors.muted}>
            {t('home.yourSite')}
          </Text>
          <Text variant="bodyStrong" style={{ fontSize: 18 }}>
            {view.siteName}
          </Text>
        </View>
      </Card>
    );
  }
  if (view.kind === 'working') {
    return (
      <View style={{ marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 20, backgroundColor: colors.checkIn, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.workingDot }} />
          <Text variant="label" color={colors.white} style={{ fontSize: 16 }}>
            {t('home.working')}
          </Text>
        </View>
        <Text variant="h1" color={colors.white} style={{ fontSize: 30 }}>
          {t('home.since', { time: formatTime(view.since, t) })}
        </Text>
        <Text color={colors.workingSub} style={{ fontSize: 16 }}>
          {t('home.soFar', { site: view.siteName, duration: formatDuration(minutesSince(view.since, now), t) })}
        </Text>
      </View>
    );
  }
  return null;
}
