import type { AttendanceStatus } from '@ve/shared';

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  CHECKED_IN: 'Working',
  COMPLETED: 'Completed',
  MISSED_CHECKOUT: 'Missed check-out',
};

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
  CHECKED_IN: 'ledgerBlue',
  COMPLETED: 'ledgerGreen',
  MISSED_CHECKOUT: 'ledgerOrange',
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
