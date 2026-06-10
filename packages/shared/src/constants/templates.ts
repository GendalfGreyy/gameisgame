export type EventTemplate = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxParticipants: number | null;
  emoji: string;
};

/**
 * Static MVP templates for the 60-second event wizard.
 * Curated from real campus formats; revisit once organic events
 * provide data on which formats people actually create.
 */
export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    id: 'streetball',
    title: 'Стритбол 3x3',
    description: 'Собираем на площадке, играем до упора. Свой мяч приветствуется.',
    durationMinutes: 120,
    maxParticipants: 12,
    emoji: '🏀',
  },
  {
    id: 'football',
    title: 'Футбол 5x5',
    description: 'Дворовый формат, делимся на месте. Манишки есть.',
    durationMinutes: 90,
    maxParticipants: 14,
    emoji: '⚽',
  },
  {
    id: 'fifa-tournament',
    title: 'FIFA-турнир',
    description: 'Сетка на вылет, две приставки. Призовой — уважение.',
    durationMinutes: 180,
    maxParticipants: 16,
    emoji: '🎮',
  },
  {
    id: 'dance-jam',
    title: 'Dance Jam',
    description: 'Открытый джем: любые стили, своя музыка, без судей.',
    durationMinutes: 150,
    maxParticipants: null,
    emoji: '💃',
  },
  {
    id: 'board-games',
    title: 'Настолки',
    description: 'Несколько столов, игры приносим вместе. Новичкам объясним.',
    durationMinutes: 180,
    maxParticipants: 20,
    emoji: '🎲',
  },
  {
    id: 'ping-pong',
    title: 'Пинг-понг между парами',
    description: 'Быстрый формат на 60-90 минут. Ракетки на месте.',
    durationMinutes: 60,
    maxParticipants: 8,
    emoji: '🏓',
  },
  {
    id: 'study-session',
    title: 'Study Session',
    description: 'Учимся вместе в тишине, перерыв каждые 50 минут.',
    durationMinutes: 180,
    maxParticipants: 12,
    emoji: '📚',
  },
  {
    id: 'quiz-night',
    title: 'Квиз',
    description: 'Команды по 4-6 человек, 5 раундов, ведущий наш.',
    durationMinutes: 120,
    maxParticipants: 36,
    emoji: '🧠',
  },
] as const;
