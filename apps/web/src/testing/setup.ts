import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Toasts live in a global store; without this, one test's toasts show up in the next.
  toast.dismiss();
});

// jsdom lacks these browser APIs, which Radix and Leaflet use. Files marked `@vitest-environment node` have no window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
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
  window.Element.prototype.scrollTo = () => {};
  // Radix sliders and menus capture the pointer.
  window.Element.prototype.hasPointerCapture = () => false;
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
}
