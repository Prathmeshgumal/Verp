import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedMapsUrl, pinFromMapsUrl } from '../src/modules/places/googleLink';
import { createTestApp } from './helpers/app';
import { adminToken, bearer, employeeToken, makeAdmin, makeEmployee } from './helpers/factories';

// Recorded from Google Maps (web and Android share sheet), September 2026.
const PLACE_URL =
  'https://www.google.com/maps/place/Charminar/@17.3615687,78.4721083,17z/data=!3m1!4b1!4m6!3m5!1s0x3bcb978c3bb5f0e5:0x7a34a2b6f0b0b5c!8m2!3d17.3615636!4d78.4746832!16zL20vMDFrNmY0?entry=ttu';
const DROPPED_PIN_URL = 'https://www.google.com/maps/search/17.416682,+78.366365?entry=tts';
const QUERY_URL = 'https://maps.google.com/?q=17.416682,78.366365';
const VIEWPORT_URL = 'https://www.google.com/maps/@17.4167,78.3664,15z';
const SHORT_URL = 'https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9';

let app: FastifyInstance;
afterEach(async () => app?.close());

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

async function setup(fetchImpl: typeof fetch = vi.fn<typeof fetch>()) {
  ({ app } = await createTestApp({ fetch: fetchImpl }));
  const token = await adminToken(app, await makeAdmin());
  const resolve = (text: string) =>
    app.inject({ method: 'POST', url: '/admin/places/resolve-link', headers: bearer(token), payload: { text } });
  return { resolve, fetchImpl };
}

describe('pinFromMapsUrl', () => {
  it('reads the exact pin from each Google Maps link shape', () => {
    expect(pinFromMapsUrl(new URL(PLACE_URL))).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(pinFromMapsUrl(new URL(DROPPED_PIN_URL))).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(pinFromMapsUrl(new URL(QUERY_URL))).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(pinFromMapsUrl(new URL('https://www.google.com/maps?ll=17.41,78.36'))).toBeNull();
    expect(pinFromMapsUrl(new URL(VIEWPORT_URL))).toBeNull();
  });

  it('allows only https Google Maps hosts', () => {
    expect(isAllowedMapsUrl(new URL(SHORT_URL))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://goo.gl/maps/abc'))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://www.google.co.in/maps/place/x'))).toBe(true);
    expect(isAllowedMapsUrl(new URL('https://goo.gl/abc'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('https://www.google.com/search?q=x'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('http://maps.google.com/?q=1,2'))).toBe(false);
    expect(isAllowedMapsUrl(new URL('https://maps.google.com.evil.example/?q=1,2'))).toBe(false);
  });
});

describe('POST /admin/places/resolve-link', () => {
  it('returns plain coordinates without any network call', async () => {
    const { resolve, fetchImpl } = await setup();
    const res = await resolve('17.416682, 78.366365');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads a full link without fetching it', async () => {
    const { resolve, fetchImpl } = await setup();
    const res = await resolve(`Charminar ${PLACE_URL}`);
    expect(res.json()).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows a short link through its redirects to the pin', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://maps.app.goo.gl/Xk3vQh2bMzN8pT7a9?g_st=ac'))
      .mockResolvedValueOnce(redirectTo(PLACE_URL));
    const { resolve } = await setup(fetchImpl);
    const res = await resolve(SHORT_URL);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lat: 17.3615636, lng: 78.4746832 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('follows the consent page to the real link', async () => {
    const consent = `https://consent.google.com/ml?continue=${encodeURIComponent(DROPPED_PIN_URL)}&gl=IN`;
    const { resolve } = await setup(vi.fn<typeof fetch>().mockResolvedValueOnce(redirectTo(consent)));
    expect((await resolve(SHORT_URL)).json()).toEqual({ lat: 17.416682, lng: 78.366365 });
  });

  it('refuses a link that only shows an area', async () => {
    const { resolve } = await setup();
    const res = await resolve(VIEWPORT_URL);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      code: 'NO_EXACT_PIN',
      message: 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.',
    });
  });

  it('refuses other sites, and a short link that redirects elsewhere', async () => {
    const { resolve, fetchImpl } = await setup(vi.fn<typeof fetch>().mockResolvedValue(redirectTo('https://evil.example/maps')));
    const other = await resolve('https://evil.example/maps/@17,78');
    expect(other.json()).toEqual({ code: 'NOT_A_MAPS_LINK', message: "That doesn't look like a Google Maps link or coordinates." });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await resolve(SHORT_URL)).json().code).toBe('NOT_A_MAPS_LINK');
  });

  it('gives up after 5 hops, on network errors and on a non-redirect answer', async () => {
    const loop = vi.fn<typeof fetch>().mockResolvedValue(redirectTo(SHORT_URL));
    const first = await setup(loop);
    expect((await first.resolve(SHORT_URL)).json().code).toBe('LINK_UNREACHABLE');
    expect(loop).toHaveBeenCalledTimes(5);
    await app.close();

    const down = await setup(vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));
    expect((await down.resolve(SHORT_URL)).json()).toEqual({
      code: 'LINK_UNREACHABLE',
      message: "Couldn't open that link. Check it, or copy the coordinates instead.",
    });
    await app.close();

    const page = await setup(vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })));
    expect((await page.resolve(SHORT_URL)).json().code).toBe('LINK_UNREACHABLE');
  });

  it('rejects junk text and is for admins only', async () => {
    const { resolve } = await setup();
    expect((await resolve('near the big tree')).json().code).toBe('NOT_A_MAPS_LINK');
    const employee = await makeEmployee();
    const res = await app.inject({
      method: 'POST',
      url: '/admin/places/resolve-link',
      headers: bearer(await employeeToken(app, employee)),
      payload: { text: '17.4, 78.3' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('limits each IP to 30 lookups a minute', async () => {
    const { resolve } = await setup();
    for (let i = 0; i < 30; i++) expect((await resolve('17.4, 78.3')).statusCode).toBe(200);
    const res = await resolve('17.4, 78.3');
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('RATE_LIMITED');
  });
});
