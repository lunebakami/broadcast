import { useEffect, useMemo, useState } from 'react';
import {
  MESSAGE_PAGE_SIZE,
  subscribeMessagePage,
  type MessageCursor,
  type MessagePage,
} from '../lib/messageQueries';
import { errorText } from '../lib/errors';
import { useMessageTotal } from './useMessageTotal';

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
  const [result, setResult] = useState<MessagePage>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const totals = useMessageTotal(filters);
  const page = cursors.length;
  const cursor = cursors[page - 1];
  const pageCount = Math.ceil(totals.totalCount / MESSAGE_PAGE_SIZE);
  const hasNextPage = page < pageCount && result.nextCursor !== null;

  useEffect(() => {
    setLoading(true);
    setError('');
    return subscribeMessagePage(
      filters,
      cursor,
      (nextResult) => {
        setResult(nextResult);
        setLoading(false);
      },
      (reason) => {
        setError(errorText(reason));
        setLoading(false);
      },
    );
  }, [filters, cursor]);

  function nextPage() {
    if (!loading && hasNextPage)
      setCursors((current) => [...current, result.nextCursor]);
  }

  function previousPage() {
    if (!loading && page > 1) setCursors((current) => current.slice(0, -1));
  }

  return {
    messages: result.items,
    totalCount: totals.totalCount,
    loading,
    error: error || totals.error,
    page,
    pageCount,
    hasPreviousPage: page > 1,
    hasNextPage,
    nextPage,
    previousPage,
    resetPage: () => setCursors([null]),
  };
}
