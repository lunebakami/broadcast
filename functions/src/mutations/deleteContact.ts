import type { MutationContext } from './types';
import { removeContact } from './removeContact';

export function deleteContact(context: MutationContext, input: unknown) {
  return removeContact(context, input, true);
}
