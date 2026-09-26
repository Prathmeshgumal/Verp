import L from 'leaflet';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Tooltip, useMap } from 'react-leaflet';
import type { AdminDayDto, SiteSummary } from '@ve/shared';
import { OsmTiles } from '../../maps/OsmTiles';

/** The drawer animates open; Leaflet must re-measure once it has its final size. */
function FixSizeAfterOpen() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function DayMap({ day, site }: { day: AdminDayDto; site: SiteSummary }) {
  const pins = [
    { key: 'in', label: 'Check-in', lat: day.checkInLat, lng: day.checkInLng, color: '#1E6B45' },
    ...(day.checkOutLat != null && day.checkOutLng != null
      ? [{ key: 'out', label: 'Check-out', lat: day.checkOutLat, lng: day.checkOutLng, color: '#B8480F' }]
      : []),
  ];
  const bounds = L.latLng(site.lat, site.lng).toBounds(site.radiusM * 2);
  for (const p of pins) bounds.extend([p.lat, p.lng]);

  return (
    <MapContainer bounds={bounds.pad(0.15)} style={{ height: 260, borderRadius: 12 }} scrollWheelZoom={false}>
      <OsmTiles />
      <Circle center={[site.lat, site.lng]} radius={site.radiusM} pathOptions={{ color: '#B8480F', weight: 2, fillOpacity: 0.12 }} />
      {pins.map((p) => (
        <CircleMarker key={p.key} center={[p.lat, p.lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }}>
          <Tooltip>{p.label}</Tooltip>
        </CircleMarker>
      ))}
      <FixSizeAfterOpen />
    </MapContainer>
  );
}
