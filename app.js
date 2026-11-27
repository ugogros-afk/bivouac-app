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

// Photos trop lentes à charger (#25) : les photo_urls de points_interet pointent souvent vers le fichier
// original Wikimedia Commons (plusieurs Mo), pas une miniature. On réécrit l'URL vers le chemin "thumb"
// de Wikimedia avec une largeur fixe quand c'est possible ; sinon on renvoie l'URL telle quelle (no-op
// pour toute autre source d'image, pour ne rien casser si on change de source plus tard).
// Photos trop lentes à charger (#25), partie 2 : les photos envoyées par les users (avis/comments)
// partent directement du fichier caméra du téléphone (souvent 3-10 Mo). On les redimensionne et
// recompresse côté client avant l'upload Supabase Storage. En cas d'échec (format non supporté par
// <canvas>, etc.), on retombe sur le fichier original plutôt que de bloquer l'envoi.
async function compressImageForUpload(file, maxDim, quality) {
  maxDim = maxDim || 1600; quality = quality || 0.82;
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.warn('Compression photo échouée, envoi du fichier original', e);
    return file;
  }
}

function wikimediaThumb(url, width) {
  if (!url) return url;
  const m = String(url).match(/^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/i);
  if (!m) return url; // déjà un /thumb/, ou pas une URL Commons reconnue
  const [, base, a, ab, filename] = m;
  return base + '/thumb/' + a + '/' + ab + '/' + filename + '/' + width + 'px-' + filename;
}

// Photos trop lentes à charger (#25), partie 3 : les photos des avis et des posts Communauté
// (stockées dans Supabase Storage) sont compressées côté client AVANT l'upload (voir
// compressImageForUpload), mais à une taille pensée pour un éventuel affichage plein écran
// (jusqu'à 1600px). Or elles ne sont AFFICHÉES que dans de petites vignettes (~350px) : le
// navigateur télécharge donc une image 4 à 5x plus lourde que nécessaire à chaque fois.
// On passe par l'API de redimensionnement à la volée de Supabase Storage (render/image) pour
// ne servir que la taille réellement affichée. Si cette fonctionnalité n'est pas activée sur le
// projet (plan Supabase sans Image Transformations), l'URL transformée répond en erreur : les
// <img> qui l'utilisent ont un onerror de secours qui retombe sur l'URL d'origine, donc aucune
// régression possible, juste une perte de l'optimisation dans ce cas.
function supabaseStorageThumb(url, width) {
  if (!url) return url;
  const m = String(url).match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/i);
  if (!m) return url; // pas une URL Supabase Storage publique reconnue
  const [, base, pathAndQuery] = m;
  return base + '/storage/v1/render/image/public/' + pathAndQuery + (pathAndQuery.includes('?') ? '&' : '?') + 'width=' + width + '&quality=75';
}

// Redimensionnement à l'affichage, quelle que soit la source de la photo (Wikimedia pour les
// lieux éditoriaux, Supabase Storage pour les avis/posts utilisateurs).
function displayThumb(url, width) {
  return supabaseStorageThumb(wikimediaThumb(url, width), width);
}

const COLORS = { aire: '#4ADE80', camping: '#38BDF8', bivouac: '#FB923C', community: '#C084FC' };

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
  // spots: [lat, lon, name, cls, fee, addr, phone, website, id (optionnel), legalStatus, vehicleConstraints, hikingConstraints]
  return {
    type: 'FeatureCollection',
    features: spots.map((s) => {
      const [lat, lon, name, cls, fee, addr, phone, website, id, legalStatus, vehicleConstraints, hikingConstraints] = s;
      // Les spots officiels n'ont pas d'identifiant propre : on en fabrique un stable
      // à partir des coordonnées, pour pouvoir y accrocher des avis/photos/favoris.
      const spotId = id || (lat.toFixed(6) + '_' + lon.toFixed(6));
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          name: name || '(sans nom)', cls, fee: fee || '',
          addr: addr || '', phone: phone || '', website: website || '',
          spotId,
          legalStatus: legalStatus || '',
          vehicleConstraints: vehicleConstraints ? JSON.stringify(vehicleConstraints) : '',
          hikingConstraints: hikingConstraints ? JSON.stringify(hikingConstraints) : ''
        }
      };
    })
  };
}

const LEGAL_STATUS_LABELS = {
  autorise_officiel: '✅ Autorisé officiellement',
  tolere: '🟡 Toléré',
  interdit_signale: '🚫 Interdit (signalé)',
  incertain: '❔ Statut incertain'
};

function legalBadgeHtml(status) {
  if (!status || !LEGAL_STATUS_LABELS[status]) return '';
  return '<div class="legal-badge legal-' + status + '">' + LEGAL_STATUS_LABELS[status] + '</div>';
}

function criteriaHtml(p) {
  const chips = [];
  if (p.vehicleConstraints) {
    try {
      const c = JSON.parse(p.vehicleConstraints);
      if (c.height_limit_m) chips.push('📏 Hauteur max ' + c.height_limit_m + ' m');
      if (c.has_water) chips.push('🚰 Point d\'eau');
      if (c.has_dump_station) chips.push('🚽 Vidange');
      if (c.price_indicative) chips.push('💶 ' + escapeHtml(c.price_indicative));
    } catch (e) { /* données mal formées : on ignore */ }
  }
  if (p.hikingConstraints) {
    try {
      const c = JSON.parse(p.hikingConstraints);
      if (c.walk_distance_m) chips.push('🚶 ' + c.walk_distance_m + ' m de marche');
      if (c.elevation_gain_m) chips.push('⛰️ ' + c.elevation_gain_m + ' m D+');
      if (c.exposure === 'abrite') chips.push('🌲 Abrité');
      if (c.exposure === 'expose') chips.push('☀️ Exposé');
      if (c.fire_allowed) chips.push('🔥 Feu autorisé');
    } catch (e) { /* données mal formées : on ignore */ }
  }
  if (!chips.length) return '';
  return '<div class="spot-criteria">' + chips.map((c) => '<span>' + c + '</span>').join('') + '</div>';
}

const CLS_LABELS = { aire: 'Aire camping-car', camping: 'Camping', bivouac: 'Bivouac', community: 'Communauté' };

function popupHtml(p, lat, lon) {
  const color = COLORS[p.cls] || '#9196A1';
  const gmaps = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
  const waze = 'https://waze.com/ul?ll=' + lat + ',' + lon + '&navigate=yes';
  let html = '<div class="bv-popup-card">';
  html += '<div class="bv-popup-head">';
  html += '<div class="bv-popup-title-group">';
  html += '<strong class="bv-popup-name">' + escapeHtml(p.name) + '</strong>';
  html += '<div class="rating-summary">Chargement de la note…</div>';
  html += '</div>';
  html += legalBadgeHtml(p.legalStatus);
  html += '</div>';
  html += '<span class="bv-popup-cls" style="color:' + color + '">' + (CLS_LABELS[p.cls] || escapeHtml(p.cls)) + '</span>';
  html += criteriaHtml(p);
  if (p.fee) html += '<div class="bv-popup-line">💶 Payant : ' + escapeHtml(p.fee) + '</div>';
  if (p.addr) html += '<div class="bv-popup-line">' + escapeHtml(p.addr) + '</div>';
  if (p.phone) html += '<div class="bv-popup-line">📞 ' + escapeHtml(p.phone) + '</div>';
  if (p.website) html += '<div class="bv-popup-line"><a href="' + p.website + '" target="_blank" rel="noopener">Site web</a></div>';
  html += '<div class="bv-popup-row">';
  html += '<a href="' + gmaps + '" target="_blank" rel="noopener" class="bv-popup-btn">Maps</a>';
  html += '<a href="' + waze + '" target="_blank" rel="noopener" class="bv-popup-btn">Waze</a>';
  html += '</div>';
  html += '<button onclick="openAvisModal(\'' + p.spotId + '\',' + lat + ',' + lon + ')" class="bv-popup-btn bv-popup-btn-wide">💬 Avis & photos</button>';
  html += '<button class="fav-btn bv-popup-btn bv-popup-btn-wide bv-popup-fav" onclick="onFavClick(this,\'' + p.spotId + '\',' + lat + ',' + lon + ',\'' + escapeAttr(p.name) + '\')">' +
    (isFavorite(p.spotId) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris') + '</button>';
  html += '</div>';
  return html;
}

// Bottom sheet riche au clic sur un spot (carte #14, cf. Carte.html) : remplace le popup MapLibre
// ci-dessus (popupHtml reste défini au cas où, mais n'est plus appelée depuis le clic sur la carte).
// Pas de photo par spot dans nos données OSM/DATAtourisme : pastille illustrée par catégorie à la
// place d'une vraie photo.
const SPOT_CATEGORY_ICON = { aire: '🅿️', camping: '🏕️', bivouac: '⛺', community: '🌍' };
const spotSheetEl = document.getElementById('spotSheet');
const spotSheetPhotoEl = document.getElementById('spotSheetPhoto');
const spotSheetIconEl = document.getElementById('spotSheetIcon');
const spotSheetLegalEl = document.getElementById('spotSheetLegal');
const spotSheetNameEl = document.getElementById('spotSheetName');
const spotSheetSubEl = document.getElementById('spotSheetSub');
const spotSheetPriceEl = document.getElementById('spotSheetPrice');
const spotSheetRatingEl = document.getElementById('spotSheetRating');
const spotSheetCtaEl = document.getElementById('spotSheetCta');
const spotSheetSecondaryEl = document.getElementById('spotSheetSecondary');
const spotSheetCloseBtn = document.getElementById('spotSheetClose');
const spotSheetFavBtn = document.getElementById('spotSheetFav');
let currentSheetSpot = null;

function closeSpotSheet() {
  spotSheetEl.classList.remove('show');
  currentSheetSpot = null;
}
spotSheetCloseBtn.addEventListener('click', closeSpotSheet);

function openSpotSheet(p, lat, lon) {
  currentSheetSpot = { p, lat, lon };
  const color = COLORS[p.cls] || '#9196A1';
  const gmaps = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
  const waze = 'https://waze.com/ul?ll=' + lat + ',' + lon + '&navigate=yes';

  spotSheetPhotoEl.style.background = color + '26';
  spotSheetIconEl.textContent = SPOT_CATEGORY_ICON[p.cls] || '📍';
  spotSheetLegalEl.innerHTML = legalBadgeHtml(p.legalStatus);
  spotSheetFavBtn.textContent = isFavorite(p.spotId) ? '★' : '☆';
  spotSheetFavBtn.onclick = async () => {
    spotSheetFavBtn.disabled = true;
    const nowFav = await toggleFavorite(p.spotId, lat, lon, p.name);
    spotSheetFavBtn.textContent = nowFav ? '★' : '☆';
    spotSheetFavBtn.disabled = false;
  };

  spotSheetNameEl.textContent = p.name;
  spotSheetSubEl.textContent = (CLS_LABELS[p.cls] || p.cls) + (p.addr ? ' · ' + p.addr : '');
  spotSheetPriceEl.textContent = p.fee ? '💶 ' + p.fee : '';
  spotSheetRatingEl.textContent = 'Chargement de la note…';
  loadRatingSummary(p.spotId, { getElement: () => spotSheetEl });

  spotSheetCtaEl.onclick = () => {
    closeSpotSheet();
    openTripPickerForPoi({ name: p.name, lat, lon, id: null });
  };

  let secondary = '<a href="' + gmaps + '" target="_blank" rel="noopener" class="bv-popup-btn">Maps</a>';
  secondary += '<a href="' + waze + '" target="_blank" rel="noopener" class="bv-popup-btn">Waze</a>';
  secondary += '<button onclick="openAvisModal(\'' + p.spotId + '\',' + lat + ',' + lon + ')" class="bv-popup-btn">💬 Avis</button>';
  spotSheetSecondaryEl.innerHTML = secondary;

  spotSheetEl.classList.add('show');
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
        'circle-color': '#15151D',
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.10)',
        'circle-opacity': 0.92,
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
      'circle-stroke-color': '#0A0A0F'
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

  // Bottom sheet riche au clic sur un point individuel (carte #14, remplace l'ancien popup MapLibre)
  map.on('click', id + '-points', (e) => {
    const f = e.features[0];
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    openSpotSheet(p, lat, lon);
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
    updateSpotStatsPills();
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

// Petit utilitaire : id de l'utilisateur connecté (ou null), pour tracer les contributions
// (avis, spots ajoutés) sans dupliquer l'appel getSession() partout.
async function currentUserId() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session && session.user ? session.user.id : null;
}

let communitySpotsRaw = [];

async function loadCommunitySpots() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('spots').select('id, lat, lon, name, category, notes, legal_status, vehicle_constraints, hiking_constraints');
    if (error) throw error;
    const tuples = data.map((s) => {
      const cls = s.category || 'community';
      return [s.lat, s.lon, s.name, cls, '', s.notes || '', '', '', s.id, s.legal_status, s.vehicle_constraints, s.hiking_constraints];
    });
    communitySpotsRaw = tuples;
    const geojson = spotsToGeoJSON(filterSpots(tuples));
    if (!map.getSource('community')) {
      addSpotLayer('community', geojson, false);
    } else {
      setLayerData('community', geojson);
    }
    updateSpotStatsPills();
  } catch (e) {
    console.error('Erreur chargement spots communautaires', e);
  }
}

