'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  Columns3,
  House,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useDemo } from './demo-context';
import { api } from './http';
const links = [
  { href: '/', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/biens', label: 'Les biens', icon: House },
  { href: '/comparateur', label: 'Comparateur', icon: Columns3 },
  { href: '/hypotheses', label: 'Hypothèses & sources', icon: ChartNoAxesCombined },
];
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, persistent, basePath, error, busy } = useDemo();
  const sciName = workspace?.sci?.name ?? (persistent ? 'Votre espace' : 'Les Horizons');
  const navigation = persistent
    ? [
        ...links,
        { href: '/famille', label: 'SCI & membres', icon: Users },
        { href: '/profil', label: 'Mon profil', icon: ShieldCheck },
        { href: '/notifications', label: 'Notifications', icon: Users },
      ]
    : links;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={basePath || '/'} className="brand">
          <span className="brand-icon">
            <Building2 size={22} />
          </span>
          predict<span>SCI</span>
          <i />
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Building2 size={19} aria-hidden="true" />
          </span>
          <div>
            <strong>{sciName}</strong>
            <small>
              {persistent
                ? (workspace?.role ?? 'Créez votre SCI')
                : 'SCI familiale · Démonstration'}
            </small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">VOTRE ESPACE</div>
        <nav aria-label="Navigation principale">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={basePath + (href === '/' ? '' : href) || '/'}
              aria-current={
                (
                  href === '/'
                    ? pathname === (basePath || '/')
                    : pathname.startsWith(basePath + href)
                )
                  ? 'page'
                  : undefined
              }
              className={
                (
                  href === '/'
                    ? pathname === (basePath || '/')
                    : pathname.startsWith(basePath + href)
                )
                  ? 'active'
                  : ''
              }
            >
              <Icon size={19} />
              {label}
              {href === '/biens' && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <Sparkles size={20} />
          </div>
          <strong>
            Investir ensemble.
            <br />
            Décider en confiance.
          </strong>
          <p>
            Des hypothèses visibles.
            <br />
            Des décisions éclairées.
          </p>
          <Link href={`${basePath}/hypotheses`}>
            Comprendre les calculs <ArrowUpRight size={14} />
          </Link>
        </div>
        {!persistent && (
          <div className="family">
            <div className="avatars">
              <span>CL</span>
              <span>TM</span>
              <span>LD</span>
            </div>
            <div>
              <strong>Votre cercle familial</strong>
              <small>3 membres fictifs</small>
            </div>
          </div>
        )}
        <div className="sidebar-bottom">
          <ShieldCheck size={16} />
          {persistent ? 'Données enregistrées · accès par SCI' : 'Espace de démonstration'}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Espace familial <span>/</span> <strong>{sciName}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span />
              {persistent ? (busy ? 'Enregistrement…' : 'Espace connecté') : 'Données fictives'}
            </span>
            {persistent ? (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await api('/api/auth/sign-out', 'POST', {});
                    router.push('/connexion');
                    router.refresh();
                  } catch {
                    window.alert('Déconnexion impossible. Réessayez.');
                  }
                }}
              >
                Déconnexion
              </button>
            ) : (
              <Link className="button" href="/connexion">
                Se connecter
              </Link>
            )}
          </div>
        </header>
        <main>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {children}
        </main>
        <footer>
          <span>PredictSCI · Construisons votre patrimoine, ensemble.</span>
          <span>Simulations avant fiscalité · Version 0.3</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: boolean;
}) {
  const { basePath, canEdit } = useDemo();
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && canEdit && (
        <Link className="button primary" href={`${basePath}/biens/nouveau`}>
          <Plus size={17} />
          Ajouter un bien
        </Link>
      )}
    </div>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Users size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
