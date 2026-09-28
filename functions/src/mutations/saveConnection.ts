import { db } from '../firebase';
import { id, named } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

export async function saveConnection(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  const { ownerId, now } = context;
  const data = named.extend({ id: id.optional() }).parse(raw);
  const ref = data.id
    ? db.collection('connections').doc(data.id)
    : db.collection('connections').doc();
  await db.runTransaction(async (tx) => {
    if (data.id) owned(await tx.get(ref), ownerId);
    tx.set(
      ref,
      {
        name: data.name,
        ownerId,
        updatedAt: now,
        ...(!data.id ? { createdAt: now } : {}),
      },
      { merge: true },
    );
  });
  return { id: ref.id };
}
