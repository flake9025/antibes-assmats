import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { daysMatch, dateMatch, daysSince, distanceKm, firstDayNextMonth, formatConditions, geocodeQuery, geocodeResult, mapsAddress, mapsUrl, sortOffers, timeMatch } from '../lib.js';

test('durée d’attente en jours calendaires, sans date future ou invalide', () => {
  const today = new Date(2027, 2, 29, 0, 5);
  assert.equal(daysSince('2027-03-29', today), 0);
  assert.equal(daysSince('2027-03-27', today), 2);
  assert.equal(daysSince('2027-03-30', today), null);
  assert.equal(daysSince('2027-02-30', today), null);
  assert.equal(daysSince('', today), null);
});

test('date par défaut : premier jour du mois suivant, même en fin d’année', () => {
  assert.equal(firstDayNextMonth(new Date(2026, 10, 25)), '2026-12-01');
  assert.equal(firstDayNextMonth(new Date(2026, 11, 31)), '2027-01-01');
  assert.equal(firstDayNextMonth(new Date(2027, 0, 31)), '2027-02-01');
});

test('Google Maps : itinéraire avec origine, recherche sinon', () => {
  const destination = "2 rue de l'Église & du Port, Antibes";
  const origin = '  1 avenue A & B, Antibes  ';
  const route = new URL(mapsUrl(destination, origin));
  assert.equal(route.pathname, '/maps/dir/');
  assert.equal(route.searchParams.get('api'), '1');
  assert.equal(route.searchParams.get('origin'), origin.trim());
  assert.equal(route.searchParams.get('destination'), destination);
  const search = new URL(mapsUrl(destination, '  '));
  assert.equal(search.pathname, '/maps/search/');
  assert.equal(search.searchParams.get('query'), destination);
  assert.equal(search.searchParams.has('origin'), false);
});

test('Google Maps : simplification des adresses sans perdre le code postal', () => {
  const address = '296 Chemin des oliviers Bât A Les oliviers 06 600 Antibes';
  const expected = '296 Chemin des oliviers, 06600 Antibes';
  assert.equal(mapsAddress(address), expected);
  assert.equal(new URL(mapsUrl(address, 'Chez moi')).searchParams.get('destination'), expected);
  assert.equal(new URL(mapsUrl(address, '')).searchParams.get('query'), expected);
  assert.equal(mapsAddress('Les Nymphéas - Bât. C 85 rue du jardin secret 06160 Juan les Pins'), '85 rue du jardin secret, 06160 Juan-les-Pins');
  assert.equal(mapsAddress('Les Terrasses - T2 357 bd Pierre Delmas Antibes'), '357 bd Pierre Delmas, Antibes');
  assert.equal(mapsAddress('2 rue du Parc 06600 Antibes'), '2 rue du Parc 06600 Antibes');
  assert.equal(mapsAddress('Lieu-dit sans numéro, Antibes'), 'Lieu-dit sans numéro, Antibes');
});

test('filtres de jours : exclusion certaine et cas ambigus', () => {
  assert.equal(daysMatch("Jours d'accueil : 4 jours sans mercredi Amplitude horaire : 8h", ['mercredi']), 'no');
  assert.equal(daysMatch("Jours d'accueil : lundi, mardi et vendredi Amplitude horaire : 8h", ['jeudi']), 'no');
  assert.equal(daysMatch("Jours d'accueil : du lundi au vendredi Amplitude horaire : 8h", ['mercredi']), 'yes');
  assert.equal(daysMatch("Jours d'accueil : 4 jours sans mercredi ou 5 jours Amplitude horaire : 8h", ['mercredi']), 'unknown');
  assert.equal(daysMatch("Jours d'accueil : 5 jours ou 4 jours sans mercredi Amplitude horaire : 8h", ['mercredi']), 'unknown');
  assert.equal(daysMatch("Jours d'accueil : 4 jours (possibilité mercredi) Amplitude horaire : 8h", ['mercredi']), 'unknown');
  assert.equal(daysMatch("Jours d'accueil : 3 jours lundi, mardi, vendredi Jours d'accueil : 4 jours Amplitude horaire : 8h", ['jeudi']), 'unknown');
});

