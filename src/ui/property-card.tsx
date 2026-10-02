'use client';
import Link from 'next/link';
import { ArrowUpRight, Heart, MapPin } from 'lucide-react';
import { analyze } from '@/financial-engine';
import { opportunityScore } from '@/opportunity-engine';
import { type DemoProperty, statusLabels } from '@/data/demo';
import { useDemo } from './demo-context';
import { euro, pct } from './format';
import { PropertyPhoto } from './property-photo';
export function PropertyCard({ property: p }: { property: DemoProperty }) {
  const a = analyze(p.investment),
    score = opportunityScore(p.investment, p.dpe);
  const { toggleFavorite, basePath, busy, persistent } = useDemo();
  return (
    <article className="property-card">
      <div className="card-image">
        <Link href={`${basePath}/biens/${p.id}`} tabIndex={-1} aria-hidden="true">
          <PropertyPhoto
            url={p.photoUrl ?? p.listing?.photos[0]}
            title={p.title}
            variant={p.color}
            synthetic={!persistent}
          />
        </Link>
        <span className={`status ${p.status === 'INTERESTING' ? 'green' : ''}`}>
          {statusLabels[p.status]}
        </span>
        <button
          disabled={busy}
          className={`favorite ${p.favorite ? 'selected' : ''}`}
          aria-label={`${p.favorite ? 'Retirer des' : 'Ajouter aux'} favoris : ${p.title}`}
          aria-pressed={p.favorite}
          onClick={() => toggleFavorite(p.id)}
        >
          <Heart size={16} fill={p.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="card-body">
        <div className="location">
          <MapPin size={12} />
          {p.city} · {p.district}
        </div>
        <Link className="card-title" href={`${basePath}/biens/${p.id}`}>
          {p.title}
          <ArrowUpRight size={18} />
        </Link>
        <div className="property-meta">
          {p.rooms ? `T${p.rooms}` : 'Pièces indisponibles'} <span>·</span> {p.investment.area} m²{' '}
          <span>·</span> DPE <b className={`dpe ${p.dpe.toLowerCase()}`}>{p.dpe}</b>
        </div>
        <div className="card-price">
          {euro(p.investment.price)}
          <small>{euro(p.investment.price / p.investment.area)} / m²</small>
        </div>
        <div className="card-metrics">
          <div>
            <small>Rendement net</small>
            <strong>{p.investment.rentPending ? 'À estimer' : pct(a.netYield)}</strong>
          </div>
          <div>
            <small>Cash-flow / mois</small>
            <strong className={a.cashFlowMonthly >= 0 ? 'positive' : 'negative'}>
              {a.cashFlowMonthly >= 0 ? '+' : ''}
              {euro(a.cashFlowMonthly)}
            </strong>
          </div>
        </div>
        <div className="card-bottom">
          <span>
            Score partiel{' '}
            <b>
              {score.score}
              <small>/100</small>
            </b>
          </span>
          <Link href={`${basePath}/biens/${p.id}`}>
            Voir l’analyse <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
