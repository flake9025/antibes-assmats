export function extractRevision(html) {
  const match = html.match(/https:\/\/ps\.calameoassets\.com\/([a-z0-9-]+)\/p1\.jpg(?:\?|&|["'])/i);
  if (!match) throw new Error('Révision Calaméo introuvable : vérifier le format de la page ou son accessibilité.');
  return match[1];
}
