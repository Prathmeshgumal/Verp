import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DashboardMapDay } from '@ve/shared';
import { dayTime, dayTone, stackDays, stackTags, visibleDays } from '../../admin/workingMap';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { LeafletMap } from '../../maps/LeafletMap';
import type { AttendanceFilters, TodayStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet, SheetOption } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { type RefusedAttempt, RefusedRow, RefusedSheet } from './refused';

/** Earlier than any record: the missed/review counts cover all time, as on the web. */
export const ALL_TIME_FROM = '2020-01-01';

type Props = NativeStackScreenProps<TodayStackParamList, 'Today'>;

const TONE_DOT = { green: colors.checkIn, orange: colors.checkOut, grey: colors.muted } as const;

interface StatProps {
  label: string;
  value: number;
  tone?: 'green' | 'warn' | 'danger';
  onPress?: () => void;
}

/** A small tile, four to a row: the number first, a short label under it. */
function Stat({ label, value, tone, onPress }: StatProps) {
  const hot = value > 0;
  const green = tone === 'green';
  const bg = green ? colors.checkIn : hot && tone === 'warn' ? colors.warnBg : hot && tone === 'danger' ? colors.dangerBg : colors.surface;
  const border = green ? colors.checkIn : hot && tone === 'warn' ? colors.warnBorder : hot && tone === 'danger' ? `${colors.danger}40` : colors.line;
  const valueColor = green ? colors.white : hot && tone === 'warn' ? colors.warnText : hot && tone === 'danger' ? colors.danger : colors.text;
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 20, lineHeight: 24 }} color={valueColor}>
          {String(value)}
        </Text>
        {onPress ? <Icon name="chevronRight" size={14} color={green ? colors.onDark : valueColor} /> : null}
      </View>
      <Text numberOfLines={2} style={{ fontSize: 11, lineHeight: 13 }} color={green ? colors.workingSub : hot && tone ? valueColor : colors.muted}>
        {label}
      </Text>
    </>
  );
  const style = { width: '23.5%' as const, minHeight: 60, backgroundColor: bg, borderRadius: radius.md, borderWidth: 1, borderColor: border, paddingVertical: 7, paddingHorizontal: 8, gap: 1 };
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={style}>
      {body}
    </View>
  );
}

