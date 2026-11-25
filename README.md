# AssMat Antibes Facile

**Trouver une assistante maternelle à Antibes et Juan-les-Pins, sans parcourir un long PDF.**

[**Ouvrir AssMat Antibes Facile →**](https://flake9025.github.io/antibes-assmats/)

Vous cherchez un mode de garde pour votre enfant ? Cet outil indépendant transforme la [liste publique de la Ville d'Antibes](https://www.calameo.com/antibes-juanlespins/read/0020745049d2a4b6c7d81?authid=eugdIT3QJTmw) en une recherche simple, utilisable sur téléphone et ordinateur.

## Comment ça marche ?

1. Choisissez vos critères : nombre d'enfants, date de début, jours, horaires et secteur.
2. Consultez les résultats, puis appelez directement en touchant un numéro de téléphone.
3. Gardez une trace de vos échanges : « OK de principe », « KO de principe », « Pas de réponse » ou « RDV prévu », avec sa date.

Vous pouvez aussi saisir votre adresse pour estimer la distance à vol d'oiseau et voir les résultats les plus proches.

**À savoir :** les disponibilités et les conditions peuvent changer. La date de la liste utilisée est affichée sur le site ; confirmez toujours les places, les jours, les horaires et les conditions directement auprès des professionnelles. La liste donne les disponibilités au mois, pas au jour. Les cas ambigus restent visibles avec la mention « à confirmer » ; les conditions peuvent aussi varier d'une place à l'autre.

## Sur votre téléphone

Le site s'utilise sans compte et peut être ajouté à l'écran d'accueil depuis le menu de votre navigateur (« Installer l'application » ou « Ajouter à l'écran d'accueil »). Après une première visite complète en ligne, la liste et votre suivi restent accessibles hors ligne. Le calcul des distances nécessite une connexion.

## Vos données

Vos statuts et dates de rendez-vous restent dans le stockage local de votre navigateur : ils ne sont ni synchronisés ni envoyés au projet. Ils peuvent être perdus si vous effacez les données du navigateur ou changez d'appareil. Les deux lignes d'une même professionnelle partagent leur suivi.

Le calcul des distances est facultatif. Si vous l'utilisez, votre adresse et celles de la liste sont envoyées à l'[API de géocodage de l'IGN](https://geoservices.ign.fr/services-web-experts-geocodage). Les distances sont approximatives et dépendent de la qualité des adresses reconnues ; certaines adresses ne peuvent pas être localisées.

## Un projet utile aux familles

AssMat Antibes Facile est un projet indépendant : il n'est pas un service officiel de la Ville d'Antibes. Il s'appuie sur une liste municipale publique, sans garantir que les places sont encore disponibles.

Vous connaissez une famille qui cherche une assistante maternelle ? **Partagez-lui [le site](https://flake9025.github.io/antibes-assmats/)**. Une idée ou un problème ? [Ouvrez une issue](https://github.com/flake9025/antibes-assmats/issues).

## Contribuer

Les propositions d'amélioration et les corrections sont bienvenues. Pour lancer le projet localement avec Node.js 22 ou plus :

```sh
npm ci
npm run extract
npm test
npx serve .
```

Le script d'extraction lit le PDF présent dans `input` et génère `data.json` ainsi que la date dans `source.json` à partir du document. La CI vérifie les tests et que ces fichiers correspondent au PDF.

Chaque jour et à la demande dans l'onglet Actions, une vérification compare la révision de la couverture de la publication Calaméo avec celle enregistrée dans `source.json`. Si elle change, une issue est ouverte (une seule tant qu'elle reste ouverte). Cela détecte un changement de la publication à cette adresse, pas un éventuel déplacement vers une autre URL. Une erreur de lecture fait échouer l'action et doit être investiguée. La liste n'est **pas remplacée automatiquement**.

Pour mettre à jour : télécharger et remplacer le PDF indiqué dans `scripts/extract.mjs`, contrôler la nouvelle structure et les couleurs, exécuter `npm run extract`, vérifier tous les résultats et leur date, puis remplacer `source.json` → `revision` par la révision affichée par `node scripts/check-source.mjs`. Actualiser si nécessaire les libellés, les liens vers le PDF, et le numéro de cache dans `sw.js` pour que les appareils installés reçoivent les nouvelles données. Après validation, fermer l'issue. La publication sur GitHub Pages reste gérée par la branche `main`.
