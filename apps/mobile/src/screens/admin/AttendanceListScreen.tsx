import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminDayDto, RefusedAttemptDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { queryKeys } from '../../attendance/queryKeys';
import { shareFile } from '../../native/device';
import type {
  AttendanceFilters,
  AttendanceStackParamList,
  AttendanceView,
} from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { DatePickerField } from '../../ui/DatePickerField';
import { Icon } from '../../ui/Icon';
import { PickerField } from '../../ui/PickerField';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { adminErrorKey } from './adminErrors';
import { RefusedRow, RefusedSheet } from './refused';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceList'>;

const PAGE_SIZE = 50;

export function StatusBadge({ status }: { status: AdminDayDto['status'] }) {
  const { t } = useTranslation();
  const bg =
    status === 'CHECKED_IN'
      ? colors.successBg
      : status === 'MISSED_CHECKOUT'
        ? colors.warnBg
        : colors.lineSoft;
  const fg =
    status === 'CHECKED_IN'
      ? colors.checkIn
      : status === 'MISSED_CHECKOUT'
        ? colors.warnText
        : colors.muted;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: 10,
      }}
    >
      <Text variant="small" color={fg}>
        {t(`admin.status.${status}`)}
      </Text>
    </View>
  );
}

/** The query the API gets: the employee's name is only for the screen. */
export function toQuery(f: AttendanceFilters): Omit<AttendanceFilters, 'employeeName'> {
  const query = { ...f };
  delete query.employeeName;
  return query;
}

