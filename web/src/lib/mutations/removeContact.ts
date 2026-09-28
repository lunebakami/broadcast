import { doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required } from './validation';

export async function removeContact(
  context: MutationContext,
  { id }: MutateInput,
  deleteContact: boolean,
) {
  const { db, ownerId, now, connections, contacts, messages, owned } = context;
  const contactId = required(id, 'id');
  const ref = doc(contacts, contactId);
  const contact = owned((await getDoc(ref)).data());
  const relatedMessages = await getDocs(
    query(
      messages,
      where('ownerId', '==', ownerId),
      where('contactId', '==', contactId),
    ),
  );
  if (relatedMessages.size > 450)
    throw new Error('Este contato tem muitas mensagens para apagar nesta operação.');
  const batch = writeBatch(db);
  relatedMessages.docs.forEach((message) => batch.delete(message.ref));
  if (deleteContact) batch.delete(ref);
  else batch.update(ref, { updatedAt: now });
  batch.update(doc(connections, String(contact.connectionId)), { updatedAt: now });
  await batch.commit();
}
