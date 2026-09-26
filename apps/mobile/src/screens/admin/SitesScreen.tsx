import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { SitesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

type Props = NativeStackScreenProps<SitesStackParamList, 'Sites'>;

export function SitesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const query = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 }}>
        <Text variant="h1">{t('admin.sites.title')}</Text>
      </View>
      {query.isPending ? (
        <Loading />
      ) : !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 8 }}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={<Text color={colors.muted}>{t('admin.sites.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => navigation.navigate('SiteEdit', { id: item.id })}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pin" size={20} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.name}</Text>
                <Text variant="small" color={colors.muted}>
                  {[item.address, t('admin.sites.radius', { m: item.radiusM })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.isActive ? null : (
                <Text variant="small" color={colors.muted}>
                  {t('admin.sites.inactive')}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('admin.sites.add')}
        onPress={() => navigation.navigate('SiteEdit', {})}
        style={{ position: 'absolute', right: 20, bottom: 20, height: 60, borderRadius: 30, paddingLeft: 18, paddingRight: 22, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 }}
      >
        <Icon name="plus" color={colors.white} />
        <Text color={colors.white} style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
          {t('admin.sites.add')}
        </Text>
      </Pressable>
    </Screen>
  );
}
