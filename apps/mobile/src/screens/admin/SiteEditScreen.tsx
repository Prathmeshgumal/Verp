import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseCoordinates } from '@ve/shared';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { queryKeys } from '../../attendance/queryKeys';
import { searchPlaces, type PlaceResult } from '../../maps/placeSearch';
import { LeafletMap, type LatLng } from '../../maps/LeafletMap';
import { ensureLocationReady, getBestFix, type LocationProblem } from '../../native/location';
import type { SitesStackParamList } from '../../navigation/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/Centered';
import { Icon } from '../../ui/Icon';
import { FadedScrollView } from '../../ui/FadedScrollView';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { adminErrorKey } from './adminErrors';

type Props = NativeStackScreenProps<SitesStackParamList, 'SiteEdit'>;

const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;
const PRESETS = [50, 100, 200, 500];
const FIX_TIMEOUT_MS = 20_000;
/** Used only until company settings arrive. */
const FALLBACK_MAX_ACCURACY_M = 50;

const LOCATION_PROBLEM_KEY: Record<LocationProblem, string> = {
  LOCATION_OFF: 'result.locationOff',
  PERMISSION_DENIED: 'result.permissionDenied',
  PRECISE_LOCATION_REQUIRED: 'result.preciseRequired',
};

/** A message to show: an i18n key plus its values. */
type Note = { key: string; values?: Record<string, number> };

const clampRadius = (m: number) => Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, m));

export function SiteEditScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const id = route.params.id;
  const siteQuery = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: () => api.getSettings() });
  const sitesQuery = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites(), enabled: !id });
  const maxAccuracyM = settingsQuery.data?.maxAccuracyM ?? FALLBACK_MAX_ACCURACY_M;

  /** Bumped on every pin move; a slow lookup that started before a move must not undo it. */
  const moveSeq = useRef(0);
  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState<LatLng | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [radiusM, setRadiusM] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [placeText, setPlaceText] = useState('');
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<Note | null>(null);

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

  function moveTo(p: LatLng, recenter: boolean, accuracy: number | null = null) {
    moveSeq.current += 1;
    setCenter(p);
    setAccuracyM(accuracy);
    setNote(null);
    setError(null);
    if (recenter) setRecenterKey((k) => k + 1);
  }

  async function locateMe() {
    setError(null);
    setNote(null);
    setLocating(true);
    const seq = moveSeq.current;
    try {
      const problem = await ensureLocationReady();
      if (problem) return setError({ key: LOCATION_PROBLEM_KEY[problem] });
      const fix = await getBestFix(maxAccuracyM, FIX_TIMEOUT_MS);
      if (moveSeq.current !== seq) return;
      if (!fix) return setError({ key: 'admin.sites.noFix' });
      const accuracy = Math.round(fix.accuracyM);
      if (fix.accuracyM > maxAccuracyM) return setError({ key: 'admin.sites.tooImprecise', values: { accuracy, max: maxAccuracyM } });
      moveTo({ lat: fix.lat, lng: fix.lng }, true, fix.accuracyM);
      setNote({ key: 'admin.sites.located', values: { accuracy } });
    } finally {
      setLocating(false);
    }
  }

  async function findPlace() {
    if (!placeText.trim()) return;
    setError(null);
    setSearching(true);
    try {
      setPlaces(await searchPlaces(placeText));
    } catch (err) {
      console.warn('site: place search failed', err);
      setError({ key: 'admin.sites.searchFailed' });
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(p: PlaceResult) {
    moveTo({ lat: p.lat, lng: p.lng }, true);
    setNote({ key: 'admin.sites.fromSearch' });
    setPlaces(null);
    if (!address.trim()) setAddress(p.name.split(',').slice(0, 3).join(',').trim());
  }

  async function pasteFromGoogle() {
    const text = linkText.trim();
    if (!text) return;
    setError(null);
    const local = parseCoordinates(text);
    let place: LatLng | null = local;
    if (!place) {
      setResolving(true);
      const seq = moveSeq.current;
      try {
        place = await api.resolvePlaceLink(text);
        if (moveSeq.current !== seq) place = null;
      } catch (err) {
        setError({ key: adminErrorKey(err) });
      } finally {
        setResolving(false);
      }
    }
    if (!place) return;
    moveTo({ lat: place.lat, lng: place.lng }, true);
    setNote({ key: 'admin.sites.fromGoogle' });
    setLinkText('');
  }

  async function save() {
    if (!center) return;
    if (!name.trim()) return setError({ key: 'admin.errors.nameRequired' });
    setBusy(true);
    setError(null);
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
      setError({ key: adminErrorKey(err) });
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

  const coords = center
    ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}${accuracyM !== null ? ` · ±${Math.round(accuracyM)} m` : ''}`
    : null;

  return (
    <Screen edges={[]}>
      <View>
        <LeafletMap
          testID="site-map"
          center={center}
          radiusM={radiusM}
          height={300}
          draggable
          tapToPlace
          overview={(sitesQuery.data ?? []).map((s) => ({ lat: s.lat, lng: s.lng }))}
          recenterKey={recenterKey}
          onMove={(p) => moveTo(p, false)}
        />
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

      <FadedScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {coords ? (
          <Text variant="mono" color={colors.muted}>
            {coords}
          </Text>
        ) : (
          <Text variant="bodyStrong">{t('admin.sites.noPinHint')}</Text>
        )}
        {note ? (
          <Text variant="small" color={colors.checkIn}>
            {t(note.key, note.values)}
          </Text>
        ) : null}

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('admin.sites.search')}
                placeholder={t('admin.sites.searchHint')}
                value={placeText}
                onChangeText={setPlaceText}
                returnKeyType="search"
                onSubmitEditing={() => void findPlace()}
              />
            </View>
            <Button label={t('admin.sites.searchGo')} variant="secondary" onPress={() => void findPlace()} disabled={searching} />
          </View>
          {places && places.length === 0 ? (
            <Text variant="small" color={colors.muted}>
              {t('admin.sites.noPlaces')}
            </Text>
          ) : null}
          {(places ?? []).map((p) => (
            <Pressable
              key={`${p.lat},${p.lng}`}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              onPress={() => pickPlace(p)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
            >
              <Icon name="pin" size={18} color={colors.muted} />
              <Text variant="small" style={{ flex: 1 }} numberOfLines={2}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('admin.sites.paste')}
                value={linkText}
                onChangeText={setLinkText}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void pasteFromGoogle()}
              />
            </View>
            <Button label={t('admin.sites.pasteGo')} variant="secondary" onPress={() => void pasteFromGoogle()} disabled={resolving} />
          </View>
          <Text variant="small" color={colors.muted}>
            {t('admin.sites.pasteHelp')}
          </Text>
        </View>

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

        {error ? (
          <Text accessibilityRole="alert" variant="bodyStrong" color={colors.checkOut}>
            {t(error.key, error.values)}
          </Text>
        ) : null}
        <Button label={busy ? t('admin.sites.saving') : t('admin.sites.save')} onPress={() => void save()} disabled={busy || !center} />
      </FadedScrollView>
    </Screen>
  );
}
