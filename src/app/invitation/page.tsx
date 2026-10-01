'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/ui/http';
export default function Invitation() {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <h1>Rejoindre votre SCI</h1>
        <p>
          Connectez-vous avec l’adresse vérifiée à laquelle cette invitation est destinée, puis
          acceptez-la. Le lien est valable sept jours et une seule fois.
        </p>
        <div className="auth-links">
          <Link href="/connexion" target="_blank" rel="noopener">
            Se connecter dans un nouvel onglet
          </Link>
          <Link href="/inscription" target="_blank" rel="noopener">
            Créer un compte
          </Link>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const token = window.location.hash.slice(1);
              const result = await api<{ sciId: string }>(
                '/api/workspace/invitations/accept',
                'POST',
                { token },
              );
              await api('/api/workspace/active-sci', 'POST', { sciId: result.sciId });
              window.location.replace('/espace/famille');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Invitation invalide.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Accepter l’invitation
        </button>
        {message && (
          <p role="alert" className="error">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
