import { getFunctions } from 'firebase-admin/functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { db, region } from './firebase';

// Firestore retries bridge a temporary queue failure without losing the schedule.
export const enqueueMessage = onDocumentWritten(
  { document: 'messages/{messageId}', retry: true },
  async (event) => {
    const message = event.data?.after.data();
    if (!message || message.status !== 'scheduled') return;
    if (event.data?.before.get('revision') === message.revision) return;
    const queue = getFunctions().taskQueue(
      `locations/${region}/functions/deliverMessage`,
    );
    try {
      await queue.enqueue(
        { messageId: event.params.messageId, revision: message.revision },
        {
          id: `${event.params.messageId}_${message.revision}`,
          scheduleTime: message.scheduledAt.toDate(),
        },
      );
    } catch (error) {
      if ((error as { code?: string }).code !== 'functions/task-already-exists')
        throw error;
    }
  },
);

export const deliverMessage = onTaskDispatched<{
  messageId: string;
  revision: string;
}>(
  {
    invoker: 'private',
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 10 },
    rateLimits: { maxConcurrentDispatches: 10 },
  },
  async (request) => {
    const { messageId, revision } = request.data;
    const ref = db.collection('messages').doc(messageId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const message = snapshot.data();
      // Also makes redelivery idempotent and invalidates deleted/edited messages.
      if (!message || message.status !== 'scheduled' || message.revision !== revision)
        return;
      if ((message.scheduledAt as Timestamp).toMillis() > Date.now())
        throw new Error('Agendamento ainda não venceu.');
      tx.update(ref, {
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  },
);
