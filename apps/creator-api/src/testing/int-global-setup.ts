import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests run against a dedicated `creator_test` schema derived from
 * CREATOR_DATABASE_URL so they can truncate freely without touching dev data.
 */
export function testDatabaseUrl(): string {
  const base = process.env.CREATOR_DATABASE_URL;
  if (!base) {
    throw new Error('CREATOR_DATABASE_URL is required for integration tests');
  }
  const url = new URL(base);
  url.searchParams.set('schema', 'creator_test');
  return url.toString();
}

export default function setup(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  execFileSync(
    process.execPath,
    [join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: root,
      env: { ...process.env, CREATOR_DATABASE_URL: testDatabaseUrl() },
      stdio: 'inherit',
    },
  );
}
