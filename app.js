import { dateMatch, daysMatch, daysSince, distanceKm, firstDayNextMonth, formatConditions, geocodeQuery, geocodeResult, localDate, mapsUrl, normalize, sortOffers, STATUSES, timeMatch } from './lib.js';
import { excelData, exportRows, EXPORT_COLUMNS } from './export.js';

const $ = selector => document.querySelector(selector);
const storageKey = 'petits-liens-contacts-v1';
const locationKey = 'petits-liens-location-v1';
const filtersKey = 'petits-liens-filtres-v1';
if ('serviceWorker' in navigator) {
  let controlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !reloading) {
      reloading = true;
      window.location.reload();
    }
    controlled = true;
  });
}
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Local storage may be unavailable. */ }
let savedLocation = {};
try { savedLocation = JSON.parse(localStorage.getItem(locationKey) || '{}') || {}; } catch { /* Local storage may be unavailable. */ }
if (typeof savedLocation.address === 'string') $('#origin').value = savedLocation.address;
let offers = [];
let sourceYear = 2026;
let sourceRevision = '';
let sourceDate = '';
let distances = new Map();
let currentResults = [];
let geoRun = 0;
let locationRun = 0;
let locationEdited = false;
let locationStorageAvailable = true;
let locationApproximate = savedLocation.approximate === true;
let savedFilters = {};
try { savedFilters = JSON.parse(localStorage.getItem(filtersKey) || '{}') || {}; } catch { /* Local storage may be unavailable. */ }
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const filterInputs = {
  query: '#query', places: '#places', start: '#start', timeStart: '#time-start', timeEnd: '#time-end', sort: '#sort'
};
const filterGroups = { days: '.days', sectors: '.sector-options', statuses: '.status-options' };

function restoreFilters() {
  for (const [key, selector] of Object.entries(filterInputs)) {
    const input = $(selector);
    if (typeof savedFilters[key] !== 'string') continue;
    if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === savedFilters[key])) continue;
    input.value = savedFilters[key];
  }
  for (const [key, selector] of Object.entries(filterGroups)) {
    if (!Array.isArray(savedFilters[key])) continue;
    document.querySelectorAll(`${selector} input`).forEach(input => {
      input.checked = savedFilters[key].includes(input.value) || (key === 'statuses' && input.value === 'awaiting' && !savedFilters.statusOptionsVersion);
    });
  }
}

function saveFilters() {
  savedFilters = Object.fromEntries(Object.entries(filterInputs).map(([key, selector]) => [key, $(selector).value]));
  for (const [key, selector] of Object.entries(filterGroups)) {
    savedFilters[key] = [...document.querySelectorAll(`${selector} input:checked`)].map(input => input.value);
  }
  savedFilters.statusOptionsVersion = 1;
  try {
    localStorage.setItem(filtersKey, JSON.stringify(savedFilters));
    $('#filter-message').textContent = 'Vos critères sont mémorisés sur cet appareil.';
  } catch {
    $('#filter-message').textContent = 'Impossible de mémoriser vos critères sur cet appareil.';
  }
}

$('#start').value = firstDayNextMonth();
$('#time-start').value = '08:30';
$('#time-end').value = '17:30';
restoreFilters();

function saveLocation() {
  try {
    localStorage.setItem(locationKey, JSON.stringify({
      address: $('#origin').value, revision: sourceRevision, distances: Object.fromEntries(distances), approximate: locationApproximate
    }));
    locationStorageAvailable = true;
  } catch {
    locationStorageAvailable = false;
  }
}

function locationMessage(message) {
  $('#geo-message').textContent = message + (locationStorageAvailable ? '' : " Impossible de mémoriser l'adresse et les distances sur cet appareil.");
}

