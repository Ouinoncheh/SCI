# Loyer local et trésorerie mensuelle

Le formulaire d'ajout et l'onglet Hypothèses d'un bien proposent une référence de loyer issue de la carte ANIL 2025, pour la location **vide**, charges comprises. Quatre séries sont embarquées : appartements, appartements T1–T2, appartements T3 et plus, maisons. Le type doit être choisi ou provenir explicitement de l'annonce. Les données ne nécessitent ni compte ni abonnement.

Le code postal est résolu avec `geo.api.gouv.fr`. Une correspondance exacte du nom de commune est requise ; sinon l'utilisateur choisit parmi les communes de ce code postal. Paris, Lyon et Marseille utilisent les codes de leurs arrondissements municipaux. Aucun premier résultat ou commune proche n'est choisi implicitement. Une source indisponible laisse la saisie manuelle accessible.

## Calcul

Référence indicative CC = surface du bien × loyer ANIL CC au m².
Loyer HC = référence CC × facteur de scénario − charges récupérables mensuelles indiquées par l'utilisateur.

Les facteurs 0,9, 1 et 1,1 représentent des hypothèses utilisateur prudente, centrale et optimiste. Ils ne sont pas des probabilités ou quantiles officiels. Les bornes de l'intervalle de prédiction publié par l'ANIL sont affichées séparément. Aucun taux de charges récupérables, supplément meublé ou correction DPE n'est inventé. Des charges supérieures au loyer rendent la variante inutilisable.

Le montant choisi alimente `investment.monthlyRent` ; le moteur existant calcule la trésorerie mensuelle **avant impôt**, après vacance, charges d'exploitation, provisions et service de la dette. Le rendement net reste un indicateur **annuel**. Une variante modifie le formulaire ; le bouton habituel d'enregistrement conserve ensuite le montant et recalcule le bien et le comparateur. La référence ANIL est consultable à nouveau, mais la sélection et les charges récupérables du widget ne constituent pas une nouvelle ligne de provenance persistée dans la base.

## Limites affichées

Les indicateurs sont établis pour des logements types : appartement 52 m², T1–T2 37 m², T3+ 72 m², maison 92 m². La multiplication par une autre surface est une approximation, particulièrement pour de grands biens. Aucune adaptation automatique au quartier, état, DPE, meublé ou saisonnier. Une estimation maillée, moins de 30 observations communales ou un R² inférieur à 0,5 est signalée comme référence à confirmer. Ce module n'établit pas un plafond légal de loyer ni l'autorisation de louer.

Les postes du formulaire initialisés à zéro restent à vérifier : la référence de loyer n'est pas une estimation des frais, du crédit, de la taxe foncière ou des travaux.

## Sources et mise à jour

Attribution : **Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin**.

Source : https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025

Période : T3 2025 ; géographie : 1 janvier 2025. Snapshot intégré : 34 900 communes/arrondissements dans `src/market-data/data/rents-2025.json`. Il est copié dans l'image Docker de production. Le script `scripts/update-rent-data.py` télécharge à nouveau ces quatre fichiers CSV publics, décode leur encodage et vérifie la complétude minimale avant remplacement. Il reste fixé au millésime 2025 : un nouveau millésime nécessite une vérification de sa méthode, de ses URLs et de sa géographie.

Tests : charges comprises/hors charges, montants impossibles, trésorerie via le moteur existant, ambiguïtés de commune, arrondissements et références ANIL réelles. Les tests du widget avec réponse simulée ne garantissent pas la disponibilité de l'API géographique externe.
