# Mise en ligne sans abonnement

Choix retenu : Render Free (application), Supabase Free (PostgreSQL et Storage privé), Resend Free (emails), Cloudflare (DNS d’axelblaze.bid). Le fichier `render.yaml` ne provisionne qu’un service gratuit et aucune base Render. La génération IA reste désactivée. Aucun compte externe ni DNS n’a été modifié pendant la préparation.

## 1. Supabase

Créer un projet sur le plan Free, de préférence en Europe. Conserver le mot de passe de la base dans un gestionnaire de mots de passe. Dans Storage, créer le bucket **predictsci-private**, avec l’option Public désactivée. Autoriser les fichiers jusqu’à 20 Mo ; les fichiers téléversés utilisent le type `application/octet-stream` et sont restitués par l’application avec le type approprié.

Dans les paramètres du projet, relever l’URL `https://…supabase.co` et la clé serveur `service_role` (jamais la clé publique anon). Les saisir uniquement dans les variables privées du service Render : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Le nom de bucket est déjà défini par le Blueprint.

Pour `DATABASE_URL`, utiliser la chaîne PostgreSQL du **pooler en mode Session**, port 5432, compatible IPv4. Ne pas utiliser le pooler transactionnel port 6543 pour les migrations. Encoder les caractères spéciaux du mot de passe dans l’URL. L’application conserve Better Auth et Prisma ; il n’est pas nécessaire de remplacer l’authentification par Supabase Auth.

## 2. Resend

Créer un compte Free, ajouter et vérifier le domaine d’envoi. Copier les enregistrements DNS exacts fournis par Resend dans Cloudflare. Créer une clé d’envoi et la saisir dans `RESEND_API_KEY` sur Render. Définir `MAIL_FROM`, par exemple `PredictSCI <contact@axelblaze.bid>`, après vérification de ce domaine. Les messages restent soumis aux quotas du plan Free.

## 3. Source et Render

Render doit pouvoir lire le code depuis un dépôt GitHub ou GitLab. Publier le code dans un dépôt personnel, idéalement privé, sans `.env`, `.local`, `node_modules`, `.next` ni comptes ou messages de test. Une archive propre peut être générée avec `scripts/package-release.py` ; elle inclut uniquement les sources et fichiers de configuration autorisés.

Dans Render, choisir **New → Blueprint** et connecter le dépôt contenant `render.yaml`. Vérifier **plan: free** avant de créer le service. Renseigner les variables privées demandées. Le secret Better Auth est généré par Render. Les migrations sont exécutées au démarrage parce que les commandes pre-deploy ne sont pas disponibles sur les services gratuits ; en cas d’échec le serveur ne démarre pas. Aucun seed de démonstration n’est exécuté. La sonde `/api/health` contrôle PostgreSQL.

## 4. Domaine

Dans le service Render, ajouter **axelblaze.bid** comme domaine personnalisé. Render fournit la cible DNS : copier exactement cette cible dans Cloudflare (CNAME à la racine, avec flattening Cloudflare) et suivre la validation indiquée. Ne pas remplacer les enregistrements MX/TXT de messagerie. Attendre que Render confirme le certificat HTTPS. `BETTER_AUTH_URL` est déjà configuré pour `https://axelblaze.bid` ; les connexions et inscriptions doivent être testées sur cette origine.

## 5. Vérifications

Le conteneur inclut aussi le provider Leboncoin facultatif, sans second abonnement : voir [son fonctionnement et ses limites](LEBONCOIN.md). Il respecte les refus d’accès et conserve le fallback manuel ; sa présence ne garantit pas l’accès au portail.

Tester l’inscription avec réception réelle du message, la vérification, la connexion, la récupération de mot de passe, une SCI et un bien avec une photo. La photo doit apparaître dans le bucket privé et ses champs binaires en base rester nuls. Un utilisateur extérieur à la SCI ne doit pas pouvoir la consulter. Aucun test local n’envoie de vrais emails ni ne contacte un stockage Supabase réel.

Les anciens fichiers PostgreSQL restent lisibles ; ils ne sont pas déplacés automatiquement et aucune donnée locale n’est importée dans la base de production. Les imports convertis réutilisent leurs références privées sans dupliquer le contenu. Les fichiers d’un envoi échoué sont nettoyés ; si le fournisseur est indisponible pendant ce nettoyage, un objet orphelin peut rester à supprimer depuis le tableau de bord. Les clés serveur ne sont pas exposées au navigateur.

## Limites gratuites

Render peut mettre l’application en veille après 15 minutes sans trafic : le premier accès suivant peut être lent, et aucun worker ne fonctionne pendant la veille. Supabase Free fournit 500 Mo de base et 1 Go de fichiers, peut suspendre les projets peu actifs après une semaine, et n’inclut pas les sauvegardes automatiques. Ne pas passer sur une offre payante : à saturation, réduire l’utilisation ou suspendre la fonctionnalité concernée. Les sauvegardes doivent être exportées et conservées séparément. Le domaine doit toujours être renouvelé selon votre contrat existant.

Le Dockerfile est prêt mais sa construction Linux n’a pas été exécutée localement, Docker étant absent. Les tests locaux couvrent PostgreSQL, les routes privées et un stockage externe simulé ; la validation réelle se fera lors de la création des services.

Sources : [Render Free](https://render.com/docs/free), [Blueprints](https://render.com/docs/blueprint-spec), [Supabase Free](https://supabase.com/pricing), [Resend Free](https://resend.com/pricing).
