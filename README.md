# PredictSCI

Espace d’analyse immobilière familiale en français. Démonstration publique avec données fictives et espace connecté avec PostgreSQL, SCI, analyses enregistrées et collaboration. Version 0.3, destinée au développement local avant revue de déploiement.

## Démarrage rapide

Prérequis : Node.js 22.12+ ou 24 LTS, pnpm 11+.

```powershell
pnpm install
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-db.ps1
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm dev
```

Ouvrir http://127.0.0.1:3000. La racine reste une démonstration fictive. Les comptes et SCI persistants se trouvent sous `/inscription`, `/connexion` puis `/espace`. Le script PowerShell crée une instance PostgreSQL PredictSCI dédiée dans `.local/` sur le port 55432 et écrit les secrets dans `.env` (ignoré par Git).

Pour une compilation de production locale :

```powershell
pnpm build
pnpm start
```

## Ce qui fonctionne

- Dashboard calculé à partir des biens étudiés, favoris et projection de la sélection.
- Catalogue, recherche, filtre de statut, tri prix/rendement et favoris.
- Ajout par formulaire ; extraction du prix et de la surface depuis du texte fourni par l’utilisateur, avec vérification manuelle. Import d’un fichier HTML autorisé dans l’espace connecté, aperçu des données structurées, sélection des photos et conservation du lien source.
- Analyse d’un bien et édition de tous les paramètres financiers avec validation Zod.
- Coût complet du projet, prêt amortissable à taux fixe, assurance sur capital initial, échéancier complet et export CSV français.
- Rendements brut/net sur coût total, cash-flow, cash-on-cash, DSCR, effort mensuel et remboursement de capital.
- Projections à 5/10/15/20/25 ans, trois scénarios modifiables, revente **avant fiscalité**, graphiques interactifs et tableaux accessibles.
- Neuf stress tests isolés, négociation du prix pour un cash-flow cible.
- Comparateur de deux à quatre biens, score partiel expliqué avec couverture des données.
- API publique en lecture seule `GET /api/demo/properties`, exclusivement fictive.
- Schéma PostgreSQL/Prisma, migration initiale, seed fictif idempotent et interfaces pour futurs providers.
- Comptes vérifiés, récupération de mot de passe, profils, SCI multiples, invitations nominatives et rôles.
- Enregistrement des biens et analyses dans `/espace`, détection des conflits de modification et historique des hypothèses/résultats sauvegardés.
- Commentaires, mentions de membres, votes modifiables et retirables, journal des opérations et notifications privées dans l’application.
- Correction du titre, de la ville, du code postal, de l’adresse, du nombre de pièces, du DPE et de la description dans l’onglet **Caractéristiques**. ADMIN et MEMBER peuvent enregistrer ; VIEWER consulte. Les conflits de version sont refusés et chaque correction est journalisée.

Dans la démonstration seulement, les favoris/statuts/ajouts sont effacés au rechargement et les simulations restent locales à la page. Dans `/espace`, les données sont enregistrées et le comparateur reprend les dernières analyses. Les variantes de projection restent temporaires. L’espace connecté démarre vide ; le seed fictif est facultatif et ne crée pas de compte connectable.

Dans la fiche d’un bien connecté, l’onglet **Échanges** contient commentaires, mentions et votes ; **Historique** présente les analyses conservées à la date de leur calcul. ADMIN et MEMBER peuvent contribuer, VIEWER peut consulter. Les votes sont indépendants des calculs et du score. Les mentions créent seulement une notification interne, aucun email. L’actualisation est manuelle ; commentaires, analyses et notifications sont paginés, le journal affiche les 30 dernières opérations du bien. Les commentaires publiés ne sont pas encore modifiables ou supprimables.

## Photos et visualisation

L’onglet **Visualisation** permet désormais de créer des pièces et d’y enregistrer des photos privées, avec angle de vue et commentaire. Voir [la phase A et ses limites](docs/VISUALISATION.md). Aucune génération IA ni estimation automatique de travaux n’est encore activée. Appliquer la nouvelle migration avec `pnpm exec prisma migrate deploy` avant utilisation.

