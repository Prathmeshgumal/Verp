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
  /** A refused attempt or a working employee to fly to; `n` changes on every click so the same one can be shown again. */
  focus?: MapFocus | null;
}

/** What the map should fly to: a refused attempt (by id) or someone working now (by employee id). */
export interface MapFocus {
  kind: 'refused' | 'working';
  id: string;
  n: number;
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

/** The check-in pin of the employee a "Working now" row points at. */
function workingDay(focus: Props['focus'], days: DashboardMapDay[]): DashboardMapDay | undefined {
  return focus?.kind === 'working' ? days.find((d) => d.employeeId === focus.id && d.status === 'CHECKED_IN') : undefined;
}

/**
 * Flies to the focused refused attempt (and opens its label) or to a working employee's check-in pin.
 * Zooms in at least far enough that people are shown one by one instead of grouped per site.
 */
function FocusPoint({ focus, refused, days, markers }: { focus: Props['focus']; refused: DashboardRefusedAttempt[]; days: DashboardMapDay[]; markers: Map<string, L.CircleMarker> }) {
  const map = useMap();
  // Read the latest lists without making them effect inputs: only a new click should move the map,
  // not the dashboard's once-a-minute refresh.
  const latest = useRef({ refused, days });
  useEffect(() => {
    latest.current = { refused, days };
  }, [refused, days]);
  useEffect(() => {
    if (!focus) return;
    const { refused, days } = latest.current;
    const attempt = focus.kind === 'refused' ? refused.find((a) => a.id === focus.id) : undefined;
    const day = workingDay(focus, days);
    const target = attempt ? L.latLng(attempt.lat, attempt.lng) : day ? L.latLng(day.checkInLat, day.checkInLng) : null;
    if (!target) return;
    map.getContainer().scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    map.flyTo(target, Math.max(map.getZoom(), 17, GROUP_BELOW_ZOOM), { duration: 0.6 });
    if (attempt) map.once('moveend', () => markers.get(attempt.id)?.openTooltip());
  }, [focus, map, markers]);
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
      {workingDay(focus, days) ? (
        <CircleMarker
          center={[workingDay(focus, days)!.checkInLat, workingDay(focus, days)!.checkInLng]}
          radius={22}
          interactive={false}
          pathOptions={{ color: '#FF5B14', weight: 3, fill: false, className: 've-focus-ring' }}
        />
      ) : null}
      <FocusPoint focus={focus} refused={refused} days={days} markers={markers} />
      <RecenterControl bounds={startBounds(days, sites)} />
    </MapContainer>
  );
}