// Bandeaux de stats flottants (DA v2, carte #21) : met à jour les pills "spots chargés" (carte) et
// "spots référencés" (mur de connexion) à partir des données réellement en mémoire, pas de chiffre inventé.
function updateSpotStatsPills() {
  const total = officialSpotsRaw.length + communitySpotsRaw.length;
  const mapEl = document.getElementById('mapStatSpots');
  if (mapEl) mapEl.textContent = total ? String(total) : '…';
  const authEl = document.getElementById('authStatSpots');
  if (authEl) authEl.textContent = total ? String(total) : '…';
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
  loadPois();

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
    const isReport = it.report_type === 'signalement_changement';
    let html = '<div class="avis-item' + (isReport ? ' is-report' : '') + '">';
    if (isReport) html += '<div class="avis-report-label">⚠️ Signalement</div>';
    if (it.rating) html += '<div class="avis-stars">' + '★'.repeat(it.rating) + '☆'.repeat(5 - it.rating) + '</div>';
    if (it.photo_url) html += '<img src="' + escapeAttr(displayThumb(it.photo_url, 400)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + escapeAttr(it.photo_url) + '\';">';
    if (it.text) html += '<p>' + escapeHtml(it.text) + '</p>';
    html += '<span class="avis-date">' + new Date(it.created_at).toLocaleDateString('fr-FR') + ' à ' + new Date(it.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>';
    html += '</div>';
    return html;
  }).join('');
}

async function openAvisModal(spotId, lat, lon) {
  if (!sb) { alert('Connexion à la base de données indisponible.'); return; }
  currentAvisSpot = { id: spotId, lat, lon };
  avisText.value = '';
  avisPhoto.value = '';
  reportTextInput.value = '';
  setAvisStars(0);
  avisModal.classList.add('show');
  avisList.innerHTML = '<p style="color:#888;font-size:13px">Chargement…</p>';
  try {
    const { data, error } = await sb
      .from('comments')
      .select('text, photo_url, created_at, rating, report_type')
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
      // Photo d'avis : jamais affichée qu'en petite vignette (pas de visionneuse plein écran),
      // donc inutile de conserver une résolution pensée pour du plein écran.
      const uploadFile = await compressImageForUpload(file, 1000, 0.78);
      const ext = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = currentAvisSpot.id + '_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('photos').upload(path, uploadFile);
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
      photo_url: photoUrl,
      user_id: await currentUserId()
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

const reportTextInput = document.getElementById('reportText');
const reportSubmitBtn = document.getElementById('reportSubmit');

reportSubmitBtn.addEventListener('click', async () => {
  if (!currentAvisSpot || !sb) return;
  const text = reportTextInput.value.trim();
  if (!text) { alert('Décrivez brièvement ce qui a changé.'); return; }
  reportSubmitBtn.disabled = true;
  reportSubmitBtn.textContent = '…';
  try {
    const { error } = await sb.from('comments').insert({
      spot_id: currentAvisSpot.id,
      lat: currentAvisSpot.lat,
      lon: currentAvisSpot.lon,
      text,
      report_type: 'signalement_changement',
      user_id: await currentUserId()
    });
    if (error) throw error;
    reportTextInput.value = '';
    openAvisModal(currentAvisSpot.id, currentAvisSpot.lat, currentAvisSpot.lon);
  } catch (e) {
    alert("Impossible d'envoyer ce signalement : " + e.message);
  } finally {
    reportSubmitBtn.disabled = false;
    reportSubmitBtn.textContent = '⚠️ Signaler';
  }
});

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

// Popover de filtres (remplace l'ancienne bande de chips en permanence visible, retour
// utilisateur du 27/11/2026 : se superposait visuellement à la carte).
const filterToggleBtn = document.getElementById('filterToggleBtn');
const filterRowEl = document.getElementById('filterRow');
filterToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willShow = !filterRowEl.classList.contains('show');
  filterRowEl.classList.toggle('show', willShow);
  filterToggleBtn.classList.toggle('active', willShow);
});
document.addEventListener('click', (e) => {
  if (filterRowEl.classList.contains('show') && !filterRowEl.contains(e.target) && e.target !== filterToggleBtn) {
    filterRowEl.classList.remove('show');
    filterToggleBtn.classList.remove('active');
  }
});

// --- Ajout d'un nouveau lieu : géolocalisation, adresse tapée, ou clic sur la carte ---
const addSpotModal = document.getElementById('addSpotModal');
const addSpotStep1 = document.getElementById('addSpotStep1');
const addSpotStep2 = document.getElementById('addSpotStep2');
const addSpotPositionLabel = document.getElementById('addSpotPositionLabel');
const addSpotNameInput = document.getElementById('addSpotName');
const addSpotCategorySelect = document.getElementById('addSpotCategory');
const addSpotNotesInput = document.getElementById('addSpotNotes');
const addSpotLegalStatusSelect = document.getElementById('addSpotLegalStatus');
const addSpotVehicleConstraints = document.getElementById('addSpotVehicleConstraints');
const addSpotHikingConstraints = document.getElementById('addSpotHikingConstraints');
const csHeightLimit = document.getElementById('csHeightLimit');
const csHasWater = document.getElementById('csHasWater');
const csHasDump = document.getElementById('csHasDump');
const csPrice = document.getElementById('csPrice');
const hcWalkDistance = document.getElementById('hcWalkDistance');
const hcElevation = document.getElementById('hcElevation');
const hcExposure = document.getElementById('hcExposure');
const hcFireAllowed = document.getElementById('hcFireAllowed');

