import type { MutationContext } from './types';
import { removeContact } from './removeContact';

export function clearContactMessages(context: MutationContext, input: unknown) {
  return removeContact(context, input, false);
}
