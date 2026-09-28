import { db } from '../firebase';
import { id } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

export async function removeContact(
  context: MutationContext,
  raw: unknown,
  deleteContact: boolean,
): Promise<MutationResult> {
  const { ownerId, now } = context;
  const contactId = id.parse((raw as { id?: string } | undefined)?.id);
  const ref = db.collection('contacts').doc(contactId);
  await db.runTransaction(async (tx) => {
    const contact = owned(await tx.get(ref), ownerId);
    const messages = await tx.get(
      db
        .collection('messages')
        .where('ownerId', '==', ownerId)
        .where('contactId', '==', contactId),
    );
    messages.docs.forEach((doc) => tx.delete(doc.ref));
    if (deleteContact) tx.delete(ref);
    else tx.update(ref, { updatedAt: now });
    tx.update(db.collection('connections').doc(contact.connectionId), {
      updatedAt: now,
    });
  });
  return { ok: true };
}
