import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @tg-creator/worker — Planned until asset/publish gates (G5+).
 * G0 keeps a long-lived process so `pnpm dev` has a stable filter target.
 */
export const PACKAGE_STATUS = 'Planned' as const;
export const PACKAGE_NAME = '@tg-creator/worker' as const;

const entry = process.argv[1];
const isMain = typeof entry === 'string' && resolve(entry) === fileURLToPath(import.meta.url);

if (isMain) {
  console.warn(`[${PACKAGE_NAME}] status=${PACKAGE_STATUS} — no queues yet`);
  setInterval(() => {
    /* keep process alive for turbo persistent dev */
  }, 60_000);
}
