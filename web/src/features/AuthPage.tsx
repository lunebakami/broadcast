import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { Google, GraphicEq } from '@mui/icons-material';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { errorText } from '../lib/errors';

export function AuthPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth!, new GoogleAuthProvider());
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#123e35] p-14 text-white lg:flex">
        <div className="flex items-center gap-3 text-2xl font-bold">
          <GraphicEq fontSize="large" /> broadcast
          <span className="text-emerald-300">.</span>
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="mb-6 text-xs font-semibold tracking-[0.24em] text-emerald-200">
            CADA CONEXÃO, UMA CONVERSA
          </p>
          <h1 className="text-6xl font-semibold leading-[1.12] tracking-tight">
            Suas mensagens.
            <br />
            No momento
            <br />
            <span className="text-emerald-300">certo.</span>
          </h1>
          <p className="mt-8 max-w-sm text-lg leading-relaxed text-emerald-50/70">
            Organize seus contatos e planeje suas próximas conversas em um só lugar.
          </p>
        </div>
        <p className="relative z-10 text-sm text-emerald-100/60">
          Seu espaço. Suas conexões.
        </p>
        <div className="absolute -right-52 bottom-8 h-[550px] w-[550px] rounded-full border-[70px] border-white/5" />
      </section>
      <section className="flex items-center justify-center bg-[#f7f9f7] px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-12 flex items-center gap-2 text-xl font-bold text-emerald-800 lg:hidden">
            <GraphicEq /> broadcast.
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">
            Vamos conversar
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Entre no Broadcast
          </h2>
          <p className="mb-8 mt-3 text-sm text-slate-500">
            Entre ou crie sua conta usando sua conta Google.
          </p>
          {error && (
            <Alert severity="error" className="mb-4">
              {error}
            </Alert>
          )}
          <Button
            fullWidth
            size="large"
            variant="outlined"
            startIcon={<Google />}
            disabled={busy}
            onClick={() => void signIn()}
          >
            {busy ? 'Aguarde…' : 'Continuar com Google'}
          </Button>
        </div>
      </section>
    </main>
  );
}
