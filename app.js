// --- Carte de base : MapLibre GL + OpenFreeMap (vectoriel, gratuit, sans clé API) ---
// Style actuel : "liberty" (style par défaut d'OpenFreeMap).
// Pour un style 100% sur-mesure : https://maplibre.org/maputnik/
// -> "Open" -> coller l'URL https://tiles.openfreemap.org/styles/liberty
// -> personnaliser chaque couleur visuellement -> "Export" -> remplacer MAP_STYLE_URL ci-dessous
// par le fichier style.json exporté (le mettre dans ce dossier et pointer dessus).
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE_URL,
  center: [2.5, 46.6],
  zoom: 5
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

const statusEl = document.getElementById('status');
const btn = document.getElementById('searchBtn');

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'show' + (type === 'error' ? ' error' : '');
  if (!msg) statusEl.className = '';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// Pour insérer une chaîne dans un attribut onclick="..." sans casser le HTML.
function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

const COLORS = { aire: '#2e7d32', camping: '#1565c0', bivouac: '#e65100', community: '#8e24aa' };

// --- Filtre par type de spot (barre de chips en haut) ---
// Toutes les catégories sont actives par défaut ; on retire celles décochées.
const activeCategories = new Set(['aire', 'camping', 'bivouac', 'community']);
function filterSpots(raw) {
  return raw.filter((s) => activeCategories.has(s[3]));
}

function classify(tags) {
  if (tags.tourism === 'caravan_site') return 'aire';
  if (tags.tourism === 'camp_site') {
    if (tags.backcountry === 'yes' || tags.informal === 'yes') return 'bivouac';
    return 'camping';
  }
  return 'camping';
}

// --- Rendu des points via des couches GeoJSON natives (rapide même avec des milliers de points, ---
// contrairement à des marqueurs DOM individuels qui ralentissent tout au-delà de quelques centaines).

function spotsToGeoJSON(spots) {
  // spots: [lat, lon, name, cls, fee, addr, phone, website, id (optionnel)]
  return {
    type: 'FeatureCollection',
    features: spots.map((s) => {
      const [lat, lon, name, cls, fee, addr, phone, website, id] = s;
      // Les spots officiels n'ont pas d'identifiant propre : on en fabrique un stable
      // à partir des coordonnées, pour pouvoir y accrocher des avis/photos/favoris.
      const spotId = id || (lat.toFixed(6) + '_' + lon.toFixed(6));
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          name: name || '(sans nom)', cls, fee: fee || '',
          addr: addr || '', phone: phone || '', website: website || '',
          spotId
        }
      };
    })
  };
}

