import type {
  DocumentData,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import { db } from '../firebase';
import { id } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

type MessageChange = (
  tx: Transaction,
  ref: DocumentReference,
  message: DocumentData,
) => void;

export async function withMessage(
  { ownerId, now }: MutationContext,
  raw: unknown,
  apply: MessageChange,
): Promise<MutationResult> {
  const ref = db
    .collection('messages')
    .doc(id.parse((raw as { id?: string } | undefined)?.id));
  await db.runTransaction(async (tx) => {
    const message = owned(await tx.get(ref), ownerId);
    apply(tx, ref, message);
    tx.update(db.collection('contacts').doc(message.contactId as string), {
      updatedAt: now,
    });
    tx.update(db.collection('connections').doc(message.connectionId as string), {
      updatedAt: now,
    });
  });
  return { ok: true };
}
