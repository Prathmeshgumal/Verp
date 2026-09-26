import { TileLayer } from 'react-leaflet';
import { config } from '../config';

/** OSM tile usage policy: visible attribution, normal browsing only (no prefetching). */
export function OsmTiles() {
  return (
    <TileLayer
      url={config.tileUrl}
      maxZoom={19}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
}
