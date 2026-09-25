import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('app skeleton', () => {
  it('serves /health', async () => {
    ({ app } = await createTestApp());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns the standard 404 body', async () => {
    ({ app } = await createTestApp());
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
  });

  it('maps malformed JSON to VALIDATION_ERROR', async () => {
    ({ app } = await createTestApp({
      beforeReady: (a) => a.post('/echo', async (req) => req.body),
    }));
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('hides internal error details', async () => {
    ({ app } = await createTestApp({
      beforeReady: (a) =>
        a.get('/boom', async () => {
          throw new Error('secret database detail');
        }),
    }));
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'INTERNAL', message: 'Something went wrong' });
    expect(res.body).not.toContain('secret');
  });

  it('allows CORS only for the web origin', async () => {
    ({ app } = await createTestApp());
    const ok = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers', async () => {
    ({ app } = await createTestApp());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
