import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '../../auth/AuthContext';
import { formatWorkDateLong } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { getDeviceInfo } from '../../native/device';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { confirmLogout } from './confirmLogout';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/** The worker's own details; more personal features will live here. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { api, logout } = useAuth();
  const user = useUser();
  const today = useQuery({ queryKey: queryKeys.today, queryFn: () => api.today() }).data;
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getDeviceInfo()
      .then((info) => setVersion(info.appVersion))
      .catch(() => setVersion(null));
  }, []);

  const rows: { icon: IconName; label: string; value: string }[] = [];
  if (user.phone) rows.push({ icon: 'person', label: t('profile.phone'), value: user.phone });
  rows.push({ icon: 'pin', label: t('profile.site'), value: today?.site?.name ?? t('profile.noSite') });
  if (today?.joinedOn) rows.push({ icon: 'calendar', label: t('profile.joined'), value: formatWorkDateLong(today.joinedOn, t) });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h2" color={colors.onDark}>
              {initials(user.name)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h1" style={{ fontSize: 24, lineHeight: 30 }}>
              {user.name}
            </Text>
            <Text color={colors.muted} style={{ fontSize: 15 }}>
              {t('profile.role')}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 64, borderTopWidth: i ? 1 : 0, borderTopColor: colors.lineSoft }}
            >
              <Icon name={row.icon} size={20} color={colors.muted} />
              <Text color={colors.muted} style={{ fontSize: 15, flex: 1 }}>
                {row.label}
              </Text>
              <Text variant="label" style={{ flexShrink: 1, textAlign: 'right' }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <Button label={t('common.logout')} variant="secondary" icon="logout" onPress={() => confirmLogout(t, logout)} />
        {version ? (
          <Text variant="small" color={colors.muted} style={{ textAlign: 'center' }}>
            {t('menu.appVersion', { version })}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
