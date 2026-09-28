import { useEffect, useState } from 'react';
import { countMessages, type MessageFilters } from '../lib/messageQueries';
import { errorText } from '../lib/errors';

const REFRESH_INTERVAL_MS = 15000;

export function useMessageTotal(filters: MessageFilters) {
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const count = await countMessages(filters);
        if (active) {
          setTotalCount(count);
          setError('');
        }
      } catch (reason) {
        if (active) setError(errorText(reason));
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [filters]);

  return { totalCount, error };
}
