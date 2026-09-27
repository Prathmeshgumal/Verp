import type { DashboardMapDay, DashboardRefusedAttempt, SiteDto } from '@ve/shared';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { formatTime } from '../../lib/time';
import { MAP_LIMITS, OsmTiles } from '../../maps/OsmTiles';
import { RecenterControl } from '../../maps/RecenterControl';
import { INDIA_BOUNDS } from '../sites/SiteMapPicker';
import { bubbleHtml, GROUP_BELOW_ZOOM, siteBubbles, stackDays, stackHtml, tagLabel, tagTone } from './workingMap';

interface Props {
  days: DashboardMapDay[];
  /** Refused attempts, drawn as red dots where the phone was. */
  refused: DashboardRefusedAttempt[];
  sites: SiteDto[];
  tz: string;
  onOpen: (dayId: string) => void;
  height: number | string;
  /** A refused attempt to fly to and label; `n` changes on every click so the same one can be shown again. */
  focus?: { id: string; n: number } | null;
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

function Tags({ days, sites, tz, onOpen }: Omit<Props, 'height' | 'refused' | 'focus'>) {
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
  return stackDays(days).map((stack) =>
    stack.days.length === 1 ? (
      <Marker
        key={stack.key}
        position={[stack.lat, stack.lng]}
        icon={labelIcon(stackHtml(stack.days, tz))}
        eventHandlers={{ click: () => onOpen(stack.days[0]!.dayId) }}
      />
    ) : (
      // Several people at one spot: the tag opens a list, and each name opens that person's day.
      <Marker key={stack.key} position={[stack.lat, stack.lng]} icon={labelIcon(stackHtml(stack.days, tz))}>
        <Popup closeButton={false} offset={[0, -30]} className="ve-stack-popup">
          <ul className="ve-stack-list">
            {stack.days.map((d) => (
              <li key={d.dayId}>
                <button
                  type="button"
                  onClick={() => {
                    map.closePopup();
                    onOpen(d.dayId);
                  }}
                >
                  <span className={`ve-dot ve-dot-${tagTone(d)}`} />
                  {tagLabel(d, tz)}
                </button>
              </li>
            ))}
          </ul>
        </Popup>
      </Marker>
    ),
  );
}

/** Flies to the focused refused attempt and opens its label. */
function FocusRefused({ focus, refused, markers }: { focus: Props['focus']; refused: DashboardRefusedAttempt[]; markers: Map<string, L.CircleMarker> }) {
  const map = useMap();
  useEffect(() => {
    const attempt = focus && refused.find((a) => a.id === focus.id);
    if (!attempt) return;
    map.getContainer().scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    map.flyTo([attempt.lat, attempt.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    map.once('moveend', () => markers.get(attempt.id)?.openTooltip());
  }, [focus, refused, markers, map]);
  return null;
}

/** Where each worker checked in today. Positions come from check-in only; nothing is tracked afterwards. */
export function WorkingMap({ days, refused, sites, tz, onOpen, height, focus = null }: Props) {
  const markers = useRef(new Map<string, L.CircleMarker>()).current;
  return (
    <MapContainer {...MAP_LIMITS} bounds={startBounds(days, sites)} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {sites
        .filter((s) => s.isActive)
        .map((s) => (
          <Circle
            key={s.id}
            center={[s.lat, s.lng]}
            radius={s.radiusM}
            interactive={false}
            pathOptions={{ color: '#FF5B14', weight: 1.5, opacity: 0.5, fillOpacity: 0.06 }}
          />
        ))}
      {refused.map((a) => (
        <CircleMarker
          key={a.id}
          ref={(m) => {
            if (m) markers.set(a.id, m);
            else markers.delete(a.id);
          }}
          center={[a.lat, a.lng]}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#D92D20', fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -6]}>
            {`${a.name} · ${a.type === 'IN' ? 'check-in' : 'check-out'} refused · ${formatTime(a.serverTime, tz)}`}
          </Tooltip>
        </CircleMarker>
      ))}
      <Tags days={days} sites={sites} tz={tz} onOpen={onOpen} />
      <FocusRefused focus={focus} refused={refused} markers={markers} />
      <RecenterControl bounds={startBounds(days, sites)} />
    </MapContainer>
  );
}
