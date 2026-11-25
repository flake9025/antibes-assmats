export const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
export const STATUSES = { none: 'À contacter', ok: 'OK de principe', ko: 'KO de principe', 'no-answer': 'Pas de réponse', meeting: 'RDV prévu' };

export function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  if (!street) return address;
  const clean = street.split(/\s+(?:résidence|residence|rés\.|res\.|bât\.?|bat\.?|bâtiment|batiment|villa|le hameau|parc|domaine|les logis|les palmas)\b|\s+-|\b0\s*6\s*(?:160|600)\b/i)[0].trim();
  return `${clean}, Antibes`;
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
