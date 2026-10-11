import { createProjectDocument, type ProjectDocument } from '@tg-creator/project-schema';

export function starterDocument(type: 'game3d' | 'game2d' = 'game3d'): ProjectDocument {
  return createProjectDocument({
    id: 'prj_test',
    ownerId: 'usr_test',
    title: 'Тест',
    type,
    templateId: 'starter',
    orientation: 'auto',
  });
}

/** Freezes the whole tree so any accidental mutation inside a command throws in tests. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** Small deterministic PRNG (mulberry32) for reproducible randomized tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
