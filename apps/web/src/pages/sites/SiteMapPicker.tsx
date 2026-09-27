import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { Reading } from '../../lib/locate';
import { MAP_LIMITS, OsmTiles } from '../../maps/OsmTiles';
import { RecenterControl } from '../../maps/RecenterControl';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  /** null = no pin yet (a new site). */
  center: LatLng | null;
  radiusM: number;
  onMove: (position: LatLng) => void;
  /** Change it to fit the map around the circle again (after search, "use my location", loading). */
  recenterKey: number;
  /** The reading behind "Use my location", drawn as a dashed ring until the pin moves. */
  accuracy?: Reading | null;
  /** Existing sites: the starting view while there is no pin. */
  overview?: LatLng[];
  height?: number | string;
}

export const INDIA_BOUNDS = L.latLngBounds(L.latLng(6.5, 68), L.latLng(35.5, 97.5));

const pinIcon = L.divIcon({ className: '', html: '<div class="ve-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

function startBounds(center: LatLng | null, radiusM: number, overview: LatLng[]): L.LatLngBounds {
  if (center) return L.latLng(center.lat, center.lng).toBounds(radiusM * 2.4);
  if (overview.length > 0) return L.latLngBounds(overview.map((p) => L.latLng(p.lat, p.lng))).pad(0.3);
  return INDIA_BOUNDS;
}

function Recenter({ center, radiusM, recenterKey }: Pick<Props, 'center' | 'radiusM' | 'recenterKey'>) {
  const map = useMap();
  const latest = useRef({ center, radiusM });
  latest.current = { center, radiusM };
  useEffect(() => {
    const { center: c, radiusM: r } = latest.current;
    if (c) map.fitBounds(L.latLng(c.lat, c.lng).toBounds(r * 2.4), { maxZoom: 18 });
  }, [map, recenterKey]);
  return null;
}

/** Existing sites load after the map mounts; show them once they arrive, but only while there is no pin. */
function FitOverview({ overview, hasPin }: { overview: LatLng[]; hasPin: boolean }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || hasPin || overview.length === 0) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(overview.map((p) => L.latLng(p.lat, p.lng))).pad(0.3), { maxZoom: 13 });
  }, [map, overview, hasPin]);
  return null;
}

function ClickToMove({ onMove }: Pick<Props, 'onMove'>) {
  useMapEvents({ click: (event) => onMove({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export function SiteMapPicker({ center, radiusM, onMove, recenterKey, accuracy = null, overview = [], height = 420 }: Props) {
  return (
    <MapContainer {...MAP_LIMITS} bounds={startBounds(center, radiusM, overview)} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {center ? (
        <>
          <Circle center={[center.lat, center.lng]} radius={radiusM} pathOptions={{ color: '#FF5B14', weight: 2.5, fillOpacity: 0.14 }} />
          <Marker
            position={[center.lat, center.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const p = (event.target as L.Marker).getLatLng();
                onMove({ lat: p.lat, lng: p.lng });
              },
            }}
          />
        </>
      ) : null}
      {accuracy ? (
        <Circle
          center={[accuracy.lat, accuracy.lng]}
          radius={accuracy.accuracyM}
          interactive={false}
          pathOptions={{ color: '#2563EB', weight: 1.5, dashArray: '4 4', fillOpacity: 0.06 }}
        />
      ) : null}
      <ClickToMove onMove={onMove} />
      <Recenter center={center} radiusM={radiusM} recenterKey={recenterKey} />
      <FitOverview overview={overview} hasPin={center !== null} />
      <RecenterControl bounds={startBounds(center, radiusM, overview)} maxZoom={18} />
    </MapContainer>
  );
}
