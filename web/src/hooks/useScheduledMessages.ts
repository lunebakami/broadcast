import { useEffect } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, functionsEnabled } from '../lib/firebase';
import { completeMessageIfDue } from '../lib/mutations/completeMessageIfDue';
import type { Notify } from '../lib/types';

const CHECK_INTERVAL_MS = 10000;
const BATCH_SIZE = 10;

export function useScheduledMessages(ownerId: string, notify: Notify) {
  useEffect(() => {
    if (functionsEnabled || !db) return;

    let active = true;
    let checking = false;

    async function processDueMessages() {
      if (!active || checking) return;
      checking = true;
      try {
        const dueSnapshot = await getDocs(
          query(
            collection(db!, 'messages'),
            where('ownerId', '==', ownerId),
            where('status', '==', 'scheduled'),
            where('scheduledAt', '<=', Timestamp.now()),
            orderBy('scheduledAt', 'asc'),
            limit(BATCH_SIZE),
          ),
        );
        await Promise.all(
          dueSnapshot.docs.map((document) =>
            completeMessageIfDue(document.id, ownerId).catch(() => {
              if (active)
                notify('Não foi possível atualizar uma mensagem agendada.', 'error');
            }),
          ),
        );
      } catch {
        if (active)
          notify('Não foi possível acompanhar as mensagens agendadas.', 'error');
      } finally {
        checking = false;
      }
    }

    void processDueMessages();
    const interval = window.setInterval(
      () => void processDueMessages(),
      CHECK_INTERVAL_MS,
    );
    window.addEventListener('focus', processDueMessages);
    document.addEventListener('visibilitychange', processDueMessages);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', processDueMessages);
      document.removeEventListener('visibilitychange', processDueMessages);
    };
  }, [ownerId, notify]);
}
