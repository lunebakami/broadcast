export type MutateAction =
  | 'saveConnection'
  | 'deleteConnection'
  | 'saveContact'
  | 'deleteContact'
  | 'clearContactMessages'
  | 'createMessages'
  | 'updateMessage'
  | 'deleteMessage';

export type MutateInput = {
  id?: string;
  name?: string;
  phone?: string;
  connectionId?: string;
  contactIds?: string[];
  text?: string;
  scheduledAt?: string | null;
};
