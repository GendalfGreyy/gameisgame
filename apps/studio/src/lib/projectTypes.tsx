import type { ProjectTypeDto } from '@tg-creator/shared';
import type { ReactNode } from 'react';

import { IconApp, IconCube, IconSprite } from '../components/icons.js';

export type ProjectTypeInfo = {
  type: ProjectTypeDto;
  label: string;
  shortLabel: string;
  description: string;
  defaultTitle: string;
  starterDescription: string;
  icon: (size?: number) => ReactNode;
};

export const PROJECT_TYPES: readonly ProjectTypeInfo[] = [
  {
    type: 'game3d',
    label: '3D-игра',
    shortLabel: '3D',
    description: 'Сцена с камерой, светом и 3D-объектами.',
    defaultTitle: 'Мой 3D-мир',
    starterDescription: 'Камера, свет, земля и куб — можно сразу двигать объекты.',
    icon: (size) => <IconCube size={size} />,
  },
  {
    type: 'game2d',
    label: '2D-игра',
    shortLabel: '2D',
    description: 'Спрайты, слои и коллизии для платформеров и аркад.',
    defaultTitle: 'Моя 2D-игра',
    starterDescription: 'Ортографическая камера, платформа и игрок с коллайдерами.',
    icon: (size) => <IconSprite size={size} />,
  },
  {
    type: 'app',
    label: 'Приложение',
    shortLabel: 'App',
    description: 'Страницы и компоненты интерфейса: магазин, анкета, каталог.',
    defaultTitle: 'Моё приложение',
    starterDescription: 'Главная страница с заголовком, текстом и кнопкой.',
    icon: (size) => <IconApp size={size} />,
  },
];

export function projectTypeInfo(type: ProjectTypeDto): ProjectTypeInfo {
  const info = PROJECT_TYPES.find((item) => item.type === type);
  if (!info) {
    throw new Error(`Unknown project type ${type}`);
  }
  return info;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