function updateConstraintsVisibility() {
  const isHiking = addSpotCategorySelect.value === 'bivouac';
  addSpotVehicleConstraints.style.display = isHiking ? 'none' : 'block';
  addSpotHikingConstraints.style.display = isHiking ? 'block' : 'none';
}
addSpotCategorySelect.addEventListener('change', updateConstraintsVisibility);
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
  addSpotLegalStatusSelect.value = 'incertain';
  csHeightLimit.value = ''; csHasWater.checked = false; csHasDump.checked = false; csPrice.value = '';
  hcWalkDistance.value = ''; hcElevation.value = ''; hcExposure.value = ''; hcFireAllowed.checked = false;
  updateConstraintsVisibility();
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
  if (pickingLocationOnMap) {
    pickingLocationOnMap = false;
    map.getCanvas().style.cursor = '';
    setStatus('');
    pendingSpotCoords = { lat: e.lngLat.lat, lon: e.lngLat.lng, label: null };
    addSpotModal.classList.add('show');
    showAddSpotStep2();
    return;
  }
  // Clic sur une zone vide de la carte (pas sur un point/cluster) : referme le bottom sheet de spot.
  if (currentSheetSpot) {
    const hit = map.queryRenderedFeatures(e.point).some((f) => f.layer && /-points$|-clusters$/.test(f.layer.id));
    if (!hit) closeSpotSheet();
  }
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
  const legalStatus = addSpotLegalStatusSelect.value || null;
  let vehicleConstraints = null;
  let hikingConstraints = null;
  if (category === 'bivouac') {
    const hc = {};
    if (hcWalkDistance.value) hc.walk_distance_m = Number(hcWalkDistance.value);
    if (hcElevation.value) hc.elevation_gain_m = Number(hcElevation.value);
    if (hcExposure.value) hc.exposure = hcExposure.value;
    if (hcFireAllowed.checked) hc.fire_allowed = true;
    if (Object.keys(hc).length) hikingConstraints = hc;
  } else {
    const vc = {};
    if (csHeightLimit.value) vc.height_limit_m = Number(csHeightLimit.value);
    if (csHasWater.checked) vc.has_water = true;
    if (csHasDump.checked) vc.has_dump_station = true;
    if (csPrice.value.trim()) vc.price_indicative = csPrice.value.trim();
    if (Object.keys(vc).length) vehicleConstraints = vc;
  }
  addSpotSubmitBtn.disabled = true;
  addSpotSubmitBtn.textContent = 'Enregistrement…';
  try {
    const { error } = await sb.from('spots').insert({
      lat: pendingSpotCoords.lat,
      lon: pendingSpotCoords.lon,
      name,
      category,
      notes: notes || null,
      legal_status: legalStatus,
      vehicle_constraints: vehicleConstraints,
      hiking_constraints: hikingConstraints,
      user_id: await currentUserId()
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
// Synchronisés en base (table `favorites`), liés au compte connecté : disponibles sur tout appareil.
// `favoritesCache` est un miroir en mémoire pour un accès synchrone depuis les popups de la carte.
const FAVORITES_KEY = 'favorite_spots'; // ancien stockage local, gardé uniquement pour la migration ponctuelle
let favoritesCache = [];

function getLocalFavoritesForMigration() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch (e) { return []; }
}

async function loadFavoritesFromDb() {
  if (!sb) { favoritesCache = []; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { favoritesCache = []; return; }
  try {
    const { data, error } = await sb.from('favorites').select('spot_id, name, lat, lon').eq('user_id', session.user.id);
    if (error) throw error;
    favoritesCache = (data || []).map((f) => ({ id: f.spot_id, name: f.name, lat: f.lat, lon: f.lon }));

    // Migration ponctuelle : si des favoris existent encore en localStorage (ancien appareil) et
    // que la base est vide pour ce compte, on les bascule une fois pour toutes en base.
    const local = getLocalFavoritesForMigration();
    if (local.length && favoritesCache.length === 0) {
      const rows = local.map((f) => ({ user_id: session.user.id, spot_id: f.id, name: f.name, lat: f.lat, lon: f.lon }));
      const { error: migErr } = await sb.from('favorites').upsert(rows, { onConflict: 'user_id,spot_id' });
      if (!migErr) {
        favoritesCache = local.map((f) => ({ id: f.id, name: f.name, lat: f.lat, lon: f.lon }));
        localStorage.removeItem(FAVORITES_KEY);
      }
    }
  } catch (e) {
    console.error('Erreur chargement favoris', e);
    favoritesCache = [];
  }
}

function isFavorite(id) {
  return favoritesCache.some((f) => f.id === id);
}

async function toggleFavorite(id, lat, lon, name) {
  if (!sb) return isFavorite(id);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return false;
  const already = isFavorite(id);
  if (already) {
    const { error } = await sb.from('favorites').delete().eq('user_id', session.user.id).eq('spot_id', id);
    if (error) { console.error(error); return true; }
    favoritesCache = favoritesCache.filter((f) => f.id !== id);
    return false;
  }
  const { error } = await sb.from('favorites').upsert(
    { user_id: session.user.id, spot_id: id, name, lat, lon },
    { onConflict: 'user_id,spot_id' }
  );
  if (error) { console.error(error); return false; }
  favoritesCache.push({ id, lat, lon, name });
  return true;
}

async function onFavClick(btnEl, id, lat, lon, name) {
  btnEl.disabled = true;
  const nowFav = await toggleFavorite(id, lat, lon, name);
  btnEl.textContent = nowFav ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
  btnEl.disabled = false;
}

const favModal = document.getElementById('favModal');
const favListEl = document.getElementById('favList');

// renderFavList() est définie plus bas (section Explorer France), car elle fusionne
// désormais les favoris de spots ET les favoris de lieux éditoriaux (#16/#21).

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

// Le listener de clic sur favListEl (ouvrir/supprimer un favori) est attaché plus bas,
// une fois renderFavList() définie, pour couvrir spots + lieux éditoriaux.

// --- Navigation du bas (Carte / Explorer / Communauté / Itinéraire / Compte) ---
const navMap = document.getElementById('navMap');
const navExplorer = document.getElementById('navExplorer');
const navCommunaute = document.getElementById('navCommunaute');
const navTrips = document.getElementById('navTrips');
const navAccount = document.getElementById('navAccount');

function setActiveNav(which) {
  navMap.classList.toggle('active', which === 'map');
  navExplorer.classList.toggle('active', which === 'explorer');
  navCommunaute.classList.toggle('active', which === 'communaute');
  navTrips.classList.toggle('active', which === 'trips');
  navAccount.classList.toggle('active', which === 'account');
}

// --- Compte utilisateur : email/mot de passe + Google, confirmation par code ---
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
    await loadFavoritesFromDb();
    await loadPoiFavoritesFromDb();
    await loadProfile();
  } else {
    showAccountView('loggedOut');
    setAuthGate(true);
    favoritesCache = [];
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
  closeTripsListModal();
  closeItineraryModal();
  closeExplorerModal();
  closeCommunauteModal();
  closePoiDetail();
  setActiveNav('map');
});
navAccount.addEventListener('click', () => {
  closeTripsListModal();
  closeItineraryModal();
  closeExplorerModal();
  closeCommunauteModal();
  closePoiDetail();
  setActiveNav('account');
  openAccountModal();
});
navTrips.addEventListener('click', () => {
  if (authGateActive) return;
  closeAccountModal();
  closeItineraryModal();
  closeExplorerModal();
  closeCommunauteModal();
  closePoiDetail();
  setActiveNav('trips');
  openTripsListModal();
});
navCommunaute.addEventListener('click', () => {
  if (authGateActive) return;
  closeAccountModal();
  closeTripsListModal();
  closeItineraryModal();
  closeExplorerModal();
  closePoiDetail();
  setActiveNav('communaute');
  openCommunauteModal();
});
navExplorer.addEventListener('click', () => {
  if (authGateActive) return;
  closeAccountModal();
  closeTripsListModal();
  closeItineraryModal();
  closeCommunauteModal();
  closePoiDetail();
  setActiveNav('explorer');
  openExplorerModal();
});
accountCloseBtn.addEventListener('click', closeAccountModal);
accountModal.addEventListener('click', (e) => {
  if (e.target === accountModal) closeAccountModal();
});

// Vérifie l'état de connexion dès le chargement de la page (verrouille si non connecté).
refreshAccountUI();

loginSubmitBtn.addEventListener('click', async () => {
  loginErrorEl.style.color = '';
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

const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
forgotPasswordBtn.addEventListener('click', async () => {
  loginErrorEl.style.color = '';
  const email = loginEmailInput.value.trim();
  if (!email) { loginErrorEl.style.color = '#F87171'; loginErrorEl.textContent = "Saisissez d'abord votre e-mail ci-dessus."; return; }
  if (!sb) { loginErrorEl.style.color = '#F87171'; loginErrorEl.textContent = 'Connexion à la base de données indisponible.'; return; }
  forgotPasswordBtn.disabled = true;
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
    loginErrorEl.style.color = '#4ADE80';
    loginErrorEl.textContent = 'E-mail de réinitialisation envoyé (si ce compte existe).';
  } catch (e) {
    loginErrorEl.style.color = '#F87171';
    loginErrorEl.textContent = e.message;
  } finally {
    forgotPasswordBtn.disabled = false;
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
      confirmErrorEl.style.color = '#F87171';
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
  confirmErrorEl.style.color = '#F87171';
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

const confirmBackBtn = document.getElementById('confirmBack');
confirmBackBtn.addEventListener('click', () => {
  pendingConfirmEmail = null;
  confirmErrorEl.textContent = '';
  showAccountView('loggedOut');
  showAuthTab('signup');
});

confirmResendBtn.addEventListener('click', async () => {
  if (!pendingConfirmEmail) return;
  confirmResendBtn.disabled = true;
  try {
    const { error } = await sb.auth.resend({ type: 'signup', email: pendingConfirmEmail });
    if (error) throw error;
    confirmErrorEl.style.color = '#4ADE80';
    confirmErrorEl.textContent = 'Nouveau code envoyé.';
  } catch (e) {
    confirmErrorEl.style.color = '#F87171';
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

// --- Profil utilisateur : pseudo + type de voyageur (table `profiles`) ---
const profilePseudoInput = document.getElementById('profilePseudo');
const profileTravelerTypeSelect = document.getElementById('profileTravelerType');
const profileSaveBtn = document.getElementById('profileSaveBtn');
const profileSavedEl = document.getElementById('profileSaved');
const profileAvatarEl = document.getElementById('profileAvatar');
const profilePseudoDisplayEl = document.getElementById('profilePseudoDisplay');
const profileTravelerToggle = document.getElementById('profileTravelerToggle');
const statAvisCountEl = document.getElementById('statAvisCount');
const statSpotsCountEl = document.getElementById('statSpotsCount');
const statKmCountEl = document.getElementById('statKmCount');
const profileBadgeStat = document.getElementById('profileBadgeStat');
const profileBadgeLabel = document.getElementById('profileBadgeLabel');

function setTravelerToggle(value) {
  profileTravelerTypeSelect.value = value || '';
  profileTravelerToggle.querySelectorAll('.profile-toggle-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}
profileTravelerToggle.querySelectorAll('.profile-toggle-opt').forEach((btn) => {
  btn.addEventListener('click', () => setTravelerToggle(btn.dataset.value));
});

function updateAvatarAndName(pseudo, email) {
  const label = (pseudo && pseudo.trim()) || (email ? email.split('@')[0] : '');
  const initials = label
    ? label.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : '?';
  profileAvatarEl.textContent = initials || '?';
  profilePseudoDisplayEl.textContent = label || 'Sans pseudo';
}

// "km parcourus" (DA v2, carte #25) : approximation, pas une vraie distance routière/GPS.
// Pour chaque itinéraire enregistré par l'utilisateur, on additionne les distances à vol d'oiseau
// (haversineKm, déjà utilisée pour les suggestions le long d'un trajet) entre étapes consécutives,
// triées par position_order. Idéalement on sommerait les distances OSRM réelles de chaque trajet,
// mais ça demanderait de rappeler l'API de routage pour chaque trip historique à chaque ouverture
// du profil ; le calcul à vol d'oiseau utilise uniquement des données déjà en base, sans appel réseau
// supplémentaire — à affiner plus tard si on stocke la distance OSRM au moment de l'enregistrement du trip.
async function loadKmParcourus(userId) {
  if (!sb || !statKmCountEl) return;
  try {
    const { data: trips, error: tErr } = await sb.from('trips').select('id').eq('user_id', userId);
    if (tErr) throw tErr;
    if (!trips || !trips.length) { statKmCountEl.textContent = '0'; return; }
    const { data: stops, error: sErr } = await sb.from('trip_stops')
      .select('trip_id, custom_lat, custom_lon, position_order')
      .in('trip_id', trips.map((t) => t.id))
      .order('position_order', { ascending: true });
    if (sErr) throw sErr;
    const byTrip = {};
    (stops || []).forEach((s) => {
      if (s.custom_lat == null || s.custom_lon == null) return;
      (byTrip[s.trip_id] = byTrip[s.trip_id] || []).push(s);
    });
    let totalKm = 0;
    Object.values(byTrip).forEach((tripStopsList) => {
      for (let i = 0; i < tripStopsList.length - 1; i++) {
        const a = tripStopsList[i], b = tripStopsList[i + 1];
        totalKm += haversineKm(a.custom_lat, a.custom_lon, b.custom_lat, b.custom_lon);
      }
    });
    statKmCountEl.textContent = String(Math.round(totalKm));
  } catch (e) {
    console.error('Erreur calcul km parcourus', e);
    statKmCountEl.textContent = '0';
  }
}

async function loadProfile() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const { data, error } = await sb.from('profiles').select('pseudo, traveler_type').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    profilePseudoInput.value = (data && data.pseudo) || '';
    setTravelerToggle((data && data.traveler_type) || '');
    currentTravelerType = (data && data.traveler_type) || null;
    updateAvatarAndName((data && data.pseudo) || '', session.user.email);

    // Stats de contribution (comptées sur les lignes où on a pu tracer l'auteur ;
    // les contributions antérieures à l'ajout de user_id ne sont pas comptabilisées).
    const [avisRes, spotsRes] = await Promise.all([
      sb.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('report_type', 'avis'),
      sb.from('spots').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id)
    ]);
    const avisCount = avisRes.count || 0;
    const spotsCount = spotsRes.count || 0;
    statAvisCountEl.textContent = String(avisCount);
    statSpotsCountEl.textContent = String(spotsCount);
    loadKmParcourus(session.user.id);
    if (avisCount + spotsCount >= 5) {
      profileBadgeLabel.textContent = 'Contributeur régulier';
      profileBadgeStat.style.display = 'flex';
    } else if (avisCount + spotsCount >= 1) {
      profileBadgeLabel.textContent = 'Nouveau contributeur';
      profileBadgeStat.style.display = 'flex';
    } else {
      profileBadgeStat.style.display = 'none';
    }
  } catch (e) {
    console.error('Erreur chargement profil', e);
  }
}

profileSaveBtn.addEventListener('click', async () => {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  profileSaveBtn.disabled = true;
  profileSavedEl.textContent = '';
  profileSavedEl.style.color = '';
  try {
    const { error } = await sb.from('profiles').upsert({
      user_id: session.user.id,
      pseudo: profilePseudoInput.value.trim() || null,
      traveler_type: profileTravelerTypeSelect.value || null
    }, { onConflict: 'user_id' });
    if (error) throw error;
    updateAvatarAndName(profilePseudoInput.value.trim(), session.user.email);
    profileSavedEl.textContent = 'Profil enregistré.';
    setTimeout(() => { profileSavedEl.textContent = ''; }, 2500);
  } catch (e) {
    profileSavedEl.style.color = '#F87171';
    profileSavedEl.textContent = "Erreur : " + e.message;
  } finally {
    profileSaveBtn.disabled = false;
  }
});

// Google : provider OAuth configuré dans Supabase (Authentication > Providers > Google).
const oauthGoogleBtn = document.getElementById('oauthGoogle');
if (oauthGoogleBtn) {
  oauthGoogleBtn.addEventListener('click', async () => {
    if (!sb) return;
    oauthGoogleBtn.disabled = true;
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
      // La redirection vers Google a lieu ; le bouton reste désactivé le temps du redirect.
    } catch (e) {
      oauthGoogleBtn.disabled = false;
      alert("Connexion Google impossible : " + e.message);
    }
  });
}

// =====================================================================================
// --- Mon itinéraire / Mes trips ---
// Planification d'itinéraire : étapes posées par l'utilisateur, calcul de distance/temps
// par segment via un service de routing public (OSRM, serveur démo gratuit — voir note
// de limitation plus bas), et suggestion de spots qualifiés à proximité de chaque segment.
// =====================================================================================

// Distance à vol d'oiseau entre deux points (km), formule de Haversine.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// OSRM : serveur démo public (router.project-osrm.org), gratuit et sans clé mais sans garantie
// de disponibilité/débit en production, et profil "driving" générique (ne tient pas compte des
// restrictions camping-car : hauteur, poids...). Suffisant pour ce prototype ; à remplacer par
// un service de routing dédié (ou un OSRM self-hosté) avant un vrai lancement public.
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

async function fetchRoute(lat1, lon1, lat2, lon2) {
  const url = OSRM_URL + lon1 + ',' + lat1 + ';' + lon2 + ',' + lat2 + '?overview=full&geometries=geojson';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  if (!data.routes || !data.routes.length) throw new Error('Pas de route trouvée');
  const r = data.routes[0];
  return {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    coords: r.geometry.coordinates // [[lon, lat], ...]
  };
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return m + ' min';
  return h + 'h' + (m > 0 ? String(m).padStart(2, '0') : '');
}

// Spots suggérés le long d'un segment : on échantillonne la ligne de route, puis on cherche,
// parmi les spots officiels + communautaires déjà chargés en mémoire, ceux dont la distance
// minimale à la route reste sous un seuil. Le "détour" affiché est une approximation
// (aller-retour depuis le point le plus proche de la route), pas un calcul d'itinéraire exact.
function suggestSpotsAlongRoute(routeCoords, max) {
  if (!routeCoords || !routeCoords.length) return [];
  const step = Math.max(1, Math.floor(routeCoords.length / 40));
  const sampled = [];
  for (let i = 0; i < routeCoords.length; i += step) sampled.push(routeCoords[i]);

  const candidates = officialSpotsRaw.concat(communitySpotsRaw);
  const found = [];
  for (const s of candidates) {
    const [lat, lon, name, cls] = s;
    if (!name) continue;
    let minDist = Infinity;
    for (const [rlon, rlat] of sampled) {
      const d = haversineKm(lat, lon, rlat, rlon);
      if (d < minDist) minDist = d;
      if (minDist < 0.3) break; // assez proche, inutile de continuer
    }
    if (minDist <= 6) found.push({ lat, lon, name, cls, detourKm: minDist * 2 });
  }
  found.sort((a, b) => a.detourKm - b.detourKm);
  return found.slice(0, max || 4);
}

// --- Mes itinéraires (liste) ---
const tripsListModal = document.getElementById('tripsListModal');
const tripsListEl = document.getElementById('tripsList');
const tripsNewBtn = document.getElementById('tripsNewBtn');

function openTripsListModal() {
  tripsListModal.classList.add('show');
  loadTripsList();
}
function closeTripsListModal() {
  tripsListModal.classList.remove('show');
}

async function loadTripsList() {
  if (!sb) return;
  tripsListEl.innerHTML = '<div class="trips-empty">Chargement…</div>';
  try {
    const userId = await currentUserId();
    if (!userId) { tripsListEl.innerHTML = '<div class="trips-empty">Connecte-toi pour voir tes itinéraires.</div>'; return; }
    const { data: trips, error } = await sb.from('trips').select('id, name, created_at').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    if (!trips.length) {
      tripsListEl.innerHTML = '<div class="trips-empty">Aucun itinéraire pour l\'instant.<br>Touche le bouton + pour créer le premier.</div>';
      return;
    }
    const { data: stops } = await sb.from('trip_stops').select('trip_id');
    const countByTrip = {};
    (stops || []).forEach((s) => { countByTrip[s.trip_id] = (countByTrip[s.trip_id] || 0) + 1; });

    tripsListEl.innerHTML = '';
    trips.forEach((t) => {
      const card = document.createElement('button');
      card.className = 'trip-card';
      const n = countByTrip[t.id] || 0;
      card.innerHTML =
        '<div class="trip-card-thumb"></div>' +
        '<div class="trip-card-body">' +
          '<span class="trip-card-title">' + escapeHtml(t.name) + '</span>' +
          '<span class="trip-card-sub">' + n + (n > 1 ? ' étapes' : ' étape') + '</span>' +
        '</div>' +
        '<div class="trip-card-chevron">›</div>';
      card.addEventListener('click', () => {
        closeTripsListModal();
        openItineraryModal(t.id);
      });
      tripsListEl.appendChild(card);
    });
  } catch (e) {
    tripsListEl.innerHTML = '<div class="trips-empty">Erreur de chargement : ' + escapeHtml(e.message) + '</div>';
  }
}

tripsNewBtn.addEventListener('click', () => {
  closeTripsListModal();
  openItineraryModal(null);
});
tripsListModal.addEventListener('click', (e) => {
  if (e.target === tripsListModal) { closeTripsListModal(); setActiveNav('map'); }
});

// --- Mon itinéraire (édition d'un trip) ---
const itineraryModal = document.getElementById('itineraryModal');
const itineraryNameInput = document.getElementById('itineraryNameInput');
const itineraryStepsEl = document.getElementById('itinerarySteps');
const itineraryBackBtn = document.getElementById('itineraryBackBtn');
const itinerarySaveBtn = document.getElementById('itinerarySaveBtn');
const itinerarySaveStatus = document.getElementById('itinerarySaveStatus');
const itinMinimapEl = document.getElementById('itinMinimap');
const itinNightsValEl = document.getElementById('itinNightsVal');
const itinOptimizeBtn = document.getElementById('itinOptimizeBtn');

let currentTripId = null;
let tripStops = []; // [{ name, lat, lon }]
let tripSegmentsCache = {}; // clé "i" -> { distanceKm, durationMin, coords, suggestions }
// "Nuits planifiées" (carte #14, Itineraire.html) : notre modèle de données (trip_stops) n'a pas de
// champ "nuits" par étape -> compteur global, en mémoire seulement (non persisté en base), initialisé
// au nombre d'étapes - 1. Simplification assumée, à affiner si on ajoute un vrai champ nights plus tard.
let plannedNights = 0;

function openItineraryModal(tripId) {
  currentTripId = tripId;
  tripStops = [];
  tripSegmentsCache = {};
  plannedNights = 0;
  itineraryNameInput.value = 'Mon itinéraire';
  itinerarySaveStatus.textContent = '';
  itineraryModal.classList.add('show');
  if (tripId) {
    loadTripIntoEditor(tripId).then(maybeAppendPendingPoi);
  } else {
    renderItinerarySteps();
    maybeAppendPendingPoi();
  }
}

// Mini-carte d'itinéraire (Itineraire.html) : pins numérotés + trajet en pointillés sur fond sauge,
// projection équirectangulaire naïve des lat/lon dans la boîte (repère visuel, pas une vraie tuile carto).
const ITIN_PIN_COLORS = ['#D98558', '#6F8874', '#263D35', '#B45309', '#9333EA', '#2563EB'];
function renderItinMinimap() {
  const pts = tripStops.filter((s) => s.lat != null && s.lon != null);
  if (pts.length < 2) {
    itinMinimapEl.innerHTML = '<div class="itin-minimap-empty">Ajoute au moins deux étapes pour voir l\'aperçu du trajet.</div>' +
      '<button type="button" id="itinMinimapAdd" class="itin-minimap-add" aria-label="Ajouter une étape">+</button>';
    document.getElementById('itinMinimapAdd').addEventListener('click', focusAddStepForm);
    return;
  }
  const pad = 24, w = itinMinimapEl.clientWidth || 358, h = itinMinimapEl.clientHeight || 150;
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const spanLat = Math.max(maxLat - minLat, 0.001), spanLon = Math.max(maxLon - minLon, 0.001);
  const project = (p) => {
    const x = pad + ((p.lon - minLon) / spanLon) * (w - pad * 2);
    const y = (h - pad) - ((p.lat - minLat) / spanLat) * (h - pad * 2);
    return [x, y];
  };
  const coords = pts.map(project);
  const pathD = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">';
  svg += '<path d="' + pathD + '" fill="none" stroke="rgba(247,245,239,0.75)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>';
  coords.forEach((c, i) => {
    const color = ITIN_PIN_COLORS[i % ITIN_PIN_COLORS.length];
    svg += '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="13" fill="' + color + '" stroke="#F7F5EF" stroke-width="3"/>';
    svg += '<text x="' + c[0].toFixed(1) + '" y="' + c[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-family="Nunito,sans-serif" font-weight="800" font-size="12" fill="#F7F5EF">' + (i + 1) + '</text>';
  });
  svg += '</svg>';

  let totalKm = 0, totalMin = 0, known = true;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = tripSegmentsCache[i];
    if (seg && !seg.error) { totalKm += seg.distanceKm; totalMin += seg.durationMin; }
    else { known = false; totalKm += haversineKm(pts[i].lat, pts[i].lon, pts[i + 1].lat, pts[i + 1].lon); }
  }
  const pillLabel = known
    ? Math.round(totalKm) + ' km · ' + formatDuration(totalMin) + ' de route'
    : '≈ ' + Math.round(totalKm) + ' km à vol d\'oiseau';

  itinMinimapEl.innerHTML = svg +
    '<div class="itin-minimap-pill">' + escapeHtml(pillLabel) + '</div>' +
    '<button type="button" id="itinMinimapAdd" class="itin-minimap-add" aria-label="Ajouter une étape">+</button>';
  document.getElementById('itinMinimapAdd').addEventListener('click', focusAddStepForm);
}
function focusAddStepForm() {
  const btn = document.getElementById('itinAddStepBtn');
  if (btn) { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); btn.click(); }
}

document.getElementById('itinNightsMinus').addEventListener('click', () => {
  plannedNights = Math.max(0, plannedNights - 1);
  itinNightsValEl.textContent = String(plannedNights);
});
document.getElementById('itinNightsPlus').addEventListener('click', () => {
  plannedNights += 1;
  itinNightsValEl.textContent = String(plannedNights);
});

// "Optimiser" (carte #14) : réordonne les étapes intermédiaires par plus proche voisin (glouton) pour
// raccourcir le trajet total à vol d'oiseau. Simplification assumée : ce n'est pas un vrai TSP résolu
// (pas optimal à 100%), mais un ordre généralement bien meilleur que l'ordre de saisie, sans dépendance
// externe ni calcul d'itinéraire réel (OSRM) coûteux pour chaque permutation.
itinOptimizeBtn.addEventListener('click', () => {
  if (tripStops.length < 3) return;
  const remaining = tripStops.slice(1);
  const ordered = [tripStops[0]];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((s, idx) => {
      const d = haversineKm(last.lat, last.lon, s.lat, s.lon);
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    });
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  tripStops = ordered;
  tripSegmentsCache = {};
  renderItinerarySteps();
});
function closeItineraryModal() {
  itineraryModal.classList.remove('show');
}
itineraryBackBtn.addEventListener('click', () => {
  closeItineraryModal();
  openTripsListModal();
});
itineraryModal.addEventListener('click', (e) => {
  if (e.target === itineraryModal) { closeItineraryModal(); setActiveNav('map'); }
});

async function loadTripIntoEditor(tripId) {
  itineraryStepsEl.innerHTML = '<div class="trips-empty">Chargement…</div>';
  try {
    const { data: trip, error: tErr } = await sb.from('trips').select('name').eq('id', tripId).single();
    if (tErr) throw tErr;
    itineraryNameInput.value = trip.name;
    const { data: stops, error: sErr } = await sb.from('trip_stops').select('name, custom_lat, custom_lon, position_order, poi_id').eq('trip_id', tripId).order('position_order', { ascending: true });
    if (sErr) throw sErr;
    tripStops = (stops || []).map((s) => ({ name: s.name, lat: s.custom_lat, lon: s.custom_lon, poi_id: s.poi_id || null }));
    await renderItinerarySteps();
  } catch (e) {
    itineraryStepsEl.innerHTML = '<div class="trips-empty">Erreur de chargement : ' + escapeHtml(e.message) + '</div>';
  }
}

async function ensureSegment(i) {
  // Segment entre l'étape i et i+1
  if (tripSegmentsCache[i]) return tripSegmentsCache[i];
  const a = tripStops[i], b = tripStops[i + 1];
  try {
    const route = await fetchRoute(a.lat, a.lon, b.lat, b.lon);
    const suggestions = suggestSpotsAlongRoute(route.coords, 4);
    const seg = { distanceKm: route.distanceKm, durationMin: route.durationMin, suggestions, error: null };
    tripSegmentsCache[i] = seg;
    return seg;
  } catch (e) {
    const seg = { error: true };
    tripSegmentsCache[i] = seg;
    return seg;
  }
}

async function renderItinerarySteps() {
  itineraryStepsEl.innerHTML = '';
  renderItinMinimap();
  itinNightsValEl.textContent = String(plannedNights);
  itinOptimizeBtn.disabled = tripStops.length < 3;

  if (!tripStops.length) {
    const empty = document.createElement('div');
    empty.className = 'trips-empty';
    empty.textContent = "Ajoute une première étape (ville ou lieu) pour démarrer.";
    itineraryStepsEl.appendChild(empty);
  }

  tripStops.forEach((stop, i) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'itin-step';
    stepDiv.innerHTML =
      '<div class="itin-step-num-col">' +
        '<span class="itin-step-num">' + (i + 1) + '</span>' +
        (i < tripStops.length - 1 ? '<span class="itin-step-connector"></span>' : '') +
      '</div>' +
      '<div class="itin-step-body">' +
        '<div class="itin-step-card">' +
          '<div class="itin-step-card-main">' +
            '<span class="itin-step-name">' + (stop.poi_id ? '🏞️ ' : '') + escapeHtml(stop.name) + '</span>' +
            '<span class="itin-step-sub">Étape ' + (i + 1) + '</span>' +
          '</div>' +
          '<button class="itin-step-remove" data-i="' + i + '" aria-label="Retirer cette étape">✕</button>' +
        '</div>' +
        '<div class="itin-suggestions-holder" data-i="' + i + '"></div>' +
      '</div>';
    itineraryStepsEl.appendChild(stepDiv);

    if (i < tripStops.length - 1) {
      const segDiv = document.createElement('div');
      segDiv.className = 'itin-segment';
      segDiv.dataset.i = i;
      segDiv.textContent = 'Calcul du trajet…';
      itineraryStepsEl.appendChild(segDiv);
    }
  });

  // Bouton + formulaire d'ajout d'étape
  const addWrap = document.createElement('div');
  addWrap.innerHTML =
    '<button id="itinAddStepBtn" class="itin-add-step-btn">+ Ajouter une étape</button>' +
    '<div id="itinAddStepForm" class="itin-add-step-form" style="display:none">' +
      '<input type="text" id="itinAddStepInput" placeholder="Ville, lieu, site à visiter…" autocomplete="off">' +
      '<button id="itinAddStepValidate">Ajouter</button>' +
    '</div>' +
    '<div id="itinAddStepResults" class="itin-search-results" style="display:none"></div>';
  itineraryStepsEl.appendChild(addWrap);

  itineraryStepsEl.querySelectorAll('.itin-step-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      tripStops.splice(Number(btn.dataset.i), 1);
      tripSegmentsCache = {};
      renderItinerarySteps();
    });
  });

  const addBtn = document.getElementById('itinAddStepBtn');
  const addForm = document.getElementById('itinAddStepForm');
  const addInput = document.getElementById('itinAddStepInput');
  addBtn.addEventListener('click', () => {
    addBtn.style.display = 'none';
    addForm.style.display = 'flex';
    addInput.focus();
  });
  const validateAdd = async () => {
    const q = addInput.value.trim();
    if (!q) return;
    try {
      const result = await geocodeAddress(q);
      if (!result) { alert('Aucun résultat pour « ' + q + ' ».'); return; }
      tripStops.push({ name: result.label, lat: result.lat, lon: result.lon });
      tripSegmentsCache = {};
      renderItinerarySteps();
    } catch (e) {
      alert('Recherche indisponible (problème réseau).');
    }
  };
  document.getElementById('itinAddStepValidate').addEventListener('click', validateAdd);
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') validateAdd(); });

  // Recherche unifiée (#15/#20) : lieux éditoriaux (points_interet) + option "rechercher comme adresse".
  const addResultsEl = document.getElementById('itinAddStepResults');
  function renderAddStepResults(q) {
    if (!q) { addResultsEl.style.display = 'none'; addResultsEl.innerHTML = ''; return; }
    const qLower = q.toLowerCase();
    const matches = poisCache.filter((p) => p.name.toLowerCase().includes(qLower)).slice(0, 5);
    let html = matches.map((p) =>
      '<button type="button" class="itin-search-result" data-poi="' + p.id + '">' +
        '<span class="itin-search-result-icon">' + (POI_CATEGORY_ICON[p.category] || '📍') + '</span>' +
        '<span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(p.name) + '</span>' +
        '<span class="itin-search-result-sub">' + escapeHtml(p.region) + '</span></span>' +
      '</button>'
    ).join('');
    html += '<button type="button" class="itin-search-result" data-geocode="1">' +
      '<span class="itin-search-result-icon">🔍</span><span>Rechercher « ' + escapeHtml(q) + ' » (ville/adresse)</span></button>';
    addResultsEl.innerHTML = html;
    addResultsEl.style.display = 'block';

    addResultsEl.querySelectorAll('.itin-search-result').forEach((rbtn) => {
      rbtn.addEventListener('click', async () => {
        addResultsEl.style.display = 'none';
        addResultsEl.innerHTML = '';
        if (rbtn.dataset.poi) {
          const p = poisCache.find((x) => x.id === rbtn.dataset.poi);
          if (p) {
            tripStops.push({ name: p.name, lat: p.lat, lon: p.lon, poi_id: p.id });
            tripSegmentsCache = {};
            renderItinerarySteps();
          }
        } else {
          const q2 = addInput.value.trim();
          if (!q2) return;
          try {
            const result = await geocodeAddress(q2);
            if (!result) { alert('Aucun résultat pour « ' + q2 + ' ».'); return; }
            tripStops.push({ name: result.label, lat: result.lat, lon: result.lon, poi_id: null });
            tripSegmentsCache = {};
            renderItinerarySteps();
          } catch (e) {
            alert('Recherche indisponible (problème réseau).');
          }
        }
      });
    });
  }
  addInput.addEventListener('input', () => renderAddStepResults(addInput.value.trim()));

  // Calcule les segments en tâche de fond (ne bloque pas l'affichage des étapes).
  for (let i = 0; i < tripStops.length - 1; i++) {
    ensureSegment(i).then((seg) => {
      const segEl = itineraryStepsEl.querySelector('.itin-segment[data-i="' + i + '"]');
      if (segEl) {
        segEl.textContent = seg.error
          ? 'Trajet indisponible pour ce segment'
          : Math.round(seg.distanceKm) + ' km · environ ' + formatDuration(seg.durationMin) + ' de route';
      }
      renderItinMinimap();
      const holder = itineraryStepsEl.querySelector('.itin-suggestions-holder[data-i="' + i + '"]');
      if (holder && !seg.error && seg.suggestions && seg.suggestions.length) {
        holder.innerHTML =
          '<div class="itin-suggestions-label"><span>' + seg.suggestions.length + ' spot(s) suggéré(s) sur le trajet</span></div>' +
          '<div class="itin-suggestions">' +
            seg.suggestions.map((s) =>
              '<button type="button" class="itin-suggestion-card" data-lat="' + s.lat + '" data-lon="' + s.lon + '" data-name="' + escapeAttr(s.name) + '">' +
                '<div class="itin-suggestion-top"><span class="dot" style="background:' + (COLORS[s.cls] || '#9196A1') + '"></span>' +
                '<span class="itin-suggestion-name">' + escapeHtml(s.name) + '</span></div>' +
                '<span class="itin-suggestion-dist">+' + s.detourKm.toFixed(1) + ' km de détour (approx.)</span>' +
              '</button>'
            ).join('') +
          '</div>';
        holder.querySelectorAll('.itin-suggestion-card').forEach((card) => {
          card.addEventListener('click', () => {
            const idx = Number(holder.dataset.i);
            tripStops.splice(idx + 1, 0, { name: card.dataset.name, lat: Number(card.dataset.lat), lon: Number(card.dataset.lon) });
            tripSegmentsCache = {};
            renderItinerarySteps();
          });
        });
      }
    });
  }
}

itinerarySaveBtn.addEventListener('click', async () => {
  if (!sb) return;
  if (!tripStops.length) { alert('Ajoute au moins une étape avant d\'enregistrer.'); return; }
  const userId = await currentUserId();
  if (!userId) { alert('Connecte-toi pour enregistrer un itinéraire.'); return; }
  itinerarySaveBtn.disabled = true;
  itinerarySaveStatus.textContent = '';
  try {
    const name = itineraryNameInput.value.trim() || 'Mon itinéraire';
    let tripId = currentTripId;
    if (tripId) {
      const { error } = await sb.from('trips').update({ name }).eq('id', tripId);
      if (error) throw error;
      await sb.from('trip_stops').delete().eq('trip_id', tripId);
    } else {
      const { data, error } = await sb.from('trips').insert({ user_id: userId, name }).select('id').single();
      if (error) throw error;
      tripId = data.id;
      currentTripId = tripId;
    }
    const rows = tripStops.map((s, i) => ({
      trip_id: tripId, name: s.name, custom_lat: s.lat, custom_lon: s.lon,
      position_order: i, day_number: i + 1, poi_id: s.poi_id || null
    }));
    const { error: insErr } = await sb.from('trip_stops').insert(rows);
    if (insErr) throw insErr;
    itinerarySaveStatus.textContent = 'Itinéraire enregistré.';
    setTimeout(() => { itinerarySaveStatus.textContent = ''; }, 2500);
  } catch (e) {
    itinerarySaveStatus.style.color = '#F87171';
    itinerarySaveStatus.textContent = 'Erreur : ' + e.message;
  } finally {
    itinerarySaveBtn.disabled = false;
  }
});

// =====================================================================================
// --- Explorer France : lieux éditoriaux (points_interet) (epic #11-#17) ---
// Contenu curé (villes + sites naturels/monuments), distinct des spots communautaires
// (aires/campings/bivouacs). Chargé une fois en mémoire, comme officialSpotsRaw/communitySpotsRaw.
// =====================================================================================

let poisCache = []; // lignes de public.points_interet
let currentTravelerType = null; // profiles.traveler_type, mis à jour par loadProfile()

const POI_CATEGORY_ICON = { 'ville': '🏙️', 'site naturel': '🏞️', 'monument': '🏛️', 'activité': '🎒' };
// DA v2 (carte #19) : plus de dégradé — aplats unis sur la palette forêt/sauge/terracotta/beige.
// Nom de fonction/variable conservé (poiGradient) pour limiter le diff ; la valeur n'est plus un gradient.
const POI_CATEGORY_GRADIENT = {
  'ville': '#D9CBB5',
  'site naturel': '#6F8874',
  'monument': '#D98558',
  'activité': '#263D35'
};
function poiIcon(cat) { return POI_CATEGORY_ICON[cat] || '📍'; }
function poiGradient(cat) { return POI_CATEGORY_GRADIENT[cat] || POI_CATEGORY_GRADIENT['site naturel']; }

async function loadPois() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('points_interet').select('*');
    if (error) throw error;
    poisCache = data || [];
  } catch (e) {
    console.error('Erreur chargement points_interet', e);
    poisCache = [];
  }
}

