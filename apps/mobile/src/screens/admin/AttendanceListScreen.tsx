import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminDayDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatTime, formatWorkDateMedium } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { queryKeys } from '../../attendance/queryKeys';
import type { AttendanceStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceList'>;

const PAGE_SIZE = 50;

export function StatusBadge({ status }: { status: AdminDayDto['status'] }) {
  const { t } = useTranslation();
  const bg = status === 'CHECKED_IN' ? colors.successBg : status === 'MISSED_CHECKOUT' ? colors.warnBg : colors.lineSoft;
  const fg = status === 'CHECKED_IN' ? colors.checkIn : status === 'MISSED_CHECKOUT' ? colors.warnText : colors.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text variant="small" color={fg}>
        {t(`admin.status.${status}`)}
      </Text>
    </View>
  );
}

export function AttendanceListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const today = localToday();
  const [date, setDate] = useState(today);
  const employeeId = route.params?.employeeId;
  const employeeName = route.params?.employeeName;
  const params = employeeId ? { from: addDays(today, -29), to: today, employeeId } : { from: date, to: date };

  const query = useInfiniteQuery({
    queryKey: queryKeys.attendance(params),
    queryFn: ({ pageParam }) => api.listAttendance({ ...params, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 12 }}>
        <Text variant="h1">{t('admin.attendance.title')}</Text>
        {employeeId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: colors.dark, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text variant="label" color={colors.onDark}>
                {t('admin.attendance.employeeFilter', { name: employeeName ?? '' })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.clearFilter')}
              onPress={() => navigation.setParams({ employeeId: undefined, employeeName: undefined })}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" />
            </Pressable>
            <Text variant="small" color={colors.muted}>
              {t('admin.attendance.last30')}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.prevDay')}
              onPress={() => setDate((d) => addDays(d, -1))}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="chevronLeft" />
            </Pressable>
            <Text variant="bodyStrong">{formatWorkDateMedium(date, t)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.attendance.nextDay')}
              disabled={date >= today}
              accessibilityState={{ disabled: date >= today }}
              onPress={() => setDate((d) => addDays(d, 1))}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: date >= today ? 0.3 : 1 }}
            >
              <Icon name="chevronRight" />
            </Pressable>
          </View>
        )}
      </View>

      {query.isPending ? (
        <Loading />
      ) : query.isError && items.length === 0 ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={<Text color={colors.muted}>{t('admin.attendance.empty')}</Text>}
          ListFooterComponent={
            query.hasNextPage ? (
              <Button label={t('common.loadMore')} variant="secondary" size="small" onPress={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} />
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.employeeName}, ${t(`admin.status.${item.status}`)}`}
              onPress={() => navigation.navigate('AttendanceDetail', { id: item.id })}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {item.employeeName}
                </Text>
                {item.needsReview ? (
                  <View style={{ backgroundColor: colors.warnBg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text variant="small" color={colors.warnText}>
                      {t('admin.attendance.review')}
                    </Text>
                  </View>
                ) : null}
                <StatusBadge status={item.status} />
              </View>
              <Text variant="small" color={colors.muted}>
                {employeeId ? `${formatWorkDateMedium(item.workDate, t)} · ${item.siteName}` : item.siteName}
              </Text>
              <Text variant="mono" color={colors.muted}>
                {`${formatTime(item.checkInAt, t)} – ${item.checkOutAt ? formatTime(item.checkOutAt, t) : '?'}`}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
