# Visualisation des pièces et projections après travaux

## État réel

La galerie privée des pièces et le workflow des projets visuels sont disponibles dans l’onglet **Visualisation** d’un bien connecté. Les budgets associés sont gérés dans **Travaux & scénarios**. Cette livraison implémente un adaptateur OpenAI, des jobs persistants et le comparateur avant/après. **La génération réelle n’est pas activée localement** : aucune clé n’a été configurée ni aucun appel payant effectué pendant les tests.

Les tests montrent des images synthétiques et fournisseurs simulés uniquement. Une image réussie par le fournisseur réel reste dépendante de l’accès du compte, de la disponibilité et de ses limites. Aucune image simulée n’est produite par l’application en remplacement d’une génération réelle.

## Photos et pièces

Créer une pièce (type, étage, surface estimée et notes facultatives), puis ajouter des photos avec angle de vue et commentaire. Première photo : couverture de la pièce. Tous les membres peuvent consulter ; ADMIN/MEMBER peuvent ajouter.

**Modifier la photo** permet aux ADMIN/MEMBER de corriger l’angle et le commentaire, de choisir une couverture par pièce et de déplacer une photo. La couverture de la première pièce alimente également la vignette du bien. Un déplacement réattribue automatiquement la couverture de la pièce d’origine si nécessaire. Une photo utilisée dans un projet visuel, même archivé, ne peut pas être déplacée : ajouter une copie dans la nouvelle pièce. Les modifications concurrentes d’un même état sont refusées avec un message d’actualisation ; chaque changement est journalisé et limité à la SCI et au bien concernés.

JPEG/PNG/WebP non animés, 8 Mo et 40 mégapixels maximum ; 10 photos par envoi dans l’interface, 100 photos et 30 pièces par bien. HEIC non pris en charge : exporter en JPEG sur iPhone. Sharp produit des WebP de 2048 pixels maximum et des miniatures de 480 pixels, sans EXIF/GPS. Les octets et miniatures sont stockés en PostgreSQL, servis sur des routes privées `private, no-store`. Les originaux de la galerie ne sont pas archivés ; l’import d’annonce dispose séparément d’un original assaini.

Les uploads valident origine, session, rôle, flux borné et contenu réel. Les quotas sont protégés par verrou transactionnel. Une photo reste locale tant qu’aucune génération externe n’est demandée.

## Projet visuel

Dans la section Projections après travaux : choisir une photo, nom, style, niveau de rénovation et prompt. Des prompts cuisine/salon/chambre/salle de bain sont proposés et personnalisables. Le projet peut être associé à un scénario travaux existant, sans en modifier le budget ni le loyer.

**Enregistrer le projet visuel** conserve les paramètres, même lorsque le fournisseur n’est pas configuré. L’interface affiche alors « Génération IA non activée ». Créer un projet n’envoie aucune photo au fournisseur.

Une fois activée, choisir 1 à 3 variantes et confirmer l’envoi de la photo et du prompt à OpenAI pour une génération susceptible d’être facturée. Cliquer Générer crée des jobs PENDING ; le worker les passe PROCESSING, puis SUCCEEDED ou FAILED. La demande utilise une clé d’idempotence pour éviter les doublons lors d’une reprise après erreur réseau. Aucun échec n’est relancé automatiquement.

Un projet est immuable : pour changer le prompt/photo/style, Dupliquer charge une copie dans le formulaire, à ajuster et enregistrer. De nouvelles variantes d’un projet conservent son prompt original. Les variantes réussies peuvent être sélectionnées et une variante préférée conservée par projet. Archiver masque un projet et ses sorties sans supprimer les données ; un projet avec générations actives ne peut être archivé. La restauration et la suppression individuelle d’une variante restent à ajouter.

## Affichage et fiabilité

Le comparateur superpose photo réelle et projection avec un curseur. Si leurs rapports d’image ou perspectives diffèrent, l’affichage ne prouve aucune correspondance géométrique. L’image complète peut être ouverte séparément.

Chaque sortie reste associée au projet, prompt utilisateur et prompt complet envoyé, style, niveau, date, modèle, fournisseur et statut. L’interface affiche **« Visualisation IA indicative, non contractuelle »** et :

> Cette visualisation IA est indicative et ne remplace pas un devis, un plan technique ou une étude de faisabilité.

