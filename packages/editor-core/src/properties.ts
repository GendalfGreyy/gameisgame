import type { ComponentRecord, ComponentType } from '@tg-creator/project-schema';

/**
 * UI hints for the Inspector: which control edits which field. Ranges mirror the Zod
 * schema in project-schema, which stays the authority — every edit is re-validated there.
 */
export type PropertyControl =
  | { kind: 'vec3'; step: number; min?: number; max?: number }
  | { kind: 'vec2'; step: number; min?: number }
  | { kind: 'number'; step: number; min?: number; max?: number; integer?: boolean }
  | { kind: 'color' }
  | { kind: 'boolean' }
  | { kind: 'enum'; options: readonly { value: string; label: string }[] }
  | { kind: 'asset'; assetKind: 'model' | 'image' | 'audio' }
  | { kind: 'graph' };

export type PropertyDescriptor = { key: string; label: string; control: PropertyControl };

const unit = { kind: 'number', step: 0.05, min: 0, max: 1 } as const;

const PROPERTIES: { [T in ComponentType]: readonly PropertyDescriptor[] } = {
  transform: [
    { key: 'position', label: 'Позиция', control: { kind: 'vec3', step: 0.1 } },
    { key: 'rotationEuler', label: 'Поворот, °', control: { kind: 'vec3', step: 1 } },
    { key: 'scale', label: 'Масштаб', control: { kind: 'vec3', step: 0.1 } },
  ],
  mesh: [
    {
      key: 'primitive',
      label: 'Форма',
      control: {
        kind: 'enum',
        options: [
          { value: 'box', label: 'Куб' },
          { value: 'sphere', label: 'Сфера' },
          { value: 'plane', label: 'Плоскость' },
          { value: 'cylinder', label: 'Цилиндр' },
          { value: 'capsule', label: 'Капсула' },
          { value: 'cone', label: 'Конус' },
        ],
      },
    },
    { key: 'assetId', label: 'Модель', control: { kind: 'asset', assetKind: 'model' } },
  ],
  material: [
    { key: 'baseColor', label: 'Цвет', control: { kind: 'color' } },
    { key: 'roughness', label: 'Шероховатость', control: unit },
    { key: 'metalness', label: 'Металличность', control: unit },
    { key: 'emissive', label: 'Свечение', control: { kind: 'color' } },
    { key: 'opacity', label: 'Непрозрачность', control: unit },
  ],
  camera: [
    {
      key: 'projection',
      label: 'Проекция',
      control: {
        kind: 'enum',
        options: [
          { value: 'perspective', label: 'Перспектива' },
          { value: 'orthographic', label: 'Ортографическая' },
        ],
      },
    },
    { key: 'fov', label: 'Угол обзора, °', control: { kind: 'number', step: 1, min: 1, max: 179 } },
    {
      key: 'orthoHeight',
      label: 'Высота кадра',
      control: { kind: 'number', step: 0.5, min: 0.01 },
    },
    {
      key: 'nearClip',
      label: 'Ближняя плоскость',
      control: { kind: 'number', step: 0.1, min: 0.001 },
    },
    {
      key: 'farClip',
      label: 'Дальняя плоскость',
      control: { kind: 'number', step: 10, min: 0.01 },
    },
  ],
  light: [
    {
      key: 'kind',
      label: 'Тип',
      control: {
        kind: 'enum',
        options: [
          { value: 'directional', label: 'Направленный' },
          { value: 'point', label: 'Точечный' },
          { value: 'spot', label: 'Прожектор' },
        ],
      },
    },
    { key: 'color', label: 'Цвет', control: { kind: 'color' } },
    {
      key: 'intensity',
      label: 'Яркость',
      control: { kind: 'number', step: 0.1, min: 0, max: 100 },
    },
    { key: 'range', label: 'Дальность', control: { kind: 'number', step: 0.5, min: 0.01 } },
    { key: 'castShadows', label: 'Тени', control: { kind: 'boolean' } },
  ],
  rigidBody3d: [
    {
      key: 'bodyType',
      label: 'Тип тела',
      control: {
        kind: 'enum',
        options: [
          { value: 'dynamic', label: 'Динамическое' },
          { value: 'kinematic', label: 'Кинематическое' },
          { value: 'static', label: 'Статичное' },
        ],
      },
    },
    { key: 'mass', label: 'Масса, кг', control: { kind: 'number', step: 0.1, min: 0.001 } },
    {
      key: 'linearDamping',
      label: 'Затухание движения',
      control: { kind: 'number', step: 0.01, min: 0 },
    },
    {
      key: 'angularDamping',
      label: 'Затухание вращения',
      control: { kind: 'number', step: 0.01, min: 0 },
    },
    { key: 'gravityScale', label: 'Гравитация ×', control: { kind: 'number', step: 0.1 } },
  ],
  collider3d: [
    {
      key: 'shape',
      label: 'Форма',
      control: {
        kind: 'enum',
        options: [
          { value: 'box', label: 'Куб' },
          { value: 'sphere', label: 'Сфера' },
          { value: 'capsule', label: 'Капсула' },
        ],
      },
    },
    { key: 'size', label: 'Размер', control: { kind: 'vec3', step: 0.1 } },
    { key: 'isTrigger', label: 'Триггер', control: { kind: 'boolean' } },
  ],
  sprite: [
    { key: 'assetId', label: 'Изображение', control: { kind: 'asset', assetKind: 'image' } },
    { key: 'color', label: 'Цвет', control: { kind: 'color' } },
    {
      key: 'layer',
      label: 'Слой',
      control: { kind: 'number', step: 1, min: -100, max: 100, integer: true },
    },
    { key: 'sortOrder', label: 'Порядок', control: { kind: 'number', step: 1, integer: true } },
    { key: 'flipX', label: 'Отразить по X', control: { kind: 'boolean' } },
    { key: 'flipY', label: 'Отразить по Y', control: { kind: 'boolean' } },
  ],
  collider2d: [
    {
      key: 'shape',
      label: 'Форма',
      control: {
        kind: 'enum',
        options: [
          { value: 'box', label: 'Прямоугольник' },
          { value: 'circle', label: 'Круг' },
        ],
      },
    },
    { key: 'size', label: 'Размер', control: { kind: 'vec2', step: 0.1 } },
    { key: 'isStatic', label: 'Статичный', control: { kind: 'boolean' } },
    { key: 'isTrigger', label: 'Триггер', control: { kind: 'boolean' } },
  ],
  audio: [
    { key: 'assetId', label: 'Звук', control: { kind: 'asset', assetKind: 'audio' } },
    { key: 'volume', label: 'Громкость', control: unit },
    { key: 'loop', label: 'Повтор', control: { kind: 'boolean' } },
    { key: 'autoplay', label: 'Автозапуск', control: { kind: 'boolean' } },
    { key: 'spatial', label: 'Объёмный звук', control: { kind: 'boolean' } },
  ],
  playerController: [
    {
      key: 'mode',
      label: 'Режим',
      control: {
        kind: 'enum',
        options: [
          { value: 'firstPerson', label: 'От первого лица' },
          { value: 'thirdPerson', label: 'От третьего лица' },
          { value: 'platformer2d', label: 'Платформер 2D' },
        ],
      },
    },
    { key: 'moveSpeed', label: 'Скорость, м/с', control: { kind: 'number', step: 0.5, min: 0.01 } },
    {
      key: 'jumpHeight',
      label: 'Высота прыжка, м',
      control: { kind: 'number', step: 0.1, min: 0 },
    },
  ],
  scriptGraph: [{ key: 'graphId', label: 'Граф', control: { kind: 'graph' } }],
};

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  transform: 'Transform',
  mesh: 'Меш',
  material: 'Материал',
  camera: 'Камера',
  light: 'Свет',
  rigidBody3d: 'Физическое тело',
  collider3d: 'Коллайдер',
  sprite: 'Спрайт',
  collider2d: 'Коллайдер 2D',
  audio: 'Звук',
  playerController: 'Управление игроком',
  scriptGraph: 'Логика (граф)',
};

/** Descriptors for the fields that exist on this component's data (camera depends on projection). */
export function componentProperties(component: ComponentRecord): PropertyDescriptor[] {
  const data: object = component.data;
  return PROPERTIES[component.type].filter((descriptor) => Object.hasOwn(data, descriptor.key));
}

/** Switching camera projection swaps the field set; near/far clip survive the switch. */
export function cameraDataForProjection(
  current: Extract<ComponentRecord, { type: 'camera' }>['data'],
  projection: 'perspective' | 'orthographic',
): Extract<ComponentRecord, { type: 'camera' }>['data'] {
  if (current.projection === projection) {
    return current;
  }
  const { nearClip, farClip } = current;
  return projection === 'perspective'
    ? { projection, fov: 60, nearClip, farClip }
    : { projection, orthoHeight: 10, nearClip, farClip };
}
