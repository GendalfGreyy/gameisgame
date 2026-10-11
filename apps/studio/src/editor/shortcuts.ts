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
  tool: (tool: 'select' | 'move' | 'rotate' | 'scale') => void;
};

const TOOL_KEYS = { q: 'select', w: 'move', e: 'rotate', r: 'scale' } as const;

function isToolKey(key: string): key is keyof typeof TOOL_KEYS {
  return key in TOOL_KEYS;
}

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
      } else if (isToolKey(key)) {
        handlers.tool(TOOL_KEYS[key]);
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