Le prompt demande de conserver perspective, murs et ouvertures, sans garantir une fidélité architecturale. Les rendus ne prouvent ni faisabilité, ni prix des travaux, ni surface, ni amélioration de DPE ou de valeur locative. Aucun montant financier n’est déduit automatiquement d’une image.

## Activation du fournisseur

Variables exclusivement côté serveur dans `.env`, puis redémarrer `pnpm dev` :

```dotenv
DESIGN_GENERATION_ENABLED=true
OPENAI_API_KEY=cle_du_compte_API
OPENAI_IMAGE_MODEL=gpt-image-1.5
```

Ne jamais publier ce fichier ni transmettre une clé dans une conversation. L’exemple de modèle est configurable : gpt-image-1.5, gpt-image-2, gpt-image-2.5-sunburst ou gpt-image-2.5-flare, sous réserve d’accès par votre compte. Ne pas activer avant d’avoir vérifié la facturation et les limites du compte API. L’application ne garantit ni crédit offert ni gratuité.

L’adaptateur utilise l’[API officielle d’édition d’images](https://developers.openai.com/api/reference/resources/images/methods/edit), avec photo WebP, prompt et une image par appel. Résultat base64 borné, assaini par Sharp puis stocké localement ; aucun lien distant de résultat ne sert à l’affichage. Qualité demandée medium, fidélité high, taille auto. Délai maximal réseau 150 s, sans retry automatique.

Le worker démarre par `src/instrumentation.ts` dans un serveur Node persistant lorsqu’activé. Il prend un job à la fois par instance avec PostgreSQL `FOR UPDATE SKIP LOCKED`. Les écritures terminales utilisent une lease pour éviter qu’un résultat tardif écrase un job expiré. Après 5 minutes, un job PROCESSING expiré passe FAILED, sans nouvelle requête : un fournisseur peut déjà avoir facturé la demande interrompue. Les jobs PENDING restent en base après redémarrage et peuvent être repris.

Ce worker intégré convient au serveur local ou à un runtime Node persistant. Pour du serverless, externaliser le worker dans un processus durable ; les timers d’un runtime suspendu ne garantissent pas la progression. L’accès réel à OpenAI et ce déploiement n’ont pas été validés par cette livraison.

## Quotas et sécurité

10 variantes demandées par SCI sur une fenêtre glissante de 24 heures ; 3 jobs actifs au maximum par SCI ; 3 variantes par demande ; 30 projets actifs par bien. Les échecs comptent aussi dans le quota pour limiter les relances éventuellement facturées. Ces quotas limitent les demandes, pas une facture en euros garantie.

Session, rôle et origine contrôlés sur les mutations. Photo et budget associés doivent appartenir au même bien et à la même SCI. La clé API reste côté serveur. Les logs et erreurs client ne contiennent ni clé, ni détail brut du fournisseur. Le consentement de transmission est conservé dans le journal de la demande. Les résultats sont privés, sans cache partagé. Choisir une variante préférée ou archiver ne modifie pas l’analyse financière.

## Architecture et données

- `src/visualization/design.ts` : paramètres, prompts, ImageGenerationProvider, DesignProjectionService.
- `src/visualization/projection-job.ts` : génération injectée, assainissement et stockage.
- `src/server/image-provider.ts` : adaptateur OpenAI et configuration.
- `src/server/designs.ts` : projets, demandes, quotas, idempotence, préféré, archive.
- `src/server/design-worker.ts` : prise de job, leases et transitions.
- `src/ui/design-studio.tsx` : préparation, suivi, variantes, avant/après.

Migration `20261001071024_design_projects` : RoomDesignProject et GeneratedVisual ; relations composites vers le bien et le projet. La migration de galerie `20261001060954_room_photos` demeure nécessaire. Le stockage PostgreSQL inclut les images dans les sauvegardes ; prévoir un stockage objet privé si la volumétrie augmente.

## Validation et suite

Tests : paramètres/prompt, fournisseur simulé, variantes bornées, assainissement et miniature, résultat invalide, erreur sans retry, jobs désactivés/PROCESSING/SUCCEEDED/FAILED et absence de détails sensibles. Parcours connecté : projet lié à la photo et au budget, permissions, photo étrangère refusée, génération sans fournisseur en 503, consentement requis, avant/après mobile sur fixture et archivage.

Les tests ne contactent pas l’API réelle. Analyse visuelle assistée avec confiance, suggestions de travaux, gestion fine des variantes et restauration des projets restent des étapes suivantes.
