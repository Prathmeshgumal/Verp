import type { AttendanceStatus, EmployeeDto } from '@ve/shared';
import type { Tone } from '../components/Pill';

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  CHECKED_IN: 'Working',
  COMPLETED: 'Completed',
  MISSED_CHECKOUT: 'Missed check-out',
};

export const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  CHECKED_IN: 'info',
  COMPLETED: 'success',
  MISSED_CHECKOUT: 'warning',
};

const FLAG_LABEL: Partial<Record<string, string>> = {
  MOCK_LOCATION: 'Fake GPS app',
  CLOCK_MISMATCH: 'Phone clock wrong',
  ADMIN_CORRECTED: 'Fixed by admin',
  MISSED_CHECKOUT: 'Missed check-out',
};

export function flagLabel(flag: string): string {
  const known = FLAG_LABEL[flag];
  if (known) return known;
  const words = flag.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const RESULT_LABEL: Partial<Record<string, string>> = {
  ACCEPTED: 'Saved',
  NO_SITE: 'No site assigned',
  LOW_ACCURACY: 'Location not accurate enough',
  OUTSIDE_SITE: 'Outside the site',
  ALREADY_CHECKED_IN: 'Already checked in',
  ALREADY_CHECKED_OUT: 'Already checked out',
  NOT_CHECKED_IN: 'Not checked in',
};

export function attemptResultLabel(result: string): string {
  return RESULT_LABEL[result] ?? result;
}

/** '+919876543210' → '+91 98765 43210'; other numbers unchanged. */
export function formatPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export function employeeStatus(e: EmployeeDto, now: number = Date.now()): { label: 'Active' | 'Inactive' | 'Locked'; tone: Tone } {
  if (!e.isActive) return { label: 'Inactive', tone: 'neutral' };
  if (e.lockedUntil && Date.parse(e.lockedUntil) > now) return { label: 'Locked', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}
