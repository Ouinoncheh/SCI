import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Cette page n’existe pas</h1>
      <Link className="button" href="/">
        Revenir au tableau de bord
      </Link>
    </div>
  );
}
