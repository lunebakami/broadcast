import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export function owned(snapshot: DocumentSnapshot, ownerId: string) {
  if (!snapshot.exists || snapshot.get('ownerId') !== ownerId) {
    throw new HttpsError('not-found', 'Registro não encontrado.');
  }
  return snapshot.data()!;
}
