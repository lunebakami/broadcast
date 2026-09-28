import { doc, runTransaction } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required } from './validation';

export async function deleteMessage(context: MutationContext, { id }: MutateInput) {
  const { db, now, connections, contacts, messages, owned } = context;
  const ref = doc(messages, required(id, 'id'));
  await runTransaction(db, async (transaction) => {
    const message = owned((await transaction.get(ref)).data());
    transaction.delete(ref);
    transaction.update(doc(contacts, String(message.contactId)), {
      updatedAt: now,
    });
    transaction.update(doc(connections, String(message.connectionId)), {
      updatedAt: now,
    });
  });
}