test('filtre de date par mois et plage avec changement d’année', () => {
  assert.equal(dateMatch('Janvier 2027', '2026-12-01'), false);
  assert.equal(dateMatch('Janvier 2027', '2027-01-01'), true);
  assert.equal(dateMatch('De novembre à février 2027', '2026-11-20'), true);
  assert.equal(dateMatch('De novembre à février 2027', '2027-03-01'), false);
  assert.equal(dateMatch('Non précisé', '2027-01-01'), true);
});

test('filtre horaire et plages conditionnelles', () => {
  const details = "Jours d'accueil : 5 jours Amplitude horaire : 7h30 - 18h00 Age de l'enfant : 3 mois";
  assert.equal(timeMatch(details, '08:00', '18:00'), 'yes');
  assert.equal(timeMatch(details, '07:00', '17:00'), 'no');
  assert.equal(timeMatch(details, '', '18:30'), 'no');
  assert.equal(timeMatch("Amplitude horaire : 7h30 / 17h si 5 jours 7h30 / 17h30 si 4 jours", '08:00', '18:00'), 'unknown');
  assert.equal(timeMatch("Amplitude horaire : 6h30/7h jusqu'à 16h30/17h", '08:00', '18:00'), 'unknown');
  assert.equal(timeMatch('Amplitude horaire : non précisée', '08:00', '18:00'), 'unknown');
  assert.equal(timeMatch(details, '', ''), 'yes');
});

test('distance à vol d’oiseau', () => {
  assert.equal(distanceKm([7, 43], [7, 43]), 0);
  assert.ok(Math.abs(distanceKm([0, 0], [1, 0]) - 111.2) < 0.2);
});

test('préparation des adresses de la liste au géocodage', () => {
  assert.equal(geocodeQuery('Les Logis - Bât. F 1485, Chemin de St Claude - 06600 Antibes'), '1485, Chemin de St Claude, 06600 Antibes');
  assert.equal(geocodeQuery('2200, Chemin de Saint Claude Le Hameau de Saint Claude - Villa 112 06600 Antibes'), '2200, Chemin de Saint Claude, 06600 Antibes');
  assert.equal(geocodeQuery('Les Mimosas A 642, Bd Guillaume Apollinaire 06600 Antibes'), '642, Bd Guillaume Apollinaire, 06600 Antibes');
  assert.equal(geocodeQuery('85 rue du jardin secret 06160 Juan les Pins'), '85 rue du jardin secret, 06160 Juan-les-Pins');
  assert.equal(geocodeQuery('2200 Chemin de Saint-Claude - Villa 112 06600 Antibes'), '2200 Chemin de Saint-Claude, 06600 Antibes');
  assert.equal(geocodeQuery('5 impasse des tilleuls 06 600 Antibes'), '5 impasse des tilleuls, 06600 Antibes');
  assert.equal(geocodeQuery('296 Chemin des oliviers Bât A Les oliviers 06 600 Antibes'), '296 Chemin des oliviers, 06600 Antibes');
  assert.equal(geocodeQuery('950 Bd Guillaume Apollinaire- Les Lavandes - E3 06600 Antibes'), '950 Bd Guillaume Apollinaire, 06600 Antibes');
  assert.equal(geocodeQuery('728 route de saint jean Le Grand Chêne B 06600 Antibes'), '728 route de saint jean, 06600 Antibes');
  assert.equal(geocodeQuery('2 rue du Général Vandenberg Caserne Gazan 06600 Antibes'), '2 rue du Général Vandenberg, 06600 Antibes');
  assert.equal(geocodeQuery('152 Boulevard Raymond Poincaré Le Trianon Bât A 06160 Antibes Juan-Les Pins'), '152 Boulevard Raymond Poincaré, 06160 Juan-les-Pins');
  assert.equal(geocodeQuery('2 rue du Parc 06 600 Antibes'), '2 rue du Parc 06600 Antibes');
});

