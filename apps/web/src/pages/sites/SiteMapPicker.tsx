import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { OsmTiles } from '../../maps/OsmTiles';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  center: LatLng;
  radiusM: number;
  onMove: (position: LatLng) => void;
  /** Change it to fit the map around the circle again (after search, "use my location", loading). */
  recenterKey: number;
  height?: number;
}

const pinIcon = L.divIcon({ className: '', html: '<div class="ve-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

function Recenter({ center, radiusM, recenterKey }: Pick<Props, 'center' | 'radiusM' | 'recenterKey'>) {
  const map = useMap();
  const latest = useRef({ center, radiusM });
  latest.current = { center, radiusM };
  useEffect(() => {
    const { center: c, radiusM: r } = latest.current;
    map.fitBounds(L.latLng(c.lat, c.lng).toBounds(r * 2.4), { maxZoom: 18 });
  }, [map, recenterKey]);
  return null;
}

function ClickToMove({ onMove }: Pick<Props, 'onMove'>) {
  useMapEvents({ click: (event) => onMove({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export function SiteMapPicker({ center, radiusM, onMove, recenterKey, height = 420 }: Props) {
  const position: [number, number] = [center.lat, center.lng];
  return (
    <MapContainer center={position} zoom={16} style={{ height, borderRadius: 12 }} scrollWheelZoom>
      <OsmTiles />
      <Circle center={position} radius={radiusM} pathOptions={{ color: '#B8480F', weight: 2.5, fillOpacity: 0.14 }} />
      <Marker
        position={position}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (event) => {
            const p = (event.target as L.Marker).getLatLng();
            onMove({ lat: p.lat, lng: p.lng });
          },
        }}
      />
      <ClickToMove onMove={onMove} />
      <Recenter center={center} radiusM={radiusM} recenterKey={recenterKey} />
    </MapContainer>
  );
}
