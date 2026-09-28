import { HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import { id, contactInput } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

export async function saveContact(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  const { ownerId, now } = context;
  const data = contactInput.extend({ id: id.optional(), connectionId: id }).parse(raw);
  const parent = db.collection('connections').doc(data.connectionId);
  const ref = data.id
    ? db.collection('contacts').doc(data.id)
    : db.collection('contacts').doc();
  await db.runTransaction(async (tx) => {
    owned(await tx.get(parent), ownerId);
    if (data.id && owned(await tx.get(ref), ownerId).connectionId !== data.connectionId)
      throw new HttpsError('invalid-argument', 'Conexão inválida.');
    tx.set(
      ref,
      {
        ownerId,
        connectionId: data.connectionId,
        name: data.name,
        phone: data.phone,
        updatedAt: now,
        ...(!data.id ? { createdAt: now } : {}),
      },
      { merge: true },
    );
    tx.update(parent, { updatedAt: now });
  });
  return { id: ref.id };
}
