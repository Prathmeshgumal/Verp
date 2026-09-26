import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatDuration, formatMonthYear, formatTime, formatWorkDateShort } from '../../attendance/format';
import { buildMonth, monthOf, monthRange, monthSummary, shiftMonth, type DayCell, type DayKind } from '../../attendance/history';
import { queryKeys } from '../../attendance/queryKeys';
import { colors, fonts, radius } from '../../theme/tokens';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

/** How each day looks in the calendar: a full green day reads at a glance, problems in amber and red. */
const CELL: Record<DayKind, { bg: string; fg: string; border: string }> = {
  completed: { bg: colors.checkIn, fg: colors.white, border: colors.checkIn },
  working: { bg: colors.successBg, fg: colors.successText, border: colors.checkIn },
  missed: { bg: colors.warnBg, fg: colors.warnText, border: colors.warnBorder },
  absent: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
  none: { bg: 'transparent', fg: colors.muted, border: 'transparent' },
};

const DOT: Record<DayKind, string> = {
  completed: colors.checkIn,
  working: colors.checkIn,
  missed: colors.warnBorder,
  absent: colors.danger,
  none: colors.line,
};

export function HistoryScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const todayQuery = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() });
  const workDate = todayQuery.data?.workDate ?? '';
  const joinedOn = todayQuery.data?.joinedOn ?? '';
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? monthOf(workDate);
  const range = monthRange(month, workDate);
  const [selected, setSelected] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: queryKeys.history(`${range.from}:${range.to}`),
    queryFn: () => api.myAttendance(range.from, range.to),
    enabled: workDate !== '',
  });

  if (todayQuery.isPending) return <Loading />;
  if (!workDate || historyQuery.isError) {
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

  const grid = buildMonth(month, workDate, joinedOn, historyQuery.data ?? []);
  const summary = monthSummary(grid);
  const canBack = month > monthOf(joinedOn);
  const canForward = month < monthOf(workDate);
  const shownDate = selected ?? (monthOf(workDate) === month ? workDate : null);
  const shown = grid.weeks.flat().find((c) => c?.workDate === shownDate) ?? null;

  function go(n: number) {
    setPicked(shiftMonth(month, n));
    setSelected(null);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={historyQuery.isRefetching} onRefresh={() => void historyQuery.refetch()} />}
      >
        <Text variant="h1" style={{ paddingHorizontal: 4 }}>
          {t('history.title')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MonthArrow icon="chevronLeft" label={t('history.previousMonth')} disabled={!canBack} onPress={() => go(-1)} />
          <Text variant="h2" style={{ flex: 1, textAlign: 'center' }} accessibilityRole="header">
            {formatMonthYear(month, t)}
          </Text>
          <MonthArrow icon="chevronRight" label={t('history.nextMonth')} disabled={!canForward} onPress={() => go(1)} />
        </View>

        <View style={{ flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SummaryCell label={t('history.present')} value={String(summary.present)} />
          <SummaryCell label={t('history.absent')} value={String(summary.absent)} tone={summary.absent ? colors.danger : undefined} />
          <SummaryCell label={t('history.missed')} value={String(summary.missed)} tone={summary.missed ? colors.warnMuted : undefined} />
          <SummaryCell label={t('history.hours')} value={String(Math.floor(summary.minutes / 60))} />
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekdayLetters(t).map((d, i) => (
              <Text key={i} variant="small" color={colors.muted} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi }}>
                {d}
              </Text>
            ))}
          </View>
          {historyQuery.isPending ? (
            <ActivityIndicator color={colors.text} style={{ height: 240 }} />
          ) : (
            grid.weeks.map((week, w) => (
              <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
                {week.map((cell, i) =>
                  cell ? (
                    <DayButton key={cell.workDate} cell={cell} isToday={cell.workDate === workDate} selected={cell.workDate === shownDate} onPress={() => setSelected(cell.workDate)} />
                  ) : (
                    <View key={`blank-${i}`} style={{ flex: 1, aspectRatio: 1 }} />
                  ),
                )}
              </View>
            ))
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 4, paddingTop: 6 }}>
            {(['completed', 'working', 'missed', 'absent'] as const).map((kind) => (
              <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CELL[kind].bg, borderWidth: 1, borderColor: CELL[kind].border }} />
                <Text color={colors.muted} style={{ fontSize: 12 }}>
                  {kindLabel(kind, t)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {shown ? <DayDetail cell={shown} isToday={shown.workDate === workDate} joinedOn={joinedOn} /> : (
          <Text color={colors.muted} style={{ textAlign: 'center', fontSize: 15 }}>
            {t('history.tapDay')}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Monday-first single letters from the translated short weekday names. */
function weekdayLetters(t: TFunction): string[] {
  const names = t('date.weekdaysShort').split(',');
  return [1, 2, 3, 4, 5, 6, 0].map((i) => (names[i] ?? '').slice(0, 1));
}

function MonthArrow({ icon, label, disabled, onPress }: { icon: 'chevronLeft' | 'chevronRight'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 }}>
      <Text variant="monoLarge" color={tone ?? colors.text} style={{ fontSize: 22, lineHeight: 28 }}>
        {value}
      </Text>
      <Text color={colors.muted} numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function kindLabel(kind: DayKind, t: TFunction): string {
  return { completed: t('history.completed'), working: t('home.working'), missed: t('history.missed'), absent: t('history.absent'), none: '' }[kind];
}

function DayButton({ cell, isToday, selected, onPress }: { cell: DayCell; isToday: boolean; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const style = CELL[cell.kind];
  const status = kindLabel(cell.kind, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status ? `${formatWorkDateShort(cell.workDate, t)}, ${status}` : formatWorkDateShort(cell.workDate, t)}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radius.sm,
        backgroundColor: style.bg,
        borderWidth: selected ? 2.5 : isToday ? 1.5 : 1,
        borderColor: selected ? colors.text : isToday ? colors.text : style.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: isToday || cell.kind !== 'none' ? fonts.monoSemi : fonts.mono, fontSize: 16, color: style.fg }}>{cell.date}</Text>
    </Pressable>
  );
}

function DayDetail({ cell, isToday, joinedOn }: { cell: DayCell; isToday: boolean; joinedOn: string }) {
  const { t } = useTranslation();
  const day = formatWorkDateShort(cell.workDate, t);
  const inTime = cell.checkInAt ? formatTime(cell.checkInAt, t, false) : '';
  let detail: string;
  if (cell.kind === 'completed') detail = `${inTime} – ${cell.checkOutAt ? formatTime(cell.checkOutAt, t, false) : '?'}`;
  else if (cell.kind === 'working') detail = t('history.working', { time: inTime });
  else if (cell.kind === 'missed') detail = t('history.noCheckout', { time: inTime });
  else if (cell.kind === 'absent') detail = t('history.notPresent');
  else detail = cell.workDate < joinedOn ? t('history.beforeJoining') : t('history.notYet');

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[cell.kind] }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{isToday ? t('history.today', { day }) : day}</Text>
        <Text variant={cell.kind === 'completed' ? 'mono' : 'small'} color={cell.kind === 'missed' ? colors.warnMuted : colors.muted}>
          {detail}
        </Text>
      </View>
      {cell.kind === 'completed' && cell.workedMinutes != null ? (
        <Text variant="mono" style={{ fontSize: 17 }}>
          {formatDuration(cell.workedMinutes, t, true)}
        </Text>
      ) : null}
    </View>
  );
}
