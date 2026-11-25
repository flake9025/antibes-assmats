import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { daysMatch, dateMatch, distanceKm, geocodeQuery, timeMatch } from '../lib.js';

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
  assert.equal(geocodeQuery('Les Logis - Bât. F 1485, Chemin de St Claude - 06600 Antibes'), '1485, Chemin de St Claude, Antibes');
  assert.equal(geocodeQuery('2200, Chemin de Saint Claude Le Hameau de Saint Claude - Villa 112 06600 Antibes'), '2200, Chemin de Saint Claude, Antibes');
  assert.equal(geocodeQuery('Les Mimosas A 642, Bd Guillaume Apollinaire 06600 Antibes'), '642, Bd Guillaume Apollinaire, Antibes');
  assert.equal(geocodeQuery('85 rue du jardin secret 06160 Juan les Pins'), '85 rue du jardin secret, Antibes');
  assert.equal(geocodeQuery('2200 Chemin de Saint-Claude - Villa 112 06600 Antibes'), '2200 Chemin de Saint-Claude, Antibes');
});

test('extraction : les lignes fusionnées ne débordent pas sur les voisines', async () => {
  const offers = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
  const dinis = offers.find(offer => offer.name.includes('DINIS FERREIRA'));
  const sapanel = offers.find(offer => offer.name.includes('SAPANEL'));
  assert.equal((dinis.details.match(/Jours d'accueil/g) || []).length, 1);
  assert.equal((sapanel.details.match(/Jours d'accueil/g) || []).length, 2);
  assert.match(sapanel.details, /marche acquise/);
});
