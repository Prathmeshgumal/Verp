import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DashboardRefusedAttempt } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { LeafletMap } from '../../maps/LeafletMap';
import { colors, fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';

/** Today's attempts have no date of their own; the history lists add one. */
export type RefusedAttempt = DashboardRefusedAttempt & { workDate?: string };

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function useRefusedText(a: RefusedAttempt) {
  const { t } = useTranslation();
  return {
    title: t('admin.today.refusedLine', {
      type: t(`admin.events.${a.type}`),
      reason: t(`admin.today.${a.result}`),
    }),
    where:
      a.distanceM != null
        ? t('admin.today.fromSite', {
            distance: formatDistance(a.distanceM),
            site: a.siteName ?? '—',
          })
        : t('admin.today.accuracy', { m: Math.round(a.accuracyM) }),
    when: a.workDate
      ? `${formatWorkDateMedium(a.workDate, t)} · ${formatTime(a.serverTime, t)}`
      : formatTime(a.serverTime, t),
  };
}

/** One refused attempt in a list; tapping it opens the map. */
export function RefusedRow({
  attempt: a,
  showName = true,
  divider = true,
  onPress,
}: {
  attempt: RefusedAttempt;
  showName?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const text = useRefusedText(a);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${showName ? a.name : text.when}, ${t('admin.refused.showOnMap')}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.lineSoft,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.danger,
          alignSelf: 'flex-start',
          marginTop: 8,
        }}
      />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" style={{ fontSize: 16 }}>
          {showName ? a.name : text.when}
        </Text>
        <Text variant="small">{text.title}</Text>
        <Text variant="small" color={colors.muted}>
          {showName ? `${text.where} · ${text.when}` : text.where}
        </Text>
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.dangerBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="pin" size={16} color={colors.danger} />
      </View>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 2,
      }}
    >
      <Text variant="small" color={colors.muted} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 18 }}>{value}</Text>
    </View>
  );
}

/** Where the phone was when the attempt was refused, next to the site it had to be inside. */
export function RefusedSheet({
  attempt,
  onClose,
}: {
  attempt: RefusedAttempt | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const sites = useQuery({
    queryKey: queryKeys.sites,
    queryFn: () => api.listSites(),
    enabled: attempt !== null,
  });
  const site = attempt?.siteId ? sites.data?.find((s) => s.id === attempt.siteId) : undefined;
  return (
    <Sheet visible={attempt !== null} title={attempt?.name ?? ''} onClose={onClose}>
      {attempt ? <RefusedDetail attempt={attempt} site={site} /> : null}
      {attempt ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Fact
            label={t('admin.refused.distance', { site: attempt.siteName ?? '—' })}
            value={attempt.distanceM != null ? formatDistance(attempt.distanceM) : '—'}
          />
          <Fact label={t('admin.refused.accuracy')} value={`±${Math.round(attempt.accuracyM)} m`} />
        </View>
      ) : null}
    </Sheet>
  );
}

function RefusedDetail({
  attempt,
  site,
}: {
  attempt: RefusedAttempt;
  site?: { lat: number; lng: number; radiusM: number; name: string };
}) {
  const text = useRefusedText(attempt);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 1 }}>
        <Text variant="bodyStrong" color={colors.danger}>
          {text.title}
        </Text>
        <Text variant="small" color={colors.muted}>
          {text.when}
        </Text>
      </View>
      <View
        testID="refused-map"
        style={{
          borderRadius: radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <LeafletMap
          center={site ? { lat: site.lat, lng: site.lng } : null}
          radiusM={site?.radiusM ?? 0}
          height={280}
          recenterKey={site ? 2 : 1}
          pins={[{ lat: attempt.lat, lng: attempt.lng, color: colors.danger }]}
          overview={site ? [] : [{ lat: attempt.lat, lng: attempt.lng }]}
          tags={
            site
              ? [
                  {
                    key: 'site',
                    lat: site.lat,
                    lng: site.lng,
                    label: site.name,
                    count: 1,
                    tone: 'orange',
                  },
                ]
              : []
          }
        />
      </View>
    </View>
  );
}