function popupHtml(p, lat, lon) {
  const color = COLORS[p.cls] || '#555';
  const gmaps = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
  const waze = 'https://waze.com/ul?ll=' + lat + ',' + lon + '&navigate=yes';
  let html = '<div style="min-width:180px">';
  html += '<strong>' + escapeHtml(p.name) + '</strong><br>';
  html += '<div class="rating-summary" style="font-size:12px;color:#f5a623;margin:2px 0">Chargement de la note…</div>';
  html += '<span style="color:' + color + '">' + escapeHtml(p.cls) + '</span>';
  if (p.fee) html += '<br>Payant: ' + escapeHtml(p.fee);
  if (p.addr) html += '<br>' + escapeHtml(p.addr);
  if (p.phone) html += '<br>📞 ' + escapeHtml(p.phone);
  if (p.website) html += '<br><a href="' + p.website + '" target="_blank" rel="noopener">Site web</a>';
  html += '<div style="display:flex;gap:6px;margin-top:8px">';
  html += '<a href="' + gmaps + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#1a73e8;color:#fff;padding:6px;border-radius:6px;text-decoration:none;font-size:12px">Google Maps</a>';
  html += '<a href="' + waze + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#33ccff;color:#003;padding:6px;border-radius:6px;text-decoration:none;font-size:12px">Waze</a>';
  html += '</div>';
  html += '<button onclick="openAvisModal(\'' + p.spotId + '\',' + lat + ',' + lon + ')" style="width:100%;margin-top:6px;background:#f1f1f1;border:none;color:#333;padding:8px;border-radius:6px;font-size:12px;font-weight:600">💬 Avis & photos</button>';
  html += '<button class="fav-btn" onclick="onFavClick(this,\'' + p.spotId + '\',' + lat + ',' + lon + ',\'' + escapeAttr(p.name) + '\')" style="width:100%;margin-top:6px;background:#fff8e1;border:none;color:#8a6500;padding:8px;border-radius:6px;font-size:12px;font-weight:600">' +
    (isFavorite(p.spotId) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris') + '</button>';
  html += '</div>';
  return html;
}

function addSpotLayer(id, geojson, clustered) {
  map.addSource(id, {
    type: 'geojson',
    data: geojson,
    cluster: !!clustered,
    clusterRadius: 40,
    clusterMaxZoom: 11
  });

  if (clustered) {
    map.addLayer({
      id: id + '-clusters',
      type: 'circle',
      source: id,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#444',
        'circle-opacity': 0.85,
        'circle-radius': ['step', ['get', 'point_count'], 16, 50, 20, 200, 26]
      }
    });
    map.addLayer({
      id: id + '-cluster-count',
      type: 'symbol',
      source: id,
      filter: ['has', 'point_count'],
      layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
      paint: { 'text-color': '#fff' }
    });
  }

  map.addLayer({
    id: id + '-points',
    type: 'circle',
    source: id,
    filter: clustered ? ['!', ['has', 'point_count']] : ['literal', true],
    paint: {
      'circle-radius': 7,
      'circle-color': ['match', ['get', 'cls'],
        'aire', COLORS.aire,
        'camping', COLORS.camping,
        'bivouac', COLORS.bivouac,
        'community', COLORS.community,
        '#555'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  // Zoom en cliquant sur un cluster
  if (clustered) {
    map.on('click', id + '-clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [id + '-clusters'] });
      const clusterId = features[0].properties.cluster_id;
      map.getSource(id).getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({ center: features[0].geometry.coordinates, zoom });
      });
    });
  }

  // Popup au clic sur un point individuel
  map.on('click', id + '-points', (e) => {
    const f = e.features[0];
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const popup = new maplibregl.Popup({ offset: 10 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(popupHtml(p, lat, lon))
      .addTo(map);
    loadRatingSummary(p.spotId, popup);
  });

  map.on('mouseenter', id + '-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', id + '-points', () => map.getCanvas().style.cursor = '');
  if (clustered) {
    map.on('mouseenter', id + '-clusters', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', id + '-clusters', () => map.getCanvas().style.cursor = '');
  }
}

function setLayerData(id, geojson) {
  const src = map.getSource(id);
  if (src) src.setData(geojson);
}

// --- Données officielles : embarquées directement dans l'app (spots-data.js, chargé avant ce fichier) ---
// Ça marche même en ouvrant index.html en double-clic (file://), sans serveur, sans terminal.
// Source : OpenStreetMap (Geofabrik) + DATAtourisme (plateforme officielle française), fusionnées.
let officialLoaded = false;
let officialSpotsRaw = [];

async function loadOfficialSpots() {
  try {
    let spots = window.SPOTS_DATA; // [[lat, lon, name, cls, fee], ...] -- injecté par spots-data.js
    if (!spots) {
      // secours : si spots-data.js n'a pas chargé, on tente le fichier JSON (marche seulement via un serveur)
      const resp = await fetch('spots-data.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      spots = await resp.json();
    }
    officialSpotsRaw = spots;
    const geojson = spotsToGeoJSON(filterSpots(spots));
    if (!officialLoaded) {
      addSpotLayer('official', geojson, true);
      officialLoaded = true;
    } else {
      setLayerData('official', geojson);
    }
    setStatus(spots.length + ' spots officiels chargés', 'ok');
    setTimeout(() => setStatus(''), 2500);
  } catch (e) {
    setStatus('Pas de données officielles trouvées', 'error');
  }
}

// --- Recherche en direct (optionnelle, bouton) : interroge OpenStreetMap pour la zone visible ---
// Utile pour compléter ponctuellement, mais les serveurs publics Overpass sont parfois surchargés
// -> c'est pour ça que la couche "officielle" principale vient des données embarquées, pas de cet appel direct.
let searchInFlight = false;
let liveSpots = [];
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

async function searchArea() {
  if (searchInFlight) return;
  searchInFlight = true;
  btn.disabled = true;

  const b = map.getBounds();
  const bbox = b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast();
  const areaDeg = (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest());
  if (areaDeg > 4) {
    setStatus('Zone trop grande — zoomez un peu avant de chercher.', 'error');
    btn.disabled = false; searchInFlight = false;
    return;
  }

  const query = '[out:json][timeout:25];(' +
    'node["tourism"="caravan_site"](' + bbox + ');' +
    'way["tourism"="caravan_site"](' + bbox + ');' +
    'node["tourism"="camp_site"](' + bbox + ');' +
    'way["tourism"="camp_site"](' + bbox + ');' +
    ');out center tags;';

  let lastErr = null;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    setStatus('Recherche en direct (serveur ' + (i + 1) + '/' + ENDPOINTS.length + ')…', 'active');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const resp = await fetch(ENDPOINTS[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      let n = 0;
      data.elements.forEach(el => {
        const lat = el.lat !== undefined ? el.lat : (el.center ? el.center.lat : null);
        const lon = el.lon !== undefined ? el.lon : (el.center ? el.center.lon : null);
        if (lat === null || lon === null) return;
        const tags = el.tags || {};
        const cls = classify(tags);
        const num = tags['addr:housenumber'] || '';
        const street = tags['addr:street'] || '';
        const postcode = tags['addr:postcode'] || '';
        const city = tags['addr:city'] || '';
        const addr = [( num + ' ' + street).trim(), (postcode + ' ' + city).trim()].filter(Boolean).join(', ');
        liveSpots.push([lat, lon, tags.name || '', cls, tags.fee || '', addr, tags.phone || '', tags.website || '']);
        n++;
      });
      if (!map.getSource('live')) {
        addSpotLayer('live', spotsToGeoJSON(filterSpots(liveSpots)), false);
      } else {
        setLayerData('live', spotsToGeoJSON(filterSpots(liveSpots)));
      }
      setStatus(n + ' spot(s) trouvé(s) en direct dans cette zone', 'ok');
      btn.disabled = false;
      searchInFlight = false;
      return;
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error('timeout (20s)') : err;
    }
  }
  setStatus('Recherche en direct indisponible : ' + (lastErr ? lastErr.message : 'inconnue'), 'error');
  btn.disabled = false;
  searchInFlight = false;
}

btn.addEventListener('click', searchArea);

// --- Spots communautaires : base de données partagée (Supabase) ---
// Tout le monde voit les mêmes spots ajoutés par la communauté, pas juste sur son propre téléphone.
const SUPABASE_URL = 'https://lbjbizpusplzsblienmt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NzQssCs8Gfyw__MNeet5xA_mJbmzHbC';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let communitySpotsRaw = [];

async function loadCommunitySpots() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('spots').select('id, lat, lon, name, category, notes');
    if (error) throw error;
    const tuples = data.map((s) => {
      const cls = s.category || 'community';
      return [s.lat, s.lon, s.name, cls, '', s.notes || '', '', '', s.id];
    });
    communitySpotsRaw = tuples;
    const geojson = spotsToGeoJSON(filterSpots(tuples));
    if (!map.getSource('community')) {
      addSpotLayer('community', geojson, false);
    } else {
      setLayerData('community', geojson);
    }
  } catch (e) {
    console.error('Erreur chargement spots communautaires', e);
  }
}

// Ré-applique le filtre actif sur les 3 couches déjà chargées (sans refaire d'appel réseau).
function applyFilters() {
  if (officialLoaded) setLayerData('official', spotsToGeoJSON(filterSpots(officialSpotsRaw)));
  if (map.getSource('community')) setLayerData('community', spotsToGeoJSON(filterSpots(communitySpotsRaw)));
  if (map.getSource('live')) setLayerData('live', spotsToGeoJSON(filterSpots(liveSpots)));
}

document.querySelectorAll('.filter-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const cls = chip.dataset.cls;
    if (activeCategories.has(cls)) {
      activeCategories.delete(cls);
      chip.classList.remove('active');
    } else {
      activeCategories.add(cls);
      chip.classList.add('active');
    }
    applyFilters();
  });
});

