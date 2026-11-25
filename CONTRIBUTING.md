# Contribuer à AssMat Antibes Facile

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

Chaque jour et à la demande dans l'onglet Actions, une vérification compare la révision de la couverture de la publication Calaméo avec celle enregistrée dans `source.json`. Si elle change, une issue est ouverte (une seule tant qu'elle reste ouverte). Cela détecte un changement de la publication à cette adresse, pas un éventuel déplacement vers une autre URL. Une erreur de lecture fait échouer l'action et doit être investiguée. La liste n'est **pas remplacée automatiquement**.

Pour mettre à jour : télécharger et remplacer le PDF indiqué dans `scripts/extract.mjs`, contrôler la nouvelle structure et les couleurs, exécuter `npm run extract`, vérifier tous les résultats et leur date, puis remplacer `source.json` → `revision` par la révision affichée par `node scripts/check-source.mjs`. Actualiser si nécessaire les libellés, les liens vers le PDF, et le numéro de cache dans `sw.js` pour que les appareils installés reçoivent les nouvelles données. Après validation, fermer l'issue. La publication sur GitHub Pages reste gérée par la branche `main`.
