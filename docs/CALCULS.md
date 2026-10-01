# Conventions de calcul — moteur 0.1.0

Toutes les sommes sont en euros. Taux saisis en pourcentage annuel ; pas de centimes entiers en interne. Arrondir uniquement à l’affichage, et comparer les résultats de tests avec une tolérance adaptée. Pas d’arrondi bancaire échéance par échéance.

## Acquisition

Coût total = prix × (1 + frais acquisition / 100) + agence non incluse + travaux × (1 + marge / 100) + mobilier + banque + garantie + courtage + autres. Le prix doit être strictement positif, les charges non négatives et l’apport compris entre zéro et le coût total. Les frais d’acquisition ne sont pas un barème de notaire, mais un paramètre explicite.

## Crédit

Capital P = coût total − apport. N = années × 12. i = taux annuel / 1200. Mensualité = P × i / (1 − (1+i)^−N). À taux zéro : P / N. Calcul stable par `log1p` et `expm1` pour les très petits taux. Intérêt mensuel = solde × i. Capital remboursé = mensualité − intérêt ; dernière échéance ajustée au solde. Assurance mensuelle = P × taux assurance / 1200, uniquement pendant le prêt. Durée 1 à 40 ans, sans différé ni in fine.

## Exploitation

Loyers théoriques = loyer HC × 12. Loyers encaissés = loyers théoriques × (1 − vacance). Charges = taxe foncière non récupérable + copropriété non récupérable + PNO + comptabilité + entretien + autres + loyers encaissés × (gestion + GLI + provision travaux).

Résultat net d’exploitation = loyers encaissés − charges. Rendement brut = loyers théoriques / coût total. Rendement net = résultat net d’exploitation / coût total. Cash-flow = résultat net d’exploitation − remboursement capital − intérêts − assurance. Cash-on-cash = cash-flow / apport. DSCR = résultat net d’exploitation / dette servie avec assurance. Effort d’épargne mensuel = max(0, −cash-flow mensuel). Aucun taux d’effort sur revenus du foyer n’est calculé faute de revenus renseignés.

## Projection

Au terme de l’année y : valeur = prix × (1 + croissance prix)^y. Loyers et charges fixes évoluent à partir de l’année 2 avec exposant y−1. Charges variables suivent les loyers encaissés. Les travaux futurs sont une sortie supplémentaire de cash à l’année indiquée. Les provisions sont déjà comptées en sorties : pas de caisse de réserve disponible modélisée.

Équité = valeur − dette. Ce n’est ni le bénéfice, ni le cash récupérable à la vente. Cash vente avant impôt = valeur − frais de vente − dette. Gain total avant impôt = cash vente + somme des cash-flows − apport. Les cash-flows négatifs représentent des apports supplémentaires déduits du gain. Gain / apport est un ratio simple sur l’apport initial, pas un TRI ; null si apport nul.

## Score

Pondérations fictives : rendement 25, cash-flow 20, décote 15, secteur 15, risque 10, DPE 5, liquidité 5, travaux 5. Le score renormalise uniquement les poids connus. Couverture = somme des poids connus / somme totale. Un critère manquant reste manquant, sans inventer une valeur neutre. Les formules et bornes sont visibles dans l’analyse et `src/opportunity-engine`.

## Fiscalité et marché

Impôt annuel, impôt de cession, rendement après fiscalité, prix de marché, décote, liquidité et fourchette de loyer sont indisponibles. Aucun barème fiscal réel n’est utilisé. Les DPE sont fictifs ; l’application signale de vérifier les conditions légales de location sans en déduire automatiquement une règle juridique.
