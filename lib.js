export const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
export const STATUSES = { none: 'À contacter', awaiting: 'En attente de réponse', ok: 'OK de principe', ko: 'KO de principe', 'no-answer': 'Pas de réponse', meeting: 'RDV prévu' };

export function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function firstDayNextMonth(today = new Date()) {
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

export function localDate(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function daysSince(date, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) return null;
  const end = Date.parse(`${localDate(today)}T00:00:00Z`);
  const days = (end - start) / 86400000;
  return days >= 0 ? days : null;
}

export function mapsUrl(address, origin) {
  const start = origin.trim();
  const destination = mapsAddress(address);
  const params = new URLSearchParams(start
    ? { api: '1', origin: start, destination }
    : { api: '1', query: destination });
  return `https://www.google.com/maps/${start ? 'dir' : 'search'}/?${params}`;
}

export function formatConditions(details) {
  const pattern = /(?:Jours d['’]accuei\s*l|Amplitude horaire|[ÂA]ge de l['’]enfant|[ÂA]ge des enfant\s*s|Accueil en dehors des vacances scolaires|Accueil pour un périscolaire|Pour les dépannages)\s*:/gi;
  const matches = [...details.matchAll(pattern)];
  if (!matches.length) return [{ label: 'À noter', value: details }];
  const sections = [];
  const prefix = details.slice(0, matches[0].index).trim();
  if (prefix) sections.push({ label: 'À noter', value: prefix });
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const raw = normalize(match[0]);
    const label = raw.startsWith('jours') ? 'Jours' :
      raw.startsWith('amplitude') ? 'Horaires' :
      raw.startsWith('age') ? 'Âge' :
      raw.startsWith('accueil en dehors') ? 'Vacances scolaires' :
      raw.startsWith('accueil pour') ? 'Périscolaire' : 'Dépannages';
    const value = details.slice(match.index + match[0].length, matches[i + 1]?.index ?? details.length).trim();
    sections.push({ label, value });
  }
  return sections;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function sortOffers(offers, sortBy, distances, saved) {
  if (sortBy === 'original') return offers;
  const updated = offer => {
    const match = offer.updated?.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    return match ? `20${match[3]}${match[2]}${match[1]}` : '';
  };
  const distance = offer => Number.isFinite(distances.get(offer.id)?.km) ? distances.get(offer.id).km : Infinity;
  return offers.sort((a, b) => {
    let order = 0;
    if (sortBy === 'name') order = collator.compare(a.name, b.name);
    else if (sortBy === 'places') order = b.places - a.places;
    else if (sortBy === 'address') order = collator.compare(a.address, b.address);
    else if (sortBy === 'distance') order = distance(a) - distance(b);
    else if (sortBy === 'updated') order = collator.compare(updated(b), updated(a));
    else if (sortBy === 'status') order = collator.compare(STATUSES[saved[a.id]?.status] || STATUSES.none, STATUSES[saved[b.id]?.status] || STATUSES.none);
    return order || collator.compare(a.name, b.name);
  });
}

export function geocodeQuery(address) {
  const street = address.match(/\b\d+\s*(?:bis|ter)?\s*[,]?\s*(?:avenue|av\.?|boulevard|bd\.?|rue|route|chemin|impasse|allée|allee|place|cours)\b.*/i)?.[0];
  const normalizePostalCode = text => text.replace(/\b0\s*6\s*(160|600)\b/g, (_, end) => `06${end}`);
  if (!street) return normalizePostalCode(address);
  const clean = street.split(/\s+(?:résidence|residence|rés|res|bât|bat|bâtiment|batiment|villa|le hameau|parc|domaine|les logis|les palmas|le grand chêne|le trianon|caserne gazan)(?=$|[\s,.\-])|\s*-\s+|\b0\s*6\s*(?:160|600)\b/i)[0]
    .replace(/(?:,\s*|\s+)(?:Antibes|Juan[\s-]+les[\s-]+Pins)\s*$/i, '')
    .replace(/,\s*$/, '').trim();
  if (/\b(?:de|du|des|le|la|rue|route|chemin|avenue|boulevard|impasse|allée|allee|place|cours)\s*$/i.test(clean)) return normalizePostalCode(address);
  const postalCode = address.match(/\b0\s*6\s*(?:160|600)\b/)?.[0].replace(/\s/g, '');
  const city = /\bjuan[\s-]+les[\s-]+pins\b/i.test(address) ? 'Juan-les-Pins' : 'Antibes';
  return `${clean}, ${postalCode ? `${postalCode} ` : ''}${city}`;
}

export function geocodeResult(feature, query, allowLocality = false) {
  const properties = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (!Number.isFinite(properties?.score) || properties.score < 0.7 ||
      typeof properties.label !== 'string' || !Array.isArray(coordinates) ||
      coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) return null;
  if (properties.type === 'housenumber') return { coordinates, label: properties.label };
  if (!allowLocality || properties.type !== 'locality' || properties.score < 0.8 || properties.citycode !== '06004') return null;
  const street = query.replace(/^\d+\s*(?:bis|ter)?\s*,?\s*/i, '').replace(/,\s*(?:\d{5}\s+)?(?:Antibes|Juan-les-Pins)\s*$/i, '').trim();
  const comparable = text => normalize(text).replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  if (!street || typeof properties.name !== 'string' || comparable(street) !== comparable(properties.name)) return null;
  return { coordinates, label: properties.label };
}

export function mapsAddress(address) {
  return geocodeQuery(address);
}

export function daysMatch(details, selected) {
  if (!selected.length) return 'yes';
  const text = normalize(details).replace(/mercerdi/g, 'mercredi');
  const sections = [...text.matchAll(/jours d.accueil\s*:\s*(.*?)(?=jours d.accueil|amplitude horaire|age de|accueil pour|$)/g)].map(m => m[1]);
  if (sections.length !== 1) return 'unknown';
  const days = sections[0];
  if (/possibilite|un mercredi sur|1 mercredi sur|sur 2|sous reserve/.test(days)) return 'unknown';
  const excluded = DAYS.filter(day => new RegExp(`(?:sans|sauf) (?:le )?${day}`).test(days));
  if (excluded.some(day => selected.includes(day)) && !/\b5 jours\b/.test(days)) return 'no';
  if (excluded.length) return 'unknown';
  let stated = DAYS.filter(day => new RegExp(`\\b${day}s?\\b`).test(days));
  const range = days.match(/(?:du |de )?(lundi|mardi|mercredi|jeudi|vendredi) (?:au|a) (lundi|mardi|mercredi|jeudi|vendredi)/);
  if (range) stated = DAYS.slice(DAYS.indexOf(range[1]), DAYS.indexOf(range[2]) + 1);
  if (stated.length) return selected.every(day => stated.includes(day)) ? 'yes' : 'no';
  if (/\b5 jours\b/.test(days)) return 'yes';
  return 'unknown';
}

export function timeMatch(details, start, end) {
  if (!start && !end) return 'yes';
  const text = normalize(details);
  if ((text.match(/jours d.accueil/g) || []).length > 1) return 'unknown';
  const section = text.match(/amplitude horaire\s*:?\s*(.*?)(?=age de|age des|accueil pour|jours d.accueil|$)/)?.[1];
  if (!section || /\b(?:si|selon|possible|sauf|uniquement)\b/.test(section)) return 'unknown';
  const times = [...section.matchAll(/\b(\d{1,2})\s*h\s*(\d{0,2})\b/g)];
  if (times.length !== 2) return 'unknown';
  const values = times.map(([, hour, minute]) => Number(hour) * 60 + Number(minute || 0));
  if (values.some(value => value >= 24 * 60) || values[0] >= values[1] ||
      times.some(([, , minute]) => Number(minute || 0) >= 60)) return 'unknown';
  const minutes = value => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
  return (start && minutes(start) < values[0]) || (end && minutes(end) > values[1]) ? 'no' : 'yes';
}

export function dateMatch(availability, selected, sourceYear = 2026) {
  if (!selected) return true;
  const text = normalize(availability);
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const matches = [...text.matchAll(new RegExp(`(${months.join('|')})(?:\\s+(20\\d\\d))?`, 'g'))];
  if (!matches.length) return true;
  const last = matches.at(-1);
  const endYear = Number(last[2] || sourceYear);
  const endMonth = months.indexOf(last[1]);
  let startYear = Number(matches[0][2] || (matches.length > 1 && months.indexOf(matches[0][1]) > endMonth ? endYear - 1 : endYear));
  const start = startYear * 12 + months.indexOf(matches[0][1]);
  const [year, month] = selected.split('-').map(Number);
  const requested = year * 12 + month - 1;
  return requested >= start && (matches.length === 1 || requested <= endYear * 12 + endMonth);
}

export function distanceKm(a, b) {
  const radians = n => n * Math.PI / 180;
  const [lon1, lat1] = a.map(radians), [lon2, lat2] = b.map(radians);
  const dLat = lat2 - lat1, dLon = lon2 - lon1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