map.on('load', () => {
  loadOfficialSpots();
  loadCommunitySpots();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 11 }),
      () => {},
      { timeout: 5000 }
    );
  }
});

// --- Avis, notes par étoiles & photos sur les emplacements (partagés via Supabase) ---
async function loadRatingSummary(spotId, popup) {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('comments').select('rating').eq('spot_id', spotId);
    if (error) throw error;
    let sum = 0, count = 0;
    data.forEach((row) => {
      if (row.rating) { sum += row.rating; count++; }
    });
    const el = popup.getElement && popup.getElement().querySelector('.rating-summary');
    if (!el) return; // le popup a peut-être déjà été fermé
    el.textContent = count ? ('★ ' + (sum / count).toFixed(1) + ' (' + count + ' avis)') : 'Pas encore noté';
  } catch (e) {
    const el = popup.getElement && popup.getElement().querySelector('.rating-summary');
    if (el) el.textContent = '';
  }
}

let currentAvisSpot = null;
let selectedRating = 0;
const avisModal = document.getElementById('avisModal');
const avisList = document.getElementById('avisList');
const avisText = document.getElementById('avisText');
const avisPhoto = document.getElementById('avisPhoto');
const avisSubmit = document.getElementById('avisSubmit');
const avisStarEls = Array.from(document.querySelectorAll('#avisStars .star'));

