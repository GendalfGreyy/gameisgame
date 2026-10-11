import { parseProjectDocument, type ParseFailure } from './parse.js';
import { projectDocumentSchema, type ProjectDocument } from './v2.js';

export class ProjectDocumentError extends Error {
  readonly failure: ParseFailure;

  constructor(failure: ParseFailure) {
    super(`ProjectDocument ${failure.code}: ${failure.issues[0]?.message ?? 'invalid document'}`);
    this.name = 'ProjectDocumentError';
    this.failure = failure;
  }
}

/**
 * Canonical JSON: key order follows the schema, so equal documents serialize to equal strings
 * (used for ETags and idempotency hashes). Throws on schema or integrity errors.
 */
export function serializeProjectDocument(document: ProjectDocument): string {
  const parsed = parseProjectDocument(projectDocumentSchema.parse(document));
  if (!parsed.ok) {
    throw new ProjectDocumentError(parsed);
  }
  return JSON.stringify(parsed.document);
}

export function deserializeProjectDocument(raw: string): ProjectDocument {
  const json: unknown = JSON.parse(raw);
  const parsed = parseProjectDocument(json);
  if (!parsed.ok) {
    throw new ProjectDocumentError(parsed);
  }
  return parsed.document;
}