// --- Favoris de lieux éditoriaux (#16) ---
// Table `favorites` étendue (item_type/poi_id) ; miroir en mémoire séparé des favoris de spots,
// pour ne pas toucher à la logique existante de favoritesCache/isFavorite/toggleFavorite.
let poiFavoritesCache = []; // [{ id: poi_id, name }]

async function loadPoiFavoritesFromDb() {
  if (!sb) { poiFavoritesCache = []; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { poiFavoritesCache = []; return; }
  try {
    const { data, error } = await sb.from('favorites').select('poi_id, name').eq('user_id', session.user.id).eq('item_type', 'poi');
    if (error) throw error;
    poiFavoritesCache = (data || []).map((f) => ({ id: f.poi_id, name: f.name }));
  } catch (e) {
    console.error('Erreur chargement favoris de lieux', e);
    poiFavoritesCache = [];
  }
}

function isPoiFavorite(id) {
  return poiFavoritesCache.some((f) => f.id === id);
}

async function togglePoiFavorite(id, name) {
  if (!sb) return isPoiFavorite(id);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { alert('Connecte-toi pour ajouter des favoris.'); return isPoiFavorite(id); }
  const already = isPoiFavorite(id);
  if (already) {
    const { error } = await sb.from('favorites').delete().eq('user_id', session.user.id).eq('poi_id', id).eq('item_type', 'poi');
    if (error) { console.error(error); return true; }
    poiFavoritesCache = poiFavoritesCache.filter((f) => f.id !== id);
    return false;
  }
  const { error } = await sb.from('favorites').insert({ user_id: session.user.id, poi_id: id, item_type: 'poi', name });
  if (error) { console.error(error); return false; }
  poiFavoritesCache.push({ id, name });
  return true;
}

// Fusionne spots + lieux éditoriaux dans l'écran "Mes favoris" existant.
function renderFavList() {
  const items = favoritesCache.map((f) => ({ type: 'spot', data: f }))
    .concat(poiFavoritesCache.map((f) => ({ type: 'poi', data: f })));
  if (!items.length) {
    favListEl.innerHTML = '<p style="color:#888;font-size:13px">Aucun favori pour l\'instant.</p>';
    favListEl.__items = [];
    return;
  }
  favListEl.innerHTML = items.map((it, i) =>
    '<div class="fav-item" data-i="' + i + '">' +
    '<span class="fav-name" data-i="' + i + '" style="flex:1">' +
      (it.type === 'poi' ? '🏞️ ' : '') + escapeHtml(it.data.name || '(sans nom)') +
    '</span>' +
    '<button class="fav-remove" data-i="' + i + '">✕</button>' +
    '</div>'
  ).join('');
  favListEl.__items = items;
}

favListEl.addEventListener('click', async (e) => {
  const i = e.target.getAttribute('data-i');
  if (i === null) return;
  const items = favListEl.__items || [];
  const it = items[Number(i)];
  if (!it) return;
  if (e.target.classList.contains('fav-remove')) {
    if (it.type === 'poi') await togglePoiFavorite(it.data.id, it.data.name);
    else await toggleFavorite(it.data.id, it.data.lat, it.data.lon, it.data.name);
    renderFavList();
  } else if (it.type === 'poi') {
    closeFavModal();
    openPoiDetail(it.data.id);
  } else {
    map.flyTo({ center: [it.data.lon, it.data.lat], zoom: 14 });
    closeFavModal();
  }
});

// --- Écran Explorer (#13/#18) ---
const explorerModal = document.getElementById('explorerModal');
const explorerScroll = document.getElementById('explorerScroll');
const explorerSearchInput = document.getElementById('explorerSearchInput');
const explorerBackBtn = document.getElementById('explorerBackBtn');
let explorerRegionFilter = null;
let explorerForYou = false;

function openExplorerModal() {
  explorerModal.classList.add('show');
  renderExplorer();
}
function closeExplorerModal() {
  explorerModal.classList.remove('show');
}
explorerBackBtn.addEventListener('click', () => { closeExplorerModal(); setActiveNav('map'); });
explorerModal.addEventListener('click', (e) => { if (e.target === explorerModal) { closeExplorerModal(); setActiveNav('map'); } });
explorerSearchInput.addEventListener('input', () => renderExplorer());

// --- Communauté (#28) : amis, partage, fil de posts façon Strava ---
const communauteModal = document.getElementById('communauteModal');
const communauteClose = document.getElementById('communauteClose');
const communauteTabFeed = document.getElementById('communauteTabFeed');
const communauteTabGroups = document.getElementById('communauteTabGroups');
const communauteFeedPane = document.getElementById('communauteFeedPane');
const communauteGroupsPane = document.getElementById('communauteGroupsPane');
const communauteFeedList = document.getElementById('communauteFeedList');
const communauteShareBtn = document.getElementById('communauteShareBtn');
const communauteSearchToggleBtn = document.getElementById('communauteSearchToggleBtn');
const communauteAddFriendBtn = document.getElementById('communauteAddFriendBtn');
const friendSearchWrap = document.getElementById('friendSearchWrap');
const friendSearchInput = document.getElementById('friendSearchInput');
const friendSearchResults = document.getElementById('friendSearchResults');
const composePostBtn = document.getElementById('composePostBtn');
const postComposerSheet = document.getElementById('postComposerSheet');
const postContentInput = document.getElementById('postContentInput');
const postPhotoInput = document.getElementById('postPhotoInput');
const postComposerError = document.getElementById('postComposerError');
const postSubmitBtn = document.getElementById('postSubmitBtn');
const postCancelBtn = document.getElementById('postCancelBtn');

let followingIds = new Set(); // ids des gens que je suis déjà, chargé à l'ouverture
let profilesCache = {}; // user_id -> pseudo, pour afficher les auteurs de posts sans refaire une requête par post

function openCommunauteModal() {
  communauteModal.classList.add('show');
  loadCommunityFeed();
}
function closeCommunauteModal() {
  communauteModal.classList.remove('show');
}
communauteClose.addEventListener('click', () => { closeCommunauteModal(); setActiveNav('map'); });
communauteModal.addEventListener('click', (e) => { if (e.target === communauteModal) { closeCommunauteModal(); setActiveNav('map'); } });

// Boutons "Rechercher des amis" / "Ajouter des amis" du header (#28, mockup Communaute.html) :
// le champ de recherche n'est plus affiché en permanence, il s'ouvre au clic sur l'un des deux
// (les deux mènent à la même recherche, "ajouter" et "rechercher des amis" étant la même action
// dans cette v1 — pas de flow d'invitation séparé).
function toggleFriendSearch(forceOpen) {
  const willShow = forceOpen !== undefined ? forceOpen : friendSearchWrap.style.display === 'none';
  friendSearchWrap.style.display = willShow ? 'block' : 'none';
  communauteSearchToggleBtn.classList.toggle('active', willShow);
  communauteAddFriendBtn.classList.toggle('active', willShow);
  if (willShow) {
    friendSearchInput.focus();
  } else {
    friendSearchInput.value = '';
    friendSearchResults.innerHTML = '';
  }
}
communauteSearchToggleBtn.addEventListener('click', () => toggleFriendSearch());
communauteAddFriendBtn.addEventListener('click', () => toggleFriendSearch(true));

communauteTabFeed.addEventListener('click', () => {
  communauteTabFeed.classList.add('active'); communauteTabGroups.classList.remove('active');
  communauteFeedPane.style.display = 'block'; communauteGroupsPane.style.display = 'none';
});
communauteTabGroups.addEventListener('click', () => {
  communauteTabGroups.classList.add('active'); communauteTabFeed.classList.remove('active');
  communauteFeedPane.style.display = 'none'; communauteGroupsPane.style.display = 'block';
});

communauteShareBtn.addEventListener('click', async () => {
  const shareData = { title: 'Roamly', text: 'Je planifie mes road-trips et bivouacs avec Roamly, regarde :', url: 'https://bivouac-app-jade.vercel.app' };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) { /* annulé par l'utilisateur, rien à faire */ }
  } else {
    try {
      await navigator.clipboard.writeText(shareData.url);
      alert('Lien copié dans le presse-papiers !');
    } catch (e) { alert(shareData.url); }
  }
});