function setAvisStars(n) {
  selectedRating = n;
  avisStarEls.forEach((s) => s.classList.toggle('active', Number(s.dataset.v) <= n));
}
avisStarEls.forEach((s) => s.addEventListener('click', () => setAvisStars(Number(s.dataset.v))));

function renderAvisList(items) {
  if (!items.length) {
    avisList.innerHTML = '<p style="color:#888;font-size:13px">Aucun avis pour l\'instant. Soyez le premier à en laisser un !</p>';
    return;
  }
  avisList.innerHTML = items.map((it) => {
    let html = '<div class="avis-item">';
    if (it.rating) html += '<div class="avis-stars">' + '★'.repeat(it.rating) + '☆'.repeat(5 - it.rating) + '</div>';
    if (it.photo_url) html += '<img src="' + it.photo_url + '" loading="lazy">';
    if (it.text) html += '<p>' + escapeHtml(it.text) + '</p>';
    html += '<span class="avis-date">' + new Date(it.created_at).toLocaleDateString('fr-FR') + '</span>';
    html += '</div>';
    return html;
  }).join('');
}

async function openAvisModal(spotId, lat, lon) {
  if (!sb) { alert('Connexion à la base de données indisponible.'); return; }
  currentAvisSpot = { id: spotId, lat, lon };
  avisText.value = '';
  avisPhoto.value = '';
  setAvisStars(0);
  avisModal.classList.add('show');
  avisList.innerHTML = '<p style="color:#888;font-size:13px">Chargement…</p>';
  try {
    const { data, error } = await sb
      .from('comments')
      .select('text, photo_url, created_at, rating')
      .eq('spot_id', spotId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    renderAvisList(data);
  } catch (e) {
    avisList.innerHTML = '<p style="color:#b71c1c;font-size:13px">Erreur de chargement des avis.</p>';
  }
}

function closeAvisModal() {
  avisModal.classList.remove('show');
  currentAvisSpot = null;
}

async function submitAvis() {
  if (!currentAvisSpot || !sb) return;
  const text = avisText.value.trim();
  const file = avisPhoto.files[0];
  if (!selectedRating && !text && !file) {
    alert("Ajoutez une note, un commentaire ou une photo avant d'envoyer.");
    return;
  }
  avisSubmit.disabled = true;
  avisSubmit.textContent = 'Envoi…';
  try {
    let photoUrl = null;
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = currentAvisSpot.id + '_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('photos').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = sb.storage.from('photos').getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }
    const { error } = await sb.from('comments').insert({
      spot_id: currentAvisSpot.id,
      lat: currentAvisSpot.lat,
      lon: currentAvisSpot.lon,
      text: text || null,
      rating: selectedRating || null,
      photo_url: photoUrl
    });
    if (error) throw error;
    avisText.value = '';
    avisPhoto.value = '';
    setAvisStars(0);
    openAvisModal(currentAvisSpot.id, currentAvisSpot.lat, currentAvisSpot.lon);
  } catch (e) {
    alert("Impossible d'envoyer cet avis : " + e.message);
  } finally {
    avisSubmit.disabled = false;
    avisSubmit.textContent = 'Envoyer';
  }
}

document.getElementById('avisClose').addEventListener('click', closeAvisModal);
avisSubmit.addEventListener('click', submitAvis);
avisModal.addEventListener('click', (e) => {
  if (e.target === avisModal) closeAvisModal();
});

// --- Barre de recherche en haut : navigation par ville/adresse ---
// Géocodage via l'API Adresse du gouvernement français (gratuite, sans clé, axée France).
const GEOCODE_URL = 'https://api-adresse.data.gouv.fr/search/';
const citySearchInput = document.getElementById('citySearchInput');
const citySearchBtnEl = document.getElementById('citySearchBtn');

async function geocodeAddress(query) {
  const resp = await fetch(GEOCODE_URL + '?q=' + encodeURIComponent(query) + '&limit=1');
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  if (!data.features || !data.features.length) return null;
  const [lon, lat] = data.features[0].geometry.coordinates;
  return { lat, lon, label: data.features[0].properties.label };
}

async function searchCity() {
  const q = citySearchInput.value.trim();
  if (!q) return;
  citySearchBtnEl.disabled = true;
  setStatus('Recherche de « ' + q + ' »…', 'active');
  try {
    const result = await geocodeAddress(q);
    if (!result) {
      setStatus('Aucun résultat pour « ' + q + ' »', 'error');
      return;
    }
    map.flyTo({ center: [result.lon, result.lat], zoom: 12 });
    setStatus(result.label, 'ok');
    setTimeout(() => setStatus(''), 2500);
  } catch (e) {
    setStatus('Recherche indisponible (problème réseau)', 'error');
  } finally {
    citySearchBtnEl.disabled = false;
  }
}
citySearchBtnEl.addEventListener('click', searchCity);
citySearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchCity();
});

