import type { EditorSession, EditorState } from '@tg-creator/editor-core';
import type { Vec3 } from '@tg-creator/project-schema';
import { createContext, useContext, useSyncExternalStore, type MutableRefObject } from 'react';

export type EditorTool = 'select' | 'move';
export type EditorLayout = 'desktop' | 'mobile';
export type MobileSheet = 'hierarchy' | 'inspector' | 'assets' | 'logic' | 'console' | 'add';

export type EditorUi = {
  layout: EditorLayout;
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  renamingId: string | null;
  setRenamingId: (entityId: string | null) => void;
  /** Where "add object" places new root objects: the centre of the viewport (docs/02 §3). */
  placementRef: MutableRefObject<Vec3>;
  /** Mobile-only: asks before destructive actions (desktop relies on Undo). */
  requestDelete: (entityId: string) => void;
  openSheet: (sheet: MobileSheet | null) => void;
  /** "Переместить в…" picker for keyboard-free reparenting. */
  requestMove: (entityId: string) => void;
  /** Asks the viewport to centre on the selection. */
  focusSelection: () => void;
  focusToken: number;
};

export const SessionContext = createContext<EditorSession | null>(null);
export const EditorUiContext = createContext<EditorUi | null>(null);

export function useSession(): EditorSession {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside the editor');
  }
  return session;
}

export function useEditorUi(): EditorUi {
  const ui = useContext(EditorUiContext);
  if (!ui) {
    throw new Error('useEditorUi must be used inside the editor');
  }
  return ui;
}

/** Selector must return values that are already stable in EditorState (no fresh objects). */
export function useEditorState<T>(selector: (state: EditorState) => T): T {
  const session = useSession();
  return useSyncExternalStore(
    session.subscribe,
    () => selector(session.getState()),
    () => selector(session.getState()),
  );
}
