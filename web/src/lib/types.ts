import type { Timestamp } from 'firebase/firestore';

export type Connection = { id: string; name: string; ownerId: string };
export type Contact = {
  id: string;
  name: string;
  phone: string;
  connectionId: string;
  ownerId: string;
};
export type Message = {
  id: string;
  contactId: string;
  connectionId: string;
  ownerId: string;
  text: string;
  recipientName: string;
  recipientPhone: string;
  status: 'sent' | 'scheduled';
  scheduledAt: Timestamp | null;
  sentAt: Timestamp | null;
  createdAt: Timestamp | null;
};
export type Notify = (message: string, severity?: 'success' | 'error') => void;
