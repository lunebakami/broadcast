import { useEffect, useMemo, useState } from 'react';
import {
  MESSAGE_PAGE_SIZE,
  subscribeMessagePage,
  type MessageCursor,
  type MessagePage,
} from '../lib/messageQueries';
import { errorText } from '../lib/errors';

export function useMessagePage(
  ownerId: string,
  connectionId: string,
  status: string,
  contactId: string,
) {
  const filters = useMemo(
    () => ({ ownerId, connectionId, status, contactId }),
    [ownerId, connectionId, status, contactId],
  );
  const [cursors, setCursors] = useState<MessageCursor[]>([null]);
  const [result, setResult] = useState<MessagePage>({
    items: [],
    nextCursor: null,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const page = cursors.length;
  const cursor = cursors[page - 1];
  const pageCount = Math.ceil(result.totalCount / MESSAGE_PAGE_SIZE);
  const hasNextPage = page < pageCount && result.nextCursor !== null;

  useEffect(() => {
    setLoading(true);
    setError('');
    return subscribeMessagePage(
      filters,
      cursor,
      page,
      (nextResult) => {
        setResult(nextResult);
        setLoading(false);
      },
      (reason) => {
        setError(errorText(reason));
        setLoading(false);
      },
    );
  }, [filters, cursor, page]);

  function nextPage() {
    if (!loading && hasNextPage)
      setCursors((current) => [...current, result.nextCursor]);
  }

  function previousPage() {
    if (!loading && page > 1) setCursors((current) => current.slice(0, -1));
  }

  return {
    messages: result.items,
    totalCount: result.totalCount,
    loading,
    error,
    page,
    pageCount,
    hasPreviousPage: page > 1,
    hasNextPage,
    nextPage,
    previousPage,
    resetPage: () => setCursors([null]),
  };
}
