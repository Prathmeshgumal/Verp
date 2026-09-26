import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { useDebounced } from '../../ui/useDebounced';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'Employees'>;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 40,
        borderRadius: 20,
        paddingHorizontal: 14,
        justifyContent: 'center',
        backgroundColor: selected ? colors.dark : colors.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.inputBorder,
      }}
    >
      <Text variant="label" color={selected ? colors.onDark : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmployeesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(true);
  const q = useDebounced(search.trim(), 300);
  const filter = { q, isActive: active };
  const query = useQuery({ queryKey: queryKeys.employees(filter), queryFn: () => api.listEmployees(filter) });

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 12 }}>
        <Text variant="h1">{t('admin.employees.title')}</Text>
        <View style={{ height: 52, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel={t('admin.employees.search')}
            placeholder={t('admin.employees.search')}
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            style={{ flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('admin.employees.active')} selected={active} onPress={() => setActive(true)} />
          <Chip label={t('admin.employees.inactive')} selected={!active} onPress={() => setActive(false)} />
        </View>
      </View>

      {query.isPending ? (
        <Loading />
      ) : !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.lg }}
          contentContainerStyle={{ paddingBottom: 96 }}
          data={query.data}
          keyExtractor={(e) => e.id}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            <Text color={colors.muted} style={{ padding: 16 }}>
              {t('admin.employees.empty')}
            </Text>
          }
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => navigation.navigate('EmployeeDetail', { id: item.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.lineSoft }}
            >
              <Avatar name={item.name} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                  {item.name}
                </Text>
                <Text variant="small" color={colors.muted}>
                  {[item.phone, item.employeeCode, item.siteName ?? t('admin.employees.noSite')].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.lockedUntil && Date.parse(item.lockedUntil) > Date.now() ? (
                <Text variant="small" color={colors.checkOut}>
                  {t('admin.employees.locked')}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('admin.employees.add')}
        onPress={() => navigation.navigate('EmployeeCreate')}
        style={{ position: 'absolute', right: 20, bottom: 20, height: 60, borderRadius: 30, paddingLeft: 18, paddingRight: 22, backgroundColor: colors.dark, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6 }}
      >
        <Icon name="plus" color={colors.white} />
        <Text color={colors.white} style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
          {t('admin.employees.add')}
        </Text>
      </Pressable>
    </Screen>
  );
}
