import { migrateToLatest } from './migrate.js';
import { projectDocumentV1Schema, type ProjectDocument } from './v1.js';

export function serializeProjectDocument(document: ProjectDocument): string {
  const parsed = projectDocumentV1Schema.parse(document);
  return JSON.stringify(parsed);
}

export function deserializeProjectDocument(raw: string): ProjectDocument {
  const json: unknown = JSON.parse(raw);
  const migrated = migrateToLatest(json);
  if (!migrated.ok) {
    throw new Error(`ProjectDocument migrate failed: ${migrated.reason}`);
  }
  return migrated.document;
}