// --- Ajout d'un nouveau lieu : géolocalisation, adresse tapée, ou clic sur la carte ---
const addSpotModal = document.getElementById('addSpotModal');
const addSpotStep1 = document.getElementById('addSpotStep1');
const addSpotStep2 = document.getElementById('addSpotStep2');
const addSpotPositionLabel = document.getElementById('addSpotPositionLabel');
const addSpotNameInput = document.getElementById('addSpotName');
const addSpotCategorySelect = document.getElementById('addSpotCategory');
const addSpotNotesInput = document.getElementById('addSpotNotes');
const addSpotSubmitBtn = document.getElementById('addSpotSubmit');
const addSpotAddressInput = document.getElementById('addSpotAddressInput');
const addSpotAddressBtn = document.getElementById('addSpotAddressBtn');

let pendingSpotCoords = null; // { lat, lon, label }
let pickingLocationOnMap = false;

function showAddSpotStep1() {
  addSpotStep1.style.display = 'block';
  addSpotStep2.style.display = 'none';
}
function showAddSpotStep2() {
  addSpotStep1.style.display = 'none';
  addSpotStep2.style.display = 'block';
  addSpotPositionLabel.textContent = pendingSpotCoords.label
    ? ('Position : ' + pendingSpotCoords.label)
    : ('Position : ' + pendingSpotCoords.lat.toFixed(5) + ', ' + pendingSpotCoords.lon.toFixed(5));
  addSpotNameInput.value = '';
  addSpotCategorySelect.value = 'aire';
  addSpotNotesInput.value = '';
}

function openAddSpotModal() {
  pendingSpotCoords = null;
  addSpotAddressInput.value = '';
  showAddSpotStep1();
  addSpotModal.classList.add('show');
}
function closeAddSpotModal() {
  addSpotModal.classList.remove('show');
  pickingLocationOnMap = false;
  map.getCanvas().style.cursor = '';
  setStatus('');
}

document.getElementById('addSpotBtn').addEventListener('click', openAddSpotModal);
document.getElementById('addSpotClose').addEventListener('click', closeAddSpotModal);
document.getElementById('addSpotBack').addEventListener('click', showAddSpotStep1);
addSpotModal.addEventListener('click', (e) => {
  if (e.target === addSpotModal) closeAddSpotModal();
});

document.getElementById('addSpotUseLocation').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas disponible sur cet appareil.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      pendingSpotCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'votre position actuelle' };
      showAddSpotStep2();
    },
    () => alert('Impossible d\'obtenir votre position (permission refusée ou signal indisponible). Essayez de taper une adresse, ou touchez la carte.'),
    { timeout: 8000 }
  );
});

