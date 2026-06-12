import type { EventTemplate } from '@game-is-game/shared';

export function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultStartLocal(): string {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return toDatetimeLocalValue(start);
}

export function endFromStartLocal(startLocal: string, durationMinutes: number): string {
  const end = new Date(startLocal);
  end.setMinutes(end.getMinutes() + durationMinutes);
  return toDatetimeLocalValue(end);
}

export function localToIso(local: string): string {
  return new Date(local).toISOString();
}

export function applyTemplate(template: EventTemplate, startLocal: string) {
  return {
    title: template.title,
    description: template.description,
    startsAt: localToIso(startLocal),
    endsAt: localToIso(endFromStartLocal(startLocal, template.durationMinutes)),
    maxParticipants: template.maxParticipants ?? undefined,
  };
}

/** Clone window: next hour slot, same duration as the source event. */
export function cloneTimesFromEvent(startsAt: string, endsAt: string) {
  const durationMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  const startLocal = defaultStartLocal();
  const endLocal = toDatetimeLocalValue(new Date(new Date(startLocal).getTime() + durationMs));
  return {
    startsAt: localToIso(startLocal),
    endsAt: localToIso(endLocal),
  };
}
