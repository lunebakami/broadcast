import { HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import { id } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

export async function deleteConnection(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  const { ownerId } = context;
  const connectionId = id.parse((raw as { id?: string } | undefined)?.id);
  const ref = db.collection('connections').doc(connectionId);
  await db.runTransaction(async (tx) => {
    owned(await tx.get(ref), ownerId);
    const messages = await tx.get(
      db
        .collection('messages')
        .where('ownerId', '==', ownerId)
        .where('connectionId', '==', connectionId)
        .limit(1),
    );
    if (!messages.empty)
      throw new HttpsError(
        'failed-precondition',
        'Apague as mensagens desta conexão antes de excluí-la.',
      );
    const contacts = await tx.get(
      db
        .collection('contacts')
        .where('ownerId', '==', ownerId)
        .where('connectionId', '==', connectionId),
    );
    contacts.docs.forEach((doc) => tx.delete(doc.ref));
    tx.delete(ref);
  });
  return { ok: true };
}
