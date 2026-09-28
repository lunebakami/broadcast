import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { completeMessageIfDue, db, functionsEnabled } from '../lib/firebase';
import type { Message, Notify } from '../lib/types';

export function useScheduledMessages(ownerId: string, notify: Notify) {
  useEffect(() => {
    if (functionsEnabled || !db) return;

    let active = true;
    let messages: Message[] = [];
    const pending = new Set<string>();
    const reportedErrors = new Set<string>();

    function processDueMessages() {
      if (!active) return;
      messages.forEach((message) => {
        if (
          !message.scheduledAt ||
          message.scheduledAt.toMillis() > Date.now() ||
          pending.has(message.id)
        )
          return;

        pending.add(message.id);
        void completeMessageIfDue(message.id, ownerId)
          .then(() => reportedErrors.delete(message.id))
          .catch(() => {
            if (active && !reportedErrors.has(message.id)) {
              reportedErrors.add(message.id);
              notify('Não foi possível atualizar uma mensagem agendada.', 'error');
            }
          })
          .finally(() => pending.delete(message.id));
      });
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'messages'),
        where('ownerId', '==', ownerId),
        where('status', '==', 'scheduled'),
      ),
      (snapshot) => {
        messages = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as Message,
        );
        processDueMessages();
      },
      () => notify('Não foi possível acompanhar as mensagens agendadas.', 'error'),
    );

    // Checks the cached snapshot; the timer does not poll Firestore.
    const interval = window.setInterval(processDueMessages, 1000);
    window.addEventListener('focus', processDueMessages);
    document.addEventListener('visibilitychange', processDueMessages);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', processDueMessages);
      document.removeEventListener('visibilitychange', processDueMessages);
    };
  }, [ownerId, notify]);
}