// Recherche d'amis par pseudo (#28)
let friendSearchTimer = null;
friendSearchInput.addEventListener('input', () => {
  clearTimeout(friendSearchTimer);
  const q = friendSearchInput.value.trim();
  if (!q) { friendSearchResults.innerHTML = ''; return; }
  friendSearchTimer = setTimeout(() => runFriendSearch(q), 300);
});

async function runFriendSearch(q) {
  if (!sb) return;
  const myId = await currentUserId();
  const { data, error } = await sb.from('profiles').select('user_id, pseudo').ilike('pseudo', '%' + q + '%').limit(10);
  if (error) { console.error(error); return; }
  const results = (data || []).filter((p) => p.user_id !== myId);
  if (!results.length) { friendSearchResults.innerHTML = '<p style="color:var(--bv-muted);font-size:13px">Aucun résultat.</p>'; return; }
  friendSearchResults.innerHTML = results.map((p) =>
    '<div class="friend-result-item"><span>' + escapeHtml(p.pseudo || 'Sans pseudo') + '</span>' +
    '<button type="button" class="follow-btn' + (followingIds.has(p.user_id) ? ' following' : '') + '" data-uid="' + p.user_id + '">' +
    (followingIds.has(p.user_id) ? 'Suivi(e)' : 'Suivre') + '</button></div>'
  ).join('');
  friendSearchResults.querySelectorAll('.follow-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      btn.disabled = true;
      if (followingIds.has(uid)) {
        const { error: delErr } = await sb.from('follows').delete().eq('follower_id', myId).eq('following_id', uid);
        if (!delErr) { followingIds.delete(uid); btn.textContent = 'Suivre'; btn.classList.remove('following'); }
      } else {
        const { error: insErr } = await sb.from('follows').insert({ follower_id: myId, following_id: uid });
        if (!insErr) { followingIds.add(uid); btn.textContent = 'Suivi(e)'; btn.classList.add('following'); }
      }
      btn.disabled = false;
    });
  });
}