function SectionHeader({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="bodyStrong">{title}</Text>
        {count != null ? (
          <Text variant="mono" color={colors.muted} style={{ fontSize: 13 }}>
            {String(count)}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function TodayScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { height } = useWindowDimensions();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [showFinished, setShowFinished] = useState(false);
  const [stackKey, setStackKey] = useState<string | null>(null);
  const [openAttempt, setOpenAttempt] = useState<RefusedAttempt | null>(null);

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const d = query.data;
  const stacks = stackDays(visibleDays(d.mapDays, showFinished));
  const openStack = stacks.find((s) => s.key === stackKey) ?? null;
  const dayOf = new Map(d.mapDays.map((m) => [m.employeeId, m.dayId]));

  function openDay(id: string) {
    setStackKey(null);
    navigation.navigate('AttendanceDetail', { id });
  }
  function openAttendance(filters: Partial<AttendanceFilters>) {
    navigation.getParent()?.navigate('AttendanceTab', { screen: 'AttendanceList', params: { filters } });
  }
  function onTag(key: string) {
    const stack = stacks.find((s) => s.key === key);
    if (!stack) return;
    if (stack.days.length === 1) openDay(stack.days[0]!.dayId);
    else setStackKey(key);
  }

  const upToToday = { from: ALL_TIME_FROM, to: d.workDate };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
              void sites.refetch();
            }}
          />
        }
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: query.isError ? colors.warnBorder : colors.checkIn }} />
            <Text variant="small" color={colors.muted}>
              {`${formatWorkDateMedium(d.workDate, t)} · ${t('admin.today.updatedAt', { time: formatTime(new Date(query.dataUpdatedAt).toISOString(), t) })}`}
            </Text>
          </View>
          <Text variant="h1">{t('admin.today.title')}</Text>
        </View>

        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 }}>
          <Stat label={t('admin.today.workingNow')} value={d.workingNow} tone="green" />
          <Stat label={t('admin.today.checkedIn')} value={d.checkedInToday} />
          <Stat label={t('admin.today.completed')} value={d.completedToday} />
          <Stat label={t('admin.today.notYetIn')} value={d.notYetIn} />
          <Stat label={t('admin.today.missed')} value={d.missedCheckouts} tone="warn" onPress={() => openAttendance({ ...upToToday, status: 'MISSED_CHECKOUT' })} />
          <Stat label={t('admin.today.needsReview')} value={d.needsReview} tone="danger" onPress={() => openAttendance({ ...upToToday, needsReview: true })} />
          <Stat label={t('admin.today.refusedToday')} value={d.refused.length} tone="danger" />
          <Stat label={t('admin.today.activeEmployees')} value={d.activeEmployees} />
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          <SectionHeader title={t('admin.today.onSite')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="small" color={colors.muted}>
                {t('admin.today.showFinished')}
              </Text>
              <Switch accessibilityLabel={t('admin.today.showFinished')} value={showFinished} onValueChange={setShowFinished} trackColor={{ true: colors.checkIn }} />
            </View>
          </SectionHeader>
          {d.mapDays.length === 0 ? (
            <Text variant="small" color={colors.muted} style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
              {t('admin.today.nobodyYet')}
            </Text>
          ) : null}
          <LeafletMap
            testID="today-map"
            center={null}
            radiusM={0}
            height={Math.max(260, Math.min(460, Math.round(height * 0.45)))}
            sites={(sites.data ?? []).filter((s) => s.isActive).map((s) => ({ lat: s.lat, lng: s.lng, radiusM: s.radiusM }))}
            tags={stackTags(stacks, t)}
            pins={d.refused.map((r) => ({ lat: r.lat, lng: r.lng, color: colors.danger }))}
            recenterKey={stacks.length + d.refused.length + (sites.data?.length ?? 0)}
            onTag={onTag}
          />
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
          <SectionHeader title={t('admin.today.workingNow')} count={d.working.length} />
          {d.working.length === 0 ? (
            <Text color={colors.muted} style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              {t('admin.today.nobodyWorking')}
            </Text>
          ) : null}
          {d.working.map((w) => {
            const dayId = dayOf.get(w.employeeId);
            return (
              <Pressable
                key={w.employeeId}
                accessibilityRole="button"
                accessibilityLabel={w.name}
                disabled={!dayId}
                onPress={() => dayId && openDay(dayId)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft }}
              >
                <Avatar name={w.name} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                    {w.name}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {t('admin.today.since', { site: w.siteName, time: formatTime(w.checkInAt, t) })}
                  </Text>
                </View>
                {dayId ? <Icon name="chevronRight" size={18} color={colors.muted} /> : null}
              </Pressable>
            );
          })}
        </View>

        {d.refused.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
            <SectionHeader title={t('admin.today.refused')} count={d.refused.length} />
            {d.refused.map((a) => (
              <RefusedRow key={a.id} attempt={a} onPress={() => setOpenAttempt(a)} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <RefusedSheet attempt={openAttempt} onClose={() => setOpenAttempt(null)} />
      <Sheet visible={!!openStack} title={t('admin.today.here', { count: openStack?.days.length ?? 0 })} onClose={() => setStackKey(null)}>
        {(openStack?.days ?? []).map((day: DashboardMapDay) => (
          <View key={day.dayId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, marginLeft: 6, backgroundColor: TONE_DOT[dayTone(day)] }} />
            <View style={{ flex: 1 }}>
              <SheetOption label={day.name} detail={dayTime(day, t)} onPress={() => openDay(day.dayId)} />
            </View>
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}
