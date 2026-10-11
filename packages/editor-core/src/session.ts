import type { ProjectDocument, Scene } from '@tg-creator/project-schema';

import { applyCommand, type CommandError, type EditorCommand } from './commands.js';
import { createIdGenerator, type IdGenerator } from './ids.js';
import { findScene, getEntity } from './scene.js';

export const HISTORY_LIMIT = 200;
export const LOG_LIMIT = 100;

export type HistoryEntry = {
  label: string;
  command: EditorCommand;
  inverse: EditorCommand;
  selectionBefore: readonly string[];
  selectionAfter: readonly string[];
  /** Consecutive commands with the same key (one drag gesture) collapse into one entry. */
  mergeKey: string | null;
  versionBefore: number;
  versionAfter: number;
};

export type LogEntry = {
  id: number;
  level: 'info' | 'error';
  message: string;
  at: number;
};

/**
 * Cloud save lifecycle. `Saved` is only ever derived from a successful server response;
 * a failed request keeps its mutationId so retrying the same document is idempotent.
 */
export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; ticket: SaveTicket }
  | { kind: 'error'; message: string; ticket: SaveTicket }
  | { kind: 'offline'; ticket: SaveTicket }
  | { kind: 'conflict'; actualRevision: number | null };

export type SaveTicket = {
  version: number;
  baseRevision: number;
  mutationId: string;
  document: ProjectDocument;
};

export type SaveIndicator = 'saved' | 'dirty' | 'saving' | 'error' | 'offline' | 'conflict';

export type EditorState = {
  document: ProjectDocument;
  sceneId: string | null;
  selection: readonly string[];
  past: readonly HistoryEntry[];
  future: readonly HistoryEntry[];
  /** Identity of the current document state; equal versions mean equal documents. */
  version: number;
  savedVersion: number;
  serverRevision: number;
  savedAt: string | null;
  save: SaveState;
  log: readonly LogEntry[];
};

export type DispatchOptions = {
  label: string;
  mergeKey?: string;
  /** Selection after the command; defaults to the current selection minus removed entities. */
  select?: readonly string[];
};

export type DispatchResult = { ok: true } | { ok: false; error: CommandError };

export type SaveFailure =
  | { kind: 'conflict'; actualRevision: number | null }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export type EditorSessionInit = {
  document: ProjectDocument;
  revision: number;
  savedAt: string | null;
  ids?: IdGenerator;
  now?: () => number;
};

export function isDirty(state: EditorState): boolean {
  return state.version !== state.savedVersion;
}

