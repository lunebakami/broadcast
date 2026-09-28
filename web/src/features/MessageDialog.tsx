import { useState, type SubmitEvent } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import { SendOutlined } from '@mui/icons-material';
import type { Contact, Message, Notify } from '../lib/types';
import { mutate } from '../lib/firebase';
import { errorText } from '../lib/errors';
import { DEFAULT_LEAD_MS, MAX_SCHEDULE_MS } from '../lib/schedule';

function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const SUBMIT_LABELS = {
  edit: 'Salvar alterações',
  schedule: 'Agendar',
  send: 'Enviar agora',
} as const;
const NOTIFY_LABELS = {
  edit: 'Mensagem atualizada.',
  schedule: 'Mensagens agendadas.',
  send: 'Envio simulado concluído.',
} as const;
function submitIntent(
  message: Message | undefined,
  scheduled: boolean,
): keyof typeof SUBMIT_LABELS {
  if (message) return 'edit';
  if (scheduled) return 'schedule';
  return 'send';
}

export function MessageDialog({
  message,
  contacts,
  connectionId,
  onClose,
  notify,
}: {
  message?: Message;
  contacts: Contact[];
  connectionId: string;
  onClose: () => void;
  notify: Notify;
}) {
  const [selected, setSelected] = useState<Contact[]>([]);
  const [text, setText] = useState(message?.text ?? '');
  const [scheduled, setScheduled] = useState(message?.status === 'scheduled');
  const [date, setDate] = useState(
    localDate(message?.scheduledAt?.toDate() ?? new Date(Date.now() + DEFAULT_LEAD_MS)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (
        scheduled &&
        (!date ||
          new Date(date).getTime() <= Date.now() ||
          new Date(date).getTime() > Date.now() + MAX_SCHEDULE_MS)
      )
        throw new Error('Escolha um horário futuro, em até 30 dias.');
      const scheduledAt = scheduled ? new Date(date).toISOString() : null;
      await mutate(message ? 'updateMessage' : 'createMessages', {
        ...(message
          ? { id: message.id }
          : { connectionId, contactIds: selected.map((c) => c.id) }),
        text,
        scheduledAt,
      });
      notify(NOTIFY_LABELS[submitIntent(message, scheduled)]);
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
      maxWidth="sm"
    >
      <form onSubmit={submit}>
        <DialogTitle>{message ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
        <DialogContent className="flex flex-col gap-5 !pt-3">
          {error && <Alert severity="error">{error}</Alert>}
          {message ? (
            <p className="text-sm text-slate-500">
              Para <strong>{message.recipientName}</strong> · {message.recipientPhone}
            </p>
          ) : (
            <Autocomplete
              multiple
              options={contacts}
              getOptionLabel={(c) => `${c.name} · ${c.phone}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={selected}
              onChange={(_, value) => setSelected(value)}
              disabled={busy}
              noOptionsText="Nenhum contato disponível"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Destinatários"
                  placeholder="Selecione os contatos"
                  helperText={`${selected.length} selecionado(s) · até 100 por envio`}
                />
              )}
            />
          )}
          <TextField
            label="Mensagem"
            multiline
            minRows={5}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 5000 } }}
            helperText={`${text.length}/5000 caracteres`}
          />
          {message?.status !== 'sent' && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduled}
                    onChange={(e) => setScheduled(e.target.checked)}
                    disabled={busy}
                  />
                }
                label="Agendar envio"
              />
              {scheduled && (
                <TextField
                  label="Data e horário"
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={busy}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      min: localDate(new Date()),
                      max: localDate(new Date(Date.now() + MAX_SCHEDULE_MS)),
                    },
                  }}
                  helperText="Horário local do seu dispositivo. Até 30 dias de antecedência."
                />
              )}
            </>
          )}
          <Alert severity="info">
            {message?.status === 'sent'
              ? 'A edição atualiza o registro. Nenhuma nova mensagem será enviada.'
              : 'Este é um envio simulado. Nenhuma mensagem real será disparada.'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            type="submit"
            startIcon={<SendOutlined />}
            disabled={
              busy ||
              !text.trim() ||
              (!message && (!selected.length || selected.length > 100))
            }
          >
            {busy ? 'Salvando…' : SUBMIT_LABELS[submitIntent(message, scheduled)]}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
