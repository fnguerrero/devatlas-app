import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Según la versión de jsdom, `localStorage` puede no estar expuesto. La app lo usa para
// la vista, los filtros y el tema, así que se garantiza un almacenamiento en memoria.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, writable: true });
}

// jsdom no implementa estas dos y varios componentes las usan.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

window.scrollTo ??= (() => {}) as typeof window.scrollTo;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
