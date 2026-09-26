import React from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatDuration, formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import type { AttendanceStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { StatusBadge } from './AttendanceListScreen';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceDetail'>;

export function AttendanceDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { id } = route.params;
  const query = useQuery({ queryKey: queryKeys.attendanceDay(id), queryFn: () => api.getAttendance(id) });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { day, events } = query.data;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h1">{day.employeeName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text color={colors.muted}>{`${formatWorkDateMedium(day.workDate, t)} · ${day.siteName}`}</Text>
            <StatusBadge status={day.status} />
          </View>
        </View>

        {day.needsReview ? <Banner tone="warn" icon="alert" title={t('admin.attendance.fixOnWeb')} /> : null}

        <Card style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.muted}>
              {t('admin.attendance.checkIn')}
            </Text>
            <Text variant="monoLarge">{formatTime(day.checkInAt, t)}</Text>
            <Text variant="small" color={colors.muted}>
              {t('admin.attendance.distance', { m: Math.round(day.checkInDistanceM), acc: Math.round(day.checkInAccuracyM) })}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="label" color={colors.muted}>
              {t('admin.attendance.checkOut')}
            </Text>
            <Text variant="monoLarge">{day.checkOutAt ? formatTime(day.checkOutAt, t) : t('admin.attendance.notYet')}</Text>
            {day.checkOutDistanceM != null && day.checkOutAccuracyM != null ? (
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(day.checkOutDistanceM), acc: Math.round(day.checkOutAccuracyM) })}
              </Text>
            ) : null}
          </View>
          {day.workedMinutes != null ? (
            <Text variant="bodyStrong">{t('admin.attendance.worked', { duration: formatDuration(day.workedMinutes, t) })}</Text>
          ) : null}
        </Card>

        {day.flags.length > 0 ? (
          <Card style={{ gap: 6 }}>
            <Text variant="label">{t('admin.attendance.flags')}</Text>
            {day.flags.map((flag) => (
              <Text key={flag} color={colors.warnText}>
                {t(`admin.flags.${flag}`, { defaultValue: flag })}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <Text variant="label">{t('admin.attendance.attempts')}</Text>
          {events.map((ev) => (
            <View key={ev.id} style={{ borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{`${t(`admin.events.${ev.type}`)} · ${formatTime(ev.serverTime, t)}`}</Text>
                <Text variant="mono" color={ev.result === 'OK' ? colors.checkIn : colors.checkOut}>
                  {ev.result}
                </Text>
              </View>
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(ev.distanceM ?? 0), acc: Math.round(ev.accuracyM) })}
              </Text>
              {ev.isMock ? (
                <Text variant="small" color={colors.warnText}>
                  {t('admin.attendance.mock')}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
