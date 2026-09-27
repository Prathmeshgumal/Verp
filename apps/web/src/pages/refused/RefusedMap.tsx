import L from 'leaflet';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Tooltip, useMap } from 'react-leaflet';
import type { DashboardRefusedAttempt, SiteDto } from '@ve/shared';
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

/** Where the phone was, next to the site circle it had to be inside. */
export function RefusedMap({ attempt, site, height = 300 }: { attempt: DashboardRefusedAttempt; site: SiteDto | null; height?: number }) {
  const bounds = L.latLng(attempt.lat, attempt.lng).toBounds(Math.max(60, attempt.accuracyM * 2));
  if (site) bounds.extend(L.latLng(site.lat, site.lng).toBounds(site.radiusM * 2));
  return (
    <MapContainer {...MAP_LIMITS} bounds={bounds.pad(0.2)} style={{ height, borderRadius: 12 }} scrollWheelZoom={false}>
      <OsmTiles />
      {site ? (
        <>
          <Circle center={[site.lat, site.lng]} radius={site.radiusM} interactive={false} pathOptions={{ color: '#FF5B14', weight: 2, fillOpacity: 0.12 }} />
          {/* The circle vanishes when zoomed out to a far-away attempt; the dot and name keep the site visible. */}
          <CircleMarker center={[site.lat, site.lng]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: '#FF5B14', fillOpacity: 1 }}>
            <Tooltip permanent direction="bottom" offset={[0, 6]}>
              {site.name}
            </Tooltip>
          </CircleMarker>
        </>
      ) : null}
      <Circle center={[attempt.lat, attempt.lng]} radius={attempt.accuracyM} interactive={false} pathOptions={{ color: '#D92D20', weight: 1, opacity: 0.4, fillOpacity: 0.08 }} />
      <CircleMarker center={[attempt.lat, attempt.lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#D92D20', fillOpacity: 1 }}>
        <Tooltip permanent direction="top" offset={[0, -8]}>
          Phone was here
        </Tooltip>
      </CircleMarker>
      <FixSizeAfterOpen />
    </MapContainer>
  );
}
