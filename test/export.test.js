import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import writeExcelFile from 'write-excel-file/node';
import { strFromU8, unzipSync } from 'fflate';
import { excelData, exportRows } from '../export.js';
import { localDate } from '../lib.js';

test('export : données affichées, statut, rendez-vous et distance', () => {
  const offers = [{
    id: '1', name: 'Mme Exemple', sector: 'Antibes Centre', address: '1 rue du Test',
    phones: ['06 12 34 56 78'], places: 2, availability: 'Novembre',
    details: "Jours d'accueil : 4 jours Amplitude horaire : 8h - 18h",
    updated: '20/11/26', dayMatch: 'unknown', timeMatch: 'yes'
  }];
  const rows = exportRows(offers, { 1: { status: 'meeting', meeting: '2026-12-10T14:30' } }, new Map([['1', { km: 1.26 }]]), '20/11/2026');
  assert.equal(rows[0].phones, '06 12 34 56 78');
  assert.equal(rows[0].conditions, 'Jours : 4 jours\nHoraires : 8h - 18h');
  assert.equal(rows[0].checks, 'Jours');
  assert.equal(rows[0].distance, 1.3);
  assert.equal(rows[0].status, 'RDV prévu');
  assert.equal(rows[0].meeting, '2026-12-10 14:30');
  assert.equal(exportRows(offers, { 1: { status: 'ko', meeting: '2026-12-10T14:30' } }, new Map(), '')[0].meeting, '');
  const waiting = exportRows(offers, { 1: { status: 'awaiting', waitingSince: localDate() } }, new Map(), '')[0];
  assert.equal(waiting.status, 'En attente de réponse');
  assert.equal(waiting.waitingSince, localDate());
  assert.equal(waiting.waitingDays, 0);
  assert.equal(exportRows(offers, { 1: { status: 'ok', waitingSince: localDate() } }, new Map(), '')[0].waitingSince, '');
});

test('fichier Excel : téléphone et texte commençant par = restent du texte', async () => {
  const row = {
    name: '=1+1', sector: 'Antibes Centre', address: '1 rue du Test', phones: '06 12 34 56 78',
    places: 1, availability: 'Novembre', conditions: 'Jours : 5 jours', checks: '',
    distance: '', updated: '20/11/26', status: 'À contacter', waitingSince: '', waitingDays: '', meeting: '', sourceDate: '20/11/2026'
  };
  const bytes = await writeExcelFile(excelData([row])).toBuffer();
  const files = unzipSync(bytes);
  const strings = strFromU8(files['xl/sharedStrings.xml']);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.match(strings, /<t>=1\+1<\/t>/);
  assert.match(strings, /<t>06 12 34 56 78<\/t>/);
  assert.doesNotMatch(sheet, /<f(?:\s|>)/);
});
