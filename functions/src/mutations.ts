import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { MutationHandler } from './mutations/types';
import { saveConnection } from './mutations/saveConnection';
import { deleteConnection } from './mutations/deleteConnection';
import { saveContact } from './mutations/saveContact';
import { deleteContact } from './mutations/deleteContact';
import { clearContactMessages } from './mutations/clearContactMessages';
import { createMessages } from './mutations/createMessages';
import { updateMessage } from './mutations/updateMessage';
import { deleteMessage } from './mutations/deleteMessage';

const ACTIONS = [
  'saveConnection',
  'deleteConnection',
  'saveContact',
  'deleteContact',
  'clearContactMessages',
  'createMessages',
  'updateMessage',
  'deleteMessage',
] as const;

type Action = (typeof ACTIONS)[number];

const actions = z.enum(ACTIONS);

const handlers: Record<Action, MutationHandler> = {
  saveConnection,
  deleteConnection,
  saveContact,
  deleteContact,
  clearContactMessages,
  createMessages,
  updateMessage,
  deleteMessage,
};

export const mutate = onCall(async (request) => {
  const ownerId = request.auth?.uid;
  if (!ownerId) throw new HttpsError('unauthenticated', 'Entre para continuar.');
  try {
    const action = actions.parse(request.data?.action);
    return await handlers[action](
      { ownerId, now: FieldValue.serverTimestamp() },
      request.data?.input,
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new HttpsError(
        'invalid-argument',
        error.issues[0]?.message ?? 'Dados inválidos.',
      );
    throw error;
  }
});
