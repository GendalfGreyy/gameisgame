import type {
  StudioBehavior,
  StudioEntity,
  StudioEntityKind,
  StudioScene,
} from '@game-is-game/shared';
import { STUDIO_MAX_ENTITIES } from '@game-is-game/shared';

let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export type PaletteItem = {
  id: string;
  label: string;
  kind: StudioEntityKind;
  color: string;
  w: number;
  h: number;
  behaviors: StudioBehavior[];
};

export const STUDIO_PALETTE: PaletteItem[] = [
  {
    id: 'player',
    label: 'Герой',
    kind: 'rect',
    color: '#3DDC97',
    w: 36,
    h: 44,
    behaviors: ['player'],
  },
  {
    id: 'platform',
    label: 'Платформа',
    kind: 'rect',
    color: '#2A6B52',
    w: 140,
    h: 22,
    behaviors: ['solid'],
  },
  {
    id: 'block',
    label: 'Блок',
    kind: 'rect',
    color: '#2F4A5E',
    w: 48,
    h: 48,
    behaviors: ['solid'],
  },
  {
    id: 'coin',
    label: 'Монета',
    kind: 'circle',
    color: '#F4D35E',
    w: 22,
    h: 22,
    behaviors: ['collectible'],
  },
  {
    id: 'hazard',
    label: 'Опасность',
    kind: 'rect',
    color: '#E4572E',
    w: 48,
    h: 22,
    behaviors: ['hazard'],
  },
  {
    id: 'goal',
    label: 'Финиш',
    kind: 'rect',
    color: '#4CC9F0',
    w: 40,
    h: 72,
    behaviors: ['goal'],
  },
  {
    id: 'spawn',
    label: 'Спавн',
    kind: 'circle',
    color: '#7CFFCB',
    w: 24,
    h: 24,
    behaviors: ['spawn'],
  },
];

export function addPaletteEntity(
  scene: StudioScene,
  item: PaletteItem,
  at?: { x: number; y: number },
): StudioScene {
  if (scene.entities.length >= STUDIO_MAX_ENTITIES) {
    return scene;
  }

  // Only one player / spawn at a time — replace existing.
  let entities = scene.entities;
  if (item.behaviors.includes('player')) {
    entities = entities.filter((e) => !e.behaviors.includes('player'));
  }
  if (item.behaviors.includes('spawn')) {
    entities = entities.filter((e) => !e.behaviors.includes('spawn'));
  }

  const x = at?.x ?? Math.round(scene.world.width / 2 - item.w / 2);
  const y = at?.y ?? Math.round(scene.world.height / 2 - item.h / 2);

  const entity: StudioEntity = {
    id: nextId(item.id),
    name: item.label,
    kind: item.kind,
    x: Math.max(0, Math.min(scene.world.width - item.w, x)),
    y: Math.max(0, Math.min(scene.world.height - item.h, y)),
    w: item.w,
    h: item.h,
    rotation: 0,
    color: item.color,
    behaviors: [...item.behaviors],
  };

  return { ...scene, entities: [...entities, entity] };
}

export function updateEntity(
  scene: StudioScene,
  entityId: string,
  patch: Partial<StudioEntity>,
): StudioScene {
  return {
    ...scene,
    entities: scene.entities.map((e) => (e.id === entityId ? { ...e, ...patch } : e)),
  };
}

export function removeEntity(scene: StudioScene, entityId: string): StudioScene {
  return {
    ...scene,
    entities: scene.entities.filter((e) => e.id !== entityId),
  };
}

export function behaviorLabel(behavior: StudioBehavior): string {
  switch (behavior) {
    case 'player':
      return 'Игрок';
    case 'solid':
      return 'Твёрдый';
    case 'collectible':
      return 'Собиралка';
    case 'hazard':
      return 'Урон';
    case 'goal':
      return 'Победа';
    case 'spawn':
      return 'Спавн';
  }
}
