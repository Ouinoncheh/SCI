'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from './http';
type Mode = 'login' | 'register' | 'forgot' | 'reset';
export function AuthForm({ mode, localMail }: { mode: Mode; localMail: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const titles: Record<Mode, string> = {
    login: 'Retrouvons votre patrimoine.',
    register: 'Votre famille. Votre projet.',
    forgot: 'Retrouver votre accès.',
    reset: 'Un nouveau mot de passe.',
  };
  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        predict<span>SCI</span>
      </Link>
      <section className="panel auth-card">
        <div className="eyebrow">ESPACE FAMILIAL</div>
        <h1>{titles[mode]}</h1>
        <p>
          {mode === 'register'
            ? 'Créez votre compte, vérifiez votre email puis créez votre SCI.'
            : 'Accédez à vos biens et analyses enregistrés.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setMessage('');
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const email = String(f.get('email') ?? '')
                .trim()
                .toLowerCase(),
              password = String(f.get('password') ?? '');
            try {
              if (mode === 'login') {
                await api('/api/auth/sign-in/email', 'POST', {
                  email,
                  password,
                  rememberMe: false,
                });
                router.push('/espace');
                router.refresh();
              }
              if (mode === 'register') {
                await api('/api/auth/sign-up/email', 'POST', {
                  email,
                  password,
                  name: String(f.get('name')).trim(),
                  callbackURL: '/connexion',
                });
                setMessage(
                  'Si cette adresse peut être inscrite, un lien de vérification vous a été adressé. Vérifiez-la avant de vous connecter.',
                );
              }
              if (mode === 'forgot') {
                await api('/api/auth/request-password-reset', 'POST', {
                  email,
                  redirectTo: `${window.location.origin}/reinitialiser`,
                });
                setMessage(
                  'Si un compte correspond à cette adresse, un lien de réinitialisation vous a été adressé.',
                );
              }
              if (mode === 'reset') {
                const token = new URLSearchParams(window.location.search).get('token');
                if (!token) throw new Error('Lien invalide. Demandez un nouveau lien.');
                await api('/api/auth/reset-password', 'POST', { newPassword: password, token });
                window.history.replaceState({}, '', '/reinitialiser');
                setMessage('Mot de passe modifié. Vous pouvez vous reconnecter.');
              }
            } catch (err) {
              setError(
                mode === 'login'
                  ? 'Connexion impossible. Vérifiez vos identifiants et la validation de votre email.'
                  : err instanceof Error
                    ? err.message
                    : 'Une erreur est survenue.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === 'register' && (
            <label>
              Votre nom
              <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              Adresse email
              <input name="email" type="email" autoComplete="email" required maxLength={254} />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
              <input
                name="password"
                type="password"
                required
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode !== 'login' && (
                <small>12 caractères minimum. Utilisez un mot de passe unique.</small>
              )}
            </label>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="demo-notice" role="status">
              {message}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Veuillez patienter…'
              : mode === 'login'
                ? 'Se connecter'
                : mode === 'register'
                  ? 'Créer mon compte'
                  : mode === 'forgot'
                    ? 'Recevoir un lien'
                    : 'Modifier le mot de passe'}
          </button>
        </form>
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <Link href="/inscription">Créer un compte</Link>
              <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
            </>
          ) : (
            <Link href="/connexion">Revenir à la connexion</Link>
          )}
        </div>
        {localMail && (
          <p className="micro">
            Mode local : aucun email externe n’est envoyé. Les liens de vérification et de
            récupération sont enregistrés dans le dossier privé .local/mail du projet.
          </p>
        )}
      </section>
      <Link className="text-link" href="/">
        Explorer la démonstration →
      </Link>
    </main>
  );
}
