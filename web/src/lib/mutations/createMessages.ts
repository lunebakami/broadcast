import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required, checkScheduleWindow } from './validation';

export async function createMessages(
  context: MutationContext,
  { connectionId, contactIds, text, scheduledAt: raw }: MutateInput,
) {
  const { db, ownerId, now, connections, contacts, messages, owned } = context;
  const parentId = required(connectionId, 'connectionId');
  const parent = doc(connections, parentId);
  const scheduledAt = raw ? new Date(raw) : null;
  if (scheduledAt && scheduledAt <= new Date())
    throw new Error('Agende para o futuro, em até 30 dias.');
  checkScheduleWindow(scheduledAt);
  const body = required(text, 'text').trim();
  const targets = required(contactIds, 'contactIds');
  for (const contactId of new Set(targets)) {
    const ref = doc(contacts, contactId);
    // Each transaction stays below Firestore's rule-access limit for batches.
    // eslint-disable-next-line no-await-in-loop
    await runTransaction(db, async (transaction) => {
      owned((await transaction.get(parent)).data());
      const currentContact = owned((await transaction.get(ref)).data());
      if (currentContact.connectionId !== parentId) {
        throw new Error('Contato de outra conexão.');
      }
      transaction.set(doc(messages), {
        ownerId,
        connectionId: parentId,
        contactId: ref.id,
        recipientName: String(currentContact.name),
        recipientPhone: String(currentContact.phone),
        text: body,
        status: scheduledAt ? 'scheduled' : 'sent',
        scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
        sentAt: scheduledAt ? null : now,
        createdAt: now,
        updatedAt: now,
        revision: crypto.randomUUID(),
      });
      transaction.update(ref, { updatedAt: now });
      transaction.update(parent, { updatedAt: now });
    });
  }
}
