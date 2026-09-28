import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';
import { MAX_SCHEDULE_MS } from './schedule';

export const emulatorsEnabled = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const functionsEnabled = import.meta.env.VITE_ENABLE_FUNCTIONS === 'true';

const config = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY || (emulatorsEnabled ? 'demo-api-key' : ''),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (emulatorsEnabled ? 'localhost' : ''),
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (emulatorsEnabled ? 'demo-broadcast' : ''),
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID || (emulatorsEnabled ? 'demo-app-id' : ''),
};
export const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
const functions = app
  ? getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
  : null;

if (emulatorsEnabled && auth && db && functions) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export type MutateAction =
  | 'saveConnection'
  | 'deleteConnection'
  | 'saveContact'
  | 'deleteContact'
  | 'clearContactMessages'
  | 'createMessages'
  | 'updateMessage'
  | 'deleteMessage';

type MutateInput = {
  id?: string;
  name?: string;
  phone?: string;
  connectionId?: string;
  contactIds?: string[];
  text?: string;
  scheduledAt?: string | null;
};

type Handler = (input: MutateInput) => Promise<void>;

function required<T>(value: T | undefined, field: string) {
  if (value === undefined) throw new Error(`Campo ausente: ${field}.`);
  return value;
}

async function syncMessageRecipientNames(
  ownerId: string,
  contactId: string,
  recipientName: string,
) {
  const relatedMessages = await getDocs(
    query(
      collection(db!, 'messages'),
      where('ownerId', '==', ownerId),
      where('contactId', '==', contactId),
    ),
  );

  for (let offset = 0; offset < relatedMessages.size; offset += 450) {
    const batch = writeBatch(db!);
    relatedMessages.docs
      .slice(offset, offset + 450)
      .forEach((message) => batch.update(message.ref, { recipientName }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

function checkScheduleWindow(scheduledAt: Date | null) {
  if (scheduledAt && scheduledAt.getTime() > Date.now() + MAX_SCHEDULE_MS)
    throw new Error('Agende para o futuro, em até 30 dias.');
}

export async function mutate(action: MutateAction, input: unknown) {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error('Entre para continuar.');

  if (functionsEnabled) {
    if (!functions) throw new Error('Configure o Firebase para continuar.');
    await httpsCallable(functions, 'mutate')({ action, input });
    return;
  }

  const ownerId = user.uid;
  const now = serverTimestamp();
  const data = input as MutateInput;
  const connections = collection(db, 'connections');
  const contacts = collection(db, 'contacts');
  const messages = collection(db, 'messages');

  const owned = (record: Record<string, unknown> | undefined) => {
    if (!record || record.ownerId !== ownerId)
      throw new Error('Registro não encontrado.');
    return record;
  };
  const removeContact =
    (deleteContact: boolean): Handler =>
    async ({ id }) => {
      const contactId = required(id, 'id');
      const ref = doc(contacts, contactId);
      const contact = owned((await getDoc(ref)).data());
      const relatedMessages = await getDocs(
        query(
          messages,
          where('ownerId', '==', ownerId),
          where('contactId', '==', contactId),
        ),
      );
      if (relatedMessages.size > 450)
        throw new Error(
          'Este contato tem muitas mensagens para apagar nesta operação.',
        );
      const batch = writeBatch(db);
      relatedMessages.docs.forEach((message) => batch.delete(message.ref));
      if (deleteContact) batch.delete(ref);
      else batch.update(ref, { updatedAt: now });
      batch.update(doc(connections, String(contact.connectionId)), { updatedAt: now });
      await batch.commit();
    };

  const handlers: Record<MutateAction, Handler> = {
    saveConnection: async ({ id, name }) => {
      const ref = id ? doc(connections, id) : doc(connections);
      await runTransaction(db, async (transaction) => {
        if (id) owned((await transaction.get(ref)).data());
        transaction.set(
          ref,
          {
            name: required(name, 'name').trim(),
            ownerId,
            updatedAt: now,
            ...(id ? {} : { createdAt: now }),
          },
          { merge: true },
        );
      });
    },

    deleteConnection: async ({ id }) => {
      const connectionId = required(id, 'id');
      const ref = doc(connections, connectionId);
      owned((await getDoc(ref)).data());
      const [relatedMessages, relatedContacts] = await Promise.all([
        getDocs(
          query(
            messages,
            where('ownerId', '==', ownerId),
            where('connectionId', '==', connectionId),
            limit(1),
          ),
        ),
        getDocs(
          query(
            contacts,
            where('ownerId', '==', ownerId),
            where('connectionId', '==', connectionId),
          ),
        ),
      ]);
      if (!relatedMessages.empty) {
        throw new Error('Apague as mensagens desta conexão antes de excluí-la.');
      }
      if (relatedContacts.size > 499) {
        throw new Error(
          'Esta conexão tem contatos demais para excluir nesta operação.',
        );
      }
      const batch = writeBatch(db);
      relatedContacts.docs.forEach((contact) => batch.delete(contact.ref));
      batch.delete(ref);
      await batch.commit();
    },

    saveContact: async ({ id, name, phone, connectionId }) => {
      const parentId = required(connectionId, 'connectionId');
      const parent = doc(connections, parentId);
      const ref = id ? doc(contacts, id) : doc(contacts);
      const nextName = required(name, 'name').trim();
      let previousName: string | undefined;
      await runTransaction(db, async (transaction) => {
        owned((await transaction.get(parent)).data());
        if (id) {
          const existing = owned((await transaction.get(ref)).data());
          if (existing.connectionId !== parentId) throw new Error('Conexão inválida.');
          previousName = String(existing.name);
        }
        transaction.set(
          ref,
          {
            ownerId,
            connectionId: parentId,
            name: nextName,
            phone: required(phone, 'phone').trim(),
            updatedAt: now,
            ...(id ? {} : { createdAt: now }),
          },
          { merge: true },
        );
        transaction.update(parent, { updatedAt: now });
      });
      if (id && previousName !== nextName)
        await syncMessageRecipientNames(ownerId, id, nextName);
    },

    deleteContact: removeContact(true),
    clearContactMessages: removeContact(false),

    createMessages: async ({ connectionId, contactIds, text, scheduledAt: raw }) => {
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
    },

    updateMessage: async ({ id, text, scheduledAt: raw }) => {
      const ref = doc(messages, required(id, 'id'));
      await runTransaction(db, async (transaction) => {
        const message = owned((await transaction.get(ref)).data());
        const scheduledAt =
          message.status === 'scheduled' && raw ? new Date(raw) : null;
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
    },

    deleteMessage: async ({ id }) => {
      const ref = doc(messages, required(id, 'id'));
      await runTransaction(db, async (transaction) => {
        const message = owned((await transaction.get(ref)).data());
        transaction.delete(ref);
        transaction.update(doc(contacts, String(message.contactId)), {
          updatedAt: now,
        });
        transaction.update(doc(connections, String(message.connectionId)), {
          updatedAt: now,
        });
      });
    },
  };

  await handlers[action](data);
}

export async function completeMessageIfDue(messageId: string, ownerId: string) {
  if (!db || auth?.currentUser?.uid !== ownerId) return;
  await runTransaction(db, async (transaction) => {
    const ref = doc(collection(db, 'messages'), messageId);
    const snapshot = await transaction.get(ref);
    const message = snapshot.data();
    if (
      !message ||
      message.ownerId !== ownerId ||
      auth.currentUser?.uid !== ownerId ||
      message.status !== 'scheduled' ||
      !message.scheduledAt ||
      message.scheduledAt.toMillis() > Date.now()
    )
      return;

    transaction.update(ref, {
      status: 'sent',
      scheduledAt: null,
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
