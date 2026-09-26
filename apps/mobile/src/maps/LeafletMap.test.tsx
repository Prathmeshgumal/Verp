import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { injectedScripts } from '../testing/webView';
import { LeafletMap, parseMapMessage } from './LeafletMap';

const message = (data: unknown) => ({ nativeEvent: { data: typeof data === 'string' ? data : JSON.stringify(data) } });

test('sends the map state once the page says it is ready', async () => {
  await render(<LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={120} height={200} draggable />);
  expect(injectedScripts).toEqual([]);
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"radiusM":120');
  expect(injectedScripts[0]).toContain('"draggable":true');
  expect(injectedScripts[0]).toContain('https://tiles.test/{z}/{x}/{y}.png');
});

test('a dragged pin reports its new position', async () => {
  const onMove = jest.fn();
  await render(<LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={120} height={200} onMove={onMove} />);
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'moved', lat: 18.51, lng: 73.81 }));
  expect(onMove).toHaveBeenCalledWith({ lat: 18.51, lng: 73.81 });
});

test('junk from the page is ignored', () => {
  expect(parseMapMessage('not json')).toBeNull();
  expect(parseMapMessage('{"type":"moved","lat":"x","lng":1}')).toBeNull();
  expect(parseMapMessage('{"type":"moved","lat":95,"lng":1}')).toBeNull();
  expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
});
