import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { migrateToLatest } from './migrate.js';
import { deserializeProjectDocument, serializeProjectDocument } from './serialize.js';
import { projectDocumentV1Schema } from './v1.js';

const examplePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../tg-creator-studio/examples/project-3d.v1.json',
);

describe('@tg-creator/project-schema', () => {
  it('parses the canonical 3D example', () => {
    const raw = JSON.parse(readFileSync(examplePath, 'utf8')) as unknown;
    const parsed = projectDocumentV1Schema.parse(raw);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.type).toBe('game3d');
    expect(parsed.scenes[0]?.entities['entity_cube']?.components.length).toBeGreaterThan(0);
  });

  it('roundtrips serialize → deserialize without data loss', () => {
    const raw = JSON.parse(readFileSync(examplePath, 'utf8')) as unknown;
    const document = projectDocumentV1Schema.parse(raw);
    const again = deserializeProjectDocument(serializeProjectDocument(document));
    expect(again).toEqual(document);
  });

  it('rejects unsupported schemaVersion via migrateToLatest', () => {
    const result = migrateToLatest({ schemaVersion: 99, id: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unsupported_version');
    }
  });
});