addSpotAddressBtn.addEventListener('click', async () => {
  const q = addSpotAddressInput.value.trim();
  if (!q) return;
  addSpotAddressBtn.disabled = true;
  addSpotAddressBtn.textContent = '…';
  try {
    const result = await geocodeAddress(q);
    if (!result) {
      alert('Adresse introuvable. Essayez une autre formulation, ou touchez directement la carte.');
      return;
    }
    pendingSpotCoords = result;
    showAddSpotStep2();
  } catch (e) {
    alert('Erreur réseau lors de la recherche d\'adresse. Réessayez, ou touchez directement la carte.');
  } finally {
    addSpotAddressBtn.disabled = false;
    addSpotAddressBtn.textContent = 'Valider';
  }
});

document.getElementById('addSpotUseMap').addEventListener('click', () => {
  addSpotModal.classList.remove('show');
  pickingLocationOnMap = true;
  map.getCanvas().style.cursor = 'crosshair';
  setStatus('Touchez la carte à l\'endroit du nouveau lieu…', 'active');
});

map.on('click', (e) => {
  if (!pickingLocationOnMap) return;
  pickingLocationOnMap = false;
  map.getCanvas().style.cursor = '';
  setStatus('');
  pendingSpotCoords = { lat: e.lngLat.lat, lon: e.lngLat.lng, label: null };
  addSpotModal.classList.add('show');
  showAddSpotStep2();
});

addSpotSubmitBtn.addEventListener('click', async () => {
  if (!pendingSpotCoords) return;
  if (!sb) { alert('Connexion à la base de données indisponible.'); return; }
  const name = addSpotNameInput.value.trim();
  if (!name) {
    alert('Le nom est obligatoire.');
    return;
  }
  const category = addSpotCategorySelect.value;
  const notes = addSpotNotesInput.value.trim();
  addSpotSubmitBtn.disabled = true;
  addSpotSubmitBtn.textContent = 'Enregistrement…';
  try {
    const { error } = await sb.from('spots').insert({
      lat: pendingSpotCoords.lat,
      lon: pendingSpotCoords.lon,
      name,
      category,
      notes: notes || null
    });
    if (error) throw error;
    closeAddSpotModal();
    loadCommunitySpots();
    setStatus('Lieu ajouté, merci !', 'ok');
    setTimeout(() => setStatus(''), 2500);
  } catch (e) {
    alert("Impossible d'enregistrer ce lieu : " + e.message);
  } finally {
    addSpotSubmitBtn.disabled = false;
    addSpotSubmitBtn.textContent = 'Enregistrer';
  }
});

// --- Favoris / spots enregistrés ---
// Pas de compte utilisateur pour l'instant : stockage local à cet appareil (localStorage).
// Limite connue et actée : les favoris ne sont pas partagés entre les appareils d'une même personne.
const FAVORITES_KEY = 'favorite_spots';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch (e) { return []; }
}
function setFavorites(list) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); } catch (e) { /* stockage indisponible : on ignore */ }
}
function isFavorite(id) {
  return getFavorites().some((f) => f.id === id);
}
function toggleFavorite(id, lat, lon, name) {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    setFavorites(list);
    return false;
  }
  list.push({ id, lat, lon, name });
  setFavorites(list);
  return true;
}
function onFavClick(btnEl, id, lat, lon, name) {
  const nowFav = toggleFavorite(id, lat, lon, name);
  btnEl.textContent = nowFav ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
}

const favModal = document.getElementById('favModal');
const favListEl = document.getElementById('favList');

function renderFavList() {
  const list = getFavorites();
  if (!list.length) {
    favListEl.innerHTML = '<p style="color:#888;font-size:13px">Aucun favori pour l\'instant.</p>';
    return;
  }
  favListEl.innerHTML = list.map((f, i) =>
    '<div class="fav-item" data-i="' + i + '">' +
    '<span class="fav-name" data-i="' + i + '" style="flex:1">' + escapeHtml(f.name || '(sans nom)') + '</span>' +
    '<button class="fav-remove" data-i="' + i + '">✕</button>' +
    '</div>'
  ).join('');
}

