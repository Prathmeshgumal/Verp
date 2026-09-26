import '@testing-library/jest-dom/vitest';
import { notifications } from '@mantine/notifications';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // The notifications store is global; without this, one test's toasts show up in the next.
  notifications.clean();
});

// jsdom lacks these browser APIs, which Mantine uses. Files marked `@vitest-environment node` have no window.
if (typeof window !== 'undefined') {
  // matchMedia must report a match: mantine-datatable hides every column whose media query does not match.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
