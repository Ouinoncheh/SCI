# Import automatique et assisté

## Diagnostic HTTP

Le client appelle `POST /api/workspace/scis/:sciId/listing-import`. La route dédiée exporte explicitement POST. Le transport distant utilise GET. GET sur notre route renvoie 405 avec `Allow: POST`, identifié par `next_api_wrong_method`. Les refus distants sont identifiés par `remote_response` et leur statut réel. Aucun 405 historique n’a été reproduit ni attribué à une couche sans preuve. Le précédent essai serveur Leboncoin a obtenu 403.

Chaque événement JSON `listing_import` comprend URL, provider, méthode, status, Allow, Content-Type et étape. Query, fragment, identifiants URL et longues séquences de chemin sont retirés des logs. Aucun cookie, corps de page, token ou secret n’est enregistré. Les étapes distinguent policy, dns, remote_response, remote_challenge, network_or_timeout et next_api_completed.

## Parcours utilisateur

Dans `/espace/biens/nouveau`, coller une URL HTTPS et cliquer Analyser. Pour une source autorisée et accessible : JSON-LD puis métadonnées et texte HTML inerte. Aucun JavaScript distant n’est exécuté. Sans accès, y compris 401/403/405/429 ou challenge, un `PropertyImportDraft` persistant `NEEDS_IMPORT_DATA` conserve le lien. L’utilisateur voit « Compléter l’annonce » et un message compréhensible.

Le brouillon peut recevoir texte, PDF (20 pages), DOCX, TXT, captures JPEG/PNG/WebP et photos. Fichiers limités à 8 Mo, 20 fichiers par brouillon. Le texte est limité à 20 000 caractères, HTML à 2 Mo. Les captures bénéficient d’un OCR français côté serveur : au premier usage, Tesseract télécharge son modèle linguistique dans `.local/ocr`. Les images ne sont pas transmises à un service OCR tiers. Si l’OCR échoue ou dépasse 30 secondes, la capture est conservée et le texte peut être collé. Un PDF scanné sans texte nécessite une capture ou une transcription.

Les champs restent éditables, les inconnues null et les faux explicites false. Les charges ne sont extraites automatiquement que lorsqu’elles sont annoncées annuelles. Les informations absentes d’un nouveau document n’effacent pas les informations déjà connues. Les changements concurrents sont refusés avec 409. Les brouillons peuvent être repris dans le sélecteur.

Chaque champ connu conserve value/source/sourceUrl/retrievedAt/confidence. Sources : STRUCTURED_HTML, USER_PROVIDED_LISTING_TEXT, USER_PROVIDED_DOCUMENT, USER_PROVIDED_SCREENSHOT_OCR, USER_CONFIRMED, BAN. La confiance exprime une heuristique de lecture, pas une certification. Les valeurs corrigées sont confirmées par l’utilisateur, les valeurs inchangées conservent leur provenance. L’interface « D’où vient cette donnée ? » expose cette provenance avant et après création du bien.

## Photos et stockage

Les nouveaux imports ne chargent ni ne conservent les URL photo distantes pour l’affichage. L’utilisateur charge ses fichiers ; Sharp produit thumbnail, medium et original pleine résolution assaini WebP, sans EXIF/GPS. Les octets sont stockés en PostgreSQL dans ImportAsset, servis par une route privée vérifiant la SCI avec `private, no-store` et `nosniff`. Les documents se téléchargent en pièces jointes.

Lors de la création du bien, les photos rejoignent une pièce « Photos de l’annonce » dans Visualisation et la première sert de couverture. Le brouillon est converti une seule fois dans la même transaction. Les captures restent des justificatifs. Les anciennes annonces peuvent encore utiliser leurs liens historiques ; elles ne sont pas transformées silencieusement.

## Enrichissement public

`PropertyEnrichmentService` s’exécute après chaque extraction/correction. L’adresse doit contenir rue, code postal et ville.

