import { readFile, writeFile } from 'node:fs/promises';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = 'input/20261120-liste-Asmat-internet.pdf';
const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), useSystemFonts: true }).promise;
const source = JSON.parse(await readFile('source.json', 'utf8'));
const offers = [];
const sectors = {
  '#92d050': 'Antibes Ouest résidentiel',
  '#66ccff': 'Antibes Activités',
  '#cc99ff': 'Antibes Grand Est',
  '#ffcc99': 'Antibes Centre',
  '#fabf8f': 'Antibes Centre',
  '#ffff99': 'Antibes Cœurs de ville et Cap',
  '#ffff00': 'Antibes Cœurs de ville et Cap'
};

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber);
  const { items } = await page.getTextContent();
  const words = items.filter(item => item.str?.trim()).map(item => ({
    text: item.str.trim(), x: item.transform[4], y: item.transform[5]
  }));
  if (pageNumber === 1) {
    const date = words.find(w => w.x < 55 && w.y > 400 && /^\d{2}\/\d{2}\/\d{4}$/.test(w.text));
    if (!date) throw new Error('Date de la liste introuvable en première page.');
    const [day, month, year] = date.text.split('/');
    source.pdfDate = `${year}-${month}-${day}`;
  }
  const operators = await page.getOperatorList();
  const blocks = [];
  const boundaries = [];
  let color;
  for (let i = 0; i < operators.fnArray.length; i++) {
    if (operators.fnArray[i] === OPS.setFillRGBColor) color = operators.argsArray[i][0];
    if (operators.fnArray[i] === OPS.constructPath) {
      const bounds = operators.argsArray[i][2];
      if (bounds && bounds[0] < 6 && bounds[2] > 560 && bounds[3] - bounds[1] < 2) boundaries.push(bounds[1]);
      if (bounds && sectors[color] && bounds[0] > 53 && bounds[0] < 55 && bounds[2] > 71 && bounds[2] < 73) {
        blocks.push({ bottom: bounds[1], top: bounds[3], color });
      }
    }
  }
  const centers = words.filter(w => w.x >= 530 && /^\d{2}\/\d{2}\/\d{2}$/.test(w.text))
    .sort((a, b) => b.y - a.y);
  if (blocks.some(block => !centers.some(center => center.y >= block.bottom && center.y <= block.top))) {
    throw new Error(`Secteur sans ligne reconnue page ${pageNumber}.`);
  }
  for (let i = 0; i < centers.length; i++) {
    const top = Math.min(...boundaries.filter(y => y > centers[i].y));
    const bottom = Math.max(...boundaries.filter(y => y < centers[i].y));
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) throw new Error(`Limites de ligne introuvables page ${pageNumber}.`);
    const row = words.filter(w => w.y < top && w.y > bottom);
    const column = (min, max) => row.filter(w => w.x >= min && w.x < max)
      .sort((a, b) => b.y - a.y || a.x - b.x).map(w => w.text).join(' ').replace(/\s+/g, ' ').trim();
    const availability = column(0, 60);
    const places = column(80, 100);
    const details = column(100, 320);
    const name = column(320, 381);
    const address = column(381, 478);
    const phones = column(478, 530).match(/0[1-9](?:[ .-]?\d{2}){4}/g) || [];
    const block = blocks.find(b => centers[i].y >= b.bottom && centers[i].y <= b.top);
    if (!name || !address || !/^\d+(?: \d+)*$/.test(places) || !phones.length || !/Jours d.accueil/i.test(details) || !block) {
      throw new Error(`Ligne à contrôler page ${pageNumber}: ${JSON.stringify({ availability, places, details, name, address, phones })}`);
    }
    offers.push({
      id: phones[0].replace(/\D/g, ''),
      name, availability, places: places.split(' ').reduce((sum, n) => sum + Number(n), 0), details, address, phones,
      sector: sectors[block.color], updated: centers[i].text, page: pageNumber
    });
  }
}
await writeFile('data.json', JSON.stringify(offers, null, 2) + '\n');
await writeFile('source.json', JSON.stringify(source, null, 2) + '\n');
console.log(`${offers.length} offres extraites sur ${pdf.numPages} pages.`);