// Composer un post (#28)
composePostBtn.addEventListener('click', () => {
  postContentInput.value = ''; postPhotoInput.value = '';
  postComposerError.style.display = 'none';
  postComposerSheet.classList.add('show');
});
postCancelBtn.addEventListener('click', () => postComposerSheet.classList.remove('show'));
postComposerSheet.addEventListener('click', (e) => { if (e.target === postComposerSheet) postComposerSheet.classList.remove('show'); });

postSubmitBtn.addEventListener('click', async () => {
  if (!sb) return;
  const content = postContentInput.value.trim();
  const file = postPhotoInput.files[0];
  if (!content && !file) {
    postComposerError.textContent = 'Ajoute un texte ou une photo avant de publier.';
    postComposerError.style.display = 'block';
    return;
  }
  postSubmitBtn.disabled = true;
  postSubmitBtn.textContent = 'Publication…';
  try {
    const myId = await currentUserId();
    let photoUrls = [];
    if (file) {
      // Photo de post Communauté : affichée dans une carte de fil, jamais en plein écran.
      const uploadFile = await compressImageForUpload(file, 1000, 0.78);
      const ext = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = 'posts/' + myId + '_' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('photos').upload(path, uploadFile);
      if (upErr) throw upErr;
      const { data: urlData } = sb.storage.from('photos').getPublicUrl(path);
      photoUrls = [urlData.publicUrl];
    }
    const { error } = await sb.from('posts').insert({ user_id: myId, content: content || null, photo_urls: photoUrls });
    if (error) throw error;
    postComposerSheet.classList.remove('show');
    await loadCommunityFeed();
  } catch (e) {
    console.error(e);
    postComposerError.textContent = "Erreur lors de la publication. Réessaie.";
    postComposerError.style.display = 'block';
  } finally {
    postSubmitBtn.disabled = false;
    postSubmitBtn.textContent = 'Publier';
  }
});

