import { useEffect, useState } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { errorText } from '../lib/errors';

const REFRESH_INTERVAL_MS = 15000;

export function useMessageCounts(ownerId: string, connectionId: string) {
  const [counts, setCounts] = useState({ sent: 0, scheduled: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) return;

    let active = true;
    const baseConstraints = [
      where('ownerId', '==', ownerId),
      where('connectionId', '==', connectionId),
    ];

    async function refresh() {
      try {
        const [sent, scheduled] = await Promise.all([
          getCountFromServer(
            query(
              collection(db!, 'messages'),
              ...baseConstraints,
              where('status', '==', 'sent'),
            ),
          ),
          getCountFromServer(
            query(
              collection(db!, 'messages'),
              ...baseConstraints,
              where('status', '==', 'scheduled'),
            ),
          ),
        ]);
        if (active) {
          setCounts({
            sent: sent.data().count,
            scheduled: scheduled.data().count,
          });
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
