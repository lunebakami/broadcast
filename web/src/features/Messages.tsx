import { useState } from 'react';
import {
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Add, MoreVert, Schedule, DoneAll } from '@mui/icons-material';
import type { Contact, Message, Notify } from '../lib/types';
import { MessageDialog } from './MessageDialog';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog, type Confirmation } from '../components/ConfirmDialog';
import { mutate } from '../lib/firebase';

function happenedAt(message: Message) {
  const { status, scheduledAt, sentAt, createdAt } = message;
  return (status === 'scheduled' ? scheduledAt : sentAt) ?? createdAt;
}

export function Messages({
  messages,
  contacts,
  connectionId,
  notify,
}: {
  messages: Message[];
  contacts: Contact[];
  connectionId: string;
  notify: Notify;
}) {
  const [status, setStatus] = useState('all');
  const [contactId, setContactId] = useState('all');
  const [search, setSearch] = useState('');
  // null = closed, undefined = creating.
  const [edit, setEdit] = useState<Message | null | undefined>(null);
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    message: Message;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const filtered = messages
    .filter(
      (m) =>
        (status === 'all' || m.status === status) &&
        (contactId === 'all' || m.contactId === contactId) &&
        `${m.text} ${m.recipientName}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) => (happenedAt(b)?.toMillis() ?? 0) - (happenedAt(a)?.toMillis() ?? 0),
    );
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={status}
          onChange={(_, value: string | null) => {
            if (value) setStatus(value);
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
          label="Buscar mensagem ou contato"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TextField
          select
          size="small"
          label="Contato"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
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
      {filtered.length === 0 ? (
        <EmptyState
          title={
            messages.length
              ? 'Nenhuma mensagem encontrada'
              : 'Espaço para novas conversas'
          }
          description={
            messages.length
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
