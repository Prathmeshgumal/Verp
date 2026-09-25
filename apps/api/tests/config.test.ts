import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(32) };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({ PORT: 3000, HOST: '0.0.0.0', TRUST_PROXY: false, COOKIE_SECURE: true, LOG_LEVEL: 'info' });
  });
  it('parses booleans', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: 'true', COOKIE_SECURE: 'false' })).toMatchObject({ TRUST_PROXY: true, COOKIE_SECURE: false });
  });
  it('rejects a short JWT secret', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
});
