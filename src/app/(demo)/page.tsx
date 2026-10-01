'use client';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Heart,
  Info,
  Layers3,
  SlidersHorizontal,
} from 'lucide-react';
import { analyze, project } from '@/financial-engine';
import { scenarioFixtures } from '@/data/demo';
import { opportunityScore } from '@/opportunity-engine';
import { useDemo } from '@/ui/demo-context';
import { euro, pct } from '@/ui/format';
import { PageHeading } from '@/ui/shell';
import { PropertyCard } from '@/ui/property-card';
import { ProjectionChart } from '@/ui/charts';
export default function Dashboard() {
  const { items, basePath, persistent, workspace } = useDemo();
  if (!items.length)
    return (
      <>
        <PageHeading
          eyebrow="VOTRE ESPACE FAMILIAL"
          title="Construisons votre patrimoine."
          description="Vos biens et vos analyses seront enregistrés dans votre SCI."
          action={Boolean(workspace?.sci)}
        />
        <section className="empty">
          <h2>
            {workspace?.sci ? 'Aucun bien à l’étude pour le moment' : 'Créez votre première SCI'}
          </h2>
          <p>
            {workspace?.sci
              ? 'Ajoutez un bien pour commencer votre analyse.'
              : 'Donnez un nom à votre SCI et invitez votre famille.'}
          </p>
          <Link
            className="button primary"
            href={workspace?.sci ? `${basePath}/biens/nouveau` : `${basePath}/famille`}
          >
            {workspace?.sci ? 'Ajouter un bien' : 'Créer une SCI'}
          </Link>
        </section>
      </>
    );
  const favorites = items.filter((p) => p.favorite);
  const ranked = [...items].sort(
    (a, b) =>
      (opportunityScore(b.investment, b.dpe).score ?? 0) -
      (opportunityScore(a.investment, a.dpe).score ?? 0),
  );
  const selected = favorites.length ? favorites : items.slice(0, 1);
  const rows = selected.map((p) => project(p.investment, scenarioFixtures[1]));
  const combined = rows[0].map((r, i) => ({
    year: r.year,
    value: rows.reduce((s, x) => s + x[i].value, 0),
    equity: rows.reduce((s, x) => s + x[i].equity, 0),
    balance: rows.reduce((s, x) => s + x[i].balance, 0),
  }));
  const avg = items.reduce((s, p) => s + analyze(p.investment).netYield, 0) / items.length;
  return (
    <>
      <PageHeading
        eyebrow="VOTRE PATRIMOINE COMMENCE ICI"
        title="Une vision claire. Des choix éclairés."
        description="Explorez, comparez et construisez votre prochain investissement en famille."
      />
      <div className="demo-notice">
        <Info size={16} />
        <span>
          {persistent
            ? 'Vos biens et analyses sont enregistrés. Les résultats restent des simulations avant fiscalité.'
            : 'Bienvenue dans votre espace de démonstration. Les biens et les membres sont fictifs ; les calculs sont réels.'}
        </span>
        <Link href={`${basePath}/hypotheses`}>
          Voir les hypothèses <ArrowUpRight size={14} />
        </Link>
      </div>
      <section className="stats-grid" aria-label="Indicateurs des biens étudiés">
        <div className="stat">
          <div className="stat-label">
            Biens étudiés <Building2 size={17} />
          </div>
          <strong>{String(items.length).padStart(2, '0')}</strong>
          <small>
            <span className="tiny-dot" />
            {items.filter((p) => ['NEW', 'TO_ANALYZE'].includes(p.status)).length} biens à analyser
          </small>
        </div>
        <div className="stat">
          <div className="stat-label">
            Dans vos favoris <Heart size={17} />
          </div>
          <strong>{String(favorites.length).padStart(2, '0')}</strong>
          <small>Votre sélection familiale</small>
        </div>
        <div className="stat">
          <div className="stat-label">
            Rendement net moyen <ArrowUpRight size={17} />
          </div>
          <strong>{pct(avg)}</strong>
          <small>Sur le coût total · avant impôt</small>
        </div>
        <div className="stat accent">
          <div className="stat-label">
            Budget des favoris <Layers3 size={17} />
          </div>
          <strong>
            {euro(favorites.reduce((s, p) => s + analyze(p.investment).totalCost, 0))}
          </strong>
          <small>Coût projet simulé · non investi</small>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>
            Vos prochaines opportunités <span className="count">{items.length}</span>
          </h2>
          <p>Une sélection à explorer, des décisions à partager.</p>
        </div>
        <Link className="text-link" href={`${basePath}/biens`}>
          Tous les biens <ArrowRight size={16} />
        </Link>
      </div>
      <div className="property-grid">
        {ranked.slice(0, 3).map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="panel projection-panel">
          <div className="panel-heading">
            <div>
              <h2>Et demain, votre patrimoine ?</h2>
              <p>
                Projection des {favorites.length ? 'favoris' : 'premier bien'} · scénario central
                fictif
              </p>
            </div>
            <span className="pill">25 ans</span>
          </div>
          <div className="projection-summary">
            <strong>{euro(combined[19].equity)}</strong>
            <span>
              d’équité simulée à 20 ans <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="brown" />
              Équité
            </span>
            <span>
              <i className="sage" />
              Valeur estimée
            </span>
            <span>
              <i className="gray" />
              Dette restante
            </span>
          </div>
          <ProjectionChart data={combined} compact />
          <p className="micro">
            Équité = valeur estimée − dette. Avant frais de vente et fiscalité. Aucun rendement
            garanti.
          </p>
        </section>
        <section className="panel next-steps">
          <div className="panel-heading">
            <div>
              <h2>Votre prochaine étape</h2>
              <p>Chaque décision commence par une question.</p>
            </div>
          </div>
          <Link href={`${basePath}/comparateur`} className="step">
            <span className="step-icon">
              <Layers3 size={20} />
            </span>
            <div>
              <strong>Comparer vos favoris</strong>
              <small>Les mêmes indicateurs, côte à côte.</small>
            </div>
            <ChevronRight size={17} />
          </Link>
          <Link href={`${basePath}/biens/${items[0].id}`} className="step">
            <span className="step-icon">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <strong>Affiner votre financement</strong>
              <small>Mesurez l’effet de votre apport.</small>
            </div>
            <ChevronRight size={17} />
          </Link>
          <Link href={`${basePath}/hypotheses`} className="step">
            <span className="step-icon">
              <ArrowDownRight size={20} />
            </span>
            <div>
              <strong>Comprendre les risques</strong>
              <small>Des hypothèses à vérifier ensemble.</small>
            </div>
            <ChevronRight size={17} />
          </Link>
          <div className="family-note">
            <span>LE SAVIEZ-VOUS ?</span>
            <p>
              Un rendement attractif ne garantit pas un cash-flow positif. Comparez aussi l’effort
              d’épargne.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
