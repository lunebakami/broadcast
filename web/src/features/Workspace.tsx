import { useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tab,
  Tabs,
} from '@mui/material';
import {
  ArrowBack,
  DeleteOutline,
  EditOutlined,
  PeopleOutline,
  ForumOutlined,
  Schedule,
} from '@mui/icons-material';
import { useCollection } from '../hooks/useCollection';
import { useMessageCounts } from '../hooks/useMessageCounts';
import type { Connection, Contact, Notify } from '../lib/types';
import { Contacts } from './Contacts';
import { Messages } from './Messages';
import { ConnectionDialog } from '../components/ConnectionDialog';
import { ConfirmDialog, type Confirmation } from '../components/ConfirmDialog';
import { mutate } from '../lib/firebase';

export function Workspace({
  connection,
  ownerId,
  onBack,
  notify,
}: {
  connection: Connection;
  ownerId: string;
  onBack: () => void;
  notify: Notify;
}) {
  const contacts = useCollection<Contact>('contacts', ownerId, connection.id);
  const messageCounts = useMessageCounts(ownerId, connection.id);
  const [tab, setTab] = useState('messages');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);

  const stats = [
    {
      label: 'Contatos',
      count: contacts.items.length,
      icon: <PeopleOutline />,
    },
    {
      label: 'Enviadas',
      count: messageCounts.sent,
      icon: <ForumOutlined />,
    },
    {
      label: 'Agendadas',
      count: messageCounts.scheduled,
      icon: <Schedule />,
    },
  ];
  return (
    <>
      <Button startIcon={<ArrowBack />} onClick={onBack} className="!mb-5">
        Todas as conexões
      </Button>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Sua conexão
            </p>
            <Chip size="small" label="Tempo real" color="success" variant="outlined" />
          </div>
          <h1 className="break-words text-3xl font-semibold tracking-tight">
            {connection.name}
          </h1>
        </div>
        <div className="flex">
          <IconButton aria-label="Editar conexão" onClick={() => setEditing(true)}>
            <EditOutlined />
          </IconButton>
          <IconButton
            aria-label="Excluir conexão"
            onClick={() =>
              setConfirm({
                title: 'Excluir conexão?',
                description:
                  'A conexão e seus contatos serão excluídos. Esta ação só é permitida quando não houver mensagens nesta conexão.',
                action: async () => {
                  await mutate('deleteConnection', { id: connection.id });
                  notify('Conexão excluída.');
                  onBack();
                },
              })
            }
          >
            <DeleteOutline />
          </IconButton>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5"
          >
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              {stat.icon}
            </span>
            <div>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>
      {(contacts.error || messageCounts.error) && (
        <Alert severity="error" className="mb-5">
          {contacts.error || messageCounts.error}
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={(_, value: string) => setTab(value)}
        className="mb-6 border-b border-slate-200"
      >
        <Tab value="messages" label="Mensagens" />
        <Tab value="contacts" label="Contatos" />
      </Tabs>
      {contacts.loading ? (
        <div className="py-20 text-center">
          <CircularProgress aria-label="Carregando dados" />
        </div>
      ) : tab === 'contacts' ? (
        <Contacts
          contacts={contacts.items}
          connectionId={connection.id}
          notify={notify}
        />
      ) : (
        <Messages
          ownerId={ownerId}
          contacts={contacts.items}
          connectionId={connection.id}
          notify={notify}
        />
      )}
      {editing && (
        <ConnectionDialog
          entity={connection}
          notify={notify}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog value={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
