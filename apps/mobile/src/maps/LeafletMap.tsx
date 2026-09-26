import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { getDeviceInfo } from '../native/device';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPin extends LatLng {
  color: string;
}

interface Props {
  center: LatLng;
  radiusM: number;
  height: number;
  draggable?: boolean;
  /** false = a static picture: touches pass through (e.g. inside a ScrollView). */
  interactive?: boolean;
  pins?: MapPin[];
  /** Change this number to make the map fit the circle and pins again. */
  recenterKey?: number;
  onMove?: (position: LatLng) => void;
  testID?: string;
}

const MAP_URL = 'file:///android_asset/map/index.html';

type MapMessage = { type: 'ready' } | { type: 'moved'; lat: number; lng: number };

export function parseMapMessage(data: string): MapMessage | null {
  try {
    const msg = JSON.parse(data) as { type?: unknown; lat?: unknown; lng?: unknown };
    if (msg.type === 'ready') return { type: 'ready' };
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

export function LeafletMap({ center, radiusM, height, draggable = false, interactive = true, pins = [], recenterKey = 0, onMove, testID }: Props) {
  const ref = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [tileUrl, setTileUrl] = useState<string | null>(null);

  useEffect(() => {
    getDeviceInfo()
      .then((info) => setTileUrl(info.tileUrl))
      .catch((err: unknown) => console.warn('map: no tile url', err));
  }, []);

  const state = JSON.stringify({ center, radiusM, draggable, pins, recenterKey, tileUrl });
  useEffect(() => {
    if (ready && tileUrl) ref.current?.injectJavaScript(`window.veMap && window.veMap.update(${state}); true;`);
  }, [ready, tileUrl, state]);

  function onMessage(event: WebViewMessageEvent) {
    const msg = parseMapMessage(event.nativeEvent.data);
    if (msg?.type === 'ready') setReady(true);
    if (msg?.type === 'moved') onMove?.({ lat: msg.lat, lng: msg.lng });
  }

  return (
    <View style={{ height, backgroundColor: '#E9E4D8', pointerEvents: interactive ? 'auto' : 'none' }}>
      <WebView<object>
        ref={ref}
        testID={testID}
        source={{ uri: MAP_URL }}
        originWhitelist={['file://*']}
        javaScriptEnabled
        applicationNameForUserAgent="VeHR-admin-map"
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
