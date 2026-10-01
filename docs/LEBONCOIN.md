# Import Leboncoin isolé

## Fonctionnement

Dans l’espace connecté, Ajouter un bien → coller l’URL → Analyser le bien. Le lien passe par `LeboncoinProvider`, l’ID est validé, puis le serveur Next.js appelle `GET /ads/{id}` sur le service Python interne. La réponse passe exclusivement par `normalizeLeboncoinAd` avant d’atteindre le brouillon et les moteurs existants. Le formulaire permet de vérifier les champs et de renseigner les hypothèses financières avant de créer le bien et son analyse.

Le service reprend le principe `get_ad` de [wydii/leboncoin-mcp](https://github.com/wydii/leboncoin-mcp), avec `lbc==1.1.6`. Il expose une façade HTTP interne, pas le protocole MCP : les autres outils (recherche, vendeurs, etc.) ne sont pas exposés. Next.js ne connaît aucun détail du package Python.

Attention : l’initialisation standard de lbc imite un navigateur, charge une page HTML pour initialiser des cookies, et retente les 403. Notre `PlainClient` saute cette initialisation et remplace son transport par urllib : identité PredictSCI explicite, TLS vérifié, aucun proxy, aucun cookie, aucun HTML, aucune redirection et aucun retry. Une protection ou restriction entraîne le fallback ; cette adaptation ne garantit donc pas l’accès à une annonce.

## Persistance et analyse

`POST /api/listings/import` exige une session vérifiée, les droits d’écriture sur une SCI, une origine autorisée et un JSON limité en taille. Exemple :

```json
{
  "sciId": "identifiant-de-votre-sci",
  "url": "https://www.leboncoin.fr/ad/ventes_immobilieres/1234567890"
}
```

`sciId` est explicite pour éviter d’enregistrer dans la mauvaise SCI. Sans hypothèses financières, la réponse contient `success: true`, `property: null`, `analysis: null` et un `draft` sauvegardé. Ce brouillon est la fiche temporaire : une annonce indisponible reçoit `status: NEEDS_MANUAL_IMPORT`. L’URL est conservée, le formulaire et l’ajout de texte/documents/photos restent disponibles. Les codes métier distinguent ID absent, service indisponible, annonce absente, réponse incompatible et repli manuel.

Pour créer directement le bien, le client peut également fournir `property`, conforme au formulaire existant (titre, ville, code postal, hypothèses `investment` complètes), et `photoRights: true` s’il est autorisé à réutiliser les images. Les prix et surface normalisés alimentent alors `createProperty`, qui sauvegarde l’analyse du même moteur financier ; la réponse contient l’ID et les résultats. Sans prix/surface disponibles, ou si l’import automatique a échoué, l’endpoint conserve le brouillon au lieu d’inventer ces données.

Les métadonnées demandées réutilisent les tables existantes : `PropertyImportDraft.sourceUrl/source/status/normalized/createdAt`, puis `Listing.url/platform/importedAt/normalizedData`, liées à `Property`. `sourceListingId`, `importStatus`, les attributs bruts bornés et la provenance sont enregistrés dans le JSON normalisé ; aucun changement de schéma ni migration destructive n’est nécessaire. Les statuts de workflow de brouillon (`READY`, `CONVERTED`) restent distincts du statut d’import (`IMPORTED`, `PARTIAL`, `NEEDS_MANUAL_IMPORT`).

BAN, DVF et ADEME conservent leur comportement prudent. Une source indisponible devient un avertissement. Le loyer, les travaux, le financement et les autres hypothèses sont confirmés par l’utilisateur ; aucun RentalEstimator ou moteur fiscal fictif n’est ajouté. Les résultats fiscaux non implémentés restent indisponibles.

Les champs invalides ou absents deviennent `null`. Les charges dont la périodicité est ambiguë et les honoraires dont l’inclusion dans le prix est inconnue restent dans `rawAttributes`, sans alimenter les montants annuels. Les attributs inconnus sont conservés sous une forme JSON bornée, pas la totalité des données du vendeur.

## Photos

Les URLs HTTPS sont des références, pas une copie garantie. Le formulaire affiche les photos et permet de choisir celle placée en premier. La réutilisation dans le bien exige la déclaration d’autorisation ; une image inaccessible ne bloque pas la fiche. Aucun téléchargement de photos externes n’est exécuté automatiquement. Pour une conservation durable autorisée, l’ajout de fichiers existant normalise les images et utilise le stockage privé Supabase (ou PostgreSQL en local). Les photos privées ont leur propre sélection de couverture dans la galerie.

## Lancement local sous Windows

Depuis la racine du projet, avec Python 3.10+ :

```powershell
python -m venv .local/leboncoin-venv
.local/leboncoin-venv/Scripts/python.exe -m pip install -r services/leboncoin-mcp/requirements.txt
```

Dans votre fichier privé `.env`, définir `LEBONCOIN_SERVICE_URL=http://127.0.0.1:8001` et un `LEBONCOIN_SERVICE_TOKEN` aléatoire d’au moins 32 caractères. Dans le terminal du service Python, définir le même token dans l’environnement, puis lancer :

```powershell
$env:LEBONCOIN_SERVICE_TOKEN = "votre-secret-interne-prive"
.local/leboncoin-venv/Scripts/python.exe services/leboncoin-mcp/server.py
```

Redémarrer `pnpm dev` après modification de `.env`. `GET http://127.0.0.1:8001/health` vérifie que la dépendance est installée ; il ne contacte pas Leboncoin. `GET /ads/{id}` exige `Authorization: Bearer …`. Le serveur écoute par défaut uniquement sur loopback, limite les appels concurrents à un et ne journalise pas les headers ou erreurs distantes. Next.js abandonne après 8 secondes ; le transport Python utilise un timeout de 6 secondes et une limite de 1 Mo. Aucun retry automatique n’est effectué.

Option Docker : définir le token dans l’environnement et lancer `docker compose --profile listing-import up --build leboncoin-service`. Le port publié est limité à `127.0.0.1:8001`. La construction Docker Linux doit être vérifiée sur une machine disposant de Docker.

## Render gratuit

Le Dockerfile principal inclut le service Python. `start-production.mjs` le démarre sur `127.0.0.1:8001`, avec un token interne aléatoire non journalisé, avant Next.js. Cela évite de provisionner un second hébergement. `LEBONCOIN_SERVICE_ENABLED=false` désactive ce processus. Un endpoint externe configuré avec `LEBONCOIN_SERVICE_URL` et `LEBONCOIN_SERVICE_TOKEN` remplace le processus embarqué ; HTTPS est requis hors loopback ou réseau Docker explicitement prévu.

Le service partage la mémoire et les périodes de veille de Render Free. Une panne du processus Python laisse l’application et le fallback manuel disponibles ; il sera relancé au prochain redémarrage du conteneur. Aucun compte Leboncoin ni accès partenaire n’est fourni par cette intégration non officielle. Un 403 peut donc toujours survenir et n’est jamais contourné.

## Vérification

Fichiers ajoutés : `src/listing-providers/provider.ts`, `leboncoin.ts`, `manual.ts`, `src/server/leboncoin-service.ts`, `src/app/api/listings/import/route.ts`, `services/leboncoin-mcp/{adapter.py,server.py,requirements.txt,Dockerfile,test_adapter.py}`, `tests/leboncoin-provider.test.ts`, `tests/fixtures/leboncoin-ad.json`, `integration/leboncoin-import.test.ts`, `vitest.integration.config.ts` et ce document.

Fichiers modifiés : `src/listing-providers/{index.ts,normalized.ts,importer.ts}`, `src/server/{listing-fetch.ts,import-drafts.ts,properties.ts}`, `src/ui/listing-import.tsx`, `Dockerfile`, `docker-compose.yml`, `scripts/{start-production.mjs,package-release.py}`, `.env.example`, `.env.production.example`, `package.json`, `e2e/{workspace.spec.ts,import-mobile.spec.ts}`, `README.md` et `docs/HEBERGEMENT-GRATUIT.md`. Aucun moteur financier n’est modifié.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
python -m unittest discover -s services/leboncoin-mcp -p "test_*.py"
pnpm test:e2e
pnpm build
```

Les tests unitaires utilisent une fixture JSON ; les tests d’intégration utilisent un serveur HTTP local simulé et PostgreSQL local, créent leurs propres comptes/SCI puis les suppriment. Ils refusent toute URL de base distante. Aucun test ne contacte réellement Leboncoin. Les logs applicatifs contiennent provider, ID, URL sans query/fragment, opération, statut et durée ; aucune clé n’est journalisée.

Le refus HTTP observé par l’ancien import provenait de la réponse du serveur distant. Sans le corps ni les en-têtes complets de cette réponse, on ne peut pas attribuer chaque ancien 403 avec certitude à DataDome plutôt qu’à une autre règle d’accès. Le [client lbc](https://github.com/etienne-hd/lbc) confirme qu’il peut également rencontrer des 403 ; passer par MCP ne supprime pas cette limite.
