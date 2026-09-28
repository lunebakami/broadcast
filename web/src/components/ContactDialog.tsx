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
import type { Contact, Notify } from '../lib/types';

export function ContactDialog({
  entity,
  connectionId,
  onClose,
  notify,
}: {
  entity?: Contact;
  connectionId: string;
  onClose: () => void;
  notify: Notify;
}) {
  const [name, setName] = useState(entity?.name ?? '');
  const [phone, setPhone] = useState(entity?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await mutate('saveContact', {
        ...(entity ? { id: entity.id } : {}),
        name,
        phone,
        connectionId,
      });
      notify(entity ? 'Alterações salvas.' : 'Contato criada.');
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
        <DialogTitle>{entity ? 'Editar' : 'Novo'} contato</DialogTitle>
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
          <TextField
            label="Telefone"
            type="tel"
            placeholder="+55 85 99999-9999"
            helperText="Inclua o DDD e, se necessário, o código do país."
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 25, minLength: 8 } }}
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
