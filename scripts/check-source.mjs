import { readFile, appendFile } from 'node:fs/promises';
import { extractRevision } from './calameo.mjs';

const source = JSON.parse(await readFile('source.json', 'utf8'));
const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Calaméo répond HTTP ${response.status}`);
const revision = extractRevision(await response.text());
const changed = revision !== source.revision;
console.log(`Révision connue : ${source.revision}\nRévision actuelle : ${revision}\n${changed ? 'Mise à jour à vérifier.' : 'Pas de changement détecté.'}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\nrevision=${revision}\n`);
