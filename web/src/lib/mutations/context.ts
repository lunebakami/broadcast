import { collection, serverTimestamp, type Firestore } from 'firebase/firestore';

export function createMutationContext(db: Firestore, ownerId: string) {
  function owned(record: Record<string, unknown> | undefined) {
    if (!record || record.ownerId !== ownerId)
      throw new Error('Registro não encontrado.');
    return record;
  }
  return {
    db,
    ownerId,
    now: serverTimestamp(),
    connections: collection(db, 'connections'),
    contacts: collection(db, 'contacts'),
    messages: collection(db, 'messages'),
    owned,
  };
}
export type MutationContext = ReturnType<typeof createMutationContext>;
