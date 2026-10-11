import type { EditorSession, SaveFailure } from '@tg-creator/editor-core';

import { ApiRequestError, type ApiClient } from '../lib/api.js';

type WithSession = <T>(call: (api: ApiClient) => Promise<T>) => Promise<T>;

export function toSaveFailure(error: unknown): SaveFailure {
  if (error instanceof ApiRequestError) {
    if (error.code === 'REVISION_CONFLICT') {
      const actual = error.details?.actualRevision;
      return { kind: 'conflict', actualRevision: typeof actual === 'number' ? actual : null };
    }
    if (error.code === null && error.status === 0) {
      return { kind: 'offline' };
    }
    return { kind: 'error', message: error.message };
  }
  return { kind: 'error', message: 'Не удалось сохранить' };
}

/**
 * PUT draft for the current state. Only a 200 marks the session saved; the ticket's
 * mutationId is reused on retry, so a request that reached the server is never applied twice.
 */
export async function saveDraft(
  session: EditorSession,
  withSession: WithSession,
  projectId: string,
): Promise<boolean> {
  const ticket = session.beginSave();
  if (!ticket) {
    return false;
  }
  try {
    const saved = await withSession((api) =>
      api.saveDraft(projectId, {
        baseRevision: ticket.baseRevision,
        mutationId: ticket.mutationId,
        document: ticket.document,
      }),
    );
    session.saveSucceeded(ticket, saved.revision, saved.savedAt);
    return true;
  } catch (error) {
    session.saveFailed(ticket, toSaveFailure(error));
    return false;
  }
}
