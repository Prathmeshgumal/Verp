import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { formatTime, formatWorkDateMedium, toIsoWithOffset } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { adminErrorKey } from './adminErrors';
import { PinReveal } from './PinReveal';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'EmployeeDetail'>;

export function EmployeeDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { id } = route.params;
  const query = useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
  const [newPin, setNewPin] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function doReset() {
    setErrorKey(null);
    try {
      const { pin } = await api.resetPin(id);
      setNewPin(pin);
      void query.refetch();
    } catch (err) {
      setErrorKey(adminErrorKey(err));
    }
  }

  function confirmReset() {
    Alert.alert(t('admin.employees.resetTitle'), t('admin.employees.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('admin.employees.resetPin'), style: 'destructive', onPress: () => void doReset() },
    ]);
  }

  if (newPin) return <PinReveal title={t('admin.employees.newPin')} pin={newPin} onDone={() => setNewPin(null)} />;
  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const e = query.data;
  const locked = e.lockedUntil && Date.parse(e.lockedUntil) > Date.now() ? e.lockedUntil : null;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h1">{e.name}</Text>
          <Text variant="label" color={e.isActive ? colors.checkIn : colors.muted}>
            {e.isActive ? t('admin.employees.statusActive') : t('admin.employees.statusInactive')}
          </Text>
        </View>
        {locked ? <Banner tone="warn" icon="alert" title={t('admin.employees.lockedUntil', { time: formatTime(locked, t) })} /> : null}

        <Card style={{ gap: 4 }}>
          <Text variant="mono">{e.phone}</Text>
          {e.employeeCode ? <Text color={colors.muted}>{e.employeeCode}</Text> : null}
          <Text color={colors.muted}>{e.siteName ?? t('admin.employees.noSite')}</Text>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text variant="label">{t('admin.employees.devices')}</Text>
          {e.sessions.length === 0 ? <Text color={colors.muted}>{t('admin.employees.noDevices')}</Text> : null}
          {e.sessions.map((s) => (
            <View key={s.id} style={{ gap: 2 }}>
              <Text variant="bodyStrong">{s.deviceModel ?? s.deviceId ?? t('admin.employees.unknownPhone')}</Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.employees.lastUsed', {
                  date: formatWorkDateMedium(toIsoWithOffset(new Date(s.lastUsedAt)).slice(0, 10), t),
                  time: formatTime(s.lastUsedAt, t),
                })}
              </Text>
            </View>
          ))}
        </Card>

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button
          label={t('admin.employees.viewAttendance')}
          variant="secondary"
          icon="list"
          onPress={() =>
            navigation.getParent()?.navigate('AttendanceTab', {
              screen: 'AttendanceList',
              params: { employeeId: e.id, employeeName: e.name },
            })
          }
        />
        <Button label={t('admin.employees.resetPin')} icon="key" onPress={confirmReset} />
      </ScrollView>
    </Screen>
  );
}
