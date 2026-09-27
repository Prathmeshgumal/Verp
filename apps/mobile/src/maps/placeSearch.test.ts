import { createPlaceSearch } from './placeSearch';

const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

test('turns results into named points and skips broken rows', async () => {
  const fetch = jest.fn(async () => reply([{ display_name: 'Hinjewadi, Pune', lat: '18.59', lon: '73.73' }, { display_name: 'x', lat: 'nope', lon: '1' }]));
  const search = createPlaceSearch({ fetch });
  expect(await search(' Hinjewadi ')).toEqual([{ name: 'Hinjewadi, Pune', lat: 18.59, lng: 73.73 }]);
  expect((fetch.mock.calls[0] as unknown as [string])[0]).toContain('q=Hinjewadi&');
});

test('waits a second between searches, as the service asks', async () => {
  let clock = 0;
  const sleep = jest.fn(async (ms: number) => {
    clock += ms;
  });
  const search = createPlaceSearch({ fetch: async () => reply([]), now: () => clock, sleep });
  await search('a');
  clock += 300;
  await search('b');
  expect(sleep).toHaveBeenCalledWith(700);
});

test('empty text does not search', async () => {
  const fetch = jest.fn();
  expect(await createPlaceSearch({ fetch })('  ')).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
