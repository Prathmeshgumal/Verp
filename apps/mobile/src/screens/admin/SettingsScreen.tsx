import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SettingsDto } from '@ve/shared';
import { useAuth, useUser } from '../../auth/AuthContext';
import { formatHhMm } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { getDeviceInfo } from '../../native/device';
import { colors, radius } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { PickerField } from '../../ui/PickerField';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useConfirmLogout } from '../worker/useConfirmLogout';
import { adminErrorKey } from './adminErrors';

/** Common zones for the company; the saved one is always listed. */
const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Kathmandu', 'Asia/Dhaka', 'Europe/London', 'America/New_York', 'UTC'];

/** Every 15 minutes; a saved time off the grid stays in the list. */
export function reminderTimes(current: string): string[] {
  const times = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
  if (current && !times.includes(current)) times.push(current);
  return times.sort();
}

type NumberKey = 'maxAccuracyM' | 'defaultRadiusM' | 'clockMismatchMinutes';
const LIMITS: Record<NumberKey, [number, number]> = { maxAccuracyM: [5, 500], defaultRadiusM: [10, 1000], clockMismatchMinutes: [1, 120] };

export function SettingsScreen() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const confirmLogout = useConfirmLogout();
  const user = useUser();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.settings, queryFn: () => api.getSettings() });
  const [form, setForm] = useState<Record<keyof SettingsDto, string> | null>(null);
  const [errors, setErrors] = useState<Partial<Record<NumberKey, string>>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getDeviceInfo()
      .then((info) => setVersion(info.appVersion))
      .catch(() => setVersion(null));
  }, []);
  const s = query.data;
  useEffect(() => {
    if (s) setForm({ timezone: s.timezone, reminderTime: s.reminderTime, maxAccuracyM: String(s.maxAccuracyM), defaultRadiusM: String(s.defaultRadiusM), clockMismatchMinutes: String(s.clockMismatchMinutes) });
  }, [s]);

  if (query.isPending || (s && !form)) return <Loading />;
  if (!s || !form) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  async function save() {
    if (!form) return;
    setMessage(null);
    const next: Partial<Record<NumberKey, string>> = {};
    const numbers = {} as Record<NumberKey, number>;
    for (const key of Object.keys(LIMITS) as NumberKey[]) {
      const [min, max] = LIMITS[key];
      const n = Number(form[key]);
      if (!/^\d+$/.test(form[key].trim()) || n < min || n > max) next[key] = t('admin.settings.range', { min, max });
      numbers[key] = n;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const saved = await api.updateSettings({ timezone: form.timezone, reminderTime: form.reminderTime, ...numbers });
      queryClient.setQueryData(queryKeys.settings, saved);
      setMessage({ text: t('admin.settings.saved') });
    } catch (err) {
      setMessage({ text: t(adminErrorKey(err)), error: true });
    } finally {
      setBusy(false);
    }
  }

  const zones = ZONES.includes(form.timezone) ? ZONES : [form.timezone, ...ZONES];
  const numberField = (key: NumberKey, label: string, help?: string) => (
    <View style={{ gap: 4 }}>
      <TextField label={label} value={form[key]} onChangeText={(v) => setForm({ ...form, [key]: v })} keyboardType="number-pad" error={errors[key] ?? null} />
      {help ? (
        <Text variant="small" color={colors.muted}>
          {help}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 4, gap: 2 }}>
          <Text variant="h1">{t('admin.settings.title')}</Text>
          <Text variant="small" color={colors.muted}>
            {t('admin.settings.subtitle')}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 14 }}>
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong">{t('admin.settings.time')}</Text>
            <Text variant="small" color={colors.muted}>
              {t('admin.settings.timeHint')}
            </Text>
          </View>
          <PickerField label={t('admin.settings.timezone')} value={form.timezone} options={zones.map((z) => ({ value: z, label: z }))} onChange={(timezone) => setForm({ ...form, timezone })} />
          <PickerField
            label={t('admin.settings.reminder')}
            value={form.reminderTime}
            options={reminderTimes(form.reminderTime).map((v) => ({ value: v, label: formatHhMm(v, t) }))}
            onChange={(reminderTime) => setForm({ ...form, reminderTime })}
          />
          <Text variant="small" color={colors.muted} style={{ marginTop: -8 }}>
            {t('admin.settings.reminderHelp')}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 14 }}>
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong">{t('admin.settings.location')}</Text>
            <Text variant="small" color={colors.muted}>
              {t('admin.settings.locationHint')}
            </Text>
          </View>
          {numberField('maxAccuracyM', t('admin.settings.accuracy'), t('admin.settings.accuracyHelp'))}
          {numberField('defaultRadiusM', t('admin.settings.radius'))}
          {numberField('clockMismatchMinutes', t('admin.settings.clock'), t('admin.settings.clockHelp'))}
        </View>

        {message ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={message.error ? colors.danger : colors.checkIn}>
            {message.text}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.employees.saving') : t('admin.settings.save')} onPress={() => void save()} disabled={busy} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <Avatar name={user.name} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{user.name}</Text>
            <Text variant="small" color={colors.muted}>
              {user.email ?? t('admin.tag')}
              {version ? ` · ${t('menu.appVersion', { version })}` : ''}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View testID="settings-footer" style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Button label={t('common.logout')} variant="danger" icon="logout" onPress={() => void confirmLogout()} />
      </View>
    </Screen>
  );
}
