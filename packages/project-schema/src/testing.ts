import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(here, '../fixtures');
export const EXAMPLES_DIR = join(here, '../../../tg-creator-studio/examples');

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function fixtureNames(version: 'v1' | 'v2-from-v1'): string[] {
  return readdirSync(join(FIXTURES_DIR, version)).filter((name) => name.endsWith('.json'));
}

export function readFixture(version: 'v1' | 'v2-from-v1', name: string): unknown {
  return readJson(join(FIXTURES_DIR, version, name));
}

export function readExample(name: string): unknown {
  return readJson(join(EXAMPLES_DIR, name));
}

/** Deep, typed-enough clone for mutating fixtures in tests. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
