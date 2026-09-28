import {
  collection,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Message } from './types';

export const MESSAGE_PAGE_SIZE = 10;
export type MessageCursor = QueryDocumentSnapshot<DocumentData> | null;
export type MessageFilters = {
  ownerId: string;
  connectionId: string;
  status: string;
  contactId: string;
};
export type MessagePage = { items: Message[]; nextCursor: MessageCursor };

function messageQuery({ ownerId, connectionId, status, contactId }: MessageFilters) {
  if (!db) throw new Error('Configure o Firebase para continuar.');
  const filters = [
    where('ownerId', '==', ownerId),
    where('connectionId', '==', connectionId),
  ];
  if (status !== 'all') filters.push(where('status', '==', status));
  if (contactId !== 'all') filters.push(where('contactId', '==', contactId));
  return query(collection(db, 'messages'), ...filters);
}

export async function countMessages(filters: MessageFilters) {
  const snapshot = await getCountFromServer(messageQuery(filters));
  return snapshot.data().count;
}

export function subscribeMessagePage(
  filters: MessageFilters,
  cursor: MessageCursor,
  onChange: (page: MessagePage) => void,
  onError: (error: Error) => void,
) {
  const pageQuery = query(
    messageQuery(filters),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(MESSAGE_PAGE_SIZE),
  );
  return onSnapshot(
    pageQuery,
    (snapshot) =>
      onChange({
        items: snapshot.docs.map(
          (document) => ({ ...document.data(), id: document.id }) as Message,
        ),
        nextCursor:
          snapshot.size === MESSAGE_PAGE_SIZE
            ? snapshot.docs[snapshot.docs.length - 1]
            : null,
      }),
    onError,
  );
}
