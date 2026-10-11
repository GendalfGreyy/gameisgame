import { useEffect } from 'react';

export type ShortcutHandlers = {
  undo: () => void;
  redo: () => void;
  save: () => void;
  duplicate: () => void;
  remove: () => void;
  rename: () => void;
  deselect: () => void;
  focus: () => void;
  toolSelect: () => void;
  toolMove: () => void;
};

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * docs/02 §3 desktop shortcuts. Inside text fields only Ctrl/Cmd+S is taken over, so
 * native text undo and Backspace keep working while typing.
 */
export function useEditorShortcuts(enabled: boolean, handlers: ShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') {
        event.preventDefault();
        handlers.save();
        return;
      }
      if (isTextTarget(event.target) || event.altKey) {
        return;
      }
      if (document.querySelector('.overlay')) {
        return;
      }
      let handled = true;
      if (mod && key === 'z') {
        if (event.shiftKey) {
          handlers.redo();
        } else {
          handlers.undo();
        }
      } else if (mod && key === 'y') {
        handlers.redo();
      } else if (mod && key === 'd') {
        handlers.duplicate();
      } else if (mod) {
        handled = false;
      } else if (key === 'delete' || key === 'backspace') {
        handlers.remove();
      } else if (key === 'f2') {
        handlers.rename();
      } else if (key === 'escape') {
        handlers.deselect();
      } else if (key === 'f') {
        handlers.focus();
      } else if (key === 'q') {
        handlers.toolSelect();
      } else if (key === 'w') {
        handlers.toolMove();
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, handlers]);
}
