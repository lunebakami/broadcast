import { useEffect, useState } from 'react';
import { countMessages } from '../lib/messageQueries';
import { errorText } from '../lib/errors';

const REFRESH_INTERVAL_MS = 15000;

export function useMessageCounts(ownerId: string, connectionId: string) {
  const [counts, setCounts] = useState({ sent: 0, scheduled: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const filters = { ownerId, connectionId, contactId: 'all' };

    async function refresh() {
      try {
        const [sent, scheduled] = await Promise.all([
          countMessages({ ...filters, status: 'sent' }),
          countMessages({ ...filters, status: 'scheduled' }),
        ]);
        if (active) {
          setCounts({ sent, scheduled });
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
  }, [ownerId, connectionId]);

  return { ...counts, error };
}
