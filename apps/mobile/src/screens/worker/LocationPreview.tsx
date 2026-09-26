import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { previewStatus, type PreviewStatus } from '../../attendance/preview';
import { LeafletMap } from '../../maps/LeafletMap';
import { useLiveFix } from '../../native/liveLocation';
import { ensureLocationReady, openAppSettings, openLocationSettings, type LocationProblem } from '../../native/location';
import { colors } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Text } from '../../ui/Text';

interface Props {
  site: { lat: number; lng: number; radiusM: number };
  maxAccuracyM: number;
  /** false while the screen is hidden, the app is in the background, or a check-in is being saved. */
  active: boolean;
}

const MAP_HEIGHT = 200;

const DOT: Record<PreviewStatus['kind'], string> = {
  inside: colors.checkIn,
  outside: colors.checkOut,
  imprecise: colors.warnBorder,
  finding: colors.muted,
};

/** Where the worker is right now, against their site's circle. It only informs: the check-in button never depends on it. */
export function LocationPreview({ site, maxAccuracyM, active }: Props) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const [ready, setReady] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    ensureLocationReady()
      .then((p) => {
        if (cancelled) return;
        setProblem(p);
        setReady(p === null);
      })
      .catch((err: unknown) => console.warn('preview: location check failed', err));
    return () => {
      cancelled = true;
    };
  }, [active]);

  const fix = useLiveFix(active && ready);

  if (problem) {
    const off = problem === 'LOCATION_OFF';
    return (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="pin" color={colors.checkOut} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {t(off ? 'home.preview.locationOff' : 'home.preview.permission')}
          </Text>
        </View>
        <Button
          label={t(off ? 'home.preview.locationSettings' : 'home.preview.appSettings')}
          variant="secondary"
          onPress={() => (off ? openLocationSettings() : openAppSettings()).catch((e: unknown) => console.warn(e))}
        />
      </Card>
    );
  }

  const status = previewStatus(fix, site, maxAccuracyM);
  const line =
    status.kind === 'inside'
      ? t('home.preview.inside', { distance: status.distanceM, accuracy: status.accuracyM })
      : status.kind === 'outside'
        ? t('home.preview.outside', { distance: status.distanceM })
        : status.kind === 'imprecise'
          ? t('home.preview.imprecise', { accuracy: status.accuracyM })
          : t('home.preview.finding');

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View>
        <LeafletMap
          testID="preview-map"
          center={{ lat: site.lat, lng: site.lng }}
          radiusM={site.radiusM}
          height={MAP_HEIGHT}
          me={fix ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM } : null}
          follow
          recenterKey={recenterKey}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.preview.centre')}
          onPress={() => setRecenterKey((k) => k + 1)}
          style={{ position: 'absolute', right: 10, bottom: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 3 }}
        >
          <Icon name="locate" size={22} />
        </Pressable>
      </View>
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[status.kind] }} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
        {fix?.isMock ? (
          <Text variant="small" color={colors.warnText}>
            {t('home.preview.mock')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
