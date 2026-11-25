import { appendFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { extractRevision } from './calameo.mjs';

const destination = process.argv[2];
if (!destination) throw new Error('Indiquer le chemin du PDF à télécharger.');
const source = JSON.parse(await readFile('source.json', 'utf8'));

async function currentRevision() {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Calaméo répond HTTP ${response.status}`);
  return extractRevision(await response.text());
}

const revision = await currentRevision();
if (process.env.EXPECTED_REVISION && revision !== process.env.EXPECTED_REVISION) {
  throw new Error('La publication a changé depuis la vérification initiale.');
}
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ locale: 'fr-FR', acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const downloadButton = page.getByRole('button', { name: 'Télécharger le document', exact: true });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    let dismissed = false;
    for (const name of ['Refuser', 'Je refuse']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 5000 });
        dismissed = true;
      }
    }
    if (dismissed) continue;
    if (await downloadButton.isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  if (!await downloadButton.isVisible().catch(() => false) ||
      !await downloadButton.isEnabled() ||
      (await downloadButton.getAttribute('class') || '').includes('button-disabled')) {
    throw new Error('Le téléchargement du PDF n’est pas disponible dans la liseuse Calaméo.');
  }
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    downloadButton.click({ timeout: 10000 })
  ]);
  if (await download.failure()) throw new Error('Échec du téléchargement du PDF.');
  if (await currentRevision() !== revision) throw new Error('La publication a changé pendant le téléchargement.');
  await download.saveAs(destination);
  const pdf = await readFile(destination);
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Le fichier téléchargé n’est pas un PDF.');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `revision=${revision}\n`);
  console.log(`PDF téléchargé : révision ${revision}.`);
} finally {
  await browser.close();
}
