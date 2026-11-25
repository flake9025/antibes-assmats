import { daysSince, formatConditions, STATUSES } from './lib.js';

export const EXPORT_COLUMNS = [
  ['name', 'Nom'],
  ['sector', 'Secteur'],
  ['address', 'Adresse'],
  ['phones', 'Téléphone'],
  ['places', 'Places'],
  ['availability', 'Disponibilité'],
  ['conditions', "Conditions d'accueil"],
  ['checks', 'À confirmer'],
  ['distance', 'Distance à vol d’oiseau (km)'],
  ['updated', 'Mise à jour'],
  ['status', 'Suivi'],
  ['waitingSince', 'Date du contact'],
  ['waitingDays', "Jours d'attente"],
  ['meeting', 'Date du rendez-vous'],
  ['sourceDate', 'Date de la liste']
];

export function exportRows(offers, saved, distances, sourceDate) {
  return offers.map(offer => {
    const contact = saved[offer.id] || {};
    const km = distances.get(offer.id)?.km;
    return {
      name: offer.name,
      sector: offer.sector,
      address: offer.address,
      phones: offer.phones.join(' / '),
      places: offer.places,
      availability: offer.availability,
      conditions: formatConditions(offer.details).map(({ label, value }) => `${label} : ${value}`).join('\n'),
      checks: [offer.dayMatch === 'unknown' && 'Jours', offer.timeMatch === 'unknown' && 'Horaires'].filter(Boolean).join(', '),
      distance: Number.isFinite(km) ? Math.round(km * 10) / 10 : '',
      updated: offer.updated,
      status: STATUSES[contact.status] || STATUSES.none,
      waitingSince: contact.status === 'awaiting' ? (contact.waitingSince || '') : '',
      waitingDays: contact.status === 'awaiting' ? (daysSince(contact.waitingSince) ?? '') : '',
      meeting: contact.status === 'meeting' ? (contact.meeting || '').replace('T', ' ') : '',
      sourceDate
    };
  });
}

export function excelData(rows) {
  return [
    EXPORT_COLUMNS.map(([, title]) => ({ value: title, fontWeight: 'bold' })),
    ...rows.map(row => EXPORT_COLUMNS.map(([key]) => ({ value: row[key], wrap: key === 'conditions' })))
  ];
}
