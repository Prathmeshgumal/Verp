// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { createPlaceSearch } from './placeSearch';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

test('asks Nominatim for Indian places and keeps only usable rows', async () => {
  const fetch = vi.fn(async () =>
    ok([
      { display_name: 'Hinjewadi Phase 1, Pune, Maharashtra', lat: '18.5912', lon: '73.7389' },
      { display_name: 'Broken', lat: 'x', lon: '73' },
      { lat: '1', lon: '2' },
    ]),
  );
  const search = createPlaceSearch({ fetch });
  await expect(search('  Hinjewadi  ')).resolves.toEqual([{ name: 'Hinjewadi Phase 1, Pune, Maharashtra', lat: 18.5912, lng: 73.7389 }]);
  const url = new URL((fetch.mock.calls[0] as unknown as [string])[0]);
  expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'Hinjewadi', format: 'jsonv2', limit: '5', countrycodes: 'in', 'accept-language': 'en' });
});

test('search waits one second between requests', async () => {
  let clock = 10_000;
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const search = createPlaceSearch({ fetch: async () => ok([]), now: () => clock, sleep });
  await search('a');
  clock += 200;
  await search('b');
  expect(sleep).toHaveBeenCalledTimes(1);
  expect(sleep).toHaveBeenCalledWith(800);
  clock += 5_000;
  await search('c');
  expect(sleep).toHaveBeenCalledTimes(1);
});

test('an empty query sends nothing', async () => {
  const fetch = vi.fn();
  await expect(createPlaceSearch({ fetch })('   ')).resolves.toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

test('a refused request is an error', async () => {
  const search = createPlaceSearch({ fetch: async () => new Response('slow down', { status: 429 }) });
  await expect(search('Pune')).rejects.toThrow('Place search failed (429)');
});
