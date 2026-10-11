import type { ComponentType, SceneEntity } from '@tg-creator/project-schema';

export type EntityKind = 'camera' | 'light' | 'mesh' | 'sprite' | 'audio' | 'empty';

const KIND_PRIORITY: readonly [ComponentType, EntityKind][] = [
  ['camera', 'camera'],
  ['light', 'light'],
  ['mesh', 'mesh'],
  ['sprite', 'sprite'],
  ['audio', 'audio'],
];

export function entityKind(entity: SceneEntity): EntityKind {
  for (const [type, kind] of KIND_PRIORITY) {
    if (entity.components.some((component) => component.type === type)) {
      return kind;
    }
  }
  return 'empty';
}

const KIND_LABELS: Record<EntityKind, string> = {
  camera: 'Камера',
  light: 'Свет',
  mesh: 'Меш',
  sprite: 'Спрайт',
  audio: 'Звук',
  empty: 'Пустой',
};

export function EntityGlyph({ entity }: { entity: SceneEntity }) {
  const kind = entityKind(entity);
  return (
    <svg
      className={`ed-glyph ed-glyph--${kind}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      role="img"
      aria-label={KIND_LABELS[kind]}
    >
      {kind === 'camera' ? (
        <>
          <rect x="1.5" y="4.5" width="9" height="7" rx="1" />
          <path d="m10.5 7 4-2v6l-4-2" />
        </>
      ) : kind === 'light' ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
        </>
      ) : kind === 'mesh' ? (
        <>
          <path d="M8 1.5 2 4.8v6.4l6 3.3 6-3.3V4.8z" />
          <path d="m2 4.8 6 3.3 6-3.3M8 8.1v6.4" />
        </>
      ) : kind === 'sprite' ? (
        <>
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="m2 11 3.5-3.5L9 11l2-2 3 3" />
        </>
      ) : kind === 'audio' ? (
        <path d="M2 6h3l4-3v10L5 10H2zM11.5 5.5a3.5 3.5 0 0 1 0 5" />
      ) : (
        <>
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1v4M8 11v4M1 8h4M11 8h4" />
        </>
      )}
    </svg>
  );
}
