import type { Metadata } from 'next';
import './globals.css';
import './modern.css';
export const metadata: Metadata = {
  title: 'PredictSCI · Votre patrimoine, ensemble',
  description:
    'Analyse immobilière familiale : financement, rendement et projections transparentes. Démonstration avec données fictives.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
