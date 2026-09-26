import type { MeTodayResponse } from '@ve/shared';

export type HomeView =
  | { kind: 'noSite' }
  | { kind: 'checkIn'; siteName: string }
  | { kind: 'working'; siteName: string; since: string }
  | { kind: 'done'; checkInAt: string; checkOutAt: string | null; workedMinutes: number | null };

/** Spec §5 "Mobile home states". */
export function homeView(today: MeTodayResponse): { view: HomeView; missedYesterday: boolean } {
  const { day, site } = today;
  let view: HomeView;
  if (day?.status === 'CHECKED_IN') {
    view = { kind: 'working', siteName: site?.name ?? '', since: day.checkInAt };
  } else if (day) {
    // COMPLETED, or (defensively) MISSED_CHECKOUT, which the server only sets for past days.
    view = { kind: 'done', checkInAt: day.checkInAt, checkOutAt: day.checkOutAt, workedMinutes: day.workedMinutes };
  } else if (!site) {
    view = { kind: 'noSite' };
  } else {
    view = { kind: 'checkIn', siteName: site.name };
  }
  return { view, missedYesterday: today.missedYesterday };
}
