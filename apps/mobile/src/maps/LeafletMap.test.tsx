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

test('a map with no pin yet sends a null centre and the overview', async () => {
  await render(
    <LeafletMap testID="map" center={null} radiusM={100} height={200} tapToPlace overview={[{ lat: 17.4, lng: 78.4 }]} />,
  );
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"center":null');
  expect(injectedScripts[0]).toContain('"tapToPlace":true');
  expect(injectedScripts[0]).toContain('"overview":[{"lat":17.4,"lng":78.4}]');
});

test('the phone position and follow mode reach the page', async () => {
  await render(
    <LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={100} height={200} me={{ lat: 18.501, lng: 73.801, accuracyM: 9 }} follow />,
  );
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"me":{"lat":18.501,"lng":73.801,"accuracyM":9}');
  expect(injectedScripts[0]).toContain('"follow":true');
});

test('a tapped tag comes back with its key', () => {
  expect(parseMapMessage('{"type":"tag","key":"d1"}')).toEqual({ type: 'tag', key: 'd1' });
  expect(parseMapMessage('{"type":"tag","key":5}')).toBeNull();
});

test('the recenter button makes the map fit its area again', async () => {
  await render(<LeafletMap testID="map" center={{ lat: 18.5, lng: 73.8 }} radiusM={100} height={200} />);
  await fireEvent(screen.getByTestId('map'), 'message', message({ type: 'ready' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(1));
  expect(injectedScripts[0]).toContain('"recenterKey":"0:0"');
  await fireEvent.press(screen.getByRole('button', { name: 'Back to the area' }));
  await waitFor(() => expect(injectedScripts).toHaveLength(2));
  expect(injectedScripts[1]).toContain('"recenterKey":"0:1"');
});

test('a static map has no recenter button', async () => {
  await render(<LeafletMap center={{ lat: 18.5, lng: 73.8 }} radiusM={100} height={200} interactive={false} />);
  expect(screen.queryByRole('button', { name: 'Back to the area' })).toBeNull();
});
