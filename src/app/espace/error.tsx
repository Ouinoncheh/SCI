'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>Chargement impossible</h1>
      <p>Vérifiez la disponibilité de PostgreSQL puis réessayez.</p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
