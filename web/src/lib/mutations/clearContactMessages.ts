import type { MutationContext } from './context';
import type { MutateInput } from './types';
import { removeContact } from './removeContact';

export function clearContactMessages(context: MutationContext, input: MutateInput) {
  return removeContact(context, input, false);
}
