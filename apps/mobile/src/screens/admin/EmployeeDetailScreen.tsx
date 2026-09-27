import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { normalizePhone, type EmployeeDetailDto, type RefusedAttemptDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { addDays, formatTime, formatWorkDateMedium, toIsoWithOffset } from '../../attendance/format';
import { localToday } from '../../attendance/localDate';
import { queryKeys } from '../../attendance/queryKeys';
import type { EmployeesStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme/tokens';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { PickerField } from '../../ui/PickerField';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';
import { StatusBadge } from './AttendanceListScreen';
import { PinReveal } from './PinReveal';
import { RefusedRow, RefusedSheet } from './refused';

/** The employee page shows the latest few; the Attendance tab has the rest. */
const RECENT_REFUSED = 5;

type Props = NativeStackScreenProps<EmployeesStackParamList, 'EmployeeDetail'>;

function dateTime(iso: string, t: TFunction): string {
  return `${formatWorkDateMedium(toIsoWithOffset(new Date(iso)).slice(0, 10), t)} ${formatTime(iso, t)}`;
}

export function EmployeeDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const today = localToday();
  const from = addDays(today, -29);
  const query = useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
  const days = useQuery({
    queryKey: queryKeys.attendance({ from, to: today, employeeId: id }),
    queryFn: () => api.listAttendance({ from, to: today, employeeId: id, page: 1, pageSize: 50 }),
  });
  const refused = useQuery({
    queryKey: queryKeys.refused({ from, to: today, employeeId: id }),
    queryFn: () => api.listRefused({ from, to: today, employeeId: id, page: 1, pageSize: RECENT_REFUSED }),
  });
  const [openAttempt, setOpenAttempt] = useState<RefusedAttemptDto | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    setNotice(null);
    try {
      await run();
      setNotice({ text: done });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      setNotice({ text: t(adminErrorKey(err)), error: true });
    } finally {
      setBusy(false);
    }
  }

  function confirm(title: string, body: string, action: string, onYes: () => void) {
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: action, style: 'destructive', onPress: onYes },
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text variant="h1">{e.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ backgroundColor: locked ? colors.warnBg : e.isActive ? colors.successBg : colors.lineSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Text variant="small" color={locked ? colors.warnText : e.isActive ? colors.checkIn : colors.muted}>
                {locked ? t('admin.employees.locked') : e.isActive ? t('admin.employees.statusActive') : t('admin.employees.statusInactive')}
              </Text>
            </View>
            <Text variant="mono" color={colors.muted}>
              {[e.phone, e.employeeCode].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {locked ? <Banner tone="warn" icon="alert" title={t('admin.employees.lockedUntil', { time: formatTime(locked, t) })} /> : null}
        {notice ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={notice.error ? colors.danger : colors.checkIn}>
            {notice.text}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexGrow: 1, flexBasis: '45%' }}>
            <Button
              label={t('admin.employees.resetPin')}
              variant="secondary"
              size="small"
              icon="key"
              disabled={busy}
              onPress={() =>
                confirm(t('admin.employees.resetTitle'), t('admin.employees.resetBody'), t('admin.employees.resetPin'), () =>
                  void act(async () => setNewPin((await api.resetPin(id)).pin), t('admin.employees.newPin')),
                )
              }
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: '45%' }}>
            <Button
              label={t('admin.employees.logoutEverywhere')}
              variant="secondary"
              size="small"
              icon="logout"
              disabled={busy}
              onPress={() =>
                confirm(t('admin.employees.logoutTitle'), t('admin.employees.logoutBody', { name: e.name }), t('admin.employees.logoutEverywhere'), () =>
                  void act(() => api.revokeSessions(id), t('admin.employees.loggedOut')),
                )
              }
            />
          </View>
          {locked ? (
            <View style={{ flexGrow: 1, flexBasis: '45%' }}>
              <Button label={t('admin.employees.unlock')} variant="secondary" size="small" disabled={busy} onPress={() => void act(() => api.unlockEmployee(id), t('admin.employees.unlocked'))} />
            </View>
          ) : null}
          <View style={{ flexGrow: 1, flexBasis: '45%' }}>
            <Button
              label={e.isActive ? t('admin.employees.deactivate') : t('admin.employees.activate')}
              variant={e.isActive ? 'danger' : 'primary'}
              size="small"
              disabled={busy}
              onPress={() =>
                e.isActive
                  ? confirm(t('admin.employees.deactivateTitle'), t('admin.employees.deactivateBody', { name: e.name }), t('admin.employees.deactivate'), () =>
                      void act(() => api.updateEmployee(id, { isActive: false }), t('admin.employees.deactivated')),
                    )
                  : confirm(t('admin.employees.activateTitle'), t('admin.employees.activateBody', { name: e.name }), t('admin.employees.activate'), () =>
                      void act(() => api.updateEmployee(id, { isActive: true }), t('admin.employees.activated')),
                    )
              }
            />
          </View>
        </View>

        <DetailsForm employee={e} />

        <Card style={{ gap: 8, borderWidth: 1, borderColor: colors.line }}>
          <Text variant="label">{t('admin.employees.devices')}</Text>
          {e.sessions.length === 0 ? <Text color={colors.muted}>{t('admin.employees.noDevices')}</Text> : null}
          {e.sessions.map((s) => (
            <View key={s.id} style={{ gap: 2, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8 }}>
              <Text variant="bodyStrong">{s.deviceModel ?? t('admin.employees.unknownPhone')}</Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.employees.loggedIn', { when: dateTime(s.createdAt, t) })}
              </Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.employees.lastUsed', { when: dateTime(s.lastUsedAt, t) })}
              </Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 4, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 0, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <Text variant="label">{t('admin.employees.last30')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.employees.openAttendance')}
              onPress={() =>
                navigation.getParent()?.navigate('AttendanceTab', {
                  screen: 'AttendanceList',
                  params: { filters: { from, to: today, employeeId: e.id, employeeName: e.name } },
                })
              }
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text variant="small" color={colors.info}>
                {t('admin.employees.openAttendance')}
              </Text>
              <Icon name="chevronRight" size={16} color={colors.info} />
            </Pressable>
          </View>
          {days.data?.items.length === 0 ? (
            <Text color={colors.muted} style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
              {t('admin.employees.noDays')}
            </Text>
          ) : null}
          {(days.data?.items ?? []).map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={`${formatWorkDateMedium(d.workDate, t)}, ${t(`admin.status.${d.status}`)}`}
              onPress={() => navigation.navigate('AttendanceDetail', { id: d.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.lineSoft }}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 15 }}>
                  {formatWorkDateMedium(d.workDate, t)}
                </Text>
                <Text variant="mono" color={colors.muted} style={{ fontSize: 13 }}>
                  {`${formatTime(d.checkInAt, t, false)} – ${d.checkOutAt ? formatTime(d.checkOutAt, t, false) : '?'} · ${d.siteName}`}
                </Text>
              </View>
              {d.needsReview ? <Icon name="alert" size={16} color={colors.danger} /> : null}
              <StatusBadge status={d.status} />
            </Pressable>
          ))}
        </Card>

        <Card style={{ gap: 4, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 0, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text variant="label">{t('admin.refused.recent')}</Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.refused.last30')}
              </Text>
            </View>
            {refused.data && refused.data.total > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('admin.refused.seeAll')}
                onPress={() =>
                  navigation.getParent()?.navigate('AttendanceTab', {
                    screen: 'AttendanceList',
                    params: { filters: { from, to: today, employeeId: e.id, employeeName: e.name }, view: 'refused' },
                  })
                }
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text variant="small" color={colors.info}>
                  {refused.data.total > RECENT_REFUSED ? `${t('admin.refused.seeAll')} (${refused.data.total})` : t('admin.refused.seeAll')}
                </Text>
                <Icon name="chevronRight" size={16} color={colors.info} />
              </Pressable>
            ) : null}
          </View>
          {refused.data?.items.length === 0 ? (
            <Text color={colors.muted} style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6 }}>
              {t('admin.refused.none30')}
            </Text>
          ) : null}
          {(refused.data?.items ?? []).map((a) => (
            <RefusedRow key={a.id} attempt={a} showName={false} onPress={() => setOpenAttempt(a)} />
          ))}
        </Card>
      </ScrollView>
      <RefusedSheet attempt={openAttempt} onClose={() => setOpenAttempt(null)} />
    </Screen>
  );
}

