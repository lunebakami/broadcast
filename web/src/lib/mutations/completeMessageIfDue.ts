import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function completeMessageIfDue(messageId: string, ownerId: string) {
  if (!db || auth?.currentUser?.uid !== ownerId) return;
  const ref = doc(db, 'messages', messageId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const message = snapshot.data();
    if (
      !message ||
      message.ownerId !== ownerId ||
      auth?.currentUser?.uid !== ownerId ||
      message.status !== 'scheduled' ||
      !message.scheduledAt ||
      message.scheduledAt.toMillis() > Date.now()
    )
      return;

    transaction.update(ref, {
      status: 'sent',
      scheduledAt: null,
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