function ViewSwitch({
  view,
  onChange,
}: {
  view: AttendanceView;
  onChange: (view: AttendanceView) => void;
}) {
  const { t } = useTranslation();
  const views: { value: AttendanceView; label: string }[] = [
    { value: 'days', label: t('admin.refused.tabDays') },
    { value: 'refused', label: t('admin.refused.tabRefused') },
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 3,
        borderRadius: radius.md,
        backgroundColor: colors.lineSoft,
      }}
    >
      {views.map((v) => {
        const on = view === v.value;
        return (
          <Pressable
            key={v.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={v.label}
            onPress={() => onChange(v.value)}
            style={{
              flex: 1,
              height: 38,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: on ? colors.surface : 'transparent',
              borderWidth: on ? 1 : 0,
              borderColor: colors.line,
            }}
          >
            <Text
              style={{ fontFamily: on ? fonts.bodySemi : fonts.body, fontSize: 14 }}
              color={on ? colors.text : colors.muted}
            >
              {v.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AttendanceListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const today = localToday();
  const [filters, setFilters] = useState<AttendanceFilters>({
    from: today,
    to: today,
    ...route.params?.filters,
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [view, setView] = useState<AttendanceView>(route.params?.view ?? 'days');
  const [openAttempt, setOpenAttempt] = useState<RefusedAttemptDto | null>(null);

  // Links from Today and from an employee replace the filters (and pick the list).
  const incoming = route.params?.filters;
  const incomingView = route.params?.view;
  useEffect(() => {
    if (incoming) setFilters({ from: today, to: today, ...incoming });
    if (incoming || incomingView) setView(incomingView ?? 'days');
  }, [incoming, incomingView, today]);

  const employees = useQuery({
    queryKey: queryKeys.employees({}),
    queryFn: () => api.listEmployees({}),
  });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const query = useInfiniteQuery({
    queryKey: queryKeys.attendance(toQuery(filters)),
    queryFn: ({ pageParam }) =>
      api.listAttendance({ ...toQuery(filters), page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: view === 'days',
  });
  const refusedParams = {
    from: filters.from,
    to: filters.to,
    employeeId: filters.employeeId,
    siteId: filters.siteId,
  };
  const refused = useInfiniteQuery({
    queryKey: queryKeys.refused(refusedParams),
    queryFn: ({ pageParam }) =>
      api.listRefused({ ...refusedParams, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: view === 'refused',
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const refusedItems = refused.data?.pages.flatMap((p) => p.items) ?? [];
  const total = view === 'refused' ? refused.data?.pages[0]?.total : query.data?.pages[0]?.total;
  const oneDay = filters.from === filters.to;

  function update(patch: Partial<AttendanceFilters>) {
    navigation.setParams({ filters: undefined, view: undefined });
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (next.from > next.to)
        return patch.from ? { ...next, to: next.from } : { ...next, from: next.to };
      return next;
    });
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await api.exportAttendanceCsv(toQuery(filters));
      await shareFile(
        `attendance_${filters.from}_${filters.to}.csv`,
        csv,
        'text/csv',
        t('admin.attendance.export'),
      );
    } catch (err) {
      setExportError(t(adminErrorKey(err)));
    } finally {
      setExporting(false);
    }
  }

  const employeeOptions = [
    { value: '', label: t('admin.attendance.allEmployees') },
    ...(employees.data ?? []).map((e) => ({ value: e.id, label: e.name })),
    ...(filters.employeeId && !employees.data?.some((e) => e.id === filters.employeeId)
      ? [{ value: filters.employeeId, label: filters.employeeName ?? '…' }]
      : []),
  ];
  const siteOptions = [
    { value: '', label: t('admin.attendance.allSites') },
    ...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];
  const statusOptions = [
    { value: '', label: t('admin.attendance.anyStatus') },
    { value: 'CHECKED_IN', label: t('admin.status.CHECKED_IN') },
    { value: 'COMPLETED', label: t('admin.status.COMPLETED') },
    { value: 'MISSED_CHECKOUT', label: t('admin.status.MISSED_CHECKOUT') },
  ];

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="h1">{t('admin.attendance.title')}</Text>
          <Text variant="small" color={colors.muted}>
            {total == null
              ? ' '
              : view === 'refused'
                ? t('admin.refused.count', { count: total })
                : t('admin.attendance.days', { count: total })}
          </Text>
        </View>
        {view === 'days' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('admin.attendance.export')}
            accessibilityState={{ busy: exporting }}
            disabled={exporting}
            onPress={() => void exportCsv()}
            style={{
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surface,
              opacity: exporting ? 0.5 : 1,
            }}
          >
            <Icon name="download" size={18} />
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14 }}>
              {t('admin.attendance.exportShort')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ViewSwitch
        view={view}
        onChange={(v) => {
          navigation.setParams({ filters: undefined, view: undefined });
          setView(v);
        }}
      />
      {exportError ? (
        <Text
          accessibilityRole="alert"
          variant="small"
          color={colors.danger}
          style={{ paddingHorizontal: 20 }}
        >
          {exportError}
        </Text>
      ) : null}

      <View style={{ paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row', gap: 10 }}>
        <DatePickerField
          label={t('admin.attendance.from')}
          value={filters.from}
          max={today}
          onChange={(from) => update({ from })}
        />
        <DatePickerField
          label={t('admin.attendance.to')}
          value={filters.to}
          max={today}
          onChange={(to) => update({ to })}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        <PickerField
          compact
          label={t('admin.attendance.employee')}
          value={filters.employeeId ?? ''}
          options={employeeOptions}
          onChange={(v) =>
            update({
              employeeId: v || undefined,
              employeeName: employeeOptions.find((o) => o.value === v)?.label,
            })
          }
        />
        <PickerField
          compact
          label={t('admin.attendance.site')}
          value={filters.siteId ?? ''}
          options={siteOptions}
          onChange={(v) => update({ siteId: v || undefined })}
        />
        {view === 'days' ? (
          <>
            <PickerField
              compact
              label={t('admin.attendance.status')}
              value={filters.status ?? ''}
              options={statusOptions}
              onChange={(v) => update({ status: (v || undefined) as AttendanceFilters['status'] })}
            />
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={t('admin.attendance.needsReviewOnly')}
              accessibilityState={{ checked: !!filters.needsReview }}
              onPress={() => update({ needsReview: filters.needsReview ? undefined : true })}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: filters.needsReview ? colors.dark : colors.inputBorder,
                backgroundColor: filters.needsReview ? colors.dark : colors.surface,
              }}
            >
              {filters.needsReview ? <Icon name="check" size={16} color={colors.onDark} /> : null}
              <Text
                style={{ fontFamily: fonts.bodySemi, fontSize: 14 }}
                color={filters.needsReview ? colors.onDark : colors.text}
              >
                {t('admin.attendance.needsReviewOnly')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {view === 'refused' ? (
        refused.isPending ? (
          <Loading />
        ) : refused.isError && refusedItems.length === 0 ? (
          <ErrorState onRetry={() => void refused.refetch()} />
        ) : (
          <FlatList
            data={refusedItems}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
            refreshing={refused.isRefetching && !refused.isFetchingNextPage}
            onRefresh={() => void refused.refetch()}
            ListEmptyComponent={<Text color={colors.muted}>{t('admin.refused.empty')}</Text>}
            ListFooterComponent={
              refused.hasNextPage ? (
                <View style={{ paddingTop: 8 }}>
                  <Button
                    label={t('common.loadMore')}
                    variant="secondary"
                    size="small"
                    onPress={() => void refused.fetchNextPage()}
                    disabled={refused.isFetchingNextPage}
                  />
                </View>
              ) : undefined
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  overflow: 'hidden',
                }}
              >
                <RefusedRow attempt={item} divider={false} onPress={() => setOpenAttempt(item)} />
              </View>
            )}
          />
        )
      ) : query.isPending ? (
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
              <Button
                label={t('common.loadMore')}
                variant="secondary"
                size="small"
                onPress={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.employeeName}, ${t(`admin.status.${item.status}`)}`}
              onPress={() => navigation.navigate('AttendanceDetail', { id: item.id })}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.line,
                padding: 14,
                gap: 6,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {item.employeeName}
                </Text>
                {item.needsReview ? (
                  <View
                    style={{
                      backgroundColor: colors.dangerBg,
                      borderRadius: radius.pill,
                      paddingVertical: 3,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text variant="small" color={colors.danger}>
                      {t('admin.attendance.review')}
                    </Text>
                  </View>
                ) : null}
                <StatusBadge status={item.status} />
              </View>
              <Text variant="small" color={colors.muted}>
                {oneDay
                  ? item.siteName
                  : `${formatWorkDateMedium(item.workDate, t)} · ${item.siteName}`}
              </Text>
              <Text variant="mono" color={colors.muted}>
                {`${formatTime(item.checkInAt, t)} – ${item.checkOutAt ? formatTime(item.checkOutAt, t) : '?'}`}
              </Text>
            </Pressable>
          )}
        />
      )}
      <RefusedSheet attempt={openAttempt} onClose={() => setOpenAttempt(null)} />
    </Screen>
  );
}
