import {
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required } from './validation';

export async function deleteConnection(context: MutationContext, { id }: MutateInput) {
  const { db, ownerId, connections, contacts, messages, owned } = context;
  const connectionId = required(id, 'id');
  const ref = doc(connections, connectionId);
  owned((await getDoc(ref)).data());
  const [relatedMessages, relatedContacts] = await Promise.all([
    getDocs(
      query(
        messages,
        where('ownerId', '==', ownerId),
        where('connectionId', '==', connectionId),
        limit(1),
      ),
    ),
    getDocs(
      query(
        contacts,
        where('ownerId', '==', ownerId),
        where('connectionId', '==', connectionId),
      ),
    ),
  ]);
  if (!relatedMessages.empty) {
    throw new Error('Apague as mensagens desta conexão antes de excluí-la.');
  }
  if (relatedContacts.size > 499) {
    throw new Error('Esta conexão tem contatos demais para excluir nesta operação.');
  }
  const batch = writeBatch(db);
  relatedContacts.docs.forEach((contact) => batch.delete(contact.ref));
  batch.delete(ref);
  await batch.commit();
}
