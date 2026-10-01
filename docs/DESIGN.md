# Interface PredictSCI

Refonte guidée par le skill UI UX Pro Max, installé depuis https://github.com/nextlevelbuilder/ui-ux-pro-max-skill dans le dossier personnel Codex. Ses recherches de système visuel ont renvoyé un modèle commercial Enterprise Gateway peu adapté à un outil d’analyse. La direction ci-dessous est donc un choix de conception propre au projet, avec les règles générales du skill pour la lisibilité, les interactions et l’accessibilité.

Navigation bleu nuit, surfaces blanches sur fond clair, actions cobalt et résultats positifs turquoise. Typographie DM Sans / Manrope existante, chiffres tabulaires, cartes de 18px, espaces de 16/24/32px, boutons de 44px minimum, champs de 16px sur téléphone pour éviter le zoom automatique Safari. Les données fictives et résultats simulés restent explicitement identifiés.

Les tokens et styles de la refonte sont regroupés dans `src/app/modern.css`, importé après la feuille structurelle existante dans le layout racine. Les graphiques suivent la même palette. Les états clavier sont visibles et les mouvements réduits respectés. La navigation annonce la page courante. La galerie authentifiée garde ses routes privées et aucune photo illustrative ne remplace une photo réelle.

Vérification responsive sur 375, 768, 1024 et 1440px, avec tests de parcours et captures ordinateur/téléphone. Les tableaux et onglets peuvent défiler à l’intérieur de leur conteneur ; le document ne doit pas déborder horizontalement.
