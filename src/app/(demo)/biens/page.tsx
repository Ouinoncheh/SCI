'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useDemo } from '@/ui/demo-context';
import { PageHeading, Empty } from '@/ui/shell';
import { PropertyCard } from '@/ui/property-card';
import { statusLabels } from '@/data/demo';
import { analyze } from '@/financial-engine';
export default function Properties() {
  const { items, persistent } = useDemo();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('ALL'),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [sort, setSort] = useState('default');
  const filtered = items
    .filter(
      (p) =>
        `${p.title} ${p.city} ${p.postcode}`
          .toLocaleLowerCase('fr')
          .includes(search.toLocaleLowerCase('fr')) &&
        (status === 'ALL' || p.status === status) &&
        (!onlyFavorites || p.favorite),
    )
    .sort((a, b) =>
      sort === 'price'
        ? a.investment.price - b.investment.price
        : sort === 'yield'
          ? analyze(b.investment).netYield - analyze(a.investment).netYield
          : 0,
    );
  return (
    <>
      <PageHeading
        eyebrow="EXPLORER & SÉLECTIONNER"
        title="Les biens à l’étude"
        description={
          persistent
            ? 'Votre carnet d’opportunités enregistré pour votre SCI.'
            : 'Votre carnet d’opportunités, partagé le temps de cette démonstration.'
        }
      />
      <div className="filterbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Rechercher un bien"
            placeholder="Ville, code postal, nom du bien…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrer par statut"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Tous les statuts</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="Trier les biens" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">Ordre d’ajout</option>
          <option value="price">Prix croissant</option>
          <option value="yield">Rendement net décroissant</option>
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => setOnlyFavorites(e.target.checked)}
          />
          Favoris
        </label>
      </div>
      <p className="muted">
        {filtered.length} bien{filtered.length > 1 ? 's' : ''} ·{' '}
        {persistent ? 'hypothèses saisies' : 'données fictives'} · résultats avant fiscalité
      </p>
      <div className="property-grid">
        {filtered.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
      {!filtered.length && (
        <Empty title="Aucun bien ne correspond" text="Modifiez votre recherche ou vos filtres." />
      )}
    </>
  );
}
