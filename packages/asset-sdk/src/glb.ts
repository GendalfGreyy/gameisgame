/**
 * Minimal glTF 2.0 binary (GLB) writer for procedurally built low-poly models.
 * Output is a regular GLB that any glTF loader (PlayCanvas, three.js, Blender) reads.
 */

export type Vec3 = readonly [number, number, number];

export type PartShape = 'box' | 'cylinder' | 'cone' | 'sphere';

export type ModelPart = {
  shape: PartShape;
  /** Linear-ish sRGB colour `#RRGGBB`. */
  color: string;
  translate: Vec3;
  scale: Vec3;
  segments?: number;
  rings?: number;
  /** Rotation of the cone/cylinder footprint around Y, radians (e.g. a square roof). */
  angleOffset?: number;
  /** Stands a cylinder/cone on its side (Y axis → Z axis). */
  sideways?: boolean;
  roughness?: number;
  metalness?: number;
};

type Geometry = { positions: number[]; normals: number[]; indices: number[] };

const TAU = Math.PI * 2;

function box(): Geometry {
  const faces: [Vec3, Vec3, Vec3][] = [
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, -1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
  ];
  const geometry: Geometry = { positions: [], normals: [], indices: [] };
  for (const [n, u, v] of faces) {
    const base = geometry.positions.length / 3;
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      geometry.positions.push(
        (n[0] + su * u[0] + sv * v[0]) / 2,
        (n[1] + su * u[1] + sv * v[1]) / 2,
        (n[2] + su * u[2] + sv * v[2]) / 2,
      );
      geometry.normals.push(n[0], n[1], n[2]);
    }
    geometry.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geometry;
}

function cap(geometry: Geometry, y: number, segments: number, offset: number): void {
  const center = geometry.positions.length / 3;
  const ny = Math.sign(y);
  geometry.positions.push(0, y, 0);
  geometry.normals.push(0, ny, 0);
  for (let i = 0; i <= segments; i += 1) {
    const angle = offset + (TAU * i) / segments;
    geometry.positions.push(0.5 * Math.cos(angle), y, 0.5 * Math.sin(angle));
    geometry.normals.push(0, ny, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    geometry.indices.push(center, center + 1 + i, center + 2 + i);
  }
}

function cylinder(segments: number, offset: number): Geometry {
  const geometry: Geometry = { positions: [], normals: [], indices: [] };
  for (let i = 0; i <= segments; i += 1) {
    const angle = offset + (TAU * i) / segments;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    geometry.positions.push(0.5 * cos, -0.5, 0.5 * sin, 0.5 * cos, 0.5, 0.5 * sin);
    geometry.normals.push(cos, 0, sin, cos, 0, sin);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    geometry.indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  cap(geometry, 0.5, segments, offset);
  cap(geometry, -0.5, segments, offset);
  return geometry;
}

function cone(segments: number, offset: number): Geometry {
  const geometry: Geometry = { positions: [], normals: [], indices: [] };
  for (let i = 0; i < segments; i += 1) {
    const a0 = offset + (TAU * i) / segments;
    const a1 = offset + (TAU * (i + 1)) / segments;
    const mid = (a0 + a1) / 2;
    const base = geometry.positions.length / 3;
    const slant = (angle: number) => {
      const length = Math.hypot(1, 0.5);
      return [Math.cos(angle) / length, 0.5 / length, Math.sin(angle) / length] as const;
    };
    const n0 = slant(a0);
    const n1 = slant(a1);
    const nm = slant(mid);
    geometry.positions.push(
      0.5 * Math.cos(a0),
      -0.5,
      0.5 * Math.sin(a0),
      0.5 * Math.cos(a1),
      -0.5,
      0.5 * Math.sin(a1),
      0,
      0.5,
      0,
    );
    // Low-poly roofs (few segments) read better flat-shaded.
    const flat = segments <= 6;
    geometry.normals.push(...(flat ? nm : n0), ...(flat ? nm : n1), ...nm);
    geometry.indices.push(base, base + 1, base + 2);
  }
  cap(geometry, -0.5, segments, offset);
  return geometry;
}

function sphere(segments: number, rings: number): Geometry {
  const geometry: Geometry = { positions: [], normals: [], indices: [] };
  for (let r = 0; r <= rings; r += 1) {
    const phi = (Math.PI * r) / rings;
    for (let s = 0; s <= segments; s += 1) {
      const theta = (TAU * s) / segments;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      geometry.positions.push(x / 2, y / 2, z / 2);
      geometry.normals.push(x, y, z);
    }
  }
  const row = segments + 1;
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const a = r * row + s;
      const b = a + row;
      if (r !== 0) geometry.indices.push(a, a + 1, b);
      if (r !== rings - 1) geometry.indices.push(a + 1, b + 1, b);
    }
  }
  return geometry;
}

function buildPart(part: ModelPart): Geometry {
  const offset = part.angleOffset ?? 0;
  const raw =
    part.shape === 'box'
      ? box()
      : part.shape === 'cylinder'
        ? cylinder(part.segments ?? 16, offset)
        : part.shape === 'cone'
          ? cone(part.segments ?? 16, offset)
          : sphere(part.segments ?? 12, part.rings ?? 8);
  const [sx, sy, sz] = part.scale;
  const [tx, ty, tz] = part.translate;
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < raw.positions.length; i += 3) {
    let px = raw.positions[i] ?? 0;
    let py = raw.positions[i + 1] ?? 0;
    let pz = raw.positions[i + 2] ?? 0;
    let nx = raw.normals[i] ?? 0;
    let ny = raw.normals[i + 1] ?? 0;
    let nz = raw.normals[i + 2] ?? 0;
    if (part.sideways) {
      [py, pz] = [-pz, py];
      [ny, nz] = [-nz, ny];
    }
    positions.push(px * sx + tx, py * sy + ty, pz * sz + tz);
    // Normals transform by the inverse scale, then renormalise.
    nx /= sx;
    ny /= sy;
    nz /= sz;
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.push(nx / length, ny / length, nz / length);
  }
  return { positions, normals, indices: orientTriangles(positions, normals, raw.indices) };
}

