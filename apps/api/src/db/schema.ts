import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['admin', 'employee']);
export const attendanceStatusEnum = pgEnum('attendance_status', [
  'CHECKED_IN',
  'COMPLETED',
  'MISSED_CHECKOUT',
]);
export const eventTypeEnum = pgEnum('attendance_event_type', ['IN', 'OUT']);
export const eventResultEnum = pgEnum('attendance_event_result', [
  'ACCEPTED',
  'OUTSIDE_SITE',
  'LOW_ACCURACY',
  'ALREADY_CHECKED_IN',
  'ALREADY_CHECKED_OUT',
  'NOT_CHECKED_IN',
  'NO_SITE',
]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  radiusM: integer('radius_m').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: roleEnum('role').notNull(),
  name: text('name').notNull(),
  phone: text('phone').unique(),
  employeeCode: text('employee_code').unique(),
  email: text('email').unique(),
  pinHash: text('pin_hash'),
  passwordHash: text('password_hash'),
  siteId: uuid('site_id').references(() => sites.id),
  isActive: boolean('is_active').notNull().default(true),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    prevRefreshTokenHash: text('prev_refresh_token_hash'),
    rotatedAt: ts('rotated_at'),
    deviceId: text('device_id'),
    deviceModel: text('device_model'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const attendanceDays = pgTable(
  'attendance_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => users.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    status: attendanceStatusEnum('status').notNull(),
    checkInAt: ts('check_in_at').notNull(),
    checkInLat: doublePrecision('check_in_lat').notNull(),
    checkInLng: doublePrecision('check_in_lng').notNull(),
    checkInAccuracyM: doublePrecision('check_in_accuracy_m').notNull(),
    checkInDistanceM: doublePrecision('check_in_distance_m').notNull(),
    checkOutAt: ts('check_out_at'),
    checkOutLat: doublePrecision('check_out_lat'),
    checkOutLng: doublePrecision('check_out_lng'),
    checkOutAccuracyM: doublePrecision('check_out_accuracy_m'),
    checkOutDistanceM: doublePrecision('check_out_distance_m'),
    workedMinutes: integer('worked_minutes'),
    flags: text('flags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    needsReview: boolean('needs_review').notNull().default(false),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: ts('reviewed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('attendance_days_employee_date_uq').on(t.employeeId, t.workDate),
    index('attendance_days_date_idx').on(t.workDate),
    index('attendance_days_status_idx').on(t.status),
  ],
);

export const attendanceEvents = pgTable(
  'attendance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => users.id),
    attendanceDayId: uuid('attendance_day_id').references(() => attendanceDays.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    type: eventTypeEnum('type').notNull(),
    result: eventResultEnum('result').notNull(),
    serverTime: ts('server_time').notNull(),
    deviceTime: ts('device_time'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    accuracyM: doublePrecision('accuracy_m').notNull(),
    distanceM: doublePrecision('distance_m'),
    isMock: boolean('is_mock').notNull(),
    deviceId: text('device_id'),
    deviceModel: text('device_model'),
    appVersion: text('app_version'),
    ip: text('ip'),
    idempotencyKey: uuid('idempotency_key').notNull().unique(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
  },
  (t) => [index('attendance_events_employee_date_idx').on(t.employeeId, t.workDate)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entityType, t.entityId)],
);

export const companySettings = pgTable(
  'company_settings',
  {
    id: integer('id').primaryKey().default(1),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    maxAccuracyM: integer('max_accuracy_m').notNull().default(50),
    defaultRadiusM: integer('default_radius_m').notNull().default(50),
    reminderTime: text('reminder_time').notNull().default('19:00'),
    clockMismatchMinutes: integer('clock_mismatch_minutes').notNull().default(10),
    updatedAt: updatedAt(),
  },
  (t) => [check('company_settings_singleton', sql`${t.id} = 1`)],
);

export type UserRow = typeof users.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type DayRow = typeof attendanceDays.$inferSelect;
export type EventRow = typeof attendanceEvents.$inferSelect;