function showLocationSummary() {
  $('#saved-address').textContent = $('#origin').value;
  $('#location-approximate').hidden = !locationApproximate;
  const missing = new Set(offers.filter(offer => !distances.has(offer.id)).map(offer => offer.address)).size;
  $('#location-coverage').hidden = !missing;
  $('#location-coverage').textContent = `${missing} adresse${missing > 1 ? 's' : ''} sans distance.`;
  $('#complete-location').hidden = !missing;
  $('#location-form').hidden = true;
  $('#location-summary').hidden = false;
  locationMessage('');
}

function render() {
  const query = normalize($('#query').value.trim());
  const selected = [...document.querySelectorAll('.days input:checked')].map(input => input.value);
  const sectors = [...document.querySelectorAll('.sector-options input:checked')].map(input => input.value);
  const statuses = [...document.querySelectorAll('.status-options input:checked')].map(input => input.value);
  const start = $('#time-start').value, end = $('#time-end').value;
  const invalidTime = start && end && start >= end;
  $('#time-message').textContent = invalidTime ? "L'heure de fin doit être après l'heure de début." : "Les horaires indiquent l'amplitude possible, à confirmer.";
  const filtered = offers.map(offer => ({ ...offer, dayMatch: daysMatch(offer.details, selected), timeMatch: invalidTime ? 'unknown' : timeMatch(offer.details, start, end) }))
    .filter(offer => offer.places >= Number($('#places').value))
    .filter(offer => !query || normalize(offer.name).includes(query))
    .filter(offer => !sectors.length || sectors.includes(offer.sector))
    .filter(offer => statuses.includes(saved[offer.id]?.status || 'none'))
    .filter(offer => dateMatch(offer.availability, $('#start').value, sourceYear) && offer.dayMatch !== 'no' && offer.timeMatch !== 'no');
  sortOffers(filtered, $('#sort').value, distances, saved);
  currentResults = filtered;
  $('#export-pdf').disabled = $('#export-excel').disabled = filtered.length === 0;
  $('#sort-hint').textContent = $('#sort').value === 'distance' && !distances.size
    ? 'Calculez les distances pour trier par proximité.' : '';
  $('#count').textContent = `${filtered.length} résultat${filtered.length === 1 ? '' : 's'} · selon la liste de la ville`;
  $('#empty').hidden = filtered.length !== 0;
  const origin = $('#origin').value.trim();
  const sectorMap = $('#sector-map').innerHTML;
  $('#cards').innerHTML = filtered.map(offer => {
    const contact = saved[offer.id] || {};
    const distance = distances.get(offer.id);
    const options = Object.entries(STATUSES).map(([value, label]) => `<option value="${value}"${(contact.status || 'none') === value ? ' selected' : ''}>${label}</option>`).join('');
    const conditions = formatConditions(offer.details).map(({ label, value }) => `<li><strong>${escape(label)}</strong><span>${escape(value)}</span></li>`).join('');
    return `<article class="card">
      <div class="card-top" data-sector="${escape(offer.sector)}"><div class="sector-info">${sectorMap}<span class="sector-tag">${escape(offer.sector.replace('Antibes ', ''))}</span></div><span class="places">${offer.places} place${offer.places > 1 ? 's' : ''}</span></div>
      <h3>${escape(offer.name.replace(/^Mme /, ''))}</h3>
      <p class="address"><span>⌖</span> <a href="${escape(mapsUrl(offer.address, origin))}" target="_blank" rel="noopener noreferrer" aria-label="${origin ? 'Itinéraire vers' : 'Voir'} ${escape(offer.address)} sur Google Maps (nouvel onglet)" title="${origin ? 'Itinéraire sur Google Maps' : 'Voir sur Google Maps'}">${escape(offer.address)} ↗</a></p>
      ${distance ? `<p class="distance-result">↗ ${distance.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km à vol d'oiseau<br><span class="hint">Adresse reconnue : ${escape(distance.label)}</span></p>` : distances.size ? '<p class="hint">Distance indisponible : adresse non localisée ou service indisponible.</p>' : ''}
      <div class="card-facts"><p><strong>Disponible à partir de</strong><br>${escape(offer.availability)}</p><p><strong>Dernière mise à jour</strong><br>${escape(offer.updated)}</p></div>
      <div class="detail"><strong>Conditions d'accueil</strong><ul class="conditions-list">${conditions}</ul>${offer.dayMatch === 'unknown' ? '<span class="uncertain">Jours à confirmer</span>' : ''}${offer.timeMatch === 'unknown' ? '<span class="uncertain">Horaires à confirmer</span>' : ''}</div>
      <div class="card-bottom"><div class="phones">${offer.phones.map(phone => `<a href="tel:${escape(phone.replace(/\D/g, ''))}">☎ ${escape(phone)}</a>`).join('')}</div>
      <a class="pdf-link" href="input/20261120-liste-Asmat-internet.pdf#page=${offer.page}" target="_blank" rel="noopener">Voir dans le PDF ↗</a></div>
      <div class="tracking"><label>Suivi <select data-status="${escape(offer.id)}">${options}</select></label>${contact.status === 'meeting' ? `<label>Date du RDV <input type="datetime-local" data-meeting="${escape(offer.id)}" value="${escape(contact.meeting || '')}"></label>` : ''}${contact.status === 'awaiting' ? `<label>Date du contact <input type="date" data-waiting="${escape(offer.id)}" max="${localDate()}" value="${escape(contact.waitingSince || '')}"><span class="waiting-count" data-waiting-count="${escape(offer.id)}"></span></label>` : ''}</div>
    </article>`;
  }).join('');
  updateWaitingDurations();
}

function updateWaitingDurations() {
  document.querySelectorAll('[data-waiting-count]').forEach(element => {
    const date = saved[element.dataset.waitingCount]?.waitingSince;
    const days = daysSince(date);
    element.textContent = days === null ? (date ? 'Date à vérifier.' : '') : `En attente depuis ${days} jour${days === 1 ? '' : 's'}`;
  });
  document.querySelectorAll('[data-waiting]').forEach(input => { input.max = localDate(); });
}

function scheduleWaitingRefresh() {
  const next = new Date();
  next.setHours(24, 0, 0, 50);
  setTimeout(() => { updateWaitingDurations(); scheduleWaitingRefresh(); }, next - Date.now());
}
scheduleWaitingRefresh();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateWaitingDurations();
});

for (const selector of ['#query', '#places', '#start', '#time-start', '#time-end', '#sort', '.days', '.sector-options', '.status-options']) {
  $(selector).addEventListener('input', () => { saveFilters(); render(); });
  $(selector).addEventListener('change', () => { saveFilters(); render(); });
}
$('#reset').addEventListener('click', () => {
  $('#query').value = ''; $('#places').value = '1'; $('#start').value = firstDayNextMonth();
  $('#time-start').value = '08:30'; $('#time-end').value = '17:30';
  $('#sort').value = 'original';
  document.querySelectorAll('.days input, .sector-options input').forEach(input => { input.checked = false; });
  document.querySelectorAll('.status-options input').forEach(input => { input.checked = input.defaultChecked; });
  saveFilters();
  render();
});
$('#cards').addEventListener('change', event => {
  const id = event.target.dataset.status || event.target.dataset.meeting || event.target.dataset.waiting;
  if (!id) return;
  saved[id] ||= {};
  if (event.target.dataset.status) {
    if (event.target.value === 'awaiting' && saved[id].status !== 'awaiting') saved[id].waitingSince = localDate();
    saved[id].status = event.target.value;
  } else if (event.target.dataset.meeting) saved[id].meeting = event.target.value;
  else saved[id].waitingSince = event.target.value;
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
  catch { alert("Impossible d'enregistrer le suivi sur cet appareil."); }
  render();
});

$('#export-pdf').addEventListener('click', () => {
  const rows = exportRows(currentResults, saved, distances, sourceDate);
  if (!rows.length) return;
  $('#print-export').innerHTML = `<h1>Easy Nanny Antibes</h1><p>${rows.length} résultat${rows.length > 1 ? 's' : ''} · Liste municipale du ${escape(sourceDate)}</p><p>Disponibilités et conditions à confirmer auprès des professionnelles.</p>${rows.map(row => `<article class="print-result"><h2>${escape(row.name)}</h2><dl>${EXPORT_COLUMNS.filter(([key]) => key !== 'name' && key !== 'sourceDate' && row[key] !== '').map(([key, title]) => `<div><dt>${escape(title)}</dt><dd>${escape(row[key])}</dd></div>`).join('')}</dl></article>`).join('')}`;
  window.print();
});

$('#export-excel').addEventListener('click', async () => {
  const rows = exportRows(currentResults, saved, distances, sourceDate);
  if (!rows.length) return;
  const button = $('#export-excel');
  button.disabled = true;
  $('#export-message').textContent = '';
  try {
    const columns = EXPORT_COLUMNS.map(([key]) => ({ width: key === 'conditions' ? 45 : key === 'address' ? 36 : 22 }));
    const blob = await window.writeXlsxFile(excelData(rows), { columns, stickyRowsCount: 1 }).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'easy-nanny-antibes-resultats.xlsx';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    $('#export-message').textContent = "Impossible de créer le fichier Excel. Réessayez.";
  } finally { button.disabled = currentResults.length === 0; }
});

async function geocode(query, allowLocality = false) {
  const url = new URL('https://data.geopf.fr/geocodage/search/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Géocodage indisponible');
  return geocodeResult((await response.json()).features?.[0], query, allowLocality);
}

$('#origin').addEventListener('input', () => {
  geoRun++;
  locationRun++;
  locationEdited = true;
  locationApproximate = false;
  distances = new Map();
  $('#locate').disabled = false;
  $('#complete-location').disabled = false;
  $('#use-location').disabled = false;
  saveLocation();
  locationMessage('');
  render();
});

$('#use-location').addEventListener('click', async () => {
  if (!navigator.geolocation) {
    $('#geo-message').textContent = "La géolocalisation n'est pas disponible. Saisissez votre adresse.";
    return;
  }
  geoRun++;
  const run = ++locationRun;
  $('#use-location').disabled = true;
  $('#geo-message').textContent = 'Recherche de votre position…';
  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000 }));
    if (run !== locationRun) return;
    const url = new URL('https://data.geopf.fr/geocodage/reverse/');
    url.searchParams.set('lon', position.coords.longitude);
    url.searchParams.set('lat', position.coords.latitude);
    url.searchParams.set('limit', '1');
    const response = await fetch(url);
    if (!response.ok) throw new Error();
    const feature = (await response.json()).features?.[0];
    if (!feature?.properties?.label) throw new Error();
    if (run !== locationRun) return;
    $('#origin').value = feature.properties.label;
    $('#origin').dispatchEvent(new Event('input', { bubbles: true }));
    locationApproximate = true;
    $('#locate').click();
  } catch (error) {
    if (run !== locationRun) return;
    $('#geo-message').textContent = error.code === 1
      ? 'Accès à la position refusé. Vous pouvez saisir votre adresse.'
      : 'Position ou adresse indisponible. Vous pouvez saisir votre adresse.';
  } finally {
    if (run === locationRun) $('#use-location').disabled = false;
  }
});

async function calculateDistances(missingOnly = false) {
  const address = $('#origin').value.trim();
  if (!address) { $('#geo-message').textContent = "Saisissez d'abord votre adresse."; return; }
  if (!offers.length) { $('#geo-message').textContent = "La liste n'est pas encore disponible. Réessayez."; return; }
  locationRun++;
  $('#use-location').disabled = false;
  const run = ++geoRun;
  $('#locate').disabled = true;
  $('#complete-location').disabled = true;
  $('#geo-message').textContent = 'Recherche de votre adresse…';
  try {
    const origin = await geocode(address);
    if (run !== geoRun) return;
    if (!origin) throw new Error("Adresse non reconnue avec suffisamment de précision. Ajoutez le numéro et la commune.");
    $('#geo-message').textContent = `Adresse reconnue : ${origin.label}. Calcul en cours…`;
    const byAddress = [...new Set(offers.filter(offer => !missingOnly || !distances.has(offer.id)).map(offer => offer.address))];
    const total = byAddress.length;
    let completed = 0;
    async function worker() {
      while (byAddress.length && run === geoRun) {
        const address = byAddress.shift();
        try {
          const result = await geocode(geocodeQuery(address), true);
          if (run !== geoRun) return;
          if (result) for (const offer of offers.filter(item => item.address === address)) {
            distances.set(offer.id, { km: distanceKm(origin.coordinates, result.coordinates), label: result.label });
          }
        } catch { /* Continue with the remaining addresses. */ }
        completed++;
        if (run !== geoRun) return;
        $('#geo-message').textContent = `Adresse reconnue : ${origin.label}. Calcul : ${completed}/${total}…`;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    await Promise.all([worker(), worker()]);
    if (run === geoRun) {
      saveLocation();
      if (distances.size) {
        showLocationSummary();
        if ($('#sort').value === 'original') {
          $('#sort').value = 'distance';
          saveFilters();
        }
      } else {
        locationMessage("Aucune adresse n'a pu être localisée. Vérifiez votre connexion et réessayez.");
      }
      render();
    }
  } catch (error) {
    if (run === geoRun) $('#geo-message').textContent = error.message || 'Calcul impossible. Vérifiez votre connexion.';
  } finally {
    if (run === geoRun) {
      $('#locate').disabled = false;
      $('#complete-location').disabled = false;
    }
  }
}
$('#locate').addEventListener('click', () => calculateDistances());
$('#complete-location').addEventListener('click', () => calculateDistances(true));

$('#reset-location').addEventListener('click', () => {
  geoRun++;
  locationRun++;
  locationEdited = true;
  locationApproximate = false;
  distances = new Map();
  savedLocation = {};
  $('#origin').value = '';
  $('#location-form').hidden = false;
  $('#location-summary').hidden = true;
  $('#locate').disabled = false;
  $('#complete-location').disabled = false;
  $('#use-location').disabled = false;
  if ($('#sort').value === 'distance') {
    $('#sort').value = 'original';
    saveFilters();
  }
  try { localStorage.removeItem(locationKey); locationStorageAvailable = true; }
  catch { locationStorageAvailable = false; }
  locationMessage('');
  render();
  $('#origin').focus();
});

try {
  const [response, sourceResponse] = await Promise.all([fetch('data.json'), fetch('source.json')]);
  if (!response.ok || !sourceResponse.ok) throw new Error();
  offers = await response.json();
  const source = await sourceResponse.json();
  sourceRevision = source.revision;
  sourceYear = Number(source.pdfDate.slice(0, 4));
  sourceDate = source.pdfDate.split('-').reverse().join('/');
  if (!locationEdited && savedLocation.revision === sourceRevision && savedLocation.distances && typeof savedLocation.distances === 'object') {
    distances = new Map(Object.entries(savedLocation.distances).filter(([, value]) => Number.isFinite(value?.km) && typeof value.label === 'string'));
    if (distances.size) {
      if (!savedFilters.sort) $('#sort').value = 'distance';
      showLocationSummary();
    }
  } else if (!locationEdited && savedLocation.revision && savedLocation.revision !== sourceRevision) {
    saveLocation();
    locationMessage('La liste a changé : recalculez les distances.');
  }
  const [year, month, day] = source.pdfDate.split('-').map(Number);
  const sourceDateLabel = `Liste municipale du ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))}.`;
  $('#source-date').textContent = $('#mobile-source-date').textContent = sourceDateLabel;
  render();
} catch {
  $('#count').textContent = 'Impossible de charger la liste. Vérifiez votre connexion et rechargez la page.';
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    const update = () => registration.update().catch(() => {});
    update();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') update();
    });
  }).catch(() => {});
}
