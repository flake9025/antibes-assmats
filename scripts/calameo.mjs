export function extractRevision(html) {
  const match = html.match(/https:\/\/ps\.calameoassets\.com\/([a-z0-9-]+)\/p1\.jpg(?:\?|&|["'])/i);
  if (!match) throw new Error('Révision Calaméo introuvable : vérifier le format de la page ou son accessibilité.');
  return match[1];
}

export function validateUpdate(previous, next, previousDate, nextDate) {
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate(previousDate) || !validDate(nextDate) || nextDate < previousDate) {
    throw new Error('Date du PDF invalide ou antérieure à la liste publiée.');
  }
  if (!Array.isArray(previous) || !previous.length || !Array.isArray(next) ||
      next.length < Math.ceil(previous.length / 2)) {
    throw new Error('Nombre d’offres anormal : vérifier le nouveau PDF et son extraction.');
  }
}
