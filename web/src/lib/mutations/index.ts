import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, functionsEnabled } from '../firebase';
import { createMutationContext } from './context';
import type { MutateAction, MutateInput } from './types';
import { saveConnection } from './saveConnection';
import { deleteConnection } from './deleteConnection';
import { saveContact } from './saveContact';
import { deleteContact } from './deleteContact';
import { clearContactMessages } from './clearContactMessages';
import { createMessages } from './createMessages';
import { updateMessage } from './updateMessage';
import { deleteMessage } from './deleteMessage';

const handlers = {
  saveConnection,
  deleteConnection,
  saveContact,
  deleteContact,
  clearContactMessages,
  createMessages,
  updateMessage,
  deleteMessage,
};

export async function mutate(action: MutateAction, input: MutateInput) {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error('Entre para continuar.');
  if (functionsEnabled) {
    if (!functions) throw new Error('Configure o Firebase para continuar.');
    await httpsCallable(functions, 'mutate')({ action, input });
    return;
  }
  await handlers[action](createMutationContext(db, user.uid), input);
}
