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
  type QuerySnapshot,
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
export type MessagePage = {
  items: Message[];
  nextCursor: MessageCursor;
  totalCount: number;
};

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

async function resolveMessagePage(
  snapshot: QuerySnapshot<DocumentData>,
  filters: MessageFilters,
  page: number,
): Promise<MessagePage> {
  const fullPage = snapshot.size === MESSAGE_PAGE_SIZE;
  const totalCount = fullPage
    ? await countMessages(filters)
    : (page - 1) * MESSAGE_PAGE_SIZE + snapshot.size;
  return {
    items: snapshot.docs.map(
      (document) => ({ ...document.data(), id: document.id }) as Message,
    ),
    nextCursor:
      fullPage && page * MESSAGE_PAGE_SIZE < totalCount
        ? snapshot.docs[snapshot.docs.length - 1]
        : null,
    totalCount,
  };
}

export function subscribeMessagePage(
  filters: MessageFilters,
  cursor: MessageCursor,
  page: number,
  onChange: (page: MessagePage) => void,
  onError: (error: Error) => void,
) {
  const pageQuery = query(
    messageQuery(filters),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(MESSAGE_PAGE_SIZE),
  );
  let revision = 0;
  const unsubscribe = onSnapshot(
    pageQuery,
    (snapshot) => {
      revision += 1;
      const currentRevision = revision;
      resolveMessagePage(snapshot, filters, page)
        .then((result) => {
          if (revision === currentRevision) onChange(result);
        })
        .catch((reason: Error) => {
          if (revision === currentRevision) onError(reason);
        });
    },
    (reason) => {
      revision += 1;
      onError(reason);
    },
  );
  return () => {
    revision += 1;
    unsubscribe();
  };
}
