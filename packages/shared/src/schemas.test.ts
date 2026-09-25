import { describe, expect, it } from 'vitest';
import {
  attendanceListQuerySchema,
  attendanceSubmitSchema,
  employeeCreateSchema,
  employeeLoginSchema,
  settingsUpdateSchema,
  siteCreateSchema,
} from './schemas';

const validSubmit = {
  lat: 18.52,
  lng: 73.85,
  accuracyM: 12,
  isMock: false,
  deviceTime: '2026-09-25T09:30:00+05:30',
  deviceId: 'abc',
};

describe('attendanceSubmitSchema', () => {
  it('accepts a valid body', () => {
    expect(attendanceSubmitSchema.parse(validSubmit)).toMatchObject(validSubmit);
  });
  it('rejects client-supplied identity or status fields', () => {
    for (const extra of [{ employeeId: 'x' }, { status: 'COMPLETED' }, { timestamp: 'x' }]) {
      expect(attendanceSubmitSchema.safeParse({ ...validSubmit, ...extra }).success).toBe(false);
    }
  });
  it.each([
    { lat: 91 },
    { lng: -181 },
    { accuracyM: 0 },
    { accuracyM: 5001 },
    { deviceTime: 'yesterday' },
    { deviceId: '' },
  ])('rejects %o', (patch) => {
    expect(attendanceSubmitSchema.safeParse({ ...validSubmit, ...patch }).success).toBe(false);
  });
});

describe('employeeLoginSchema', () => {
  it('normalizes the phone number', () => {
    const r = employeeLoginSchema.parse({ phone: '098765 43210', pin: '123456', deviceId: 'd' });
    expect(r.phone).toBe('+919876543210');
  });
  it.each(['12345', '1234567', '12a456'])('rejects PIN %s', (pin) => {
    expect(employeeLoginSchema.safeParse({ phone: '9876543210', pin, deviceId: 'd' }).success).toBe(false);
  });
  it('rejects an invalid phone', () => {
    expect(employeeLoginSchema.safeParse({ phone: '123', pin: '123456', deviceId: 'd' }).success).toBe(false);
  });
});

describe('siteCreateSchema', () => {
  it('trims the name and allows an omitted radius', () => {
    expect(siteCreateSchema.parse({ name: '  Plot 7 ', lat: 18.5, lng: 73.8 })).toEqual({ name: 'Plot 7', lat: 18.5, lng: 73.8 });
  });
  it.each([9, 1001, 50.5])('rejects radius %s', (radiusM) => {
    expect(siteCreateSchema.safeParse({ name: 'x', lat: 1, lng: 1, radiusM }).success).toBe(false);
  });
});

describe('employeeCreateSchema', () => {
  it('requires a name and a valid phone', () => {
    expect(employeeCreateSchema.safeParse({ name: '', phone: '9876543210' }).success).toBe(false);
    expect(employeeCreateSchema.parse({ name: 'Ravi', phone: '9876543210' }).phone).toBe('+919876543210');
  });
});

describe('attendanceListQuerySchema', () => {
  it('coerces paging and booleans from query strings', () => {
    const q = attendanceListQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30', needsReview: 'true', page: '2' });
    expect(q).toMatchObject({ needsReview: true, page: 2, pageSize: 50 });
  });
  it('rejects from after to', () => {
    expect(attendanceListQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success).toBe(false);
  });
});

describe('settingsUpdateSchema', () => {
  it('validates timezone and reminder time', () => {
    expect(settingsUpdateSchema.safeParse({ timezone: 'Asia/Kolkata', reminderTime: '19:30' }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ reminderTime: '24:00' }).success).toBe(false);
  });
});
