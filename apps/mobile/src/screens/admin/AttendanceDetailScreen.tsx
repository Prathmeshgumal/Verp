import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminDayDto } from '@ve/shared';
import { useAuth } from '../../auth/AuthContext';
import { formatDuration, formatTime, formatWorkDateMedium, toIsoWithOffset } from '../../attendance/format';
import { queryKeys } from '../../attendance/queryKeys';
import { LeafletMap, type MapPin } from '../../maps/LeafletMap';
import { colors, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, Loading } from '../../ui/Centered';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';
import { StatusBadge } from './AttendanceListScreen';

/** Shared by the Attendance and Today stacks; only the day id matters. */
interface Props {
  route: { params: { id: string } };
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "18:30" on the work date, in the phone's time zone, as the API expects. Null if the time is not valid. */
export function checkoutIso(workDate: string, hhmm: string): string | null {
  const m = HHMM.exec(hhmm.trim());
  if (!m) return null;
  const [y = 0, mo = 1, d = 1] = workDate.split('-').map(Number);
  return toIsoWithOffset(new Date(y, mo - 1, d, Number(m[1]), Number(m[2])));
}

function localHhMm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AttendanceDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const query = useQuery({ queryKey: queryKeys.attendanceDay(id), queryFn: () => api.getAttendance(id) });
  const [fixing, setFixing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  }
  const review = useMutation({
    mutationFn: () => api.markReviewed(id),
    onSuccess: () => {
      setNotice(t('admin.attendance.reviewed'));
      refreshAll();
    },
  });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { day, events, site } = query.data;
  const adminSet = day.flags.includes('ADMIN_CORRECTED') || (day.checkOutAt != null && day.checkOutLat == null);

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <LeafletMap
            center={{ lat: site.lat, lng: site.lng }}
            radiusM={site.radiusM}
            height={240}
            recenterKey={1}
            pins={[
              { lat: day.checkInLat, lng: day.checkInLng, color: colors.checkIn },
              ...(day.checkOutLat != null && day.checkOutLng != null ? [{ lat: day.checkOutLat, lng: day.checkOutLng, color: colors.checkOut } satisfies MapPin] : []),
            ]}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text variant="h1">{day.employeeName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text color={colors.muted}>{`${formatWorkDateMedium(day.workDate, t)} · ${day.siteName}`}</Text>
            <StatusBadge status={day.status} />
            {day.needsReview ? (
              <View style={{ backgroundColor: colors.dangerBg, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 }}>
                <Text variant="small" color={colors.danger}>
                  {t('admin.attendance.review')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Card style={{ gap: 12, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.muted}>
                {t('admin.attendance.checkIn')}
              </Text>
              <Text variant="monoLarge">{formatTime(day.checkInAt, t)}</Text>
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(day.checkInDistanceM), acc: Math.round(day.checkInAccuracyM) })}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.muted}>
                {t('admin.attendance.checkOut')}
              </Text>
              <Text variant="monoLarge">{day.checkOutAt ? formatTime(day.checkOutAt, t) : '—'}</Text>
              <Text variant="small" color={colors.muted}>
                {day.checkOutAt
                  ? adminSet
                    ? t('admin.attendance.setByAdmin')
                    : t('admin.attendance.distance', { m: Math.round(day.checkOutDistanceM ?? 0), acc: Math.round(day.checkOutAccuracyM ?? 0) })
                  : day.status === 'MISSED_CHECKOUT'
                    ? t('admin.attendance.noCheckout')
                    : t('admin.status.CHECKED_IN')}
              </Text>
            </View>
          </View>
          {day.workedMinutes != null ? <Text variant="bodyStrong">{t('admin.attendance.worked', { duration: formatDuration(day.workedMinutes, t) })}</Text> : null}
        </Card>

        {notice ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkIn}>
            {notice}
          </Text>
        ) : null}
        {review.isError ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.danger}>
            {t(adminErrorKey(review.error))}
          </Text>
        ) : null}
        {day.needsReview ? (
          <Button label={t('admin.attendance.markReviewed')} icon="check" onPress={() => review.mutate()} disabled={review.isPending} />
        ) : day.reviewedAt ? (
          <Text variant="small" color={colors.muted}>
            {t('admin.attendance.reviewedAt', { date: formatWorkDateMedium(toIsoWithOffset(new Date(day.reviewedAt)).slice(0, 10), t), time: formatTime(day.reviewedAt, t) })}
          </Text>
        ) : null}
        {day.status === 'CHECKED_IN' ? (
          <Text variant="small" color={colors.muted}>
            {t('admin.attendance.stillWorking')}
          </Text>
        ) : fixing ? (
          <FixCheckoutForm
            day={day}
            onCancel={() => setFixing(false)}
            onDone={() => {
              setFixing(false);
              setNotice(t('admin.attendance.fixed'));
              refreshAll();
            }}
          />
        ) : (
          <Button label={t('admin.attendance.fixCheckout')} variant="secondary" icon="checkOut" onPress={() => setFixing(true)} />
        )}

        {day.flags.length > 0 ? (
          <Card style={{ gap: 6, borderWidth: 1, borderColor: colors.line }}>
            <Text variant="label">{t('admin.attendance.flags')}</Text>
            {day.flags.map((flag) => (
              <Text key={flag} color={colors.warnText}>
                {t(`admin.flags.${flag}`, { defaultValue: flag })}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: 10, borderWidth: 1, borderColor: colors.line }}>
          <Text variant="label">{t('admin.attendance.attempts')}</Text>
          {events.map((ev) => (
            <View key={ev.id} style={{ borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{`${t(`admin.events.${ev.type}`)} · ${formatTime(ev.serverTime, t)}`}</Text>
                <Text variant="mono" color={ev.result === 'OK' ? colors.checkIn : colors.danger}>
                  {ev.result}
                </Text>
              </View>
              <Text variant="small" color={colors.muted}>
                {t('admin.attendance.distance', { m: Math.round(ev.distanceM ?? 0), acc: Math.round(ev.accuracyM) })}
              </Text>
              {ev.isMock ? (
                <Text variant="small" color={colors.warnText}>
                  {t('admin.attendance.mock')}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function FixCheckoutForm({ day, onCancel, onDone }: { day: AdminDayDto; onCancel: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [time, setTime] = useState(day.checkOutAt ? localHhMm(day.checkOutAt) : '18:00');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ time?: string; reason?: string; form?: string }>({});
  const fix = useMutation({
    mutationFn: (body: { checkOutAt: string; reason: string }) => api.fixCheckout(day.id, body),
    onSuccess: onDone,
    onError: (err) => setErrors({ form: t(adminErrorKey(err)) }),
  });

  function submit() {
    const iso = checkoutIso(day.workDate, time);
    const next = { time: iso ? undefined : t('admin.attendance.badTime'), reason: reason.trim().length >= 3 ? undefined : t('admin.attendance.badReason') };
    setErrors(next);
    if (iso && !next.reason) fix.mutate({ checkOutAt: iso, reason: reason.trim() });
  }

  return (
    <Card style={{ gap: 12, borderWidth: 1, borderColor: colors.line }}>
      <Text variant="h2">{t('admin.attendance.fixTitle')}</Text>
      <TextField
        label={t('admin.attendance.fixTime')}
        value={time}
        onChangeText={setTime}
        keyboardType="numbers-and-punctuation"
        placeholder="18:30"
        error={errors.time ?? null}
      />
      <Text variant="small" color={colors.muted} style={{ marginTop: -6 }}>
        {t('admin.attendance.fixTimeHelp', { date: formatWorkDateMedium(day.workDate, t) })}
      </Text>
      <TextField label={t('admin.attendance.fixReason')} value={reason} onChangeText={setReason} placeholder={t('admin.attendance.fixReasonHint')} multiline error={errors.reason ?? null} />
      {errors.form ? (
        <Text accessibilityRole="alert" variant="bodyStrong" color={colors.danger}>
          {errors.form}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('admin.attendance.fixSave')} onPress={submit} disabled={fix.isPending} />
        </View>
      </View>
    </Card>
  );
}
