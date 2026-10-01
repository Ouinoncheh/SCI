'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from './http';
type Mode = 'login' | 'register' | 'forgot' | 'reset';
export function AuthForm({
  mode,
  localMail,
  googleEnabled = false,
  googleError = false,
}: {
  mode: Mode;
  localMail: boolean;
  googleEnabled?: boolean;
  googleError?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(
      googleError
        ? 'La connexion Google n’a pas abouti. Réessayez ou connectez-vous avec votre email.'
        : '',
    ),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
            ? googleEnabled
              ? 'Créez votre compte avec Google ou votre email, puis créez votre SCI.'
              : 'Créez votre compte, vérifiez votre email puis créez votre SCI.'
            : 'Accédez à vos biens et analyses enregistrés.'}
        </p>
        {googleEnabled && (mode === 'login' || mode === 'register') && (
          <div className="auth-social">
            <button
              type="button"
              className="button secondary"
              disabled={busy || googleBusy}
              aria-busy={googleBusy}
              onClick={async () => {
                setError('');
                setMessage('');
                setGoogleBusy(true);
                try {
                  const result = await api<{ url: string }>('/api/auth/sign-in/social', 'POST', {
                    provider: 'google',
                    callbackURL: '/espace',
                    errorCallbackURL: mode === 'register' ? '/inscription' : '/connexion',
                    disableRedirect: true,
                  });
                  const destination = new URL(result.url);
                  if (destination.origin !== 'https://accounts.google.com')
                    throw new Error('Invalid provider URL');
                  window.location.assign(destination.href);
                } catch {
                  setError(
                    'La connexion Google est indisponible. Réessayez ou utilisez votre email.',
                  );
                  setGoogleBusy(false);
                }
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
                style={{ flexShrink: 0 }}
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>
              {googleBusy ? 'Connexion à Google…' : 'Continuer avec Google'}
            </button>
            <p className="micro">ou avec votre adresse email</p>
          </div>
        )}
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
          <button className="button primary" disabled={busy || googleBusy}>
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
