import { doc, runTransaction } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required } from './validation';

export async function saveConnection(
  context: MutationContext,
  { id, name }: MutateInput,
) {
  const { db, ownerId, now, connections, owned } = context;
  const ref = id ? doc(connections, id) : doc(connections);
  await runTransaction(db, async (transaction) => {
    if (id) owned((await transaction.get(ref)).data());
    transaction.set(
      ref,
      {
        name: required(name, 'name').trim(),
        ownerId,
        updatedAt: now,
        ...(id ? {} : { createdAt: now }),
      },
      { merge: true },
    );
  });
}
