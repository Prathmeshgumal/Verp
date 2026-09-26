import type { DashboardMapDay, SiteDto } from '@ve/shared';
import L from 'leaflet';
import { useState } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { OsmTiles } from '../../maps/OsmTiles';
import { INDIA_BOUNDS } from '../sites/SiteMapPicker';
import { bubbleHtml, GROUP_BELOW_ZOOM, siteBubbles, tagHtml } from './workingMap';

interface Props {
  days: DashboardMapDay[];
  sites: SiteDto[];
  tz: string;
  onOpen: (dayId: string) => void;
  height: number | string;
}

/** A zero-size marker; the label inside positions itself (see .ve-tag / .ve-bubble). */
const labelIcon = (html: string) => L.divIcon({ className: 've-anchor', html, iconSize: [0, 0], iconAnchor: [0, 0] });

function startBounds(days: DashboardMapDay[], sites: SiteDto[]): L.LatLngBounds {
  const points = [
    ...days.map((d) => L.latLng(d.checkInLat, d.checkInLng)),
    ...sites.filter((s) => s.isActive).map((s) => L.latLng(s.lat, s.lng)),
  ];
  return points.length > 0 ? L.latLngBounds(points).pad(0.2) : INDIA_BOUNDS;
}

function Tags({ days, sites, tz, onOpen }: Omit<Props, 'height'>) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  if (zoom < GROUP_BELOW_ZOOM) {
    return siteBubbles(days, sites).map((b) => (
      <Marker
        key={b.siteId}
        position={[b.lat, b.lng]}
        icon={labelIcon(bubbleHtml(b))}
        eventHandlers={{ click: () => map.flyTo([b.lat, b.lng], GROUP_BELOW_ZOOM + 1) }}
      />
    ));
  }
  return days.map((d) => (
    <Marker
      key={d.dayId}
      position={[d.checkInLat, d.checkInLng]}
      icon={labelIcon(tagHtml(d, tz))}
      eventHandlers={{ click: () => onOpen(d.dayId) }}
    />
  ));
}

/** Where each worker checked in today. Positions come from check-in only; nothing is tracked afterwards. */
export function WorkingMap({ days, sites, tz, onOpen, height }: Props) {
  return (
    <MapContainer bounds={startBounds(days, sites)} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {sites
        .filter((s) => s.isActive)
        .map((s) => (
          <Circle
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.radiusM}
            interactive={false}
            pathOptions={{ color: '#B8480F', weight: 1.5, opacity: 0.5, fillOpacity: 0.06 }}
          />
        ))}
      <Tags days={days} sites={sites} tz={tz} onOpen={onOpen} />
    </MapContainer>
  );
}
