import L from 'leaflet';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapContainer } from 'react-leaflet';
import { expect, test, vi } from 'vitest';
import { RecenterControl } from './RecenterControl';

test('the button fits the map back onto its area', async () => {
  const area = L.latLngBounds([18.5, 73.8], [18.6, 73.9]);
  let map: L.Map | null = null;
  render(
    <MapContainer bounds={L.latLngBounds([40, -74], [41, -73])} ref={(m) => { map = m; }} style={{ height: 200 }}>
      <RecenterControl bounds={area} maxZoom={15} />
    </MapContainer>,
  );
  const button = await screen.findByRole('button', { name: 'Back to the area' });
  const fit = vi.spyOn(map!, 'fitBounds');
  const click = vi.fn();
  map!.on('click', click);
  fireEvent.click(button);
  expect(fit).toHaveBeenCalledWith(area, { maxZoom: 15 });
  expect(click).not.toHaveBeenCalled();
});
