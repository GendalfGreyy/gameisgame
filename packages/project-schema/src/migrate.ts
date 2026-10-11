import { projectDocumentV1Schema, type ProjectDocument } from './v1.js';

export type MigrateResult =
  | { ok: true; document: ProjectDocument }
  | { ok: false; reason: 'unsupported_version' | 'invalid' };

/**
 * Normalize unknown JSON into the current ProjectDocument.
 * G0 only supports schemaVersion 1; future versions add pure migrators here.
 */
export function migrateToLatest(input: unknown): MigrateResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, reason: 'invalid' };
  }
  const version = 'schemaVersion' in input ? Reflect.get(input, 'schemaVersion') : undefined;
  if (version !== 1) {
    return { ok: false, reason: 'unsupported_version' };
  }
  const parsed = projectDocumentV1Schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, document: parsed.data };
}
