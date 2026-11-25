# Petits liens — Antibes

Une application web installable pour rechercher les assistantes maternelles figurant dans la liste publique de la Ville d'Antibes et suivre ses prises de contact.

La date de la liste municipale utilisée est affichée dans l'application. Les secteurs reprennent les couleurs de sa légende. Les données ne sont pas actualisées automatiquement : places, dates, horaires et conditions doivent être confirmés auprès des professionnelles. Les disponibilités sont connues au mois, pas au jour ; les jours ambigus restent visibles avec une mention « à confirmer ». Certaines places d'une même personne peuvent avoir des conditions différentes.

Le suivi et les dates de rendez-vous sont conservés dans le stockage local du navigateur, sans compte ni synchronisation. Ils peuvent être perdus si les données du navigateur sont effacées ou si l'on change d'appareil. Les deux lignes d'une même professionnelle partagent leur suivi.

Le calcul facultatif des distances envoie l'adresse saisie et les adresses de la liste à l'[API de géocodage IGN](https://geoservices.ign.fr/services-web-experts-geocodage). Il nécessite Internet ; les distances sont à vol d'oiseau, approximatives et dépendent de la qualité des adresses reconnues. Les adresses non localisées n'ont pas de distance.

## Utilisation

Ouvrir le site HTTPS publié, puis utiliser le menu du navigateur pour l'installer sur son téléphone ou ordinateur. Après une première visite complète en ligne, la liste et le suivi restent accessibles hors ligne ; les distances nécessitent une connexion.

## Publication GitHub Pages

Dans **Settings → Pages**, choisir **Deploy from a branch**, puis la branche **main** et le dossier **/ (root)**, et enregistrer. L'adresse prévue est `https://flake9025.github.io/antibes-assmats/`.

## Développement

Avec Node.js 22 ou plus :

```sh
npm ci
npm run extract
npm test
npx serve .
```

Le script d'extraction lit le PDF présent dans `input` et génère `data.json` ainsi que la date dans `source.json` à partir du document. La CI vérifie les tests et que ces fichiers correspondent au PDF.

Chaque jour et à la demande dans l'onglet Actions, une vérification compare la révision de la couverture de la publication Calaméo avec celle enregistrée dans `source.json`. Si elle change, une issue est ouverte (une seule tant qu'elle reste ouverte). Cela détecte un changement de la publication à cette adresse, pas un éventuel déplacement vers une autre URL. Une erreur de lecture fait échouer l'action et doit être investiguée. La liste n'est **pas remplacée automatiquement**.

Pour mettre à jour : télécharger et remplacer le PDF indiqué dans `scripts/extract.mjs`, contrôler la nouvelle structure et les couleurs, exécuter `npm run extract`, vérifier tous les résultats et leur date, puis remplacer `source.json` → `revision` par la révision affichée par `node scripts/check-source.mjs`. Actualiser si nécessaire les libellés, les liens vers le PDF, et le numéro de cache dans `sw.js` pour que les appareils installés reçoivent les nouvelles données. Après validation, fermer l'issue. La publication sur Pages reste gérée par la branche `main`.
