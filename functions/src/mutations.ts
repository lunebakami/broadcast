import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from './firebase';
import { id, named, contactInput, messageInput, scheduleDate } from './validation';

function owned(snapshot: DocumentSnapshot, ownerId: string) {
  if (!snapshot.exists || snapshot.get('ownerId') !== ownerId) {
    throw new HttpsError('not-found', 'Registro não encontrado.');
  }
  return snapshot.data()!;
}
const actions = z.enum([
  'saveConnection',
  'deleteConnection',
  'saveContact',
  'deleteContact',
  'clearContactMessages',
  'createMessages',
  'updateMessage',
  'deleteMessage',
]);

export const mutate = onCall(async (request) => {
  const ownerId = request.auth?.uid;
  if (!ownerId) throw new HttpsError('unauthenticated', 'Entre para continuar.');
  try {
    const action = actions.parse(request.data?.action);
    const input = request.data?.input;
    const now = FieldValue.serverTimestamp();

    if (action === 'saveConnection') {
      const data = named.extend({ id: id.optional() }).parse(input);
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
    if (action === 'deleteConnection') {
      const connectionId = id.parse(input?.id);
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
    if (action === 'saveContact') {
      const data = contactInput
        .extend({ id: id.optional(), connectionId: id })
        .parse(input);
      const parent = db.collection('connections').doc(data.connectionId);
      const ref = data.id
        ? db.collection('contacts').doc(data.id)
        : db.collection('contacts').doc();
      await db.runTransaction(async (tx) => {
        owned(await tx.get(parent), ownerId);
        if (
          data.id &&
          owned(await tx.get(ref), ownerId).connectionId !== data.connectionId
        )
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
    if (action === 'deleteContact' || action === 'clearContactMessages') {
      const contactId = id.parse(input?.id);
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
        if (action === 'deleteContact') tx.delete(ref);
        else tx.update(ref, { updatedAt: now });
        tx.update(db.collection('connections').doc(contact.connectionId), {
          updatedAt: now,
        });
      });
      return { ok: true };
    }
    if (action === 'createMessages') {
      const data = messageInput
        .extend({ connectionId: id, contactIds: z.array(id).min(1).max(100) })
        .parse(input);
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
    const messageId = id.parse(input?.id);
    const ref = db.collection('messages').doc(messageId);
    await db.runTransaction(async (tx) => {
      const message = owned(await tx.get(ref), ownerId);
      if (action === 'deleteMessage') {
        tx.delete(ref);
      } else {
        const data = messageInput.parse(input);
        const scheduledAt =
          message.status === 'scheduled' ? scheduleDate(data.scheduledAt) : null;
        tx.update(ref, {
          text: data.text,
          updatedAt: now,
          revision: randomUUID(),
          ...(message.status === 'scheduled'
            ? {
                scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
                status: scheduledAt ? 'scheduled' : 'sent',
                sentAt: scheduledAt ? null : now,
              }
            : {}),
        });
      }
      tx.update(db.collection('contacts').doc(message.contactId), {
        updatedAt: now,
      });
      tx.update(db.collection('connections').doc(message.connectionId), {
        updatedAt: now,
      });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new HttpsError(
        'invalid-argument',
        error.issues[0]?.message ?? 'Dados inválidos.',
      );
    throw error;
  }
});