function openFavModal() {
  renderFavList();
  favModal.classList.add('show');
}
function closeFavModal() {
  favModal.classList.remove('show');
}

document.getElementById('favBtn').addEventListener('click', openFavModal);
document.getElementById('favClose').addEventListener('click', closeFavModal);
favModal.addEventListener('click', (e) => {
  if (e.target === favModal) closeFavModal();
});

favListEl.addEventListener('click', (e) => {
  const i = e.target.getAttribute('data-i');
  if (i === null) return;
  const list = getFavorites();
  const fav = list[Number(i)];
  if (!fav) return;
  if (e.target.classList.contains('fav-remove')) {
    list.splice(Number(i), 1);
    setFavorites(list);
    renderFavList();
  } else {
    map.flyTo({ center: [fav.lon, fav.lat], zoom: 14 });
    closeFavModal();
  }
});

// --- Navigation du bas (Carte / Compte) ---
const navMap = document.getElementById('navMap');
const navAccount = document.getElementById('navAccount');

function setActiveNav(which) {
  navMap.classList.toggle('active', which === 'map');
  navAccount.classList.toggle('active', which === 'account');
}

// --- Compte utilisateur : email/mot de passe (+ Google/Apple à venir), confirmation par code ---
const accountModal = document.getElementById('accountModal');
const accountLoggedOut = document.getElementById('accountLoggedOut');
const accountConfirm = document.getElementById('accountConfirm');
const accountLoggedIn = document.getElementById('accountLoggedIn');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPane = document.getElementById('loginPane');
const signupPane = document.getElementById('signupPane');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = document.getElementById('loginSubmit');
const loginErrorEl = document.getElementById('loginError');
const signupEmailInput = document.getElementById('signupEmail');
const signupPasswordInput = document.getElementById('signupPassword');
const signupSubmitBtn = document.getElementById('signupSubmit');
const signupErrorEl = document.getElementById('signupError');
const confirmEmailLabel = document.getElementById('confirmEmailLabel');
const confirmCodeInput = document.getElementById('confirmCode');
const confirmSubmitBtn = document.getElementById('confirmSubmit');
const confirmResendBtn = document.getElementById('confirmResend');
const confirmErrorEl = document.getElementById('confirmError');
const accountEmailLabel = document.getElementById('accountEmailLabel');
const logoutBtn = document.getElementById('logoutBtn');

let pendingConfirmEmail = null;
// Tant qu'on n'est pas connecté, l'appli est verrouillée sur l'écran de compte :
// impossible de voir la carte ou de fermer la modale.
let authGateActive = false;
const accountCloseBtn = document.getElementById('accountClose');

function showAccountView(view) {
  accountLoggedOut.style.display = view === 'loggedOut' ? 'block' : 'none';
  accountConfirm.style.display = view === 'confirm' ? 'block' : 'none';
  accountLoggedIn.style.display = view === 'loggedIn' ? 'block' : 'none';
}

function showAuthTab(tab) {
  tabLogin.classList.toggle('active', tab === 'login');
  tabSignup.classList.toggle('active', tab === 'signup');
  loginPane.style.display = tab === 'login' ? 'block' : 'none';
  signupPane.style.display = tab === 'signup' ? 'block' : 'none';
}
tabLogin.addEventListener('click', () => showAuthTab('login'));
tabSignup.addEventListener('click', () => showAuthTab('signup'));

function setAuthGate(active) {
  authGateActive = active;
  accountCloseBtn.style.display = active ? 'none' : '';
  bottomNav.style.display = active ? 'none' : 'flex';
  if (active) {
    accountModal.classList.add('show');
  }
}

async function refreshAccountUI() {
  if (!sb) { showAccountView('loggedOut'); setAuthGate(true); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    accountEmailLabel.textContent = session.user.email;
    showAccountView('loggedIn');
    setAuthGate(false);
  } else {
    showAccountView('loggedOut');
    setAuthGate(true);
  }
}

function openAccountModal() {
  accountModal.classList.add('show');
  refreshAccountUI();
}
function closeAccountModal() {
  if (authGateActive) return; // pas de carte tant qu'on n'est pas connecté
  accountModal.classList.remove('show');
  setActiveNav('map');
}