async function loadCommunityFeed() {
  if (!sb) return;
  communauteFeedList.innerHTML = 'Chargement…';
  const myId = await currentUserId();

  const { data: followRows } = await sb.from('follows').select('following_id').eq('follower_id', myId);
  followingIds = new Set((followRows || []).map((f) => f.following_id));
  const authorIds = Array.from(followingIds); if (myId) authorIds.push(myId);

  const { data: posts, error } = await sb.from('posts').select('*').in('user_id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']).order('created_at', { ascending: false }).limit(30);
  if (error) { console.error(error); communauteFeedList.innerHTML = '<p style="color:var(--bv-bad)">Impossible de charger le fil.</p>'; return; }

  if (!posts || !posts.length) {
    communauteFeedList.innerHTML = '<p style="color:var(--bv-muted);text-align:center;padding:30px 0">Pas encore de posts. Suis des amis ou partage ton premier voyage !</p>';
    return;
  }

  // Auteurs : une requête groupée plutôt qu'une par post.
  const neededIds = Array.from(new Set(posts.map((p) => p.user_id).filter((id) => !profilesCache[id])));
  if (neededIds.length) {
    const { data: authors } = await sb.from('profiles').select('user_id, pseudo').in('user_id', neededIds);
    (authors || []).forEach((a) => { profilesCache[a.user_id] = a.pseudo; });
  }

  const postIds = posts.map((p) => p.id);
  const { data: kudosRows } = await sb.from('post_kudos').select('post_id, user_id').in('post_id', postIds);
  const kudosByPost = {};
  (kudosRows || []).forEach((k) => { (kudosByPost[k.post_id] = kudosByPost[k.post_id] || []).push(k.user_id); });

  communauteFeedList.innerHTML = posts.map((p) => feedPostHtml(p, kudosByPost[p.id] || [], myId)).join('');

  communauteFeedList.querySelectorAll('.kudo-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;
      const isActive = btn.classList.contains('kudo-active');
      btn.disabled = true;
      if (isActive) {
        await sb.from('post_kudos').delete().eq('post_id', postId).eq('user_id', myId);
      } else {
        await sb.from('post_kudos').insert({ post_id: postId, user_id: myId });
      }
      await loadCommunityFeed();
    });
  });
  communauteFeedList.querySelectorAll('.comments-toggle').forEach((btn) => {
    btn.addEventListener('click', () => toggleComments(btn.dataset.postId));
  });
  communauteFeedList.querySelectorAll('.feed-post-comment-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const content = input.value.trim();
      if (!content) return;
      await sb.from('post_comments').insert({ post_id: form.dataset.postId, user_id: myId, content });
      input.value = '';
      await renderComments(form.dataset.postId);
    });
  });
}

function feedPostHtml(p, kudoUserIds, myId) {
  const author = profilesCache[p.user_id] || 'Un roamer';
  const photo = Array.isArray(p.photo_urls) && p.photo_urls.length ? p.photo_urls[0] : null;
  const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
  let statsHtml = '';
  if (stats.km) statsHtml += '<span>🛣️ ' + stats.km + ' km</span>';
  if (stats.etapes) statsHtml += '<span>📍 ' + stats.etapes + ' étapes</span>';
  if (stats.spots_favoris) statsHtml += '<span>⭐ ' + stats.spots_favoris + ' favoris</span>';
  const iKudoed = kudoUserIds.includes(myId);
  const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return '<div class="feed-post-card" data-post-id="' + p.id + '">' +
    '<div class="feed-post-head"><span class="feed-post-author">' + escapeHtml(author) + '</span><span class="feed-post-date">' + date + '</span></div>' +
    (p.content ? '<div class="feed-post-content">' + escapeHtml(p.content) + '</div>' : '') +
    (photo ? '<img src="' + escapeAttr(displayThumb(photo, 800)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + escapeAttr(photo) + '\';">' : '') +
    (statsHtml ? '<div class="feed-post-stats">' + statsHtml + '</div>' : '') +
    '<div class="feed-post-actions">' +
      '<button type="button" class="kudo-btn' + (iKudoed ? ' kudo-active' : '') + '" data-post-id="' + p.id + '">👏 ' + kudoUserIds.length + '</button>' +
      '<button type="button" class="comments-toggle" data-post-id="' + p.id + '">💬 Commentaires</button>' +
    '</div>' +
    '<div class="feed-post-comments" id="comments-' + p.id + '" style="display:none">' +
      '<div class="feed-post-comment-list"></div>' +
      '<form class="feed-post-comment-form" data-post-id="' + p.id + '"><input type="text" placeholder="Écrire un commentaire…" required><button type="submit">Envoyer</button></form>' +
    '</div>' +
  '</div>';
}

async function toggleComments(postId) {
  const box = document.getElementById('comments-' + postId);
  const nowShown = box.style.display === 'none';
  box.style.display = nowShown ? 'block' : 'none';
  if (nowShown) await renderComments(postId);
}

async function renderComments(postId) {
  const box = document.getElementById('comments-' + postId);
  const listEl = box.querySelector('.feed-post-comment-list');
  const { data, error } = await sb.from('post_comments').select('user_id, content, created_at').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) { listEl.innerHTML = ''; return; }
  const neededIds = Array.from(new Set((data || []).map((c) => c.user_id).filter((id) => !profilesCache[id])));
  if (neededIds.length) {
    const { data: authors } = await sb.from('profiles').select('user_id, pseudo').in('user_id', neededIds);
    (authors || []).forEach((a) => { profilesCache[a.user_id] = a.pseudo; });
  }
  listEl.innerHTML = (data || []).map((c) =>
    '<div class="feed-post-comment"><strong>' + escapeHtml(profilesCache[c.user_id] || 'Un roamer') + ' :</strong> ' + escapeHtml(c.content) + '</div>'
  ).join('') || '<p style="color:var(--bv-muted);font-size:12.5px">Aucun commentaire pour l\'instant.</p>';
}

function poiGridHtml(list) {
  if (!list.length) return '<div class="explorer-empty">Aucun lieu dans cette catégorie.</div>';
  return '<div class="poi-grid">' + list.map(poiCardHtml).join('') + '</div>';
}

function poiCardHtml(p) {
  let badges = '';
  if (p.popularity === 'forte') badges += '<span class="poi-badge">⭐ Incontournable</span>';
  if (p.hidden_gem) badges += '<span class="poi-badge poi-badge-gem">💎 Pépite</span>';
  const photoUrl = Array.isArray(p.photo_urls) && p.photo_urls.length ? wikimediaThumb(p.photo_urls[0], 400) : null;
  const imgHtml = photoUrl
    ? '<img src="' + escapeAttr(photoUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'; this.parentElement.classList.add(\'poi-card-img-fallback\');">'
    : '';
  return '<button type="button" class="poi-card" data-id="' + p.id + '">' +
    '<div class="poi-card-img' + (photoUrl ? '' : ' poi-card-img-fallback') + '" style="background:' + poiGradient(p.category) + '">' + imgHtml + '<span class="poi-card-img-icon">' + poiIcon(p.category) + '</span></div>' +
    '<div class="poi-card-body">' +
      '<span class="poi-card-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="poi-card-region">' + escapeHtml(p.region) + '</span>' +
      (badges ? '<div class="poi-card-badges">' + badges + '</div>' : '') +
    '</div>' +
  '</button>';
}

async function renderExplorer() {
  if (!poisCache.length) {
    explorerScroll.innerHTML = '<div class="trips-empty">Chargement…</div>';
    await loadPois();
  }
  const q = explorerSearchInput.value.trim();
  const qLower = q.toLowerCase();
  let list = poisCache.filter((p) => !q || (p.name + ' ' + p.region).toLowerCase().includes(qLower));
  if (explorerRegionFilter) list = list.filter((p) => p.region === explorerRegionFilter);

  // "Pour vous" (#17/#22) : filtrage basique selon le type de voyageur du profil, sans algo complexe.
  if (explorerForYou) {
    if (currentTravelerType === 'bivouac_tente') {
      list = list.filter((p) => p.category === 'site naturel' || p.hidden_gem);
    } else if (currentTravelerType === 'camping_car') {
      list = list.filter((p) => p.category === 'ville' || p.category === 'monument' || p.popularity === 'forte');
    }
  }

  const regions = Array.from(new Set(poisCache.map((p) => p.region))).sort();

  let html = '<div class="explorer-region-row">';
  html += '<button class="filter-chip' + (explorerForYou ? ' active' : '') + '" data-foryou="1">✨ Pour vous</button>';
  html += '<button class="filter-chip' + (!explorerRegionFilter ? ' active' : '') + '" data-region="">Toutes régions</button>';
  regions.forEach((r) => {
    html += '<button class="filter-chip' + (explorerRegionFilter === r ? ' active' : '') + '" data-region="' + escapeAttr(r) + '">' + escapeHtml(r) + '</button>';
  });
  html += '</div>';

  if (!q && !explorerRegionFilter && !explorerForYou) {
    const forte = list.filter((p) => p.popularity === 'forte');
    const gems = list.filter((p) => p.hidden_gem);
    if (forte.length) html += '<div class="explorer-section-title">⭐ À ne pas manquer</div>' + poiGridHtml(forte);
    if (gems.length) html += '<div class="explorer-section-title">💎 Pépites secrètes</div>' + poiGridHtml(gems);
    html += '<div class="explorer-section-title">🗺️ Tous les lieux</div>' + poiGridHtml(list);
  } else {
    html += '<div class="explorer-section-title">Résultats (' + list.length + ')</div>' + poiGridHtml(list);
  }

  explorerScroll.innerHTML = html;

  explorerScroll.querySelectorAll('.filter-chip[data-foryou]').forEach((chip) => {
    chip.addEventListener('click', () => { explorerForYou = !explorerForYou; renderExplorer(); });
  });
  explorerScroll.querySelectorAll('.filter-chip[data-region]').forEach((chip) => {
    chip.addEventListener('click', () => { explorerRegionFilter = chip.dataset.region || null; renderExplorer(); });
  });
  explorerScroll.querySelectorAll('.poi-card').forEach((card) => {
    card.addEventListener('click', () => openPoiDetail(card.dataset.id));
  });
}

// --- Fiche lieu (POI) (#14/#19) ---
const poiDetailModal = document.getElementById('poiDetailModal');
const poiDetailScroll = document.getElementById('poiDetailScroll');
const poiDetailBackBtn = document.getElementById('poiDetailBackBtn');
const poiDetailFavBtn = document.getElementById('poiDetailFavBtn');
let currentPoi = null;
let pendingPoiToAdd = null; // { name, lat, lon, poi_id } en attente d'être ajouté à un itinéraire

async function openPoiDetail(poiId) {
  let p = poisCache.find((x) => x.id === poiId);
  if (!p && !poisCache.length) { await loadPois(); p = poisCache.find((x) => x.id === poiId); }
  if (!p) return;
  currentPoi = p;
  poiDetailModal.classList.add('show');
  renderPoiDetail(p);
  loadPoiReviews(p.id);
}
function closePoiDetail() {
  poiDetailModal.classList.remove('show');
  currentPoi = null;
}
poiDetailBackBtn.addEventListener('click', closePoiDetail);
poiDetailModal.addEventListener('click', (e) => { if (e.target === poiDetailModal) closePoiDetail(); });

poiDetailFavBtn.addEventListener('click', async () => {
  if (!currentPoi) return;
  poiDetailFavBtn.disabled = true;
  const now = await togglePoiFavorite(currentPoi.id, currentPoi.name);
  poiDetailFavBtn.textContent = now ? '★' : '☆';
  poiDetailFavBtn.disabled = false;
});

function accordionItem(icon, q, aHtml) {
  return '<div class="poi-acc-item">' +
    '<div class="poi-acc-q"><span>' + icon + ' ' + escapeHtml(q) + '</span><span class="poi-acc-chevron">▾</span></div>' +
    '<div class="poi-acc-a">' + aHtml + '</div>' +
  '</div>';
}

// "Où séjourner ?" : spots (aires/campings/bivouacs) déjà en mémoire, à proximité du POI (≤15 km).
function nearbySpotsHtml(p) {
  const candidates = officialSpotsRaw.concat(communitySpotsRaw)
    .filter((s) => s[2])
    .map((s) => ({ name: s[2], cls: s[3], dist: haversineKm(p.lat, p.lon, s[0], s[1]) }))
    .filter((s) => s.dist <= 15)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);
  if (!candidates.length) return '<p style="margin:0;color:var(--bv-muted)">Aucun spot connu à proximité pour l\'instant.</p>';
  return candidates.map((s) =>
    '<div class="poi-nearby-item"><span class="dot" style="background:' + (COLORS[s.cls] || '#9196A1') + '"></span>' +
    '<span style="flex:1">' + escapeHtml(s.name) + '</span><span style="color:var(--bv-muted)">' + s.dist.toFixed(1) + ' km</span></div>'
  ).join('');
}