## Base de données

Sous Windows, le script ci-dessus utilise PostgreSQL 18 installé dans `C:\Program Files\PostgreSQL\18`. Il conserve les données dans `.local/postgres`. Pour arrêter cette instance : `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-db.ps1 -Action stop`.

Alternative Docker : uniquement si aucune configuration `.env` n’existe, copier `.env.example`, adapter les secrets et lancer Compose. Ne pas écraser une configuration existante. Les identifiants d’exemple sont réservés au développement local.

```powershell
docker compose up -d db
pnpm exec prisma migrate deploy
pnpm db:generate
pnpm db:seed
pnpm db:studio
```

Pour une évolution de schéma : `pnpm db:migrate --name nom_de_la_modification`. Ne pas utiliser `db push` pour remplacer l’historique de migrations. Le seed crée seulement une SCI fictive et des utilisateurs `example.invalid` sans mot de passe ; il ne crée pas de comptes connectables. Répéter le seed ne supprime ni ne remplace les données existantes.

L’interface racine utilise `src/data/demo.ts`; l’espace `/espace` lit et écrit PostgreSQL. Les relations composites et les contrôles serveur empêchent l’accès entre SCI différentes.

## Variables d’environnement

| Variable                | Usage                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| `BETTER_AUTH_URL`       | Origine publique exacte de l’authentification                          |
| `BETTER_AUTH_SECRET`    | Secret aléatoire d’au moins 32 caractères                              |
| `MAIL_MODE`             | `local` écrit les liens dans `.local/mail` en développement            |
| `SMTP_URL`, `MAIL_FROM` | Obligatoires pour les emails hors développement local                  |
| `DATABASE_URL`          | Connexion PostgreSQL pour les commandes Prisma et l’espace connecté    |
| `POSTGRES_PASSWORD`     | Facultatif, mot de passe du conteneur local, à synchroniser avec l’URL |

Aucun secret ne doit être ajouté au code ou à une variable `NEXT_PUBLIC_*`. `.env` et `.env.local` sont ignorés par Git.

En mode email local, ouvrez le fichier JSON correspondant dans `.local/mail` pour suivre le lien de vérification ou de récupération. Ce dossier contient des liens sensibles : ne le publiez pas. Aucun véritable email n’est envoyé dans ce mode. Les endpoints de vérification et récupération sont exclus des journaux de requêtes Next.js en développement.

## Tests et validation

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright lance automatiquement le serveur local si nécessaire. Les tests couvrent les parcours dashboard/favoris, modification financière, export, projection, comparaison, création temporaire, API et absence de débordement mobile. Les tests unitaires couvrent valeurs de référence, cas limites, conservation du capital, vacance, charges, ratios, extinction de dette, scénario, stress, négociation et absence explicite de données.

## Architecture

```text
src/
  app/                  Routes Next.js, pages et API publique de démonstration
  api/                  Garde du mode démo
  ui/                   Composants, contexte démo, graphiques, formulaires
  financial-engine/     Fonctions pures et validation, indépendantes de React
  tax-engine/           Contrats, résultat indisponible (pas de faux barème)
  listing-providers/    Contrat et extraction de texte utilisateur
  market-data/          Contrat, provenance, confiance et RentalEstimator
  opportunity-engine/   Score pondéré explicable et couverture
  data/                 Fixtures synthétiques explicitement identifiées
  server/               Authentification, accès SCI, Prisma et services persistants
  collaboration/        Contrats et validation des commentaires, votes et historiques
prisma/                 Modèle cible, migration et seed
tests/                  Tests de calcul
e2e/                    Parcours Playwright
docs/                   Plan, conventions, état de validation
```

Voir [le plan technique](docs/ARCHITECTURE.md) et [les conventions de calcul](docs/CALCULS.md).

## Ajouter un provider

