import { useState } from 'react';
import type { AuthState } from '../auth/useAuth';

// Discreet corner control: visitors see a small "Entrar como admin" link, admins see who
// they're signed in as. Someone who signs in with a non-admin Google account is told so
// (and stays read-only) instead of silently seeing nothing change.
export function AdminBar({ auth }: { auth: AuthState }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await auth.signIn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-bar">
      {!auth.user && (
        <button type="button" className="btn btn--link admin-bar-link" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Entrando…' : '🔑 Entrar como admin'}
        </button>
      )}
      {auth.user && (
        <>
          <span className="admin-bar-user">
            {auth.isAdmin ? '🛠️ Admin' : '👀 Sem permissão de edição'} · {auth.user.email}
          </span>
          <button type="button" className="btn btn--link admin-bar-link" onClick={() => auth.signOut()}>
            Sair
          </button>
        </>
      )}
      {error && <span className="admin-bar-error">{error}</span>}
    </div>
  );
}
