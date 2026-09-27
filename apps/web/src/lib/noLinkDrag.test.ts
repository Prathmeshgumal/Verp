import { afterEach, expect, test } from 'vitest';
import { blockLinkDrags } from './noLinkDrag';

let stop = () => {};
afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

function drag(el: Element): boolean {
  const event = new Event('dragstart', { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}

test('dragging a link, or anything inside one, is cancelled', () => {
  stop = blockLinkDrags();
  document.body.innerHTML = '<a href="/sites"><svg></svg><span>Sites</span></a><img alt="" /><p draggable="true">note</p>';
  expect(drag(document.querySelector('a')!)).toBe(true);
  expect(drag(document.querySelector('span')!)).toBe(true);
  expect(drag(document.querySelector('img')!)).toBe(true);
  expect(drag(document.querySelector('p')!)).toBe(false);
});
