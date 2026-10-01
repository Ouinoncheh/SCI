# Activer la connexion Google

Le bouton « Continuer avec Google » apparaît sur `/connexion` et `/inscription` lorsque `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont tous deux configurés. Better Auth crée le compte lors de la première connexion et réutilise ensuite ce compte. La destination est `/espace`, où l'utilisateur peut créer sa SCI. Les comptes email restent disponibles. Aucune migration n'est nécessaire : la table `Account` existe déjà.

## Google Cloud

1. Ouvrir https://console.cloud.google.com/ et créer ou sélectionner un projet.
2. Dans Google Auth Platform, configurer le nom PredictSCI, l'adresse de support et l'audience externe. En mode test, ajouter les adresses des testeurs ; pour les utilisateurs publics, publier l'écran de consentement et compléter les exigences indiquées par Google.
3. Créer un client OAuth de type **Application Web**.
4. Ajouter l'URI de redirection exacte correspondant à `BETTER_AUTH_URL` : `https://axelblaze.bid/api/auth/callback/google`. Si l'application utilise encore son domaine Render, ajouter aussi `https://predictsci.onrender.com/api/auth/callback/google`.
5. Pour la preview locale, ajouter `http://127.0.0.1:3000/api/auth/callback/google`. `localhost` et `127.0.0.1` sont distincts : utiliser l'adresse réellement configurée dans `BETTER_AUTH_URL`.
6. Copier l'identifiant client et le secret dans les réglages privés de Render, sous `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis redéployer. Pour la preview, les ajouter au fichier privé `.env`, puis redémarrer Next.js.

Ne jamais publier le secret dans GitHub ou le transmettre dans le chat. Aucun accès Gmail ou Drive n'est demandé : le fournisseur utilise les informations de profil et d'identité nécessaires à la connexion.

## Vérification après activation

Tester une première inscription Google, la déconnexion/reconnexion, le retour après annulation et un compte email existant avec la même adresse vérifiée. Vérifier que les biens et droits de SCI restent associés au bon utilisateur. Les règles de liaison et de vérification de Better Auth restent actives ; aucune adresse non vérifiée n'est forcée comme vérifiée par l'application.

Sans identifiants réels, les tests de configuration et du formulaire ne constituent pas une connexion Google de bout en bout réussie.

Documentation : https://better-auth.com/docs/authentication/google
