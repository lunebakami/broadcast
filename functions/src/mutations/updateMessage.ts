import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { messageInput, scheduleDate } from '../validation';
import { withMessage } from './withMessage';
import type { MutationContext, MutationResult } from './types';

export async function updateMessage(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  const { now } = context;
  return withMessage(context, raw, (tx, ref, message) => {
    const data = messageInput.parse(raw);
    const scheduledAt =
      message.status === 'scheduled' ? scheduleDate(data.scheduledAt) : null;
    tx.update(ref, {
      text: data.text,
      updatedAt: now,
      revision: randomUUID(),
      ...(message.status === 'scheduled'
        ? {
            scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
            status: scheduledAt ? 'scheduled' : 'sent',
            sentAt: scheduledAt ? null : now,
          }
        : {}),
    });
  });
}
