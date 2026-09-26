import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { normalizePhone, type CreatedEmployeeDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';
import { PinReveal } from './PinReveal';

type Props = NativeStackScreenProps<EmployeesStackParamList, 'EmployeeCreate'>;

function SiteOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.dark : colors.inputBorder }}
    >
      <Text>{label}</Text>
      {selected ? <Icon name="check" /> : null}
    </Pressable>
  );
}

export function EmployeeCreateScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedEmployeeDto | null>(null);

  async function submit() {
    if (!name.trim()) return setErrorKey('admin.errors.nameRequired');
    if (!normalizePhone(phone)) return setErrorKey('login.errors.invalidPhone');
    setBusy(true);
    setErrorKey(null);
    try {
      const result = await api.createEmployee({ name: name.trim(), phone, employeeCode: code.trim() || undefined, siteId });
      setCreated(result);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
    } catch (err) {
      setErrorKey(adminErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <PinReveal
        title={t('admin.employees.pinTitle', { name: created.employee.name })}
        pin={created.pin}
        onDone={() => navigation.goBack()}
      />
    );
  }

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <TextField label={t('admin.employees.name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label={t('admin.employees.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label={t('admin.employees.code')} value={code} onChangeText={setCode} autoCapitalize="characters" />
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('admin.employees.site')}</Text>
          <SiteOption label={t('admin.employees.noSiteOption')} selected={siteId === null} onPress={() => setSiteId(null)} />
          {(sites.data ?? [])
            .filter((s) => s.isActive)
            .map((s) => (
              <SiteOption key={s.id} label={s.name} selected={siteId === s.id} onPress={() => setSiteId(s.id)} />
            ))}
        </View>
        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.employees.saving') : t('admin.employees.create')} onPress={() => void submit()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}