function renderPoiDetail(p) {
  const tags = Array.isArray(p.ambiance_tags) ? p.ambiance_tags : [];
  poiDetailFavBtn.textContent = isPoiFavorite(p.id) ? '★' : '☆';

  const heroPhoto = Array.isArray(p.photo_urls) && p.photo_urls.length ? wikimediaThumb(p.photo_urls[0], 800) : null;
  const heroCredit = Array.isArray(p.photo_credits) && p.photo_credits.length ? p.photo_credits[0] : null;
  const heroImgHtml = heroPhoto
    ? '<img src="' + escapeAttr(heroPhoto) + '" alt="" onerror="this.style.display=\'none\'; this.parentElement.classList.add(\'poi-hero-fallback\');">'
    : '';
  // Bandeau de stats flottant (carte #21) : uniquement des infos réelles (popularité/pépite déjà en base),
  // pas de note chiffrée inventée (les lieux éditoriaux points_interet n'ont pas de champ "avis" comme les spots).
  let heroPills = '';
  if (p.popularity === 'forte') heroPills += '<div class="stat-glass-pill stat-glass-light"><span class="stat-glass-num">⭐</span><span class="stat-glass-label">Incontournable</span></div>';
  if (p.hidden_gem) heroPills += '<div class="stat-glass-pill stat-glass-light"><span class="stat-glass-num">💎</span><span class="stat-glass-label">Pépite</span></div>';

  let html = '<div class="poi-hero' + (heroPhoto ? '' : ' poi-hero-fallback') + '" style="background:' + poiGradient(p.category) + '">' +
      heroImgHtml +
      (heroPills ? '<div class="stat-glass-row" style="position:absolute;top:12px;right:12px;z-index:2">' + heroPills + '</div>' : '') +
      '<div class="poi-hero-overlay"><div class="poi-hero-title">' + escapeHtml(p.name) + '</div>' +
      '<div class="poi-hero-region">' + escapeHtml(p.region) + ' · ' + escapeHtml(p.category) + '</div></div>' +
    '</div>' +
    '<div class="poi-detail-body">' +
      (heroPhoto && heroCredit ? '<p class="poi-photo-credit">📷 ' + escapeHtml(heroCredit) + '</p>' : '') +
      '<p class="poi-detail-desc">' + escapeHtml(p.description_longue || p.description_courte || '') + '</p>' +
      (tags.length ? '<div class="poi-tags-row">' + tags.map((t) => '<span class="poi-tag">' + escapeHtml(t) + '</span>').join('') + '</div>' : '') +
      '<button type="button" id="poiAddToTripBtn" class="sheet-submit" style="width:100%;margin-bottom:18px">+ Ajouter à la planification</button>' +

      accordionItem('🌤️', 'Quelle est l\'ambiance ?', '<p style="margin:0">' + (tags.length ? escapeHtml(tags.join(', ')) : 'Non précisé.') + '</p>') +
      accordionItem('🏕️', 'Où séjourner à proximité ?', nearbySpotsHtml(p)) +
      accordionItem('💡', 'Un conseil pratique ?', '<p style="margin:0">' + escapeHtml(p.practical_tips || 'Pas de conseil spécifique pour le moment.') + '</p>') +
      accordionItem('📅', 'Meilleure période ?', '<p style="margin:0">' + escapeHtml(p.best_season || 'Toute l\'année') + (p.best_duration ? ' · Durée conseillée : ' + escapeHtml(p.best_duration) : '') + '</p>') +
      accordionItem('🚗', 'Comment s\'y rendre ?', '<p style="margin:0">' + escapeHtml(p.how_to_get_there || 'Non précisé.') + '</p>') +

      '<div class="explorer-section-title">💬 Avis de la communauté</div>' +
      '<div id="poiAvisList" class="sheet-list" style="max-height:none;margin-bottom:10px"></div>' +
      '<div id="poiAvisStars" style="font-size:24px;margin-bottom:10px;letter-spacing:4px">' +
        [1, 2, 3, 4, 5].map((v) => '<span class="star" data-v="' + v + '">★</span>').join('') +
      '</div>' +
      '<textarea id="poiAvisText" placeholder="Votre avis sur ce lieu..." style="width:100%;min-height:60px;border:1px solid var(--bv-border);border-radius:8px;padding:8px;font-size:14px;margin-bottom:8px;font-family:inherit;background:var(--bv-card);color:var(--bv-text)"></textarea>' +
      '<button type="button" id="poiAvisSubmit" class="sheet-submit" style="width:100%">Envoyer</button>' +
    '</div>';

  poiDetailScroll.innerHTML = html;

  poiDetailScroll.querySelectorAll('.poi-acc-item').forEach((item) => {
    item.querySelector('.poi-acc-q').addEventListener('click', () => item.classList.toggle('open'));
  });

  document.getElementById('poiAddToTripBtn').addEventListener('click', () => openTripPickerForPoi(p));

  let poiSelectedRating = 0;
  const starEls = Array.from(poiDetailScroll.querySelectorAll('#poiAvisStars .star'));
  starEls.forEach((s) => s.addEventListener('click', () => {
    poiSelectedRating = Number(s.dataset.v);
    starEls.forEach((el) => el.classList.toggle('active', Number(el.dataset.v) <= poiSelectedRating));
  }));
  document.getElementById('poiAvisSubmit').addEventListener('click', async () => {
    if (!sb) return;
    const textEl = document.getElementById('poiAvisText');
    const text = textEl.value.trim();
    if (!text && !poiSelectedRating) { alert('Ajoutez une note ou un commentaire.'); return; }
    try {
      const { error } = await sb.from('comments').insert({
        poi_id: p.id, lat: p.lat, lon: p.lon,
        text: text || null, rating: poiSelectedRating || null, user_id: await currentUserId()
      });
      if (error) throw error;
      textEl.value = '';
      poiSelectedRating = 0;
      loadPoiReviews(p.id);
    } catch (e) {
      alert("Impossible d'envoyer cet avis : " + e.message);
    }
  });
}

async function loadPoiReviews(poiId) {
  if (!sb) return;
  const list = poiDetailScroll.querySelector('#poiAvisList');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--bv-muted);font-size:13px">Chargement…</p>';
  try {
    const { data, error } = await sb.from('comments').select('text, photo_url, created_at, rating').eq('poi_id', poiId).order('created_at', { ascending: false });
    if (error) throw error;
    if (!data.length) { list.innerHTML = '<p style="color:var(--bv-muted);font-size:13px">Aucun avis pour l\'instant. Soyez le premier à en laisser un !</p>'; return; }
    list.innerHTML = data.map((it) => {
      let h = '<div class="avis-item">';
      if (it.rating) h += '<div class="avis-stars">' + '★'.repeat(it.rating) + '☆'.repeat(5 - it.rating) + '</div>';
      if (it.photo_url) h += '<img src="' + escapeAttr(displayThumb(it.photo_url, 400)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + escapeAttr(it.photo_url) + '\';">';
      if (it.text) h += '<p>' + escapeHtml(it.text) + '</p>';
      h += '<span class="avis-date">' + new Date(it.created_at).toLocaleDateString('fr-FR') + '</span></div>';
      return h;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p style="color:var(--bv-bad);font-size:13px">Erreur de chargement des avis.</p>';
  }
}

// "Ajouter à la planification" : réutilise l'écran "Mes itinéraires" existant pour choisir/créer
// un trip, puis ajoute automatiquement ce lieu comme étape dès que l'éditeur d'itinéraire s'ouvre.
function openTripPickerForPoi(p) {
  pendingPoiToAdd = { name: p.name, lat: p.lat, lon: p.lon, poi_id: p.id };
  closePoiDetail();
  openTripsListModal();
}
function maybeAppendPendingPoi() {
  if (!pendingPoiToAdd) return;
  tripStops.push({ name: pendingPoiToAdd.name, lat: pendingPoiToAdd.lat, lon: pendingPoiToAdd.lon, poi_id: pendingPoiToAdd.poi_id });
  tripSegmentsCache = {};
  pendingPoiToAdd = null;
  renderItinerarySteps();
}

if (sb) {
  sb.auth.onAuthStateChange(() => refreshAccountUI());
}
