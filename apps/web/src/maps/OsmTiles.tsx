import { TileLayer } from 'react-leaflet';
import { config } from '../config';

/**
 * Spread onto every MapContainer. At zoom 4 one copy of the world is ~4000 px wide, and the tiles don't
 * repeat (noWrap below), so the map can never show the world several times side by side.
 */
export const MAP_LIMITS = { minZoom: 4 };

/** OSM tile usage policy: visible attribution, normal browsing only (no prefetching). */
export function OsmTiles() {
  return (
    <TileLayer
      url={config.tileUrl}
      maxZoom={19}
      noWrap
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
}
