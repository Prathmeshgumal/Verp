import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import { LeafletMap, type LatLng } from '../../maps/LeafletMap';
import { ensureLocationReady, getBestFix, type LocationProblem } from '../../native/location';
import type { SitesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';

type Props = NativeStackScreenProps<SitesStackParamList, 'SiteEdit'>;

/** Pune city centre: only a starting view until the admin drags the pin or uses their location. */
const DEFAULT_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 };
const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const PRESETS = [50, 100, 200, 500];

const LOCATION_PROBLEM_KEY: Record<LocationProblem, string> = {
  LOCATION_OFF: 'result.locationOff',
  PERMISSION_DENIED: 'result.permissionDenied',
  PRECISE_LOCATION_REQUIRED: 'result.preciseRequired',
};

const clampRadius = (m: number) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, m));

export function SiteEditScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const id = route.params.id;
  const siteQuery = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });

  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [radiusM, setRadiusM] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: t(id ? 'admin.sites.editTitle' : 'admin.sites.newTitle') });
  }, [navigation, t, id]);

  useEffect(() => {
    const site = siteQuery.data;
    if (!site || loaded) return;
    setName(site.name);
    setAddress(site.address ?? '');
    setCenter({ lat: site.lat, lng: site.lng });
    setRadiusM(site.radiusM);
    setIsActive(site.isActive);
    setRecenterKey((k) => k + 1);
    setLoaded(true);
  }, [siteQuery.data, loaded]);

  async function locateMe() {
    setErrorKey(null);
    setLocating(true);
    try {
      const problem = await ensureLocationReady();
      if (problem) return setErrorKey(LOCATION_PROBLEM_KEY[problem]);
      const fix = await getBestFix(20, 15_000);
      if (!fix) return setErrorKey('result.lowAccuracy');
      setCenter({ lat: fix.lat, lng: fix.lng });
      setRecenterKey((k) => k + 1);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!name.trim()) return setErrorKey('admin.errors.nameRequired');
    setBusy(true);
    setErrorKey(null);
    try {
      if (id) {
        await api.updateSite(id, { name: name.trim(), address: address.trim() || null, lat: center.lat, lng: center.lng, radiusM, isActive });
      } else {
        await api.createSite({ name: name.trim(), address: address.trim() || undefined, lat: center.lat, lng: center.lng, radiusM });
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'sites'] });
      if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.site(id) });
      navigation.goBack();
    } catch (err) {
      setErrorKey(adminErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  if (id && siteQuery.isPending) return <Loading />;
  if (id && !siteQuery.data) {
    return (
      <Screen edges={[]}>
        <ErrorState onRetry={() => void siteQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <View>
        <LeafletMap testID="site-map" center={center} radiusM={radiusM} height={300} draggable recenterKey={recenterKey} onMove={setCenter} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('admin.sites.useMyLocation')}
          onPress={() => void locateMe()}
          disabled={locating}
          style={{ position: 'absolute', left: 12, bottom: 12, height: 48, borderRadius: 24, paddingHorizontal: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 3 }}
        >
          <Icon name="locate" size={20} />
          <Text variant="label">{locating ? t('admin.sites.locating') : t('admin.sites.useMyLocation')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text variant="mono" color={colors.muted}>{`${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}</Text>
        <TextField label={t('admin.sites.name')} value={name} onChangeText={setName} />
        <TextField label={t('admin.sites.address')} value={address} onChangeText={setAddress} />

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('admin.sites.allowedDistance')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.sites.smaller')}
              onPress={() => setRadiusM((m) => clampRadius(m - 10))}
              style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="minus" />
            </Pressable>
            <Text style={{ fontFamily: fonts.monoSemi, fontSize: 20, minWidth: 90, textAlign: 'center' }}>{t('admin.sites.radius', { m: radiusM })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('admin.sites.larger')}
              onPress={() => setRadiusM((m) => clampRadius(m + 10))}
              style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="plus" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRESETS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={t('admin.sites.radius', { m })}
                onPress={() => setRadiusM(m)}
                style={{ height: 40, borderRadius: 20, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: radiusM === m ? colors.dark : colors.surface }}
              >
                <Text variant="small" color={radiusM === m ? colors.onDark : colors.text}>
                  {t('admin.sites.radius', { m })}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="small" color={colors.muted}>
            {t('admin.sites.dragHint')}
          </Text>
        </View>

        {id ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label">{t('admin.sites.active')}</Text>
            <Switch accessibilityLabel={t('admin.sites.active')} value={isActive} onValueChange={setIsActive} />
          </View>
        ) : null}

        {errorKey ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(errorKey)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.sites.saving') : t('admin.sites.save')} onPress={() => void save()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}
