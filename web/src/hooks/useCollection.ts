import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { errorText } from '../lib/errors';

export function useCollection<T extends { id: string }>(
  name: string,
  ownerId: string,
  connectionId?: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setItems([]);
    setLoading(true);
    setError('');
    if (!db) return;
    const constraints = [where('ownerId', '==', ownerId)];
    if (connectionId) constraints.push(where('connectionId', '==', connectionId));
    return onSnapshot(
      query(collection(db, name), ...constraints),
      (snapshot) => {
        setItems(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as T));
        setLoading(false);
      },
      (reason) => {
        setError(errorText(reason));
        setLoading(false);
      },
    );
  }, [name, ownerId, connectionId]);
  return { items, loading, error };
}