/** Makes every triangle counter-clockwise when seen from the side its normals point to. */
export function orientTriangles(
  positions: number[],
  normals: number[],
  indices: number[],
): number[] {
  const out = indices.slice();
  const at = (array: number[], index: number, axis: number) => array[index * 3 + axis] ?? 0;
  for (let t = 0; t + 2 < out.length; t += 3) {
    const a = out[t] ?? 0;
    const b = out[t + 1] ?? 0;
    const c = out[t + 2] ?? 0;
    const e1 = [0, 1, 2].map((k) => at(positions, b, k) - at(positions, a, k));
    const e2 = [0, 1, 2].map((k) => at(positions, c, k) - at(positions, a, k));
    const face = [
      (e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0),
      (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0),
      (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0),
    ];
    let dot = 0;
    for (const vertex of [a, b, c]) {
      for (let k = 0; k < 3; k += 1) dot += (face[k] ?? 0) * at(normals, vertex, k);
    }
    if (dot < 0) {
      out[t + 1] = c;
      out[t + 2] = b;
    }
  }
  return out;
}

function hexToLinear(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(16), channel(8), channel(0)];
}

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error('GLB JSON must stay ASCII');
    }
    bytes[i] = code;
  }
  return bytes;
}

const align4 = (value: number) => (value + 3) & ~3;

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Builds a GLB with one node and one primitive (and material) per part. */
export function buildGlb(name: string, parts: readonly ModelPart[]): Uint8Array {
  const geometries = parts.map(buildPart);
  const views: { offset: number; length: number; target: number }[] = [];
  const accessors: Record<string, unknown>[] = [];
  const chunks: { offset: number; bytes: Uint8Array }[] = [];
  let binLength = 0;

  const pushView = (bytes: Uint8Array, target: number) => {
    const offset = binLength;
    chunks.push({ offset, bytes });
    views.push({ offset, length: bytes.byteLength, target });
    binLength = align4(offset + bytes.byteLength);
    return views.length - 1;
  };

  const primitives = geometries.map((geometry, index) => {
    const positions = new Float32Array(geometry.positions);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        const v = positions[i + k] ?? 0;
        min[k] = Math.min(min[k] ?? v, v);
        max[k] = Math.max(max[k] ?? v, v);
      }
    }
    const count = positions.length / 3;
    const positionView = pushView(new Uint8Array(positions.buffer), 34962);
    accessors.push({
      bufferView: positionView,
      componentType: 5126,
      count,
      type: 'VEC3',
      min,
      max,
    });
    const normalView = pushView(new Uint8Array(new Float32Array(geometry.normals).buffer), 34962);
    accessors.push({ bufferView: normalView, componentType: 5126, count, type: 'VEC3' });
    const indexView = pushView(new Uint8Array(new Uint16Array(geometry.indices).buffer), 34963);
    accessors.push({
      bufferView: indexView,
      componentType: 5123,
      count: geometry.indices.length,
      type: 'SCALAR',
    });
    return {
      attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 },
      indices: accessors.length - 1,
      material: index,
    };
  });

  const json = {
    asset: { version: '2.0', generator: 'tg-creator builtin models' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives }],
    materials: parts.map((part) => ({
      pbrMetallicRoughness: {
        baseColorFactor: [...hexToLinear(part.color), 1],
        metallicFactor: part.metalness ?? 0,
        roughnessFactor: part.roughness ?? 0.8,
      },
    })),
    buffers: [{ byteLength: binLength }],
    bufferViews: views.map((view) => ({
      buffer: 0,
      byteOffset: view.offset,
      byteLength: view.length,
      target: view.target,
    })),
    accessors,
  };

  const jsonBytes = asciiBytes(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.byteLength);
  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(jsonBytes, 20);
  const binStart = 20 + jsonLength;
  view.setUint32(binStart, binLength, true);
  view.setUint32(binStart + 4, CHUNK_BIN, true);
  for (const chunk of chunks) {
    out.set(chunk.bytes, binStart + 8 + chunk.offset);
  }
  return out;
}

export type ParsedGlb = { json: unknown; bin: Uint8Array };

/** Splits a GLB into its JSON and BIN chunks (used by tests and for validation). */
export function parseGlb(bytes: Uint8Array): ParsedGlb {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
    throw new Error('Not a glTF 2.0 binary');
  }
  if (view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('GLB length mismatch');
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON) {
    throw new Error('First chunk must be JSON');
  }
  let text = '';
  for (const code of bytes.subarray(20, 20 + jsonLength)) {
    text += String.fromCharCode(code);
  }
  const binStart = 20 + jsonLength;
  const binLength = view.getUint32(binStart, true);
  if (view.getUint32(binStart + 4, true) !== CHUNK_BIN) {
    throw new Error('Second chunk must be BIN');
  }
  return {
    json: JSON.parse(text) as unknown,
    bin: bytes.subarray(binStart + 8, binStart + 8 + binLength),
  };
}
