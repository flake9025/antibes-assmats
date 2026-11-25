import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { daysMatch, dateMatch, distanceKm, geocodeQuery } from '../lib.js';

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
