import type { DashboardMapDay } from '@ve/shared';
import { expect, test } from 'vitest';
import { dashboardToday, site } from '../../testing/fakes';
import { bubbleHtml, escapeHtml, siteBubbles, stackDays, stackLabel, stackTone, tagHtml, tagLabel, tagTone, visibleDays } from './workingMap';

const [working, finished] = dashboardToday().mapDays as [DashboardMapDay, DashboardMapDay];
const TZ = 'Asia/Kolkata';

test('tags say who and when, in company time', () => {
  expect(tagLabel(working, TZ)).toBe('Ravi Kumar · in 09:05');
  expect(tagLabel(finished, TZ)).toBe('Sunita Rao · 08:00–16:30');
});

test('green while working, orange when it needs review, grey once finished', () => {
  expect(tagTone(working)).toBe('green');
  expect(tagTone({ ...working, needsReview: true })).toBe('orange');
  expect(tagTone(finished)).toBe('grey');
});

test('finished days show only when asked', () => {
  expect(visibleDays([working, finished], false)).toEqual([working]);
  expect(visibleDays([working, finished], true)).toEqual([working, finished]);
});

test('tags at one site merge into a bubble at the site centre', () => {
  expect(siteBubbles([working, finished], [site()])).toEqual([
    { siteId: 's1', lat: 18.5912, lng: 73.7389, label: 'Plot 7 · 1 working, 1 done' },
  ]);
  // A site missing from the list (e.g. turned off) sits at the average check-in.
  expect(siteBubbles([working], [])).toEqual([{ siteId: 's1', lat: 18.5913, lng: 73.739, label: 'Plot 7 · 1 working' }]);
});

test('names are escaped before they reach the map markup', () => {
  const evil = { ...working, name: '<img src=x onerror=alert(1)>' };
  expect(tagHtml(evil, TZ)).toBe('<div class="ve-tag ve-tag-green">&lt;img src=x onerror=alert(1)&gt; · in 09:05</div>');
  expect(bubbleHtml({ siteId: 's1', lat: 0, lng: 0, label: 'A&B "yard"' })).toBe('<div class="ve-bubble">A&amp;B &quot;yard&quot;</div>');
  expect(escapeHtml(`it's`)).toBe('it&#39;s');
});

test('people who checked in at the same spot share one tag instead of hiding each other', () => {
  // Working checked in at 18.5913, 73.739; the other two stand a few metres away, the third 1 km off.
  const near = { ...finished, dayId: 'd3', name: 'Amol', checkInLat: 18.59133, checkInLng: 73.73903 };
  const far = { ...finished, dayId: 'd4', name: 'Far Away', checkInLat: 18.6013, checkInLng: 73.739 };
  const stacks = stackDays([working, near, far]);
  expect(stacks.map((s) => s.days.map((d) => d.dayId))).toEqual([['d1', 'd3'], ['d4']]);
  expect(stacks[0]!.lat).toBeCloseTo(18.5913, 3);
});

test('a shared tag names up to two people, then counts the rest', () => {
  expect(stackLabel([working], TZ)).toBe('Ravi Kumar · in 09:05');
  expect(stackLabel([working, finished], TZ)).toBe('Ravi Kumar, Sunita Rao');
  expect(stackLabel([working, finished, { ...finished, dayId: 'd3', name: 'Amol' }], TZ)).toBe('Ravi Kumar, Sunita Rao +1');
});

test('a shared tag shows the most urgent colour among its people', () => {
  expect(stackTone([finished, working])).toBe('green');
  expect(stackTone([working, { ...finished, needsReview: true, status: 'CHECKED_IN' }])).toBe('orange');
  expect(stackTone([finished])).toBe('grey');
});
