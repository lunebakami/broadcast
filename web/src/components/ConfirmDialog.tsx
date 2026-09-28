import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { errorText } from '../lib/errors';

export type Confirmation = {
  title: string;
  description: string;
  action: () => Promise<void>;
};
export function ConfirmDialog({
  value,
  onClose,
}: {
  value: Confirmation | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      await value.action();
      onClose();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={Boolean(value)}
      onClose={() => {
        if (!busy) {
          setError('');
          onClose();
        }
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{value?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{value?.description}</DialogContentText>
        {error && (
          <Alert severity="error" className="mt-4">
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          disabled={busy}
          onClick={() => {
            setError('');
            onClose();
          }}
        >
          Cancelar
        </Button>
        <Button color="error" variant="contained" disabled={busy} onClick={confirm}>
          {busy ? 'Excluindo…' : 'Confirmar exclusão'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
