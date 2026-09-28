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

export async function mutate(action: string, input: unknown) {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error('Entre para continuar.');

  if (functionsEnabled) {
    if (!functions) throw new Error('Configure o Firebase para continuar.');
    await httpsCallable(functions, 'mutate')({ action, input });
    return;
  }

  const ownerId = user.uid;
  const now = serverTimestamp();
  const data = input as {
    id?: string;
    name?: string;
    phone?: string;
    connectionId?: string;
    contactIds?: string[];
    text?: string;
    scheduledAt?: string | null;
  };
  const connections = collection(db, 'connections');
  const contacts = collection(db, 'contacts');
  const messages = collection(db, 'messages');
  const owned = (record: Record<string, unknown> | undefined) => {
    if (!record || record.ownerId !== ownerId)
      throw new Error('Registro não encontrado.');
    return record;
  };

  if (action === 'saveConnection') {
    const ref = data.id ? doc(connections, data.id) : doc(connections);
    await runTransaction(db, async (transaction) => {
      if (data.id) owned((await transaction.get(ref)).data());
      transaction.set(
        ref,
        {
          name: data.name!.trim(),
          ownerId,
          updatedAt: now,
          ...(!data.id ? { createdAt: now } : {}),
        },
        { merge: true },
      );
    });
    return;
  }

  if (action === 'deleteConnection') {
    const ref = doc(connections, data.id!);
    owned((await getDoc(ref)).data());
    const [relatedMessages, relatedContacts] = await Promise.all([
      getDocs(
        query(
          messages,
          where('ownerId', '==', ownerId),
          where('connectionId', '==', data.id!),
          limit(1),
        ),
      ),
      getDocs(
        query(
          contacts,
          where('ownerId', '==', ownerId),
          where('connectionId', '==', data.id!),
        ),
      ),
    ]);
    if (!relatedMessages.empty) {
      throw new Error('Apague as mensagens desta conexão antes de excluí-la.');
    }
    if (relatedContacts.size > 499) {
      throw new Error('Esta conexão tem contatos demais para excluir nesta operação.');
    }
    const batch = writeBatch(db);
    relatedContacts.docs.forEach((contact) => batch.delete(contact.ref));
    batch.delete(ref);
    await batch.commit();
    return;
  }

  if (action === 'saveContact') {
    const parent = doc(connections, data.connectionId!);
    const ref = data.id ? doc(contacts, data.id) : doc(contacts);
    await runTransaction(db, async (transaction) => {
      owned((await transaction.get(parent)).data());
      if (data.id) {
        const existing = owned((await transaction.get(ref)).data());
        if (existing.connectionId !== data.connectionId)
          throw new Error('Conexão inválida.');
      }
      transaction.set(
        ref,
        {
          ownerId,
          connectionId: data.connectionId!,
          name: data.name!.trim(),
          phone: data.phone!.trim(),
          updatedAt: now,
          ...(!data.id ? { createdAt: now } : {}),
        },
        { merge: true },
      );
      transaction.update(parent, { updatedAt: now });
    });
    return;
  }

  if (action === 'deleteContact' || action === 'clearContactMessages') {
    const ref = doc(contacts, data.id!);
    const contact = owned((await getDoc(ref)).data());
    const relatedMessages = await getDocs(
      query(
        messages,
        where('ownerId', '==', ownerId),
        where('contactId', '==', data.id!),
      ),
    );
    if (relatedMessages.size > 450) {
      throw new Error('Este contato tem muitas mensagens para apagar nesta operação.');
    }
    const batch = writeBatch(db);
    relatedMessages.docs.forEach((message) => batch.delete(message.ref));
    if (action === 'deleteContact') batch.delete(ref);
    else batch.update(ref, { updatedAt: now });
    batch.update(doc(connections, String(contact.connectionId)), { updatedAt: now });
    await batch.commit();
    return;
  }

  if (action === 'createMessages') {
    const parent = doc(connections, data.connectionId!);
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (
      scheduledAt &&
      (scheduledAt <= new Date() || scheduledAt.getTime() > Date.now() + 30 * 86400000)
    ) {
      throw new Error('Agende para o futuro, em até 30 dias.');
    }
    for (const contactId of new Set(data.contactIds!)) {
      const ref = doc(contacts, contactId);
      // Each transaction stays below Firestore's rule-access limit for batches.
      // eslint-disable-next-line no-await-in-loop
      await runTransaction(db, async (transaction) => {
        owned((await transaction.get(parent)).data());
        const currentContact = owned((await transaction.get(ref)).data());
        if (currentContact.connectionId !== data.connectionId) {
          throw new Error('Contato de outra conexão.');
        }
        const message = doc(messages);
        transaction.set(message, {
          ownerId,
          connectionId: data.connectionId!,
          contactId: ref.id,
          recipientName: String(currentContact.name),
          recipientPhone: String(currentContact.phone),
          text: data.text!.trim(),
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
    return;
  }

  const ref = doc(messages, data.id!);
  await runTransaction(db, async (transaction) => {
    const message = owned((await transaction.get(ref)).data());
    if (action === 'deleteMessage') transaction.delete(ref);
    else {
      const scheduledAt =
        message.status === 'scheduled' && data.scheduledAt
          ? new Date(data.scheduledAt)
          : null;
      if (
        scheduledAt &&
        (scheduledAt <= new Date() ||
          scheduledAt.getTime() > Date.now() + 30 * 86400000)
      ) {
        throw new Error('Agende para o futuro, em até 30 dias.');
      }
      transaction.update(ref, {
        text: data.text!.trim(),
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
    }
    transaction.update(doc(contacts, String(message.contactId)), { updatedAt: now });
    transaction.update(doc(connections, String(message.connectionId)), {
      updatedAt: now,
    });
  });
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
