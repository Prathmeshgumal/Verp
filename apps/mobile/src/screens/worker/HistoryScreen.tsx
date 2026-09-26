import React from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatDuration, formatTime, formatWorkDateShort } from '../../attendance/format';
import { buildHistoryRows, type HistoryRow } from '../../attendance/history';
import { queryKeys } from '../../attendance/queryKeys';
import { colors, radius } from '../../theme/tokens';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon, type IconName } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

export function HistoryScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const todayQuery = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() });
  const workDate = todayQuery.data?.workDate ?? '';
  const historyQuery = useQuery({
    queryKey: queryKeys.history(workDate),
    queryFn: () => api.myAttendance(addDays(workDate, -29), workDate),
    enabled: workDate !== '',
  });

  if (todayQuery.isPending || (workDate && historyQuery.isPending)) return <Loading />;
  if (!workDate || !historyQuery.data) {
    return (
      <Screen>
        <ErrorState
          onRetry={() => {
            void todayQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 2 }}>
        <Text variant="h1">{t('history.title')}</Text>
        <Text color={colors.muted} style={{ fontSize: 15 }}>
          {t('history.subtitle')}
        </Text>
      </View>
      <FlatList
        data={buildHistoryRows(workDate, historyQuery.data)}
        keyExtractor={(row) => row.workDate}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
        refreshing={historyQuery.isRefetching}
        onRefresh={() => void historyQuery.refetch()}
        renderItem={({ item }) => <HistoryRowView row={item} isToday={item.workDate === workDate} />}
      />
    </Screen>
  );
}

const ROW_STYLE: Record<HistoryRow['kind'], { bg: string; circle: string; icon: IconName; iconColor: string; title: string }> = {
  completed: { bg: colors.surface, circle: colors.successBg, icon: 'check', iconColor: colors.checkIn, title: colors.text },
  working: { bg: colors.surface, circle: colors.infoBg, icon: 'checkIn', iconColor: colors.info, title: colors.text },
  missed: { bg: colors.warnBg, circle: colors.warnIconBg, icon: 'alert', iconColor: colors.warnMuted, title: colors.warnText },
  absent: { bg: colors.lineSoft, circle: colors.line, icon: 'minus', iconColor: colors.muted, title: colors.muted },
};

function HistoryRowView({ row, isToday }: { row: HistoryRow; isToday: boolean }) {
  const { t } = useTranslation();
  const style = ROW_STYLE[row.kind];
  const day = formatWorkDateShort(row.workDate, t);
  const inTime = row.checkInAt ? formatTime(row.checkInAt, t, false) : '';
  let detail: string;
  if (row.kind === 'completed') detail = `${inTime} – ${row.checkOutAt ? formatTime(row.checkOutAt, t, false) : '?'}`;
  else if (row.kind === 'working') detail = t('history.working', { time: inTime });
  else if (row.kind === 'missed') detail = t('history.noCheckout', { time: inTime });
  else detail = t('history.notPresent');

  return (
    <View style={{ backgroundColor: style.bg, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: style.circle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={style.icon} size={20} color={style.iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={style.title}>
          {isToday ? t('history.today', { day }) : day}
        </Text>
        <Text variant={row.kind === 'completed' ? 'mono' : 'small'} color={row.kind === 'missed' ? colors.warnMuted : colors.muted}>
          {detail}
        </Text>
      </View>
      {row.kind === 'completed' && row.workedMinutes != null ? (
        <Text variant="mono" style={{ fontSize: 17 }}>
          {formatDuration(row.workedMinutes, t, true)}
        </Text>
      ) : null}
      {row.kind === 'missed' ? (
        <Text variant="mono" color={colors.warnMuted} style={{ fontSize: 17 }}>
          —
        </Text>
      ) : null}
    </View>
  );
}
