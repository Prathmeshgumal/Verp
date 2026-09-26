import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { colors, fonts, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { confirmLogout } from '../worker/MenuSheet';

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'plain' | 'warn' }) {
  const bg = tone === 'green' ? colors.checkIn : tone === 'warn' ? colors.warnBg : colors.surface;
  const labelColor = tone === 'green' ? colors.workingSub : tone === 'warn' ? colors.warnMuted : colors.muted;
  const valueColor = tone === 'green' ? colors.white : tone === 'warn' ? colors.warnText : colors.text;
  return (
    <View style={{ width: '48.5%', backgroundColor: bg, borderRadius: radius.lg, padding: 14, gap: 4 }}>
      <Text variant="small" color={labelColor}>
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 }} color={valueColor}>
        {String(value)}
      </Text>
    </View>
  );
}

export function TodayScreen() {
  const { t } = useTranslation();
  const { api, logout } = useAuth();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const d = query.data;

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text variant="small" color={colors.muted}>
            {t('admin.today.updated', {
              date: formatWorkDateMedium(d.workDate, t),
              time: formatTime(new Date(query.dataUpdatedAt).toISOString(), t),
            })}
          </Text>
          <Text variant="h1">{t('admin.today.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: colors.dark, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Text color={colors.onDark} style={{ fontFamily: fonts.bodyBold, fontSize: 13 }}>
              {t('admin.tag')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.logout')}
            onPress={() => confirmLogout(t, logout)}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="logout" />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        <Stat label={t('admin.today.workingNow')} value={d.workingNow} tone="green" />
        <Stat label={t('admin.today.notYetIn')} value={d.notYetIn} tone="plain" />
        <Stat label={t('admin.today.completed')} value={d.completedToday} tone="plain" />
        <Stat label={t('admin.today.needsReview')} value={d.needsReview} tone="warn" />
      </View>
      <Text variant="small" color={colors.muted} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        {t('admin.today.summary', { checkedIn: d.checkedInToday, missed: d.missedCheckouts, active: d.activeEmployees })}
      </Text>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="h2">{t('admin.today.workingNow')}</Text>
        <Text variant="small" color={colors.muted}>
          {t('admin.today.byCheckIn')}
        </Text>
      </View>
      <FlatList
        style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: radius.lg }}
        data={d.working}
        keyExtractor={(w) => w.employeeId}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListEmptyComponent={
          <Text color={colors.muted} style={{ padding: 16 }}>
            {t('admin.today.nobodyWorking')}
          </Text>
        }
        renderItem={({ item, index }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.lineSoft,
            }}
          >
            <Avatar name={item.name} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                {item.name}
              </Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.today.since', { site: item.siteName, time: formatTime(item.checkInAt, t) })}
              </Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
