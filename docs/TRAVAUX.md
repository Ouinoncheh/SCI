# Budget travaux et comparaison de rentabilité

## Parcours

Ouvrir un bien puis l’onglet **Travaux & scénarios**. Créer un scénario (économique, standard, premium ou nom libre), ajouter les postes et, si souhaité, les rattacher aux pièces créées dans Visualisation. Chaque poste contient catégorie, libellé, quantité, unité (forfait/m²/unité), prix unitaires minimum/maximum TTC, origine du montant (estimation personnelle ou devis) et référence/notes. Les sous-totaux par pièce sont présentés hors provision pour imprévus.

Les montants sont saisis par l’utilisateur : aucun tarif d’artisan ou loyer de marché n’est inventé. Le choix « Devis fourni » est une déclaration avec référence libre ; ce module ne vérifie ni ne télécharge le devis. Les photos et projections ne sont pas interprétées comme des preuves de coût ou de faisabilité.

Un scénario peut être sauvegardé incomplet. Ses montants inconnus restent null, son total et sa rentabilité restent indisponibles jusqu’à compléter chaque fourchette. Zéro explicite est accepté. Les prix sont positifs ou nuls, à deux décimales, les quantités strictement positives et le maximum supérieur ou égal au minimum.

## Calculs

### Devis et paiements

Dans chaque poste, ouvrir **Devis et dépenses de ce poste** : renseigner l’entreprise, la référence et le statut du devis (demandé, reçu, accepté ou refusé). Les prix unitaires TTC du poste restent la source du budget prévu ; aucun montant n’est déduit du statut du devis. Les pièces jointes ne sont pas encore prises en charge ici.

Ajouter les paiements effectués avec libellé, montant TTC, date et référence de facture. Les acomptes et règlements doivent être saisis sans double comptage. Enregistrer le scénario conserve ces données dans son JSON existant : accès SCI, droits, journalisation et contrôle de version identiques aux budgets. Les anciens scénarios restent compatibles. Le suivi est propre à chaque scénario, et les paiements de scénarios alternatifs ne sont jamais additionnés. Dupliquer un scénario remet les paiements et les soldes à zéro.

Le suivi indique les paiements saisis, le budget choisi avec provision et la différence, négative en cas de dépassement. Cette différence n’est pas le montant des factures restant à payer. Un budget incomplet laisse le prévu et la différence inconnus. Cocher **Poste soldé** déclare que tous les paiements de ce poste sont saisis ; zéro explicite est possible. Lorsque tous les postes sont soldés, la rentabilité finale remplace les travaux et meubles par leurs coûts payés et utilise une provision nulle pour éviter de compter les imprévus deux fois. Les autres hypothèses financières sont conservées. Ce calcul n’applique rien automatiquement à l’analyse principale.

Chaque total de poste est quantité × prix unitaire, arrondi au centime. Les totaux bas/haut correspondent à la somme de tous les postes de leur borne ; le milieu de fourchette est une convention de simulation, pas un devis prévisionnel certifié.

Les postes Ameublement alimentent `Investment.furniture`. Les autres alimentent `Investment.works`. La provision pour imprévus s’applique seulement aux travaux, conformément au FinancialEngine existant. Le budget retenu est bas, central ou haut. Ces montants **remplacent** les anciens montants travaux et mobilier : ils ne s’y ajoutent pas. Le taux d’imprévus du scénario remplace celui de l’analyse principale.

Le loyer du scénario est une hypothèse manuelle ; vide, il reprend le loyer de l’analyse principale, zéro reste zéro. Les scénarios sont recalculés sur la même analyse principale actuellement enregistrée : prix d’achat, apport, taux, durée, frais et charges identiques, seuls travaux/mobilier/imprévus/loyer varient. Modifier l’analyse principale change donc aussi les comparaisons. Le financement supplémentaire est pris en charge par le moteur existant, avec apport inchangé ; il ne s’agit pas d’une offre bancaire garantie.

Le tableau compare budget, loyer, coût total, mensualité assurance comprise, rendement brut et net sur coût total, cash-flow avant impôt. Un apport supérieur au coût total rend le calcul indisponible et bloque l’application. Aucune hausse de valorisation, modification de DPE ou économie de charges n’est déduite automatiquement des travaux. La fiscalité reste indisponible.

## Sauvegarde et application

Créer, modifier, dupliquer, choisir un préféré et archiver sont disponibles aux ADMIN/MEMBER. Les VIEWER peuvent consulter. Dupliquer prépare une copie à personnaliser et à enregistrer. Un seul scénario préféré est conservé par bien ; le choix ne modifie pas les finances.

**Appliquer à l’analyse principale** enregistre explicitement les hypothèses du scénario via le parcours financier existant, avec version du bien et nouvelle entrée dans l’historique. Sauvegarder ou préférer un scénario n’applique rien. Archiver masque le scénario mais conserve sa ligne en base ; la restauration depuis l’interface n’est pas encore proposée.

Dans la démonstration publique, les scénarios sont temporaires et disparaissent en quittant l’onglet. Dans l’espace connecté, ils persistent après rechargement.

## Architecture et limites

- `src/renovation/index.ts` : validation et fonctions pures de budget, regroupement par pièce et comparaison financière.
- `src/server/renovation.ts` : SCI/rôle, validation des pièces du bien, contrôle de version et journalisation.
- `src/ui/renovation-budget.tsx` : formulaires, sous-totaux et comparateur.
- Routes privées GET/POST `.../properties/:propertyId/renovation` et PATCH `.../renovation/:scenarioId`.
- Modèle `RenovationScenario` : données JSON validées, version, préféré, archive, auteur et dates. Migration `20261001065746_renovation_scenarios` appliquée localement.

Limites : 100 postes et 20 scénarios actifs par bien ; mutations limitées à 20/minute par utilisateur, JSON borné à 200 Ko, session et origine contrôlées. Les écritures verrouillent le bien pour les quotas et le préféré ; une édition concurrente d’un scénario renvoie 409. Une pièce d’un autre bien est refusée.

Cette livraison couvre le budget et la comparaison financière. Elle ne génère aucune image IA et n’estime pas automatiquement des travaux à partir de photos. Les fournisseurs IA, images avant/après et rapprochement avec des scénarios de design restent une étape distincte.

## Validation

Tests unitaires : quantités, fourchettes, arrondis, mobilier séparé, imprévus, inconnues, absence de double comptage, zéro explicite de loyer, absence de mutation de référence, comparaison de crédit/cash-flow, données invalides et apport incompatible.

Tests navigateur : création et duplication temporaire sur mobile ; scénario persistant associé à une pièce ; consultation VIEWER, écritures refusées, isolation SCI, pièce étrangère refusée, conflit 409, préféré, application à l’analyse et historique, archivage et absence de débordement horizontal.
