'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/ui/demo-context';
import { api } from '@/ui/http';
import { PageHeading } from '@/ui/shell';
export default function Profile() {
  const { workspace } = useDemo();
  const router = useRouter();
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="VOTRE COMPTE"
        title="Vos informations personnelles"
        description="Votre identité et vos accès à PredictSCI."
        action={false}
      />
      <section className="panel">
        <h2>Profil</h2>
        <p>{workspace?.user.email} · adresse vérifiée</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            try {
              await api('/api/auth/update-user', 'POST', {
                name: String(new FormData(e.currentTarget).get('name')).trim(),
              });
              setMessage('Profil enregistré.');
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Erreur.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="profile-field">
            Nom affiché
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={workspace?.user.name}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Enregistrer le profil
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Changer de mot de passe</h2>
        <p>Vos autres sessions seront révoquées.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            setBusy(true);
            setError('');
            setMessage('');
            try {
              await api('/api/auth/change-password', 'POST', {
                currentPassword: String(f.get('currentPassword')),
                newPassword: String(f.get('newPassword')),
                revokeOtherSessions: true,
              });
              form.reset();
              setMessage('Mot de passe modifié.');
            } catch {
              setError('Modification impossible. Vérifiez votre mot de passe actuel.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Mot de passe actuel
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Nouveau mot de passe
              <input
                name="newPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>
          <button className="button" disabled={busy}>
            Modifier mon mot de passe
          </button>
        </form>
      </section>
      {message && (
        <p className="positive" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
