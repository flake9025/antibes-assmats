import { dateMatch, daysMatch, distanceKm, geocodeQuery, normalize, timeMatch } from './lib.js';

const $ = selector => document.querySelector(selector);
const statuses = { none: 'À contacter', ok: 'OK de principe', ko: 'KO de principe', 'no-answer': 'Pas de réponse', meeting: 'RDV prévu' };
const storageKey = 'petits-liens-contacts-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* Local storage may be unavailable. */ }
let offers = [];
let sourceYear = 2026;
let distances = new Map();
let geoRun = 0;
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function render() {
  const query = normalize($('#query').value.trim());
  const selected = [...document.querySelectorAll('.days input:checked')].map(input => input.value);
  const start = $('#time-start').value, end = $('#time-end').value;
  const invalidTime = start && end && start >= end;
  $('#time-message').textContent = invalidTime ? "L'heure de fin doit être après l'heure de début." : "Les horaires indiquent l'amplitude possible, à confirmer.";
  const filtered = offers.map(offer => ({ ...offer, dayMatch: daysMatch(offer.details, selected), timeMatch: invalidTime ? 'unknown' : timeMatch(offer.details, start, end) }))
    .filter(offer => offer.places >= Number($('#places').value))
    .filter(offer => !query || normalize(`${offer.name} ${offer.address} ${offer.sector}`).includes(query))
    .filter(offer => !$('#sector').value || offer.sector === $('#sector').value)
    .filter(offer => !$('#status-filter').value || (saved[offer.id]?.status || 'none') === $('#status-filter').value)
    .filter(offer => dateMatch(offer.availability, $('#start').value, sourceYear) && offer.dayMatch !== 'no' && offer.timeMatch !== 'no');
  if (distances.size) filtered.sort((a, b) => (distances.get(a.id)?.km ?? Infinity) - (distances.get(b.id)?.km ?? Infinity));
  $('#count').textContent = `${filtered.length} résultat${filtered.length === 1 ? '' : 's'} · selon la liste de la ville`;
  $('#empty').hidden = filtered.length !== 0;
  $('#cards').innerHTML = filtered.map(offer => {
    const contact = saved[offer.id] || {};
    const distance = distances.get(offer.id);
    const options = Object.entries(statuses).map(([value, label]) => `<option value="${value}"${(contact.status || 'none') === value ? ' selected' : ''}>${label}</option>`).join('');
    return `<article class="card">
      <div class="card-top"><span class="sector-tag">${escape(offer.sector.replace('Antibes ', ''))}</span><span class="places">${offer.places} place${offer.places > 1 ? 's' : ''}</span></div>
      <h3>${escape(offer.name.replace(/^Mme /, ''))}</h3>
      <p class="address"><span>⌖</span> <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(offer.address)}" target="_blank" rel="noopener noreferrer" aria-label="Voir ${escape(offer.address)} sur Google Maps (nouvel onglet)">${escape(offer.address)} ↗</a></p>
      ${distance ? `<p class="distance-result">↗ ${distance.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km à vol d'oiseau<br><span class="hint">Adresse reconnue : ${escape(distance.label)}</span></p>` : ''}
      <div class="card-facts"><p><strong>Disponible à partir de</strong><br>${escape(offer.availability)}</p><p><strong>Dernière mise à jour</strong><br>${escape(offer.updated)}</p></div>
      <div class="detail"><strong>Conditions d'accueil</strong><p>${escape(offer.details)}</p>${offer.dayMatch === 'unknown' ? '<span class="uncertain">Jours à confirmer</span>' : ''}${offer.timeMatch === 'unknown' ? '<span class="uncertain">Horaires à confirmer</span>' : ''}${offer.places > 1 ? '<span class="hint">Les places peuvent avoir des conditions différentes.</span>' : ''}</div>
      <div class="card-bottom"><div class="phones">${offer.phones.map(phone => `<a href="tel:${escape(phone.replace(/\D/g, ''))}">☎ ${escape(phone)}</a>`).join('')}</div>
      <a class="pdf-link" href="input/20261120-liste-Asmat-internet.pdf#page=${offer.page}" target="_blank" rel="noopener">Voir dans le PDF ↗</a></div>
      <div class="tracking"><label>Suivi <select data-status="${escape(offer.id)}">${options}</select></label>${contact.status === 'meeting' ? `<label>Date du RDV <input type="datetime-local" data-meeting="${escape(offer.id)}" value="${escape(contact.meeting || '')}"></label>` : ''}</div>
    </article>`;
  }).join('');
}

for (const selector of ['#query', '#places', '#start', '#time-start', '#time-end', '#sector', '#status-filter', '.days']) {
  $(selector).addEventListener('input', render);
  $(selector).addEventListener('change', render);
}
$('#reset').addEventListener('click', () => {
  $('#query').value = ''; $('#places').value = '1'; $('#start').value = '';
  $('#time-start').value = ''; $('#time-end').value = '';
  $('#sector').value = ''; $('#status-filter').value = '';
  document.querySelectorAll('.days input').forEach(input => { input.checked = false; });
  render();
});
$('#cards').addEventListener('change', event => {
  const id = event.target.dataset.status || event.target.dataset.meeting;
  if (!id) return;
  saved[id] ||= {};
  if (event.target.dataset.status) saved[id].status = event.target.value;
  else saved[id].meeting = event.target.value;
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
  catch { alert("Impossible d'enregistrer le suivi sur cet appareil."); }
  render();
});

async function geocode(query) {
  const url = new URL('https://data.geopf.fr/geocodage/search/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Géocodage indisponible');
  const feature = (await response.json()).features?.[0];
  if (!feature || feature.properties.score < 0.7 || feature.properties.type !== 'housenumber') return null;
  return { coordinates: feature.geometry.coordinates, label: feature.properties.label };
}

$('#origin').addEventListener('input', () => {
  geoRun++;
  distances = new Map();
  $('#locate').disabled = false;
  $('#geo-message').textContent = '';
  render();
});

$('#locate').addEventListener('click', async () => {
  const address = $('#origin').value.trim();
  if (!address) { $('#geo-message').textContent = "Saisissez d'abord votre adresse."; return; }
  const run = ++geoRun;
  distances = new Map();
  render();
  $('#locate').disabled = true;
  $('#geo-message').textContent = 'Recherche de votre adresse…';
  try {
    const origin = await geocode(address);
    if (!origin) throw new Error("Adresse non reconnue avec suffisamment de précision. Ajoutez le numéro et la commune.");
    $('#geo-message').textContent = `Adresse reconnue : ${origin.label}. Calcul en cours…`;
    const byAddress = [...new Set(offers.map(offer => offer.address))];
    const total = byAddress.length;
    let completed = 0;
    let failures = 0;
    async function worker() {
      while (byAddress.length && run === geoRun) {
        const address = byAddress.shift();
        try {
          const result = await geocode(geocodeQuery(address));
          if (run !== geoRun) return;
          if (result) for (const offer of offers.filter(item => item.address === address)) {
            distances.set(offer.id, { km: distanceKm(origin.coordinates, result.coordinates), label: result.label });
          }
          else failures++;
        } catch { failures++; }
        completed++;
        if (run !== geoRun) return;
        $('#geo-message').textContent = `Adresse reconnue : ${origin.label}. Calcul : ${completed}/${total}…`;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    await Promise.all([worker(), worker()]);
    if (run === geoRun) {
      $('#geo-message').textContent = `Depuis ${origin.label}. ${failures ? `${failures} adresse(s) non localisée(s). ` : ''}Vérifiez les adresses reconnues.`;
      render();
    }
  } catch (error) {
    if (run === geoRun) $('#geo-message').textContent = error.message || 'Calcul impossible. Vérifiez votre connexion.';
  } finally { if (run === geoRun) $('#locate').disabled = false; }
});

try {
  const [response, sourceResponse] = await Promise.all([fetch('data.json'), fetch('source.json')]);
  if (!response.ok || !sourceResponse.ok) throw new Error();
  offers = await response.json();
  const source = await sourceResponse.json();
  sourceYear = Number(source.pdfDate.slice(0, 4));
  const [year, month, day] = source.pdfDate.split('-').map(Number);
  $('#source-date').textContent = `Liste municipale du ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))}.`;
  render();
} catch {
  $('#count').textContent = 'Impossible de charger la liste. Vérifiez votre connexion et rechargez la page.';
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
