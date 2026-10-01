export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'USER_PROVIDED';
export type SourcedValue = {
  value: number | null;
  source: string;
  observedAt: string;
  zone: string;
  confidence: Confidence;
  updatedAt: string;
};
export interface MarketDataProvider {
  id: string;
  pricePerSquareMeter(postcode: string): Promise<SourcedValue | null>;
  monthlyRentPerSquareMeter(postcode: string): Promise<SourcedValue | null>;
}
export class RentalEstimator {
  estimate(area: number, rent: SourcedValue | null) {
    if (!Number.isFinite(area) || area <= 0) throw new Error('Surface invalide');
    return rent?.value != null
      ? { monthlyRent: area * rent.value, source: rent, low: null, high: null }
      : null;
  }
}