**Leboncoin** : provider normalisé, extraction d’ID, service Python interne inspiré de `leboncoin-mcp`, endpoint privé `/api/listings/import`, brouillons persistants et fallback manuel. Aucun fetch HTML du portail, imitation de navigateur ou retry après refus. Voir [configuration, lancement et limites](docs/LEBONCOIN.md).

**Travaux et scénarios** : un onglet sur chaque bien propose des postes TTC par pièce, fourchettes de prix et sources, un budget bas/central/haut, un loyer manuel et un comparateur de rentabilité. Les scénarios persistent dans l’espace connecté ; leur application à l’analyse est explicite et historisée. Voir [le fonctionnement des budgets travaux](docs/TRAVAUX.md).

**Visualisation après travaux** : préparation de projets depuis les photos privées, prompts, styles, budget associé, jobs persistants et comparateur avant/après. La génération réelle exige une clé API et un modèle configurés côté serveur et reste désactivée localement. Aucun résultat IA simulé n’est affiché par l’application. Voir [la configuration et les limites](docs/VISUALISATION.md).

**Import d’annonces** : voir [le fonctionnement et les limites](docs/IMPORT-ANNONCES.md). Une URL crée un brouillon persistant, complétable avec texte, PDF/DOCX/TXT, captures et photos conservées localement. Les champs restent éditables avec provenance. Un transport HTTPS est disponible pour les domaines autorisés dans `LISTING_ALLOWED_HOSTS` ; les refus créent un import assisté. BAN et ADEME disposent d’adaptateurs prudents, DVF nécessite `CEREMA_DVF_URL`. Les hypothèses confirmées alimentent le même moteur financier. Aucun CAPTCHA, authentification ou restriction n’est contourné.

**MarketDataProvider** : implémenter `pricePerSquareMeter` et `monthlyRentPerSquareMeter`. Retourner `null` sans observation pertinente, sinon conserver valeur, source, date d’observation, zone, confiance et date de mise à jour. Les futurs imports DVF/INSEE doivent préciser licence, granularité, période, taille d’échantillon et méthode de filtrage. Aucune API externe ni scraping ne fonctionne aujourd’hui.

**TaxEngine** : ajouter des règles versionnées avec date d’entrée en vigueur, source primaire, commentaire et paramètres. Faire valider IR/IS et cession par un professionnel avant activation. Les calculs après impôt restent indisponibles dans cette livraison.

## Sécurité et prochaine itération

Les endpoints privés vérifient la session, la SCI et le rôle. Ils valident l’origine et le JSON, limitent la taille du corps et le débit des requêtes via PostgreSQL. Les mentions sont validées dans la SCI et les notifications sont accessibles uniquement à leur destinataire. Les analyses utilisent un contrôle de version pour éviter les écrasements concurrents. Les messages sont affichés en texte, sans interprétation HTML. Better Auth utilise ses propres tables de sessions et de vérification ; les anciens modèles Session/RecoveryToken sont conservés mais inutilisés.

Ensuite : caractéristiques complémentaires (équipements, GES, coordonnées, photos et URL source), travaux détaillés, paramètres partagés de score, sources publiques, fiscalité IR/IS validée, carte, Opportunity Finder et alertes. Prévoir aussi gestion des départs/changements de rôle, modération des commentaires et livraison email de production. Différé/in fine, fiscalité de distribution, déficits fonciers, amortissements, TRI et pénalités de remboursement anticipé ne sont pas calculés.

## Déploiement

Le déploiement retenu utilise Render Free, Supabase Free et Resend. Voir [le guide de mise en ligne](docs/HEBERGEMENT-GRATUIT.md). Le Dockerfile génère Prisma et construit Next.js ; `start-production.mjs` applique les migrations, démarre le service Python interne facultatif puis l’application. L’authentification en production exige HTTPS et un fournisseur email configuré.

Les illustrations sont des SVG originaux locaux. Les polices Google Fonts sont facultatives, avec repli système hors réseau. Aucune photographie réelle n’est utilisée.