navMap.addEventListener('click', () => {
  closeAccountModal();
});
navAccount.addEventListener('click', () => {
  setActiveNav('account');
  openAccountModal();
});
accountCloseBtn.addEventListener('click', closeAccountModal);
accountModal.addEventListener('click', (e) => {
  if (e.target === accountModal) closeAccountModal();
});

// Vérifie l'état de connexion dès le chargement de la page (verrouille si non connecté).
refreshAccountUI();

loginSubmitBtn.addEventListener('click', async () => {
  loginErrorEl.textContent = '';
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !password) { loginErrorEl.textContent = 'Renseignez votre e-mail et votre mot de passe.'; return; }
  if (!sb) { loginErrorEl.textContent = 'Connexion à la base de données indisponible.'; return; }
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Connexion…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshAccountUI();
    closeAccountModal();
  } catch (e) {
    loginErrorEl.textContent = e.message === 'Invalid login credentials'
      ? 'E-mail ou mot de passe incorrect.' : e.message;
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Se connecter';
  }
});

signupSubmitBtn.addEventListener('click', async () => {
  signupErrorEl.textContent = '';
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  if (!email || !password) { signupErrorEl.textContent = 'Renseignez un e-mail et un mot de passe.'; return; }
  if (password.length < 6) { signupErrorEl.textContent = 'Le mot de passe doit faire au moins 6 caractères.'; return; }
  if (!sb) { signupErrorEl.textContent = 'Connexion à la base de données indisponible.'; return; }
  signupSubmitBtn.disabled = true;
  signupSubmitBtn.textContent = 'Création…';
  try {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) {
      // La confirmation par e-mail est désactivée côté projet : le compte est actif tout de suite.
      await refreshAccountUI();
      closeAccountModal();
    } else {
      pendingConfirmEmail = email;
      confirmEmailLabel.textContent = email;
      confirmCodeInput.value = '';
      confirmErrorEl.textContent = '';
      confirmErrorEl.style.color = '#b71c1c';
      showAccountView('confirm');
    }
  } catch (e) {
    signupErrorEl.textContent = e.message;
  } finally {
    signupSubmitBtn.disabled = false;
    signupSubmitBtn.textContent = 'Créer mon compte';
  }
});

confirmSubmitBtn.addEventListener('click', async () => {
  confirmErrorEl.style.color = '#b71c1c';
  confirmErrorEl.textContent = '';
  const token = confirmCodeInput.value.trim();
  if (!pendingConfirmEmail || !token) { confirmErrorEl.textContent = 'Saisissez le code reçu par e-mail.'; return; }
  confirmSubmitBtn.disabled = true;
  confirmSubmitBtn.textContent = 'Vérification…';
  try {
    const { error } = await sb.auth.verifyOtp({ email: pendingConfirmEmail, token, type: 'signup' });
    if (error) throw error;
    pendingConfirmEmail = null;
    await refreshAccountUI();
    closeAccountModal();
  } catch (e) {
    confirmErrorEl.textContent = 'Code invalide ou expiré.';
  } finally {
    confirmSubmitBtn.disabled = false;
    confirmSubmitBtn.textContent = 'Valider le code';
  }
});

confirmResendBtn.addEventListener('click', async () => {
  if (!pendingConfirmEmail) return;
  confirmResendBtn.disabled = true;
  try {
    const { error } = await sb.auth.resend({ type: 'signup', email: pendingConfirmEmail });
    if (error) throw error;
    confirmErrorEl.style.color = '#1b5e20';
    confirmErrorEl.textContent = 'Nouveau code envoyé.';
  } catch (e) {
    confirmErrorEl.style.color = '#b71c1c';
    confirmErrorEl.textContent = e.message;
  } finally {
    confirmResendBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  if (!sb) return;
  logoutBtn.disabled = true;
  try {
    await sb.auth.signOut();
    await refreshAccountUI();
    showAuthTab('login');
  } finally {
    logoutBtn.disabled = false;
  }
});

// Google/Apple : les boutons sont prêts côté code mais désactivés tant que les fournisseurs
// OAuth ne sont pas configurés dans le tableau de bord Supabase (Authentication > Providers).
// document.getElementById('oauthGoogle').addEventListener('click', () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }));
// document.getElementById('oauthApple').addEventListener('click', () => sb.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } }));

if (sb) {
  sb.auth.onAuthStateChange(() => refreshAccountUI());
}
