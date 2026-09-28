import { randomUUID } from 'node:crypto';
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from './firebase';
import { id, named, contactInput, messageInput, scheduleDate } from './validation';

const ACTIONS = [
  'saveConnection',
  'deleteConnection',
  'saveContact',
  'deleteContact',
  'clearContactMessages',
  'createMessages',
  'updateMessage',
  'deleteMessage',
] as const;

type Action = (typeof ACTIONS)[number];

const actions = z.enum(ACTIONS);

type Result = { id: string } | { ok: true };
type Handler = (input: unknown) => Promise<Result>;

function owned(snapshot: DocumentSnapshot, ownerId: string) {
  if (!snapshot.exists || snapshot.get('ownerId') !== ownerId) {
    throw new HttpsError('not-found', 'Registro não encontrado.');
  }
  return snapshot.data()!;
}

async function syncMessageRecipientNames(
  ownerId: string,
  contactId: string,
  recipientName: string,
) {
  const messages = await db
    .collection('messages')
    .where('ownerId', '==', ownerId)
    .where('contactId', '==', contactId)
    .get();

  for (let offset = 0; offset < messages.size; offset += 450) {
    const batch = db.batch();
    messages.docs
      .slice(offset, offset + 450)
      .forEach((message) => batch.update(message.ref, { recipientName }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

export const mutate = onCall(async (request) => {
  const ownerId = request.auth?.uid;
  if (!ownerId) throw new HttpsError('unauthenticated', 'Entre para continuar.');
  try {
    const action: Action = actions.parse(request.data?.action);
    const input = request.data?.input;
    const now = FieldValue.serverTimestamp();

    // deleteContact and clearContactMessages differ only in what happens to
    // the contact document itself, so they share everything else.
    const clearContact =
      (deleteContact: boolean): Handler =>
      async (raw) => {
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
      };

    // deleteMessage and updateMessage likewise share the message read plus
    // the two updatedAt bumps on the parent contact and connection.
    const withMessage =
      (
        apply: (
          tx: Transaction,
          ref: DocumentReference,
          message: DocumentData,
          input: unknown,
        ) => void,
      ): Handler =>
      async (raw) => {
        const ref = db
          .collection('messages')
          .doc(id.parse((raw as { id?: string } | undefined)?.id));
        await db.runTransaction(async (tx) => {
          const message = owned(await tx.get(ref), ownerId);
          apply(tx, ref, message, raw);
          tx.update(db.collection('contacts').doc(message.contactId as string), {
            updatedAt: now,
          });
          tx.update(db.collection('connections').doc(message.connectionId as string), {
            updatedAt: now,
          });
        });
        return { ok: true };
      };

    const handlers: Record<Action, Handler> = {
      saveConnection: async (raw) => {
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
      },

      deleteConnection: async (raw) => {
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
      },

      saveContact: async (raw) => {
        const data = contactInput
          .extend({ id: id.optional(), connectionId: id })
          .parse(raw);
        const parent = db.collection('connections').doc(data.connectionId);
        const ref = data.id
          ? db.collection('contacts').doc(data.id)
          : db.collection('contacts').doc();
        let previousName: string | undefined;
        await db.runTransaction(async (tx) => {
          owned(await tx.get(parent), ownerId);
          if (data.id) {
            const existing = owned(await tx.get(ref), ownerId);
            if (existing.connectionId !== data.connectionId)
              throw new HttpsError('invalid-argument', 'Conexão inválida.');
            previousName = String(existing.name);
          }
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
        if (data.id && previousName !== data.name)
          await syncMessageRecipientNames(ownerId, data.id, data.name);
        return { id: ref.id };
      },

      deleteContact: clearContact(true),
      clearContactMessages: clearContact(false),

      createMessages: async (raw) => {
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
      },

      updateMessage: withMessage((tx, ref, message, raw) => {
        const data = messageInput.parse(raw);
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
      }),

      deleteMessage: withMessage((tx, ref) => {
        tx.delete(ref);
      }),
    };

    return await handlers[action](input);
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new HttpsError(
        'invalid-argument',
        error.issues[0]?.message ?? 'Dados inválidos.',
      );
    throw error;
  }
});