test('géocodage : accepter la rue exacte comme approximation uniquement pour une destination', () => {
  const query = '5 impasse des tilleuls, 06600 Antibes';
  const feature = {
    properties: { label: 'Impasse des Tilleuls 06600 Antibes', name: 'Impasse des Tilleuls', score: 0.82, type: 'locality', citycode: '06004' },
    geometry: { coordinates: [7.11, 43.6] }
  };
  assert.equal(geocodeResult(feature, query), null);
  assert.deepEqual(geocodeResult(feature, query, true), { coordinates: [7.11, 43.6], label: feature.properties.label });
  assert.equal(geocodeResult({ ...feature, properties: { ...feature.properties, name: 'Rond-point des Tilleuls' } }, query, true), null);
  assert.equal(geocodeResult({ ...feature, properties: { ...feature.properties, citycode: '06088' } }, query, true), null);
  assert.equal(geocodeResult({ ...feature, properties: { ...feature.properties, score: 0.79 } }, query, true), null);
  assert.equal(geocodeResult({ ...feature, geometry: { coordinates: [NaN, 43.6] } }, query, true), null);
  assert.deepEqual(geocodeResult({ ...feature, properties: { ...feature.properties, type: 'housenumber' } }, query), { coordinates: [7.11, 43.6], label: feature.properties.label });
});
test('extraction : les lignes fusionnées ne débordent pas sur les voisines', async t => {
  const source = JSON.parse(await readFile(new URL('../source.json', import.meta.url), 'utf8'));
  if (source.revision !== '261120171359-ded507ebe2ee23e40ed4c1c2c73b84d9') return t.skip('La liste de référence a changé.');
  const offers = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
  const dinis = offers.find(offer => offer.name.includes('DINIS FERREIRA'));
  const sapanel = offers.find(offer => offer.name.includes('SAPANEL'));
  assert.equal((dinis.details.match(/Jours d'accueil/g) || []).length, 1);
  assert.equal((sapanel.details.match(/Jours d'accueil/g) || []).length, 2);
  assert.match(sapanel.details, /marche acquise/);
});

test('présentation des conditions sans perdre les particularités', () => {
  const text = "Recherche périscolaire uniquement Jours d'accueil : mercredi Amplitude horaire : 9h - 17h Age des enfant s : marche acquise Pour les dépannages : tout âge";
  assert.deepEqual(formatConditions(text), [
    { label: 'À noter', value: 'Recherche périscolaire uniquement' },
    { label: 'Jours', value: 'mercredi' },
    { label: 'Horaires', value: '9h - 17h' },
    { label: 'Âge', value: 'marche acquise' },
    { label: 'Dépannages', value: 'tout âge' }
  ]);
  assert.deepEqual(formatConditions('Information libre'), [{ label: 'À noter', value: 'Information libre' }]);
  assert.equal(formatConditions("Jours d'accueil : 5 jours Jours d'accuei l : 4 jours").length, 2);
});

test('tri des offres, distances absentes et dates récentes', () => {
  const offers = [
    { id: 'a', name: 'Mme Zola', address: '10 rue A', places: 1, updated: '20/10/26' },
    { id: 'b', name: 'Mme Émile', address: '2 rue A', places: 3, updated: '01/11/26' },
    { id: 'c', name: 'Mme Alain', address: '1 rue A', places: 2, updated: '09/09/26' }
  ];
  const distances = new Map([['a', { km: 2 }], ['b', { km: 1 }]]);
  const saved = { a: { status: 'meeting' }, b: { status: 'ko' } };
  const sorted = by => sortOffers([...offers], by, distances, saved).map(offer => offer.id);
  assert.deepEqual(sorted('original'), ['a', 'b', 'c']);
  assert.deepEqual(sorted('name'), ['c', 'b', 'a']);
  assert.deepEqual(sorted('places'), ['b', 'c', 'a']);
  assert.deepEqual(sorted('address'), ['c', 'b', 'a']);
  assert.deepEqual(sorted('distance'), ['b', 'a', 'c']);
  assert.deepEqual(sorted('updated'), ['b', 'a', 'c']);
  assert.deepEqual(sorted('status'), ['c', 'b', 'a']);
});
