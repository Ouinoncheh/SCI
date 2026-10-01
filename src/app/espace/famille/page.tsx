'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/ui/demo-context';
import { api } from '@/ui/http';
import { euro } from '@/ui/format';
import { PageHeading } from '@/ui/shell';
export default function Family() {
  const { workspace } = useDemo();
  const router = useRouter();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [invitation, setInvitation] = useState('');
  const sci = workspace?.sci;
  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }
  const actions: Record<string, string> = {
    SCI_CREATED: 'SCI créée',
    PROPERTY_CREATED: 'Bien ajouté',
    ANALYSIS_SAVED: 'Analyse enregistrée',
    STATUS_CHANGED: 'Statut modifié',
    PROPERTY_UPDATED: 'Caractéristiques modifiées',
    ROOM_CREATED: 'Pièce ajoutée',
    ROOM_PHOTO_ADDED: 'Photo de pièce ajoutée',
    INVITATION_CREATED: 'Invitation créée',
    MEMBER_JOINED: 'Membre ajouté',
    COMMENT_ADDED: 'Commentaire ajouté',
    VOTE_CHANGED: 'Vote enregistré',
    VOTE_REMOVED: 'Vote retiré',
  };
  return (
    <>
      <PageHeading
        eyebrow="CONSTRUIRE ENSEMBLE"
        title="Votre SCI, votre famille."
        description="Gérez vos espaces, vos parts et les accès des membres."
        action={false}
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {Boolean(workspace?.scis.length) && (
        <section className="panel">
          <label className="status-select">
            SCI active
            <select
              aria-label="SCI active"
              disabled={busy}
              value={sci?.id ?? ''}
              onChange={(e) =>
                run(async () => {
                  await api('/api/workspace/active-sci', 'POST', { sciId: e.target.value });
                  router.refresh();
                })
              }
            >
              {workspace?.scis.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name} · {s.role}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {sci && (
        <section className="panel">
          <h2>{sci.name}</h2>
          <p>
            Capital : {euro(sci.capital)} ·{' '}
            {sci.taxRegime === 'SCI_IR' ? 'SCI à l’IR' : 'SCI à l’IS'} · fiscalité non simulée
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Parts</th>
                </tr>
              </thead>
              <tbody>
                {sci.members.map((m) => (
                  <tr key={m.id}>
                    <th>{m.user.name}</th>
                    <td>{m.user.email}</td>
                    <td>{m.role}</td>
                    <td>{m.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="micro">
            ADMIN : création d’invitations et modification des biens. MEMBER : modification des
            biens. VIEWER : lecture et favoris personnels. Les parts saisies décrivent la
            répartition ; elles ne modifient pas les calculs fiscaux.
          </p>
        </section>
      )}
      {sci && workspace?.role === 'ADMIN' && (
        <section className="panel">
          <h2>Inviter un membre</h2>
          <p>Créez un lien destiné à une adresse précise. Vous pourrez le transmettre vous-même.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                const data = await api<{ url: string }>(
                  `/api/workspace/scis/${sci.id}/invitations`,
                  'POST',
                  {
                    email: String(f.get('email')),
                    role: String(f.get('role')),
                    shares: Number(f.get('shares')),
                  },
                );
                setInvitation(data.url);
                router.refresh();
              });
            }}
          >
            <div className="form-grid">
              <label>
                Email du membre
                <input name="email" type="email" required />
              </label>
              <label>
                Rôle
                <select name="role" defaultValue="MEMBER">
                  <option>ADMIN</option>
                  <option>MEMBER</option>
                  <option>VIEWER</option>
                </select>
              </label>
              <label>
                Nombre de parts
                <input
                  name="shares"
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1"
                  required
                  defaultValue="0"
                />
              </label>
            </div>
            <button className="button primary" disabled={busy}>
              Créer le lien d’invitation
            </button>
          </form>
          {invitation && (
            <div className="invitation-result" role="status">
              <label>
                Lien à transmettre
                <input readOnly value={invitation} onFocus={(e) => e.target.select()} />
              </label>
              <p>
                Valable sept jours, une seule fois, uniquement pour l’adresse vérifiée du
                destinataire.
              </p>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <h2>Créer une SCI</h2>
        <p>Un nouvel espace privé, sans données de démonstration.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              const data = await api<{ id: string }>('/api/workspace/scis', 'POST', {
                name: String(f.get('name')),
                capital: Number(f.get('capital')),
                taxRegime: String(f.get('taxRegime')),
                shares: Number(f.get('shares')),
              });
              await api('/api/workspace/active-sci', 'POST', { sciId: data.id });
              router.refresh();
            });
          }}
        >
          <div className="form-grid">
            <label>
              Nom de la SCI
              <input name="name" required minLength={2} maxLength={100} />
            </label>
            <label>
              Capital (€)
              <input type="number" name="capital" required min="0" max="10000000000" step=".01" />
            </label>
            <label>
              Régime fiscal
              <select name="taxRegime">
                <option value="SCI_IR">SCI à l’IR</option>
                <option value="SCI_IS">SCI à l’IS</option>
              </select>
            </label>
            <label>
              Vos parts initiales
              <input name="shares" type="number" min="1" max="1000000000" step="1" required />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            Créer la SCI
          </button>
        </form>
      </section>
      {sci && (
        <section className="panel">
          <h2>Historique des opérations</h2>
          <ul className="activity-list">
            {sci.activities.map((a) => (
              <li key={a.id}>
                <strong>{actions[a.action] ?? a.action}</strong>
                <time>
                  {new Date(a.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
