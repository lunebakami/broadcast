import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../firebase';
import { id, messageInput, scheduleDate } from '../validation';
import { owned } from './owned';
import type { MutationContext, MutationResult } from './types';

export async function createMessages(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  const { ownerId, now } = context;
  const data = messageInput
    .extend({ connectionId: id, contactIds: z.array(id).min(1).max(100) })
    .parse(raw);
  const scheduledAt = scheduleDate(data.scheduledAt);
  const parent = db.collection('connections').doc(data.connectionId);
  await db.runTransaction(async (tx) => {
    owned(await tx.get(parent), ownerId);
    const refs = [...new Set(data.contactIds)].map((value) =>
      db.collection('contacts').doc(value),
    );
    const contacts = await tx.getAll(...refs);
    const recipients = contacts.map((doc) => {
      const contact = owned(doc, ownerId);
      if (contact.connectionId !== data.connectionId)
        throw new HttpsError('invalid-argument', 'Contato de outra conexão.');
      return { doc, contact };
    });
    for (const { doc, contact } of recipients) {
      tx.create(db.collection('messages').doc(), {
        ownerId,
        connectionId: data.connectionId,
        contactId: doc.id,
        recipientName: contact.name,
        recipientPhone: contact.phone,
        text: data.text,
        status: scheduledAt ? 'scheduled' : 'sent',
        scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
        sentAt: scheduledAt ? null : now,
        createdAt: now,
        updatedAt: now,
        revision: randomUUID(),
      });
      tx.update(doc.ref, { updatedAt: now });
    }
    tx.update(parent, { updatedAt: now });
  });
  return { ok: true };
}
