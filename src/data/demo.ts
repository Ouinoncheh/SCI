import type { Investment, Scenario } from '../financial-engine';
import type { ListingAttachment } from '../listing-providers/import-types';
import type { NormalizedProperty } from '../listing-providers/normalized';
import type { EnrichmentResult } from '../market-data/enrichment';
export type DemoProperty = {
  version?: number;
  address?: string | null;
  listing?: ListingAttachment;
  photoUrl?: string;
  importData?: { normalized: NormalizedProperty; enrichment: EnrichmentResult };
  id: string;
  title: string;
  city: string;
  district: string;
  postcode: string;
  rooms: number;
  dpe: string;
  status: string;
  favorite: boolean;
  color: string;
  description: string;
  investment: Investment;
};
// Explicit synthetic fixtures. These are not defaults for real acquisitions.
const fixture: Investment = {
  price: 160000,
  area: 60,
  acquisitionRate: 8,
  agencyFees: 0,
  works: 12000,
  contingencyRate: 10,
  furniture: 0,
  bankFees: 800,
  guaranteeFees: 2200,
  brokerFees: 1200,
  otherFees: 0,
  contribution: 45000,
  loanRate: 3.5,
  loanYears: 20,
  insuranceRate: 0.25,
  monthlyRent: 1050,
  vacancyRate: 5,
  propertyTax: 1100,
  condoCharges: 600,
  pno: 180,
  accounting: 650,
  maintenance: 350,
  otherExpenses: 0,
  managementRate: 6,
  gliRate: 2.5,
  reserveRate: 3,
};
export const properties: DemoProperty[] = [
  {
    id: 'marseille-vauban',
    title: 'Un balcon sur Vauban',
    city: 'Marseille',
    district: '6e · Vauban',
    postcode: '13006',
    rooms: 3,
    dpe: 'C',
    status: 'INTERESTING',
    favorite: true,
    color: 'terracotta',
    description:
      'Appartement fictif traversant, balcon et pièces lumineuses. Hypothèse de rafraîchissement léger. Aucune annonce réelle ni estimation de marché.',
    investment: { ...fixture, price: 178000, area: 63, monthlyRent: 1270, contribution: 80000 },
  },
  {
    id: 'angers-doutre',
    title: 'Le charme de la Doutre',
    city: 'Angers',
    district: 'La Doutre',
    postcode: '49100',
    rooms: 2,
    dpe: 'D',
    status: 'TO_ANALYZE',
    favorite: true,
    color: 'sage',
    description:
      'T2 fictif dans un immeuble ancien. Un cas de rendement intermédiaire avec des charges à surveiller.',
    investment: {
      ...fixture,
      price: 145000,
      area: 46,
      monthlyRent: 830,
      works: 7000,
      contribution: 40000,
    },
  },
  {
    id: 'lyon-croix-rousse',
    title: 'L’atelier des Canuts',
    city: 'Lyon',
    district: '4e · Croix-Rousse',
    postcode: '69004',
    rooms: 2,
    dpe: 'D',
    status: 'VISIT_PLANNED',
    favorite: false,
    color: 'blue',
    description:
      'Bien fictif illustrant un cash-flow négatif malgré un apport conséquent. Aucun potentiel de plus-value n’est garanti.',
    investment: {
      ...fixture,
      price: 265000,
      area: 52,
      monthlyRent: 1120,
      works: 5000,
      contribution: 55000,
      condoCharges: 1000,
    },
  },
  {
    id: 'saint-etienne-centre',
    title: 'Une nouvelle histoire',
    city: 'Saint-Étienne',
    district: 'Centre-ville',
    postcode: '42000',
    rooms: 4,
    dpe: 'F',
    status: 'NEW',
    favorite: false,
    color: 'sand',
    description:
      'Grand appartement fictif à rénover. Le budget travaux est important ; la valeur après rénovation et la possibilité de location restent à vérifier.',
    investment: {
      ...fixture,
      price: 89000,
      area: 84,
      monthlyRent: 1050,
      works: 48000,
      contribution: 40000,
      vacancyRate: 10,
      maintenance: 800,
    },
  },
];
export const scenarioFixtures: Scenario[] = [
  {
    name: 'Prudent',
    priceGrowth: -1,
    rentGrowth: 0,
    expenseGrowth: 3,
    vacancyRate: 10,
    saleFeeRate: 5,
    futureWorks: [{ year: 10, amount: 10000 }],
  },
  {
    name: 'Central',
    priceGrowth: 1,
    rentGrowth: 1,
    expenseGrowth: 2,
    vacancyRate: 5,
    saleFeeRate: 5,
    futureWorks: [{ year: 10, amount: 5000 }],
  },
  {
    name: 'Optimiste',
    priceGrowth: 2,
    rentGrowth: 2,
    expenseGrowth: 1.5,
    vacancyRate: 3,
    saleFeeRate: 5,
    futureWorks: [],
  },
];
export const statusLabels: Record<string, string> = {
  NEW: 'Nouveau',
  TO_ANALYZE: 'À analyser',
  INTERESTING: 'Intéressant',
  VISIT_PLANNED: 'Visite prévue',
  OFFER: 'Offre',
  NEGOTIATION: 'Négociation',
  REJECTED: 'Écarté',
  PURCHASED: 'Acquis',
};
