# Mise en ligne de PredictSCI

**Choix actuel : aucun abonnement.** Suivre [HEBERGEMENT-GRATUIT.md](HEBERGEMENT-GRATUIT.md) pour Render Free + Supabase Free + Resend Free. La section Railway ci-dessous est une alternative historique, non retenue.

## Architecture

Le projet est préparé pour un service Node.js permanent ou un conteneur Docker, avec PostgreSQL persistant, une origine HTTPS et un fournisseur d’emails SMTP ou Resend HTTPS. Le processus permanent convient également au worker de projections visuelles. Un déploiement serverless demanderait un worker séparé avant d’activer ces générations.

Le domaine demandé est **axelblaze.bid**. Le fournisseur et les accès restent à définir. Aucun compte, achat ni déploiement public n’a été effectué. Le Dockerfile constitue une préparation : Docker n’est pas installé dans cet environnement et sa construction doit être vérifiée sur l’hébergeur choisi.

## Variables privées à configurer sur l’hébergeur

- `DATABASE_URL` : base PostgreSQL de production, avec connexion TLS selon les instructions du fournisseur.
- `BETTER_AUTH_URL=https://axelblaze.bid` : origine publique HTTPS.
- `BETTER_AUTH_SECRET` : secret aléatoire unique de 32 caractères minimum, généré dans le gestionnaire de secrets de l’hébergeur.
- `MAIL_MODE=smtp` ; `SMTP_URL` et `MAIL_FROM` : fournisseur SMTP et expéditeur vérifié.
- Pour Railway Hobby : `MAIL_MODE=resend`, `RESEND_API_KEY` et `MAIL_FROM` avec un domaine expéditeur vérifié dans Resend. SMTP reste disponible comme alternative sur un hébergeur autorisant les connexions sortantes SMTP.
- `DESIGN_GENERATION_ENABLED=false` pour la première mise en ligne. Configurer ultérieurement les paramètres OpenAI si cette fonctionnalité doit être activée.

Ne jamais importer le fichier `.env` de développement, les comptes de test ni les messages `.local/mail`. Le contexte Docker les exclut. Aucun secret n’est nécessaire à la compilation et aucune variable privée ne doit utiliser le préfixe `NEXT_PUBLIC_`.

## Installation sur un service Node

Utiliser Node 24 et pnpm 11.25.0. À la construction : `pnpm install --frozen-lockfile`, `pnpm db:generate`, puis `pnpm build`. Avant la première exécution et à chaque livraison contenant des migrations : lancer `pnpm db:deploy` avec la base de production. Démarrer avec `pnpm start:production`. Le serveur écoute sur `0.0.0.0` et utilise la variable `PORT` du fournisseur. Le script refuse les configurations d’authentification ou d’emails manquantes sans afficher les secrets.

## Installation par conteneur

Construire avec `docker build -t predictsci .`. Appliquer les migrations dans une tâche ponctuelle utilisant la même image et les variables privées : `node node_modules/prisma/build/index.js migrate deploy`. Démarrer ensuite le conteneur avec les variables configurées dans l’hébergeur ; exposer son port 3000 derrière le proxy HTTPS. Ne pas lancer de seed sur la base de production. Le conteneur s’exécute comme utilisateur non privilégié.

## Vérifications avant ouverture

Configurer une sonde sur `/api/health` : 200 lorsque PostgreSQL répond, 503 sinon. Cette sonde ne vérifie pas la livraison SMTP ni l’ensemble des migrations. Tester une inscription, le message de vérification, la connexion, la récupération de mot de passe, la création d’une SCI et l’enregistrement d’un bien. Vérifier ces parcours sur Safari iPhone et contrôler les photos privées avec un autre compte. Le proxy ne doit pas conserver les URL contenant les jetons de vérification ou de récupération dans des journaux accessibles.

Activer les sauvegardes PostgreSQL et tester une restauration avant d’y enregistrer des données réelles. Les images sont actuellement stockées dans PostgreSQL : les sauvegardes les incluent et la capacité de stockage doit en tenir compte. Les imports de portails bloqués restent assistés après mise en ligne.

## Railway et Cloudflare

Créer un projet Railway avec un service PostgreSQL et un service application utilisant ce Dockerfile. Définir les variables privées sur le service application ; lier `DATABASE_URL` à la variable du service PostgreSQL pour utiliser le réseau interne. Configurer la commande avant déploiement `node node_modules/prisma/build/index.js migrate deploy` et la sonde `/api/health`. Conserver une seule instance application pour la première livraison.

Créer un domaine personnalisé `axelblaze.bid` dans les réglages réseau du service application. Railway donnera la cible CNAME et les éventuels enregistrements de validation TXT. Copier exactement ces valeurs dans la zone DNS Cloudflare, sans inventer de cible et sans remplacer les enregistrements de messagerie existants. Vérifier le certificat HTTPS et l’accès avant toute redirection supplémentaire de `www`. Aucun DNS n’a été modifié pendant la préparation.

Créer et vérifier le domaine d’envoi dans Resend ; recopier ses valeurs DNS exactes dans Cloudflare. La clé d’API reste dans les variables privées Railway. Les emails HTTPS sont implémentés et testés avec un fournisseur simulé ; la réception réelle doit être testée après configuration.

Railway Hobby démarre à 5 USD/mois, comptés dans la consommation ; le total augmente si les ressources dépassent ce montant. Les offres Free/Trial/Hobby bloquent SMTP, d’où l’option HTTPS. Vérifier également le plan, les quotas et la tarification du fournisseur d’emails avant souscription.

Sources : [tarification Railway](https://docs.railway.com/pricing), [emails sortants](https://docs.railway.com/networking/outbound-networking), [domaines Railway](https://docs.railway.com/networking/domains/working-with-domains), [API Resend](https://resend.com/docs/api-reference/emails/send-email).
