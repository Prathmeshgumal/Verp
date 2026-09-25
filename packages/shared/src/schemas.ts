import { z } from 'zod';
import { normalizePhone } from './phone';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const boolString = z.enum(['true', 'false']).transform((v) => v === 'true');
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const name = z.string().trim().min(1).max(120);
const deviceId = z.string().min(1).max(128);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
    return z.NEVER;
  }
  return phone;
});

export const pinSchema = z.string().regex(/^\d{6}$/, 'PIN must be 6 digits');

export const employeeLoginSchema = z.strictObject({
  phone: phoneSchema,
  pin: pinSchema,
  deviceId,
  deviceModel: optionalText(128),
});

export const adminLoginSchema = z.strictObject({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
  client: z.enum(['web', 'mobile']).default('mobile'),
  deviceId: deviceId.optional(),
  deviceModel: optionalText(128),
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512).optional(),
});

export const attendanceSubmitSchema = z.strictObject({
  lat,
  lng,
  accuracyM: z.number().positive().max(5000),
  isMock: z.boolean(),
  deviceTime: z.iso.datetime({ offset: true }),
  deviceId,
  deviceModel: optionalText(128),
  appVersion: optionalText(32),
});

export const idempotencyKeySchema = z.uuid();

const radiusM = z.number().int().min(10).max(1000);

export const siteCreateSchema = z.strictObject({
  name,
  address: optionalText(300),
  lat,
  lng,
  radiusM: radiusM.optional(),
});

export const siteUpdateSchema = z.strictObject({
  name: name.optional(),
  address: z.string().trim().max(300).nullable().optional(),
  lat: lat.optional(),
  lng: lng.optional(),
  radiusM: radiusM.optional(),
  isActive: z.boolean().optional(),
});

const employeeCode = z.string().trim().min(1).max(32);

export const employeeCreateSchema = z.strictObject({
  name,
  phone: phoneSchema,
  employeeCode: employeeCode.optional(),
  siteId: z.uuid().nullable().optional(),
});

export const employeeUpdateSchema = z.strictObject({
  name: name.optional(),
  phone: phoneSchema.optional(),
  employeeCode: employeeCode.nullable().optional(),
  siteId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const employeeListQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  siteId: z.uuid().optional(),
  isActive: boolString.optional(),
});

export const attendanceListQuerySchema = z
  .strictObject({
    from: z.iso.date(),
    to: z.iso.date(),
    employeeId: z.uuid().optional(),
    siteId: z.uuid().optional(),
    status: z.enum(['CHECKED_IN', 'COMPLETED', 'MISSED_CHECKOUT']).optional(),
    needsReview: boolString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((q) => q.from <= q.to, { message: 'from must not be after to', path: ['from'] });

export const myAttendanceQuerySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const fixCheckoutSchema = z.strictObject({
  checkOutAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(3).max(500),
});

export const settingsUpdateSchema = z.strictObject({
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone').optional(),
  maxAccuracyM: z.number().int().min(5).max(500).optional(),
  defaultRadiusM: radiusM.optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)')
    .optional(),
  clockMismatchMinutes: z.number().int().min(1).max(120).optional(),
});

export type EmployeeLogin = z.output<typeof employeeLoginSchema>;
export type AdminLogin = z.output<typeof adminLoginSchema>;
export type AttendanceSubmit = z.output<typeof attendanceSubmitSchema>;
export type SiteCreate = z.output<typeof siteCreateSchema>;
export type SiteUpdate = z.output<typeof siteUpdateSchema>;
export type EmployeeCreate = z.output<typeof employeeCreateSchema>;
export type EmployeeUpdate = z.output<typeof employeeUpdateSchema>;
export type EmployeeListQuery = z.output<typeof employeeListQuerySchema>;
export type AttendanceListQuery = z.output<typeof attendanceListQuerySchema>;
export type MyAttendanceQuery = z.output<typeof myAttendanceQuerySchema>;
export type FixCheckout = z.output<typeof fixCheckoutSchema>;
export type SettingsUpdate = z.output<typeof settingsUpdateSchema>;
