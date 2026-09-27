import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { getDeviceInfo } from '../native/device';
import { colors } from '../theme/tokens';
import { Icon } from '../ui/Icon';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPin extends LatLng {
  color: string;
}

export interface MapSite extends LatLng {
  radiusM: number;
  active?: boolean;
}

/** A name tag above a point; tapping it calls onTag with its key. */
export interface MapTag extends LatLng {
  key: string;
  label: string;
  /** More than 1 shows a count badge. */
  count: number;
  tone: 'green' | 'orange' | 'grey';
}

export interface MeDot extends LatLng {
  accuracyM: number;
}

interface Props {
  /** null = no pin yet (a new site); the map shows `overview`, or India. */
  center: LatLng | null;
  radiusM: number;
  /** 'fill' = take the parent's remaining height. */
  height: number | 'fill';
  draggable?: boolean;
  /** A tap on the map moves the pin there (reported through onMove). */
  tapToPlace?: boolean;
  /** false = a static picture: touches pass through (e.g. inside a ScrollView). */
  interactive?: boolean;
  pins?: MapPin[];
  /** The phone's own position: a blue dot with its accuracy ring. */
  me?: MeDot | null;
  /** Refit the map when the blue dot leaves the view. */
  follow?: boolean;
  /** Other places to frame while there is no pin (e.g. existing sites). */
  overview?: LatLng[];
  /** Change this number to make the map fit the circle and pins again. */
  recenterKey?: number;
  /** Extra site circles, e.g. every site on an overview map. */
  sites?: MapSite[];
  tags?: MapTag[];
  onTag?: (key: string) => void;
  onMove?: (position: LatLng) => void;
  testID?: string;
}

const MAP_URL = 'file:///android_asset/map/index.html';

type MapMessage = { type: 'ready' } | { type: 'moved'; lat: number; lng: number } | { type: 'tag'; key: string };

export function parseMapMessage(data: string): MapMessage | null {
  try {
    const msg = JSON.parse(data) as { type?: unknown; lat?: unknown; lng?: unknown };
    if (msg.type === 'ready') return { type: 'ready' };
    const key = (msg as { key?: unknown }).key;
    if (msg.type === 'tag' && typeof key === 'string') return { type: 'tag', key };
    if (
      msg.type === 'moved' &&
      typeof msg.lat === 'number' &&
      typeof msg.lng === 'number' &&
      Math.abs(msg.lat) <= 90 &&
      Math.abs(msg.lng) <= 180
    ) {
      return { type: 'moved', lat: msg.lat, lng: msg.lng };
    }
  } catch {
    // not ours
  }
  return null;
}

export function LeafletMap({
  center,
  radiusM,
  height,
  draggable = false,
  tapToPlace = false,
  interactive = true,
  pins = [],
  me = null,
  follow = false,
  overview = [],
  recenterKey = 0,
  sites = [],
  tags = [],
  onTag,
  onMove,
  testID,
}: Props) {
  const { t } = useTranslation();
  const ref = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  // Bumped by the recenter button; the map refits whenever the combined key changes.
  const [recenters, setRecenters] = useState(0);
  const [tileUrl, setTileUrl] = useState<string | null>(null);

  useEffect(() => {
    getDeviceInfo()
      .then((info) => setTileUrl(info.tileUrl))
      .catch((err: unknown) => console.warn('map: no tile url', err));
  }, []);

  const state = JSON.stringify({ center, radiusM, draggable, tapToPlace, pins, me, follow, overview, recenterKey: `${recenterKey}:${recenters}`, tileUrl, sites, tags });
  useEffect(() => {
    if (ready && tileUrl) ref.current?.injectJavaScript(`window.veMap && window.veMap.update(${state}); true;`);
  }, [ready, tileUrl, state]);

  function onMessage(event: WebViewMessageEvent) {
    const msg = parseMapMessage(event.nativeEvent.data);
    if (msg?.type === 'ready') setReady(true);
    if (msg?.type === 'moved') onMove?.({ lat: msg.lat, lng: msg.lng });
    if (msg?.type === 'tag') onTag?.(msg.key);
  }

  return (
    <View style={{ ...(height === 'fill' ? { flex: 1 } : { height }), backgroundColor: '#E9E4D8', pointerEvents: interactive ? 'auto' : 'none' }}>
      <WebView<object>
        ref={ref}
        testID={testID}
        source={{ uri: MAP_URL }}
        originWhitelist={['file://*']}
        javaScriptEnabled
        // Keeps pinches and drags on the map instead of letting the page's ScrollView take them.
        nestedScrollEnabled={interactive}
        applicationNameForUserAgent="VeHR-admin-map"
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
      {interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
          onPress={() => setRecenters((n) => n + 1)}
          hitSlop={6}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 10,
            bottom: 10,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 3,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name="locate" size={22} />
        </Pressable>
      ) : null}
    </View>
  );
}
