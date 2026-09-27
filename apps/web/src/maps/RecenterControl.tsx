import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';

/**
 * A map button under the zoom buttons that brings the map back to its own area,
 * for when someone has panned off to another city or country. Put it inside a MapContainer.
 */
export function RecenterControl({ bounds, maxZoom = 17 }: { bounds: L.LatLngBounds; maxZoom?: number }) {
  const map = useMap();
  const [box] = useState(() => {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    // Clicks on the button must not reach the map (a click there moves the pin on the site picker).
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  });

  useEffect(() => {
    const control = new L.Control({ position: 'topleft' });
    control.onAdd = () => box;
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, box]);

  return createPortal(
    <button
      type="button"
      aria-label="Back to the area"
      title="Back to the area"
      onClick={() => map.fitBounds(bounds, { maxZoom })}
      className="flex size-[30px] cursor-pointer items-center justify-center bg-white text-neutral-800 hover:bg-neutral-100"
    >
      <LocateFixed className="size-4" aria-hidden />
    </button>,
    box,
  );
}
