import type { ZodIssue } from 'zod';

import {
  MAX_REPORTED_ISSUES,
  documentErrorCode,
  validateProjectDocument,
  type DocumentErrorCode,
  type DocumentIssue,
} from './integrity.js';
import { migrateToLatest } from './migrate.js';
import { PROJECT_SCHEMA_VERSION, type ProjectDocument } from './v2.js';

export type ParseFailure = {
  ok: false;
  code: DocumentErrorCode | 'MIGRATION_FAILED';
  issues: DocumentIssue[];
};

export type ParseResult =
  | { ok: true; document: ProjectDocument; migratedFrom: number | null }
  | ParseFailure;

function fromZod(issues: readonly ZodIssue[]): DocumentIssue[] {
  return issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
    code: 'SCHEMA_INVALID',
    path: issue.path,
    message: issue.message,
  }));
}

/**
 * The one entry point Studio, API and Player use: migrate → Zod → referential integrity.
 * Older documents are upgraded; newer ones fail with MIGRATION_FAILED instead of being guessed at.
 */
export function parseProjectDocument(input: unknown): ParseResult {
  const migrated = migrateToLatest(input);
  if (!migrated.ok) {
    const isOldVersion =
      migrated.fromVersion !== null && migrated.fromVersion < PROJECT_SCHEMA_VERSION;
    if (migrated.reason === 'unsupported_version' || isOldVersion) {
      const head: DocumentIssue = {
        code: 'SCHEMA_INVALID',
        path: ['schemaVersion'],
        message:
          migrated.reason === 'unsupported_version'
            ? `Версия схемы ${String(migrated.fromVersion ?? '—')} не поддерживается (актуальная ${PROJECT_SCHEMA_VERSION})`
            : `Документ версии ${String(migrated.fromVersion)} не удалось обновить`,
      };
      return {
        ok: false,
        code: 'MIGRATION_FAILED',
        issues: [head, ...fromZod(migrated.issues)].slice(0, MAX_REPORTED_ISSUES),
      };
    }
    return { ok: false, code: 'SCHEMA_INVALID', issues: fromZod(migrated.issues) };
  }

  const issues = validateProjectDocument(migrated.document);
  if (issues.length > 0) {
    return { ok: false, code: documentErrorCode(issues), issues };
  }
  return {
    ok: true,
    document: migrated.document,
    migratedFrom: migrated.fromVersion === PROJECT_SCHEMA_VERSION ? null : migrated.fromVersion,
  };
}