- BAN via IGN `https://data.geopf.fr/geocodage/search` : numéro de rue, score ≥ 0,90, code postal identique et séparation ≥ 0,05 avec le second résultat. Coordonnées, commune et INSEE conservés ; aucune adresse ambiguë n’est forcée.
- DVF CEREMA : nécessite `CEREMA_DVF_URL`, vide par défaut. Seuls les hôtes officiels apidf.cerema.fr et apidf-preprod.cerema.fr sont admis. L’adaptateur lit au maximum 500 transactions de la commune ; les observations sans coordonnées sont exclues. Comparables : même type maison/appartement, distance ≤ 1 km, surface ±25 %, moins de 3 ans, dates futures exclues et doublons retirés. Médiane/moyenne €/m², nombre, écart-type et transactions récentes sont calculés. Cet échantillon limité ne constitue pas une expertise exhaustive. La disponibilité réelle du service et le format des données doivent être validés dans chaque déploiement.
- ADEME DPE logements existants : recherche par adresse, candidats seulement lorsque adresse, distance ≤30 m et surface ±5 % concordent. Les coordonnées projetées non converties sont exclues. Aucun candidat n’est automatiquement associé, même avec confiance élevée : validation utilisateur nécessaire dans un immeuble comprenant plusieurs logements.

Un service absent, non configuré ou sans résultat affiche « donnée indisponible ». Les adaptateurs BAN/ADEME sont implémentés ; leur disponibilité réseau n’est pas garantie par les tests sur fixtures. DVF n’est pas activé localement sans endpoint vérifié.

Références : [géocodage IGN](https://ignf.github.io/cartes.gouv.fr-documentation/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/), [API DVF CEREMA](https://cerema.github.io/apifoncier/endpoints/dvf_opendata/), [DPE ADEME](https://data.ademe.fr/datasets/meg-83tjwtg8dyz4vv7h1dqe).

## Analyse et architecture

ListingImporter orchestre un ListingProvider injecté ; PropertyNormalizer valide la forme commune ; PropertyEnrichmentService gère les sources publiques. L’extraction, la normalisation, les statistiques et l’analyse ne sont pas implémentées dans React.

L’import alimente le même formulaire et le même FinancialEngine/LoanEngine/OpportunityEngine que la saisie manuelle. Prix, surface, taxe foncière et frais d’agence annoncés sont transférés ; les charges annuelles de copropriété ne sont pas assimilées automatiquement à la part non récupérable. L’aperçu financier se recalcule dès que les hypothèses nécessaires sont valides : coût total, mensualité, rendements, cash-flow, score avec couverture et projections à 10/20 ans à hypothèses constantes. Après sauvegarde, les scénarios sont modifiables. La comparaison DVF apparaît dans le brouillon.

Loyer estimé, estimation automatique de travaux et fiscalité restent indisponibles faute de sources/moteurs validés ; aucun montant n’est inventé. Les zéros du formulaire sont des postes à confirmer, pas des estimations. Import automatique et assisté rejoignent exactement le même moteur après confirmation.

## Configuration et contrôles

`LISTING_ALLOWED_HOSTS` contient uniquement les hôtes exacts disposant d’un accès autorisé. Une entrée ne donne aucun droit ni ne garantit l’accès. HTTPS public uniquement, DNS vérifié et épinglé, pas de redirections ni cookies, délai HTTP 10 s, aucune tentative de contournement CAPTCHA/WAF/authentification. Les API sont privées, isolées par SCI et rôle, avec origine contrôlée et quotas. Migration `20261001062325_assisted_import` nécessaire (`pnpm db:generate`, `pnpm db:migrate`).

Validation : `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`. Les tests unitaires utilisent HTML local et fournisseurs injectés pour les statuts 401/403/405/429. Les tests d’intégration utilisent une source non configurée et du HTML fourni, puis texte/document et photos locales. Aucune requête Leboncoin/SeLoger n’est effectuée pendant les tests.
