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

const COLORS = { aire: '#2e7d32', camping: '#1565c0', bivouac: '#e65100', community: '#8e24aa' };

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
  // spots: [lat, lon, name, cls, fee, addr, phone, website]
  return {
    type: 'FeatureCollection',
    features: spots.map((s) => {
      const [lat, lon, name, cls, fee, addr, phone, website] = s;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          name: name || '(sans nom)', cls, fee: fee || '',
          addr: addr || '', phone: phone || '', website: website || ''
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
  html += '<strong>' + p.name + '</strong><br>';
  html += '<span style="color:' + color + '">' + p.cls + '</span>';
  if (p.fee) html += '<br>Payant: ' + p.fee;
  if (p.addr) html += '<br>' + p.addr;
  if (p.phone) html += '<br>📞 ' + p.phone;
  if (p.website) html += '<br><a href="' + p.website + '" target="_blank" rel="noopener">Site web</a>';
  html += '<div style="display:flex;gap:6px;margin-top:8px">';
  html += '<a href="' + gmaps + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#1a73e8;color:#fff;padding:6px;border-radius:6px;text-decoration:none;font-size:12px">Google Maps</a>';
  html += '<a href="' + waze + '" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#33ccff;color:#003;padding:6px;border-radius:6px;text-decoration:none;font-size:12px">Waze</a>';
  html += '</div></div>';
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
    new maplibregl.Popup({ offset: 10 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(popupHtml(p, lat, lon))
      .addTo(map);
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

async function loadOfficialSpots() {
  try {
    let spots = window.SPOTS_DATA; // [[lat, lon, name, cls, fee], ...] -- injecté par spots-data.js
    if (!spots) {
      // secours : si spots-data.js n'a pas chargé, on tente le fichier JSON (marche seulement via un serveur)
      const resp = await fetch('spots-data.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      spots = await resp.json();
    }
    const geojson = spotsToGeoJSON(spots);
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
        addSpotLayer('live', spotsToGeoJSON(liveSpots), false);
      } else {
        setLayerData('live', spotsToGeoJSON(liveSpots));
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

async function loadCommunitySpots() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('spots').select('lat, lon, name');
    if (error) throw error;
    const geojson = spotsToGeoJSON(data.map(s => [s.lat, s.lon, s.name, 'community', '', '', '', '']));
    if (!map.getSource('community')) {
      addSpotLayer('community', geojson, false);
    } else {
      setLayerData('community', geojson);
    }
  } catch (e) {
    console.error('Erreur chargement spots communautaires', e);
  }
}

async function addCommunitySpot(lat, lon, name) {
  if (!sb) { alert('Connexion à la base de données indisponible.'); return; }
  try {
    const { error } = await sb.from('spots').insert({ lat, lon, name: name || 'Spot ajouté' });
    if (error) throw error;
    loadCommunitySpots();
  } catch (e) {
    alert("Impossible d'enregistrer ce spot : " + e.message);
  }
}

map.on('contextmenu', (e) => {
  const name = prompt('Nom du spot (parking toléré, coin sympa...) ?');
  if (name !== null) addCommunitySpot(e.lngLat.lat, e.lngLat.lng, name);
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
