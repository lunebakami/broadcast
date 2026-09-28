import { useState } from 'react';
import {
  Avatar,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Add, MoreVert, Search } from '@mui/icons-material';
import type { Contact, Notify } from '../lib/types';
import { mutate } from '../lib/firebase';
import { ContactDialog } from '../components/ContactDialog';
import { ConfirmDialog, type Confirmation } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export function Contacts({
  contacts,
  connectionId,
  notify,
}: {
  contacts: Contact[];
  connectionId: string;
  notify: Notify;
}) {
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Contact | 'new' | null>(null);
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    contact: Contact;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const filtered = contacts
    .filter((c) =>
      `${c.name} ${c.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  function remove(contact: Contact, onlyMessages: boolean) {
    setMenu(null);
    setConfirm({
      title: onlyMessages ? 'Apagar todas as mensagens?' : `Excluir ${contact.name}?`,
      description: onlyMessages
        ? `Todas as mensagens enviadas e agendadas de ${contact.name} serão excluídas. Os demais contatos serão preservados.`
        : 'O contato e todas as suas mensagens enviadas e agendadas serão excluídos. Esta ação não pode ser desfeita.',
      action: async () => {
        await mutate(onlyMessages ? 'clearContactMessages' : 'deleteContact', {
          id: contact.id,
        });
        notify(onlyMessages ? 'Mensagens excluídas.' : 'Contato excluído.');
      },
    });
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <TextField
          size="small"
          placeholder="Buscar nome ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Buscar contatos' },
          }}
        />
        <Button variant="contained" startIcon={<Add />} onClick={() => setEdit('new')}>
          Novo contato
        </Button>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={
            contacts.length
              ? 'Nenhum contato encontrado'
              : 'Sua próxima conversa começa aqui'
          }
          description={
            contacts.length
              ? 'Tente buscar outro nome ou telefone.'
              : 'Adicione um contato para começar a enviar e agendar mensagens.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_1fr_48px] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Contato</span>
            <span>Telefone</span>
            <span />
          </div>
          {filtered.map((contact) => (
            <div
              key={contact.id}
              className="grid grid-cols-[1fr_1fr_48px] items-center gap-4 border-t border-slate-100 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="!bg-emerald-50 !text-emerald-800">
                  {contact.name[0]?.toUpperCase()}
                </Avatar>
                <span className="truncate text-sm font-semibold">{contact.name}</span>
              </div>
              <span className="break-all text-sm text-slate-500">{contact.phone}</span>
              <IconButton
                aria-label={`Ações de ${contact.name}`}
                onClick={(e) => setMenu({ anchor: e.currentTarget, contact })}
              >
                <MoreVert />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setEdit(menu!.contact);
            setMenu(null);
          }}
        >
          Editar contato
        </MenuItem>
        <MenuItem onClick={() => remove(menu!.contact, true)}>
          Apagar todas as mensagens
        </MenuItem>
        <MenuItem
          className="!text-red-700"
          onClick={() => remove(menu!.contact, false)}
        >
          Excluir contato
        </MenuItem>
      </Menu>
      {edit && (
        <ContactDialog
          entity={edit === 'new' ? undefined : edit}
          connectionId={connectionId}
          notify={notify}
          onClose={() => setEdit(null)}
        />
      )}
      <ConfirmDialog value={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
