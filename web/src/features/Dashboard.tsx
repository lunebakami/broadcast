import { useCallback, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Add,
  ArrowForward,
  GraphicEq,
  HubOutlined,
  Logout,
  Search,
} from '@mui/icons-material';
import { useCollection } from '../hooks/useCollection';
import { useScheduledMessages } from '../hooks/useScheduledMessages';
import { auth } from '../lib/firebase';
import { errorText } from '../lib/errors';
import type { Connection, Notify } from '../lib/types';
import { EntityDialog } from '../components/EntityDialog';
import { EmptyState } from '../components/EmptyState';
import { Workspace } from './Workspace';

export function Dashboard({ user }: { user: User }) {
  const connections = useCollection<Connection>('connections', user.uid);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    severity: 'success' | 'error';
  } | null>(null);
  const notify: Notify = useCallback(
    (message, severity = 'success') => setToast({ message, severity }),
    [],
  );
  const active = connections.items.find((c) => c.id === selected);
  useScheduledMessages(user.uid, notify);
  const filtered = connections.items
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-10">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 text-2xl font-bold tracking-tight text-emerald-800"
          onClick={() => setSelected(null)}
          aria-label="Broadcast — início"
        >
          <GraphicEq fontSize="large" />
          broadcast.
        </button>
        <div className="flex items-center gap-3">
          <Avatar
            src={user.photoURL ?? undefined}
            className="!h-9 !w-9 !bg-emerald-100 !text-sm !text-emerald-800"
          >
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold">{user.displayName || 'Minha conta'}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <Tooltip title="Sair">
            <IconButton
              aria-label="Sair"
              onClick={() =>
                void signOut(auth!).catch((reason) =>
                  notify(errorText(reason), 'error'),
                )
              }
            >
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
        {connections.error && (
          <Alert severity="error" className="mb-6">
            {connections.error}
          </Alert>
        )}
        {connections.loading ? (
          <div className="py-24 text-center">
            <CircularProgress aria-label="Carregando conexões" />
          </div>
        ) : active ? (
          <Workspace
            key={active.id}
            connection={active}
            ownerId={user.uid}
            notify={notify}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Seu espaço de trabalho
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Suas conexões
                </h1>
                <p className="mt-3 text-sm text-slate-500">
                  Cada conexão reúne seus próprios contatos e mensagens.
                </p>
              </div>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreating(true)}
              >
                Nova conexão
              </Button>
            </div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-500">
                {connections.items.length}{' '}
                {connections.items.length === 1 ? 'conexão' : 'conexões'}
              </p>
              <TextField
                size="small"
                placeholder="Buscar conexão"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <Search className="mr-2 text-slate-400" fontSize="small" />
                    ),
                  },
                  htmlInput: { 'aria-label': 'Buscar conexão' },
                }}
              />
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                title={
                  connections.items.length
                    ? 'Nenhuma conexão encontrada'
                    : 'Crie sua primeira conexão'
                }
                description={
                  connections.items.length
                    ? 'Tente buscar por outro nome.'
                    : 'Dê um nome à sua conexão. Depois, adicione contatos e prepare sua primeira mensagem.'
                }
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((connection) => (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => setSelected(connection.id)}
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <div className="mb-7 flex items-center justify-between">
                      <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                        <HubOutlined />
                      </span>
                      <ArrowForward className="text-slate-300 group-hover:text-emerald-700" />
                    </div>
                    <h2 className="truncate text-lg font-semibold">
                      {connection.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Gerenciar contatos e mensagens
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-12 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              As alterações aparecem automaticamente em tempo real.
            </div>
          </>
        )}
      </main>
      {creating && (
        <EntityDialog
          kind="connection"
          notify={notify}
          onClose={() => setCreating(false)}
        />
      )}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity}
          onClose={() => setToast(null)}
          variant="filled"
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
