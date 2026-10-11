/**
 * localStorage access that survives private mode / disabled storage in
 * embedded webviews (reads return null, writes are dropped).
 */
function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStored(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    const target = store();
    if (value === null) {
      target?.removeItem(key);
    } else {
      target?.setItem(key, value);
    }
  } catch {
    // Storage full or blocked: the app keeps working with in-memory state.
  }
}

export const STORAGE_KEYS = {
  session: 'tgc.session',
  theme: 'tgc.theme',
  density: 'tgc.density',
  lastProject: 'tgc.lastProject',
} as const;
