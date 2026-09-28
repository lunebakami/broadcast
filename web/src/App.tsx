import { Alert, CircularProgress } from '@mui/material';
import { configured } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { AuthPage } from './features/AuthPage';
import { Dashboard } from './features/Dashboard';

export default function App() {
  const { user, loading } = useAuth();
  if (!configured)
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 p-6">
        <h1 className="text-3xl font-semibold text-emerald-800">broadcast.</h1>
        <Alert severity="info">Configure o Firebase para começar.</Alert>
        <p className="text-slate-600">
          Copie <code>web/.env.example</code> para <code>web/.env.local</code>, preencha
          os dados do seu aplicativo Firebase e reinicie o Vite. O README contém as
          instruções de publicação das funções e regras.
        </p>
      </main>
    );
  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <CircularProgress aria-label="Carregando sessão" />
      </main>
    );
  return user ? <Dashboard key={user.uid} user={user} /> : <AuthPage />;
}
