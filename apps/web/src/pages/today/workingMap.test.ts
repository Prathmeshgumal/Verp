import type { DashboardMapDay } from '@ve/shared';
import { expect, test } from 'vitest';
import { dashboardToday, site } from '../../testing/fakes';
import { bubbleHtml, escapeHtml, siteBubbles, tagHtml, tagLabel, tagTone, visibleDays } from './workingMap';

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
