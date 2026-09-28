import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { required, checkScheduleWindow } from './validation';

export async function updateMessage(
  context: MutationContext,
  { id, text, scheduledAt: raw }: MutateInput,
) {
  const { db, now, connections, contacts, messages, owned } = context;
  const ref = doc(messages, required(id, 'id'));
  await runTransaction(db, async (transaction) => {
    const message = owned((await transaction.get(ref)).data());
    const scheduledAt = message.status === 'scheduled' && raw ? new Date(raw) : null;
    if (scheduledAt && scheduledAt <= new Date())
      throw new Error('Agende para o futuro, em até 30 dias.');
    checkScheduleWindow(scheduledAt);
    transaction.update(ref, {
      text: required(text, 'text').trim(),
      updatedAt: now,
      revision: crypto.randomUUID(),
      ...(message.status === 'scheduled'
        ? {
            scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
            status: scheduledAt ? 'scheduled' : 'sent',
            sentAt: scheduledAt ? null : now,
          }
        : {}),
    });
    transaction.update(doc(contacts, String(message.contactId)), {
      updatedAt: now,
    });
    transaction.update(doc(connections, String(message.connectionId)), {
      updatedAt: now,
    });
  });
}
