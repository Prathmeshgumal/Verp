import { expect, test } from 'vitest';
import { filtersFromParams, filtersToParams } from './attendanceFilters';

const TODAY = '2026-09-25';

test('an empty URL means today, page 1, no other filters', () => {
  expect(filtersFromParams(new URLSearchParams(), TODAY)).toEqual({
    from: TODAY,
    to: TODAY,
    employeeId: undefined,
    siteId: undefined,
    status: undefined,
    needsReview: undefined,
    page: 1,
  });
});

test('valid values are read; junk falls back to the default', () => {
  const f = filtersFromParams(
    new URLSearchParams('from=2026-09-01&to=2026-09-25&employeeId=e1&siteId=s1&status=MISSED_CHECKOUT&needsReview=true&page=3'),
    TODAY,
  );
  expect(f).toEqual({ from: '2026-09-01', to: '2026-09-25', employeeId: 'e1', siteId: 's1', status: 'MISSED_CHECKOUT', needsReview: true, page: 3 });
  const junk = filtersFromParams(new URLSearchParams('from=yesterday&status=LOST&needsReview=yes&page=-2'), TODAY);
  expect(junk).toMatchObject({ from: TODAY, status: undefined, needsReview: undefined, page: 1 });
});

test('a reversed range is swapped', () => {
  expect(filtersFromParams(new URLSearchParams('from=2026-09-25&to=2026-09-01'), TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-09-25' });
});

test('writing leaves out empty filters and page 1', () => {
  const f = filtersFromParams(new URLSearchParams('from=2026-09-01&to=2026-09-25&status=COMPLETED'), TODAY);
  expect(filtersToParams(f).toString()).toBe('from=2026-09-01&to=2026-09-25&status=COMPLETED');
  expect(filtersToParams({ ...f, needsReview: true, page: 2 }).toString()).toBe(
    'from=2026-09-01&to=2026-09-25&status=COMPLETED&needsReview=true&page=2',
  );
});
