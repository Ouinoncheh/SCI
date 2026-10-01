# Architecture et plan technique

La première livraison est maintenant suivie d’une itération persistante : PostgreSQL, comptes Better Auth et autorisation par SCI sont opérationnels en local.

Next.js App Router / TypeScript strict / React / CSS responsive / Recharts. PostgreSQL et Prisma alimentent l’espace persistant. Better Auth gère email/mot de passe, vérification, sessions et récupération. Le mode démonstration reste séparé.

## Frontières

- `src/financial-engine` : validation, acquisition, prêt amortissable, charges, indicateurs, projections, revente avant impôt, stress tests et négociation. Fonctions pures, montants en euros, taux en pourcentage annuel. Arrondi uniquement à l'affichage ; pas un échéancier bancaire contractuel.
- `src/tax-engine` : contrat versionné, absence de simulation tant que les paramètres ne sont pas renseignés. Aucun barème fiscal supposé.
- `src/market-data` : valeurs nullable, provenance et confiance ; pas de source externe branchée.
- `src/listing-providers` : import de texte utilisateur, aucune récupération réseau des portails.
- `src/opportunity-engine` : score pondéré partiel, détail et couverture des données.
- `src/api` : validation partagée. `src/server` : Prisma, Better Auth, sessions, rate limiting et autorisation SCI. `src/app/api` : endpoints démo et persistants.
- `src/ui` : composants de présentation ; aucune formule financière.
- `prisma` : schéma relationnel et seed fictif optionnel.

## Séquence de livraison

1. Socle et modèle de données ; documenter les limites de sécurité.
2. Moteurs et tests déterministes, cas limites et invariants de remboursement.
3. Catalogue fictif, dashboard, détail avec simulation et comparateur.
4. Vérification TypeScript / ESLint / tests / build / parcours navigateur.

## Itérations suivantes

1. Revue de déploiement, emails transactionnels, gestion des départs et modifications de rôles. Les comptes et tests d’isolation multi-SCI sont implémentés.
2. Modification complète des caractéristiques, corrections d'import et budgets travaux détaillés. Les biens et analyses sont déjà persistants et versionnés.
3. Sources publiques autorisées et carte ; ingestion asynchrone, historique et dates de provenance.
4. Règles fiscales sourcées, revue métier IR/IS, déficits, amortissements et fiscalité de cession.
5. Alertes, connecteurs autorisés et tâches idempotentes. Les commentaires, votes, mentions et notifications internes sont implémentés ; la modération et l’actualisation automatique restent à ajouter.

## Collaboration 0.3

`src/server/collaboration.ts` applique l’autorisation avant chaque lecture/écriture et renvoie des objets limités aux champs nécessaires. Un commentaire et les notifications de ses mentions sont enregistrés dans une transaction. Le client ne choisit jamais l’auteur. Les avis utilisent la contrainte unique SCI/bien/membre et n’écrivent pas dans PropertyAnalysis. Historique et notifications utilisent une pagination par curseur contrôlé dans la même SCI ; notifications également filtrées par destinataire.

Le schéma prépare ces fonctionnalités ; leur présence dans le schéma ne signifie pas qu'elles sont implémentées. Pas de shadcn/Tailwind dans cette première version : CSS local sans dépendance à un service de styles.
