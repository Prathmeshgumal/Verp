import { toIsoWithOffset } from './format';

/** Today's date on this phone (same zone as the company, see Global Constraints). */
export function localToday(): string {
  return toIsoWithOffset(new Date()).slice(0, 10);
}
