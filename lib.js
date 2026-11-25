export const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

export function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
