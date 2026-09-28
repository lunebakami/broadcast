import { withMessage } from './withMessage';
import type { MutationContext, MutationResult } from './types';

export async function deleteMessage(
  context: MutationContext,
  raw: unknown,
): Promise<MutationResult> {
  return withMessage(context, raw, (tx, ref) => {
    tx.delete(ref);
  });
}
