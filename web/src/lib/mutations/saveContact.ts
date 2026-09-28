import { doc, runTransaction } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required } from './validation';

export async function saveContact(
  context: MutationContext,
  { id, name, phone, connectionId }: MutateInput,
) {
  const { db, ownerId, now, connections, contacts, owned } = context;
  const parentId = required(connectionId, 'connectionId');
  const parent = doc(connections, parentId);
  const ref = id ? doc(contacts, id) : doc(contacts);
  await runTransaction(db, async (transaction) => {
    owned((await transaction.get(parent)).data());
    if (id) {
      const existing = owned((await transaction.get(ref)).data());
      if (existing.connectionId !== parentId) throw new Error('Conexão inválida.');
    }
    transaction.set(
      ref,
      {
        ownerId,
        connectionId: parentId,
        name: required(name, 'name').trim(),
        phone: required(phone, 'phone').trim(),
        updatedAt: now,
        ...(id ? {} : { createdAt: now }),
      },
      { merge: true },
    );
    transaction.update(parent, { updatedAt: now });
  });
}
