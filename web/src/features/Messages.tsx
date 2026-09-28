import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Add, MoreVert, Schedule, DoneAll } from '@mui/icons-material';
import {
  collection,
  DocumentData,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  QueryDocumentSnapshot,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db, mutate } from '../lib/firebase';
import { errorText } from '../lib/errors';
import type { Contact, Message, Notify } from '../lib/types';
import { ConfirmDialog, type Confirmation } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MessageDialog } from './MessageDialog';

const PAGE_SIZE = 10;

function happenedAt(message: Message) {
  const { status, scheduledAt, sentAt, createdAt } = message;
  return (status === 'scheduled' ? scheduledAt : sentAt) ?? createdAt;
}

export function Messages({
  ownerId,
  contacts,
  connectionId,
  notify,
}: {
  ownerId: string;
  contacts: Contact[];
  connectionId: string;
  notify: Notify;
}) {
  const [status, setStatus] = useState('all');
  const [contactId, setContactId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<
    Array<QueryDocumentSnapshot<DocumentData> | null>
  >([null]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null = closed, undefined = creating.
  const [edit, setEdit] = useState<Message | null | undefined>(null);
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    message: Message;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const cursor = cursors[page - 1];
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    setError('');
    const constraints = [
      where('ownerId', '==', ownerId),
      where('connectionId', '==', connectionId),
    ];
    if (status !== 'all') constraints.push(where('status', '==', status));
    if (contactId !== 'all') constraints.push(where('contactId', '==', contactId));
    const messagesQuery = query(
      collection(db, 'messages'),
      ...constraints,
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE),
    );
    const countQuery = query(collection(db, 'messages'), ...constraints);
    let active = true;
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (!active) return;
        setMessages(
          snapshot.docs.map(
            (document) => ({ ...document.data(), id: document.id }) as Message,
          ),
        );
        setLoading(false);
        if (snapshot.size === PAGE_SIZE) {
          setCursors((current) => {
            const lastDocument = snapshot.docs[snapshot.docs.length - 1];
            if (current[page]?.ref.path === lastDocument.ref.path) return current;
            const next = [...current];
            next[page] = lastDocument;
            return next;
          });
        }
      },
      (reason) => {
        if (!active) return;
        setError(errorText(reason));
        setLoading(false);
      },
    );
    async function refreshCount() {
      try {
        const snapshot = await getCountFromServer(countQuery);
        if (active) setTotalCount(snapshot.data().count);
      } catch (reason) {
        if (active) setError(errorText(reason));
      }
    }
    void refreshCount();
    const countInterval = window.setInterval(() => void refreshCount(), 15000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(countInterval);
    };
  }, [ownerId, connectionId, status, contactId, page, cursor]);

  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const currentMessages = messages.map((message) => ({
    ...message,
    recipientName: contactNames.get(message.contactId) ?? message.recipientName,
  }));
  const filtered = currentMessages
    .filter(
      (m) =>
        (status === 'all' || m.status === status) &&
        (contactId === 'all' || m.contactId === contactId) &&
        `${m.text} ${m.recipientName}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) => (happenedAt(b)?.toMillis() ?? 0) - (happenedAt(a)?.toMillis() ?? 0),
    );
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const hasPreviousPage = page > 1;
  const hasNextPage = page < pageCount;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={status}
          onChange={(_, value: string | null) => {
            if (value) {
              setStatus(value);
              setPage(1);
              setCursors([null]);
            }
          }}
          aria-label="Status das mensagens"
        >
          <ToggleButton value="all">Todas</ToggleButton>
          <ToggleButton value="sent">Enviadas</ToggleButton>
          <ToggleButton value="scheduled">Agendadas</ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled={!contacts.length}
          onClick={() => setEdit(undefined)}
        >
          Nova mensagem
        </Button>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <TextField
          size="small"
          label="Buscar nesta página"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          select
          size="small"
          label="Contato"
          value={contactId}
          onChange={(e) => {
            setContactId(e.target.value);
            setPage(1);
            setCursors([null]);
          }}
          className="min-w-48"
        >
          <MenuItem value="all">Todos os contatos</MenuItem>
          {contacts.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </div>
      {!contacts.length && (
        <p className="mb-4 text-sm text-slate-500">
          Adicione um contato na aba Contatos para criar uma mensagem.
        </p>
      )}
      {error && (
        <Alert severity="error" className="mb-5">
          {error}
        </Alert>
      )}
      {loading ? (
        <div className="py-16 text-center">
          <CircularProgress aria-label="Carregando mensagens" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            totalCount ? 'Nenhuma mensagem encontrada' : 'Espaço para novas conversas'
          }
          description={
            totalCount
              ? 'Ajuste os filtros para encontrar suas mensagens.'
              : 'Crie uma mensagem e escolha entre enviar agora ou agendar para depois.'
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((message) => (
            <article
              key={message.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{message.recipientName}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {message.recipientPhone}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Chip
                    size="small"
                    color={message.status === 'sent' ? 'success' : 'warning'}
                    variant="outlined"
                    icon={message.status === 'sent' ? <DoneAll /> : <Schedule />}
                    label={message.status === 'sent' ? 'Enviada' : 'Agendada'}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Ações da mensagem para ${message.recipientName}`}
                    onClick={(e) => setMenu({ anchor: e.currentTarget, message })}
                  >
                    <MoreVert />
                  </IconButton>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                {message.text}
              </p>
              <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {message.status === 'scheduled'
                  ? 'Agendada para '
                  : 'Envio simulado em '}
                {happenedAt(message)?.toDate().toLocaleString('pt-BR') ?? '—'}
              </p>
            </article>
          ))}
        </div>
      )}
      {pageCount > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <Button
              disabled={!hasPreviousPage || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-500">
              Página {page} de {pageCount}
            </span>
            <Button
              disabled={!hasNextPage || loading || !cursors[page]}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
          <p className="text-xs text-slate-500">{totalCount} mensagens no filtro</p>
        </div>
      )}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setEdit(menu!.message);
            setMenu(null);
          }}
        >
          Editar mensagem
        </MenuItem>
        <MenuItem
          className="!text-red-700"
          onClick={() => {
            const { message } = menu!;
            setMenu(null);
            setConfirm({
              title: 'Excluir mensagem?',
              description: `A mensagem para ${message.recipientName} será excluída. Se estiver agendada, não será processada.`,
              action: async () => {
                await mutate('deleteMessage', { id: message.id });
                notify('Mensagem excluída.');
              },
            });
          }}
        >
          Excluir mensagem
        </MenuItem>
      </Menu>
      {edit !== null && (
        <MessageDialog
          message={edit}
          contacts={contacts}
          connectionId={connectionId}
          notify={notify}
          onClose={() => setEdit(null)}
        />
      )}
      <ConfirmDialog value={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
