import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extractRevision, validateUpdate } from './calameo.mjs';

const pdf = process.argv[2];
const revision = process.env.EXPECTED_REVISION;
if (!pdf || !/^[a-z0-9-]+$/i.test(revision || '')) throw new Error('PDF ou révision attendue manquants.');
const previous = JSON.parse(await readFile('data.json', 'utf8'));
const previousSource = JSON.parse(await readFile('source.json', 'utf8'));
if (revision === previousSource.revision) throw new Error('La révision est déjà publiée.');

await copyFile(pdf, 'input/20261120-liste-Asmat-internet.pdf');
execFileSync(process.execPath, ['scripts/extract.mjs'], { stdio: 'inherit' });
const offers = JSON.parse(await readFile('data.json', 'utf8'));
const source = JSON.parse(await readFile('source.json', 'utf8'));
validateUpdate(previous, offers, previousSource.pdfDate, source.pdfDate);
const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
if (!response.ok || extractRevision(await response.text()) !== revision) {
  throw new Error('Impossible de confirmer la révision de la publication après extraction.');
}
const sw = await readFile('sw.js', 'utf8');
const updatedSw = sw.replace(/^const CACHE = 'petits-liens-[^']+';/, `const CACHE = 'petits-liens-pdf-${revision}';`);
if (sw === updatedSw) throw new Error('Impossible de renouveler le cache de la PWA.');
source.revision = revision;
await writeFile('source.json', JSON.stringify(source, null, 2) + '\n');
await writeFile('sw.js', updatedSw);
console.log(`Mise à jour validée : ${offers.length} offres, liste du ${source.pdfDate}.`);
