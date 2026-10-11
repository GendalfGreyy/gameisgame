import type { AssetRef } from '@tg-creator/project-schema';

import { buildGlb, type ModelPart } from './glb.js';

/**
 * Built-in model library: real GLB files generated in code, so the editor and player can
 * use models before asset upload exists (G5). They are referenced from documents like any
 * other model — an `AssetRef` whose id starts with `builtin_`.
 */
export const BUILTIN_PREFIX = 'builtin_';

export type BuiltinModel = {
  id: string;
  version: string;
  label: string;
  parts: readonly ModelPart[];
};

const ROOF = Math.SQRT1_2;

export const BUILTIN_MODELS: readonly BuiltinModel[] = [
  {
    id: 'builtin_tree',
    version: '1',
    label: 'Дерево',
    parts: [
      {
        shape: 'cylinder',
        color: '#6B4A2F',
        translate: [0, 0.4, 0],
        scale: [0.25, 0.8, 0.25],
        segments: 10,
      },
      {
        shape: 'cone',
        color: '#4F7A3A',
        translate: [0, 1.25, 0],
        scale: [1.3, 1.1, 1.3],
        segments: 10,
      },
      {
        shape: 'cone',
        color: '#5E8C45',
        translate: [0, 1.85, 0],
        scale: [0.95, 0.9, 0.95],
        segments: 10,
      },
    ],
  },
  {
    id: 'builtin_rock',
    version: '1',
    label: 'Камень',
    parts: [
      {
        shape: 'sphere',
        color: '#8A877E',
        translate: [0, 0.3, 0],
        scale: [1.1, 0.7, 0.9],
        segments: 7,
        rings: 5,
        roughness: 0.95,
      },
      {
        shape: 'sphere',
        color: '#9C998F',
        translate: [0.5, 0.15, 0.3],
        scale: [0.5, 0.4, 0.5],
        segments: 6,
        rings: 4,
        roughness: 0.95,
      },
    ],
  },
  {
    id: 'builtin_crate',
    version: '1',
    label: 'Ящик',
    parts: [
      { shape: 'box', color: '#A57843', translate: [0, 0.5, 0], scale: [1, 1, 1] },
      { shape: 'box', color: '#7A5530', translate: [0, 0.06, 0], scale: [1.04, 0.12, 1.04] },
      { shape: 'box', color: '#7A5530', translate: [0, 0.94, 0], scale: [1.04, 0.12, 1.04] },
    ],
  },
  {
    id: 'builtin_house',
    version: '1',
    label: 'Домик',
    parts: [
      { shape: 'box', color: '#D9C9A8', translate: [0, 0.7, 0], scale: [2, 1.4, 1.6] },
      {
        shape: 'cone',
        color: '#B5523B',
        translate: [0, 1.85, 0],
        scale: [2.4 / ROOF, 0.9, 2 / ROOF],
        segments: 4,
        angleOffset: Math.PI / 4,
      },
      { shape: 'box', color: '#5A3A22', translate: [0, 0.4, 0.81], scale: [0.4, 0.8, 0.04] },
    ],
  },
  {
    id: 'builtin_coin',
    version: '1',
    label: 'Монета',
    parts: [
      {
        shape: 'cylinder',
        color: '#E3B23C',
        translate: [0, 0.5, 0],
        scale: [0.6, 0.08, 0.6],
        segments: 24,
        sideways: true,
        metalness: 0.85,
        roughness: 0.3,
      },
    ],
  },
];

export function isBuiltinAsset(assetId: string): boolean {
  return assetId.startsWith(BUILTIN_PREFIX);
}

export function findBuiltinModel(assetId: string): BuiltinModel | undefined {
  return BUILTIN_MODELS.find((model) => model.id === assetId);
}

export function builtinModelRef(model: BuiltinModel): AssetRef {
  return { id: model.id, version: model.version, kind: 'model' };
}

const glbCache = new Map<string, Uint8Array>();

/** GLB bytes of a built-in model (generated once per id), or `null` for unknown ids. */
export function builtinModelGlb(assetId: string): Uint8Array | null {
  const cached = glbCache.get(assetId);
  if (cached) {
    return cached;
  }
  const model = findBuiltinModel(assetId);
  if (!model) {
    return null;
  }
  const bytes = buildGlb(model.id, model.parts);
  glbCache.set(assetId, bytes);
  return bytes;
}
