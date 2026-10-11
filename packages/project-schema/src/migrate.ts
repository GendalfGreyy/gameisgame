import type { ZodIssue } from 'zod';

import { projectDocumentV1Schema, type ProjectDocumentV1 } from './v1.js';
import {
  COMPONENT_DEFAULTS,
  PROJECT_SCHEMA_VERSION,
  projectDocumentSchema,
  type ComponentType,
  type ProjectDocument,
} from './v2.js';

export type MigrationFailure = {
  ok: false;
  /** `unsupported_version`: newer than this build (Studio/Player must be updated) or unknown. */
  reason: 'unsupported_version' | 'invalid';
  fromVersion: number | null;
  issues: ZodIssue[];
};

export type MigrateResult =
  | { ok: true; document: ProjectDocument; fromVersion: number }
  | MigrationFailure;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Known fields from `data` over `defaults`; unknown v1 keys are dropped by design. */
function withDefaults(defaults: object, data: Json): Json {
  const result: Json = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  return result;
}

const ORTHOGRAPHIC_DEFAULTS = {
  projection: 'orthographic',
  orthoHeight: 10,
  nearClip: 0.1,
  farClip: 1000,
} as const;

const APP_PROP_DEFAULTS: Record<string, object> = {
  container: { direction: 'column', gap: 12, padding: 16 },
  text: { text: '', variant: 'body' },
  button: { label: 'Кнопка', variant: 'primary', action: { kind: 'none' } },
  image: { assetId: null, alt: '', fit: 'cover' },
  input: { label: '', placeholder: '', fieldKey: 'field' },
};

function componentDataV2(type: ComponentType, data: Json): Json {
  if (type === 'camera' && data.projection === 'orthographic') {
    return withDefaults(ORTHOGRAPHIC_DEFAULTS, data);
  }
  return withDefaults(COMPONENT_DEFAULTS[type], data);
}

/**
 * v1 → v2: typed component data (missing fields get COMPONENT_DEFAULTS), `entrySceneId`
 * becomes required-nullable, pages get a `name`, typed widget props, graphs get `name`
 * and node `position`. Scene graph, IDs, names and values present in v1 are preserved.
 */
export function migrateV1ToV2(source: ProjectDocumentV1): unknown {
  const isGame = source.type !== 'app';
  return {
    schemaVersion: 2,
    id: source.id,
    ownerId: source.ownerId,
    title: source.title,
    type: source.type,
    settings: source.settings,
    entrySceneId: source.entrySceneId ?? (isGame ? (source.scenes[0]?.id ?? null) : null),
    scenes: source.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      rootEntityIds: scene.rootEntityIds,
      entities: Object.fromEntries(
        Object.entries(scene.entities).map(([key, entity]) => [
          key,
          {
            id: entity.id,
            name: entity.name,
            parentId: entity.parentId,
            childIds: entity.childIds,
            enabled: entity.enabled,
            components: entity.components.map((component) => ({
              id: component.id,
              type: component.type,
              enabled: component.enabled,
              data: componentDataV2(component.type, component.data),
            })),
          },
        ]),
      ),
    })),
    pages: source.pages.map((page) => ({
      id: page.id,
      name: page.route === '/' ? 'Главная' : page.route,
      route: page.route,
      rootComponentId: page.rootComponentId,
      components: Object.fromEntries(
        Object.entries(page.components).map(([key, component]) => {
          const defaults = APP_PROP_DEFAULTS[component.type];
          return [
            key,
            {
              id: component.id,
              type: component.type,
              props: defaults ? withDefaults(defaults, component.props) : component.props,
              childIds: component.childIds,
            },
          ];
        }),
      ),
    })),
    graphs: source.graphs.map((graph, index) => ({
      id: graph.id,
      name: `Граф ${index + 1}`,
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: 0, y: 0 },
        data: node.data,
      })),
      edges: graph.edges,
    })),
    assetRefs: source.assetRefs,
    globalVariables: source.globalVariables,
  };
}

/** Normalizes stored or received JSON of any supported version into the latest schema. */
export function migrateToLatest(input: unknown): MigrateResult {
  if (!isRecord(input)) {
    return { ok: false, reason: 'invalid', fromVersion: null, issues: [] };
  }
  const version = input.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, reason: 'unsupported_version', fromVersion: null, issues: [] };
  }

  let current: unknown = input;
  if (version === 1) {
    const v1 = projectDocumentV1Schema.safeParse(input);
    if (!v1.success) {
      return { ok: false, reason: 'invalid', fromVersion: 1, issues: v1.error.issues };
    }
    current = migrateV1ToV2(v1.data);
  } else if (version !== PROJECT_SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupported_version', fromVersion: version, issues: [] };
  }

  const latest = projectDocumentSchema.safeParse(current);
  if (!latest.success) {
    return { ok: false, reason: 'invalid', fromVersion: version, issues: latest.error.issues };
  }
  return { ok: true, document: latest.data, fromVersion: version };
}