function DetailsForm({ employee: e }: { employee: EmployeeDetailDto }) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const initial = { name: e.name, phone: e.phone, code: e.employeeCode ?? '', siteId: e.siteId ?? '' };
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => setV({ name: e.name, phone: e.phone, code: e.employeeCode ?? '', siteId: e.siteId ?? '' }), [e.name, e.phone, e.employeeCode, e.siteId]);
  const dirty = v.name !== initial.name || v.phone !== initial.phone || v.code !== initial.code || v.siteId !== initial.siteId;

  // Inactive sites are hidden, except the one this employee is already on.
  const siteOptions = [
    { value: '', label: t('admin.employees.noSiteOption') },
    ...(sites.data ?? []).filter((s) => s.isActive || s.id === e.siteId).map((s) => ({ value: s.id, label: s.isActive ? s.name : `${s.name} (${t('admin.sites.inactive')})` })),
  ];

  async function save() {
    setMessage(null);
    if (!v.name.trim()) return setMessage({ text: t('admin.errors.nameRequired'), error: true });
    const phone = normalizePhone(v.phone);
    if (!phone) return setMessage({ text: t('login.errors.invalidPhone'), error: true });
    setBusy(true);
    try {
      await api.updateEmployee(e.id, { name: v.name.trim(), phone, employeeCode: v.code.trim() || null, siteId: v.siteId || null });
      setMessage({ text: t('admin.employees.saved') });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      setMessage({ text: t(adminErrorKey(err)), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 12, borderWidth: 1, borderColor: colors.line }}>
      <Text variant="label">{t('admin.employees.details')}</Text>
      <TextField label={t('admin.employees.name')} value={v.name} onChangeText={(name) => setV({ ...v, name })} autoCapitalize="words" />
      <TextField label={t('admin.employees.phone')} value={v.phone} onChangeText={(phone) => setV({ ...v, phone })} keyboardType="phone-pad" />
      <TextField label={t('admin.employees.code')} value={v.code} onChangeText={(code) => setV({ ...v, code })} autoCapitalize="characters" />
      <PickerField label={t('admin.employees.site')} value={v.siteId} options={siteOptions} onChange={(siteId) => setV({ ...v, siteId })} />
      {message ? (
        <Text accessibilityRole="alert" variant="bodyStrong" color={message.error ? colors.danger : colors.checkIn}>
          {message.text}
        </Text>
      ) : null}
      <Button label={busy ? t('admin.employees.saving') : t('admin.employees.saveDetails')} onPress={() => void save()} disabled={busy || !dirty} />
    </Card>
  );
}
