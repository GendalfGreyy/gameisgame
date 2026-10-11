import { assetRefSchema } from '@tg-creator/project-schema';
import { describe, expect, it } from 'vitest';

import { BUILTIN_MODELS, builtinModelGlb, builtinModelRef, isBuiltinAsset } from './builtin.js';
import { parseGlb } from './glb.js';

type Accessor = {
  bufferView: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
};
type Gltf = {
  asset: { version: string };
  bufferViews: { byteOffset: number; byteLength: number }[];
  accessors: Accessor[];
  meshes: {
    primitives: {
      attributes: { POSITION: number; NORMAL: number };
      indices: number;
      material: number;
    }[];
  }[];
  materials: unknown[];
  buffers: { byteLength: number }[];
};

function floats(bin: Uint8Array, gltf: Gltf, accessor: Accessor): Float32Array {
  const view = gltf.bufferViews[accessor.bufferView];
  if (!view) throw new Error('missing view');
  return new Float32Array(bin.slice(view.byteOffset, view.byteOffset + view.byteLength).buffer);
}

function shorts(bin: Uint8Array, gltf: Gltf, accessor: Accessor): Uint16Array {
  const view = gltf.bufferViews[accessor.bufferView];
  if (!view) throw new Error('missing view');
  return new Uint16Array(bin.slice(view.byteOffset, view.byteOffset + view.byteLength).buffer);
}

describe('built-in models are valid glTF 2.0 binaries', () => {
  for (const model of BUILTIN_MODELS) {
    it(`${model.id}: chunks, accessors, bounds, winding`, () => {
      const bytes = builtinModelGlb(model.id);
      if (!bytes) throw new Error('no bytes');
      expect(bytes.byteLength % 4).toBe(0);
      const { json, bin } = parseGlb(bytes);
      const gltf = json as Gltf;
      expect(gltf.asset.version).toBe('2.0');
      expect(gltf.buffers[0]?.byteLength).toBe(bin.byteLength);
      const primitives = gltf.meshes[0]?.primitives ?? [];
      expect(primitives).toHaveLength(model.parts.length);
      expect(gltf.materials).toHaveLength(model.parts.length);

      for (const primitive of primitives) {
        const position = gltf.accessors[primitive.attributes.POSITION];
        const normal = gltf.accessors[primitive.attributes.NORMAL];
        const index = gltf.accessors[primitive.indices];
        if (!position || !normal || !index) throw new Error('missing accessor');
        const p = floats(bin, gltf, position);
        const n = floats(bin, gltf, normal);
        const idx = shorts(bin, gltf, index);
        expect(p.length).toBe(position.count * 3);
        expect(n.length).toBe(position.count * 3);
        expect(idx.length).toBeGreaterThanOrEqual(index.count);
        expect(index.count % 3).toBe(0);

        for (let i = 0; i < position.count; i += 1) {
          for (let k = 0; k < 3; k += 1) {
            const v = p[i * 3 + k] ?? NaN;
            expect(v).toBeGreaterThanOrEqual((position.min?.[k] ?? 0) - 1e-6);
            expect(v).toBeLessThanOrEqual((position.max?.[k] ?? 0) + 1e-6);
          }
          expect(Math.hypot(n[i * 3] ?? 0, n[i * 3 + 1] ?? 0, n[i * 3 + 2] ?? 0)).toBeCloseTo(1, 4);
        }
        // Every non-degenerate triangle faces the side its vertex normals point to.
        for (let t = 0; t < index.count; t += 3) {
          const [a, b, c] = [idx[t] ?? 0, idx[t + 1] ?? 0, idx[t + 2] ?? 0];
          expect(Math.max(a, b, c)).toBeLessThan(position.count);
          const e1 = [0, 1, 2].map((k) => (p[b * 3 + k] ?? 0) - (p[a * 3 + k] ?? 0));
          const e2 = [0, 1, 2].map((k) => (p[c * 3 + k] ?? 0) - (p[a * 3 + k] ?? 0));
          const face = [
            (e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0),
            (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0),
            (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0),
          ];
          let dot = 0;
          for (const vertex of [a, b, c]) {
            for (let k = 0; k < 3; k += 1) dot += (face[k] ?? 0) * (n[vertex * 3 + k] ?? 0);
          }
          expect(dot).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    });
  }

  it('refs satisfy the project schema and ids are recognised as built-in', () => {
    for (const model of BUILTIN_MODELS) {
      expect(assetRefSchema.parse(builtinModelRef(model))).toEqual({
        id: model.id,
        version: model.version,
        kind: 'model',
      });
      expect(isBuiltinAsset(model.id)).toBe(true);
    }
    expect(isBuiltinAsset('asset_123')).toBe(false);
    expect(builtinModelGlb('builtin_missing')).toBeNull();
  });

  it('generation is deterministic and cached', () => {
    expect(builtinModelGlb('builtin_tree')).toBe(builtinModelGlb('builtin_tree'));
  });
});
