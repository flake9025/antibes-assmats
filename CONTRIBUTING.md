# Contribuer à Easy Nanny Antibes

Avec Node.js 22 ou plus :

```sh
npm ci
npm run vendor
npm run extract
npm test
npx serve .
```

Le script d'extraction lit le PDF présent dans `input` et génère `data.json` ainsi que la date dans `source.json` à partir du document. La CI vérifie les tests et que ces fichiers correspondent au PDF.

Le bundle Excel et ses licences sont générés dans `vendor` avec `npm run vendor` pour que l'export fonctionne sans connexion.

Chaque nuit à 02 h 17 UTC et à la demande dans l'onglet Actions, une vérification compare la révision de la publication Calaméo avec celle enregistrée dans `source.json`. En cas de changement, le workflow télécharge le PDF avec le bouton autorisé de la liseuse, vérifie que la révision reste stable, extrait les données et exécute les tests. Si tout réussit, il commite le PDF, les données, la date et la nouvelle version du cache, puis déploie le site. Le PDF et les données restent disponibles hors ligne.

La mise à jour est interrompue en cas d'erreur, notamment si un secteur ne correspond pas à une ligne, si la date recule ou si le nombre d'offres tombe à moins de la moitié de la liste précédente. Une issue est alors ouverte ; il faut examiner les journaux et adapter l'extraction ou vérifier le PDF avant de relancer. Ces contrôles ne garantissent pas l'absence de toute erreur d'extraction. Un déplacement vers une autre URL n'est pas détecté.

Le téléchargement automatique utilise Chrome, installé sur le runner GitHub ; localement, `CHROME_PATH` permet d'indiquer son chemin. GitHub Pages doit utiliser la source **GitHub Actions** : le workflow de déploiement est appelé après la vérification nocturne, car un commit effectué avec `GITHUB_TOKEN` ne déclenche pas une publication par branche.