export function saveIndicator(state: EditorState): SaveIndicator {
  switch (state.save.kind) {
    case 'saving':
      return 'saving';
    case 'conflict':
      return 'conflict';
    case 'offline':
      return isDirty(state) ? 'offline' : 'saved';
    case 'error':
      return isDirty(state) ? 'error' : 'saved';
    case 'idle':
      return isDirty(state) ? 'dirty' : 'saved';
  }
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

export function activeScene(state: EditorState): Scene | undefined {
  return state.sceneId === null ? undefined : findScene(state.document, state.sceneId);
}

function pruneSelection(document: ProjectDocument, sceneId: string | null, ids: readonly string[]) {
  const scene = sceneId === null ? undefined : findScene(document, sceneId);
  if (!scene) {
    return [];
  }
  return ids.filter((id) => getEntity(scene, id) !== undefined);
}

function initialSceneId(document: ProjectDocument): string | null {
  return document.entrySceneId ?? document.scenes[0]?.id ?? null;
}

export type EditorSession = ReturnType<typeof createEditorSession>;

/** Framework-agnostic store (subscribe/getState) — React binds it via useSyncExternalStore. */
export function createEditorSession(init: EditorSessionInit) {
  const ids = init.ids ?? createIdGenerator();
  const now = init.now ?? (() => Date.now());
  const listeners = new Set<() => void>();
  let versionCounter = 0;
  let logCounter = 0;

  let state: EditorState = {
    document: init.document,
    sceneId: initialSceneId(init.document),
    selection: [],
    past: [],
    future: [],
    version: 0,
    savedVersion: 0,
    serverRevision: init.revision,
    savedAt: init.savedAt,
    save: { kind: 'idle' },
    log: [],
  };

  function set(next: EditorState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function withLog(next: EditorState, level: LogEntry['level'], message: string): EditorState {
    logCounter += 1;
    const entry: LogEntry = { id: logCounter, level, message, at: now() };
    return { ...next, log: [...next.log, entry].slice(-LOG_LIMIT) };
  }

  function dispatch(command: EditorCommand, options: DispatchOptions): DispatchResult {
    const result = applyCommand(state.document, command);
    if (!result.ok) {
      set(withLog(state, 'error', `${options.label}: ${result.error.message}`));
      return { ok: false, error: result.error };
    }
    const selectionAfter = pruneSelection(
      result.document,
      state.sceneId,
      options.select ?? state.selection,
    );
    versionCounter += 1;
    const last = state.past.at(-1);
    const merge =
      options.mergeKey !== undefined &&
      last !== undefined &&
      last.mergeKey === options.mergeKey &&
      state.future.length === 0;
    let past: HistoryEntry[];
    if (merge) {
      past = [
        ...state.past.slice(0, -1),
        { ...last, command, selectionAfter, versionAfter: versionCounter },
      ];
    } else {
      const entry: HistoryEntry = {
        label: options.label,
        command,
        inverse: result.inverse,
        selectionBefore: state.selection,
        selectionAfter,
        mergeKey: options.mergeKey ?? null,
        versionBefore: state.version,
        versionAfter: versionCounter,
      };
      past = [...state.past, entry].slice(-HISTORY_LIMIT);
    }
    const next: EditorState = {
      ...state,
      document: result.document,
      selection: selectionAfter,
      past,
      future: [],
      version: versionCounter,
    };
    set(merge ? next : withLog(next, 'info', options.label));
    return { ok: true };
  }

  function undo(): DispatchResult {
    const entry = state.past.at(-1);
    if (!entry) {
      return { ok: false, error: { code: 'INVALID_DATA', message: 'Нечего отменять' } };
    }
    const result = applyCommand(state.document, entry.inverse);
    if (!result.ok) {
      set(withLog(state, 'error', `Отмена «${entry.label}»: ${result.error.message}`));
      return { ok: false, error: result.error };
    }
    set(
      withLog(
        {
          ...state,
          document: result.document,
          selection: pruneSelection(result.document, state.sceneId, entry.selectionBefore),
          past: state.past.slice(0, -1),
          future: [...state.future, entry],
          version: entry.versionBefore,
        },
        'info',
        `Отменено: ${entry.label}`,
      ),
    );
    return { ok: true };
  }

  function redo(): DispatchResult {
    const entry = state.future.at(-1);
    if (!entry) {
      return { ok: false, error: { code: 'INVALID_DATA', message: 'Нечего повторять' } };
    }
    const result = applyCommand(state.document, entry.command);
    if (!result.ok) {
      set(withLog(state, 'error', `Повтор «${entry.label}»: ${result.error.message}`));
      return { ok: false, error: result.error };
    }
    set(
      withLog(
        {
          ...state,
          document: result.document,
          selection: pruneSelection(result.document, state.sceneId, entry.selectionAfter),
          past: [...state.past, { ...entry, inverse: result.inverse }],
          future: state.future.slice(0, -1),
          version: entry.versionAfter,
        },
        'info',
        `Повторено: ${entry.label}`,
      ),
    );
    return { ok: true };
  }

  /** Ends the current merge group, e.g. on pointerup, so the next drag is its own entry. */
  function closeMergeGroup(): void {
    const last = state.past.at(-1);
    if (last && last.mergeKey !== null) {
      set({ ...state, past: [...state.past.slice(0, -1), { ...last, mergeKey: null }] });
    }
  }

  function select(entityIds: readonly string[]): void {
    const selection = pruneSelection(state.document, state.sceneId, entityIds);
    if (
      selection.length === state.selection.length &&
      selection.every((id, index) => state.selection[index] === id)
    ) {
      return;
    }
    set({ ...state, selection });
  }

  function setScene(sceneId: string): void {
    if (findScene(state.document, sceneId) && sceneId !== state.sceneId) {
      set({ ...state, sceneId, selection: [] });
    }
  }

  /** Returns what to PUT, or `null` when there is nothing to save or a save is in flight. */
  function beginSave(): SaveTicket | null {
    if (state.save.kind === 'saving' || state.save.kind === 'conflict' || !isDirty(state)) {
      return null;
    }
    const previous =
      state.save.kind === 'error' || state.save.kind === 'offline' ? state.save.ticket : null;
    const ticket: SaveTicket =
      previous &&
      previous.version === state.version &&
      previous.baseRevision === state.serverRevision
        ? previous
        : {
            version: state.version,
            baseRevision: state.serverRevision,
            mutationId: ids('mut'),
            document: state.document,
          };
    set({ ...state, save: { kind: 'saving', ticket } });
    return ticket;
  }

  function saveSucceeded(ticket: SaveTicket, revision: number, savedAt: string): void {
    set(
      withLog(
        {
          ...state,
          serverRevision: revision,
          savedVersion: ticket.version,
          savedAt,
          save: { kind: 'idle' },
        },
        'info',
        `Сохранено в облаке (ревизия ${revision})`,
      ),
    );
  }

  function saveFailed(ticket: SaveTicket, failure: SaveFailure): void {
    let save: SaveState;
    let message: string;
    switch (failure.kind) {
      case 'conflict':
        save = { kind: 'conflict', actualRevision: failure.actualRevision };
        message = 'Проект изменён в другом месте — сохранение остановлено';
        break;
      case 'offline':
        save = { kind: 'offline', ticket };
        message = 'Нет связи с сервером — изменения не сохранены в облаке';
        break;
      case 'error':
        save = { kind: 'error', message: failure.message, ticket };
        message = `Ошибка сохранения: ${failure.message}`;
        break;
    }
    set(withLog({ ...state, save }, 'error', message));
  }

  /** Replaces the document with a server copy (conflict "load server version"); clears history. */
  function reset(document: ProjectDocument, revision: number, savedAt: string): void {
    versionCounter += 1;
    const sceneId =
      state.sceneId !== null && findScene(document, state.sceneId)
        ? state.sceneId
        : initialSceneId(document);
    set(
      withLog(
        {
          ...state,
          document,
          sceneId,
          selection: pruneSelection(document, sceneId, state.selection),
          past: [],
          future: [],
          version: versionCounter,
          savedVersion: versionCounter,
          serverRevision: revision,
          savedAt,
          save: { kind: 'idle' },
        },
        'info',
        `Загружена версия с сервера (ревизия ${revision})`,
      ),
    );
  }

  function logError(message: string): void {
    set(withLog(state, 'error', message));
  }

  return {
    ids,
    getState: (): EditorState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    undo,
    redo,
    closeMergeGroup,
    select,
    setScene,
    beginSave,
    saveSucceeded,
    saveFailed,
    reset,
    logError,
  };
}
