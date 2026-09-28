import type { FieldValue } from 'firebase-admin/firestore';

export type MutationContext = { ownerId: string; now: FieldValue };
export type MutationResult = { id: string } | { ok: true };
export type MutationHandler = (
  context: MutationContext,
  input: unknown,
) => Promise<MutationResult>;
