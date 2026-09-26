import type { SiteDto } from '@ve/shared';
import L from 'leaflet';
import { Fragment, useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet';
import { MAP_LIMITS, OsmTiles } from '../../maps/OsmTiles';
import { INDIA_BOUNDS } from './SiteMapPicker';

interface Props {
  sites: SiteDto[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}

const IN_USE = '#B8480F';
const NOT_IN_USE = '#8A8578';

const pinIcon = (inUse: boolean) =>
  L.divIcon({ className: '', html: `<div class="ve-pin${inUse ? '' : ' ve-pin-off'}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

function boundsOf(sites: SiteDto[]): L.LatLngBounds {
  if (sites.length === 0) return INDIA_BOUNDS;
  const bounds = L.latLng(sites[0]!.lat, sites[0]!.lng).toBounds(sites[0]!.radiusM * 2);
  for (const s of sites) bounds.extend(L.latLng(s.lat, s.lng).toBounds(s.radiusM * 2));
  return bounds.pad(0.1);
}

/** Flies to the chosen site; keyed on the id so a background refetch does not move the map. */
function FlyToSelected({ sites, selectedId }: { sites: SiteDto[]; selectedId: string | null }) {
  const map = useMap();
  const latest = useRef(sites);
  latest.current = sites;
  useEffect(() => {
    const site = latest.current.find((s) => s.id === selectedId);
    if (site) map.flyToBounds(L.latLng(site.lat, site.lng).toBounds(site.radiusM * 3), { maxZoom: 17, duration: 0.6 });
  }, [map, selectedId]);
  return null;
}

export function SitesMap({ sites, selectedId, hoveredId, onSelect }: Props) {
  return (
    <MapContainer {...MAP_LIMITS} bounds={boundsOf(sites)} boundsOptions={{ maxZoom: 16 }} style={{ height: '100%', minHeight: 320, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      {sites.map((s) => {
        const lit = s.id === selectedId || s.id === hoveredId;
        return (
          <Fragment key={s.id}>
            <Circle
              center={[s.lat, s.lng]}
              radius={s.radiusM}
              pathOptions={{ color: s.isActive ? IN_USE : NOT_IN_USE, weight: lit ? 3.5 : 2, fillOpacity: lit ? 0.3 : 0.12 }}
              eventHandlers={{ click: () => onSelect(s.id) }}
            />
            <Marker position={[s.lat, s.lng]} icon={pinIcon(s.isActive)} eventHandlers={{ click: () => onSelect(s.id) }}>
              <Tooltip direction="top" offset={[0, -12]}>
                {s.name}
              </Tooltip>
            </Marker>
          </Fragment>
        );
      })}
      <FlyToSelected sites={sites} selectedId={selectedId} />
    </MapContainer>
  );
}
