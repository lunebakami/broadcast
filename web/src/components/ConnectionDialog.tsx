import { useState, type SubmitEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { mutate } from '../lib/firebase';
import { errorText } from '../lib/errors';
import type { Connection, Notify } from '../lib/types';

export function ConnectionDialog({
  entity,
  onClose,
  notify,
}: {
  entity?: Connection;
  onClose: () => void;
  notify: Notify;
}) {
  const [name, setName] = useState(entity?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await mutate('saveConnection', {
        ...(entity ? { id: entity.id } : {}),
        name,
      });
      notify(entity ? 'Alterações salvas.' : 'Conexão criada.');
      onClose();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={submit}>
        <DialogTitle>{entity ? 'Editar' : 'Nova'} conexão</DialogTitle>
        <DialogContent className="flex flex-col gap-5 !pt-3">
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="Nome"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            disabled={busy}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="contained" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
