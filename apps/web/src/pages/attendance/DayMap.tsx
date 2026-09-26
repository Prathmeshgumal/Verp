import L from 'leaflet';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Tooltip, useMap } from 'react-leaflet';
import type { AdminDayDto, SiteSummary } from '@ve/shared';
import { MAP_LIMITS, OsmTiles } from '../../maps/OsmTiles';

/** The drawer animates open; Leaflet must re-measure once it has its final size. */
function FixSizeAfterOpen() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/** An admin-set check-out has no real position, and the phone's earlier reading would mislead. */
export function dayPins(day: AdminDayDto) {
  const pins = [{ key: 'in', label: 'Check-in', lat: day.checkInLat, lng: day.checkInLng, color: '#16A34A' }];
  if (day.checkOutLat != null && day.checkOutLng != null && !day.flags.includes('ADMIN_CORRECTED')) {
    pins.push({ key: 'out', label: 'Check-out', lat: day.checkOutLat, lng: day.checkOutLng, color: '#FF5B14' });
  }
  return pins;
}

export function DayMap({ day, site }: { day: AdminDayDto; site: SiteSummary }) {
  const pins = dayPins(day);
  const bounds = L.latLng(site.lat, site.lng).toBounds(site.radiusM * 2);
  for (const p of pins) bounds.extend([p.lat, p.lng]);

  return (
    <MapContainer {...MAP_LIMITS} bounds={bounds.pad(0.15)} style={{ height: 320, borderRadius: 12 }} scrollWheelZoom={false}>
      <OsmTiles />
      <Circle center={[site.lat, site.lng]} radius={site.radiusM} pathOptions={{ color: '#FF5B14', weight: 2, fillOpacity: 0.12 }} />
      {pins.map((p) => (
        <CircleMarker key={p.key} center={[p.lat, p.lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }}>
          <Tooltip>{p.label}</Tooltip>
        </CircleMarker>
      ))}
      <FixSizeAfterOpen />
    </MapContainer>
  );
}
