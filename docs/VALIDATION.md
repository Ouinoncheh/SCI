# Validation de la livraison 0.3

## Projets visuels — 1er octobre 2026

Migration `20261001071024_design_projects` appliquée et client Prisma régénéré. TypeScript, ESLint et compilation réussissent ; **76 tests unitaires** et **9 parcours navigateur** passent. Projets persistants, budgets associés, rôles, source étrangère refusée, consentement, fournisseur absent, archivage et avant/après mobile sur fixture sont contrôlés. Les fournisseurs et jobs sont simulés dans les tests. Aucune génération OpenAI réelle ni facture n’a été déclenchée. Configuration et limites dans `docs/VISUALISATION.md`.

## Budget travaux et scénarios — 1er octobre 2026

Migration `20261001065746_renovation_scenarios` appliquée localement et client Prisma régénéré. TypeScript, ESLint et compilation de production réussissent. Les **66 tests unitaires** et **9 scénarios Playwright** passent : budgets TTC, inconnues, quantités, séparation mobilier/travaux, provision, comparaison financière, association à une pièce, isolation SCI/rôles, version concurrente, préféré, archivage et application historisée. Interface mobile vérifiée dans `test-results/travaux-prives-mobile.png`. Fonctionnement documenté dans `docs/TRAVAUX.md`.

## Validation précédente

Contrôles renouvelés le 1er octobre 2026 sur Windows, Node.js 24.19.0 et pnpm 11.25.0. La phase A de visualisation ajoute la migration `20261001060954_room_photos`, appliquée localement. Les tests incluent l’upload privé, les autorisations, la suppression EXIF et la galerie mobile. TypeScript, lint, compilation et les 7 parcours navigateur réussissent.

| Contrôle                          | Résultat                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| Tests unitaires Vitest            | 42 tests réussis                                             |
| TypeScript strict                 | Réussi                                                       |
| ESLint                            | Réussi                                                       |
| Compilation Next.js de production | Réussie                                                      |
| Prisma validate                   | Schéma valide avec URL locale de configuration               |
| Prisma generate                   | Client généré                                                |
| Migration SQL                     | Migrations initiale et comptes appliquées à PostgreSQL local |
| Tests Playwright Chromium         | 7 parcours, incluant la collaboration et l’isolation SCI     |
| Inspection visuelle               | Dashboard bureau 1440 px, mobile 390 px et page d’analyse    |

Les parcours navigateur vérifient : recherche et favoris ; modification des hypothèses et recalcul ; échéancier 240 lignes et export CSV ; horizons de projection ; fiscalité absente ; sélection dans le comparateur ; import de texte et ajout temporaire ; disparition de cet ajout au rechargement ; absence de débordement horizontal sur quatre pages mobiles ; API fictive en lecture seule.

Captures reproductibles via `pnpm exec node scripts/capture-preview.mjs` avec le serveur actif. Résultats dans `docs/previews/`.

## Limites de la validation

PostgreSQL 18 est installé localement. Les migrations initiale et comptes ont été appliquées à l’instance dédiée `127.0.0.1:55432`. La collaboration utilise les tables déjà présentes, sans nouvelle migration. Les tests créent exclusivement des comptes `example.invalid` et des SCI de test ; ils ne suppriment pas les données préexistantes. Docker, SMTP externe et déploiement de production ne sont pas validés.

Les comptes, invitations, autorisations multi-SCI, emails locaux, reset de mot de passe et persistance sont couverts par `e2e/workspace.spec.ts`. Les sources externes, alertes et règles fiscales restent à développer ; le test fiscal vérifie uniquement qu’une donnée indisponible reste `null`.

La suite vérifie aussi : refus des contributions VIEWER, refus des mentions inter-SCI, confidentialité des notifications, marquage comme lu, conservation des commentaires après rechargement, texte HTML affiché sans exécution, changement/retrait d’un vote, invariance des données financières après vote et consultation des trois analyses successives sauvegardées. Les tests unitaires bornent les commentaires/mentions et rejettent les identités d’auteur fournies par le client.

L’édition des caractéristiques est couverte : correction via le formulaire, conservation après rechargement, refus VIEWER/inter-SCI, validation du code postal, conflit de version 409 et conservation exacte des hypothèses et analyses précédentes. Le formulaire est aussi contrôlé à 390 px. Les valeurs inconnues restent explicitement inconnues ; aucune migration supplémentaire n’est nécessaire.

L’import est vérifié sur des fichiers HTML contrôlés : extraction, autorisations, limites, validation réseau et persistance du lien et des URL photo. Le formulaire est testé à 390 px avec application d’un aperçu sans photos. Aucun test ne démontre une connexion réelle à Leboncoin ou SeLoger ; ces sources restent non configurées. Voir `docs/IMPORT-ANNONCES.md`.
