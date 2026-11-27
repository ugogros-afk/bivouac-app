// Import de lieux "Explorer France" depuis l'API DATAtourisme (épics #29/#30).
//
// IMPORTANT — pourquoi ce script doit être exécuté EN LOCAL (pas par Claude) :
// api.datatourisme.fr n'est pas joignable depuis le container Claude Code ni depuis le
// pont vers cette machine (proxy sortant avec allow-list, hôte non autorisé). Ce script
// doit donc être lancé directement dans un terminal sur ta machine, où l'accès réseau
// est libre.
//
// Usage :
//   DATATOURISME_API_KEY=xxxx node scripts/import-datatourisme.js
//
// La clé n'est JAMAIS écrite en dur : elle doit venir de la variable d'environnement.
// Sortie : scripts/poi-seed-data-datatourisme.js (nouveau fichier, ne touche pas à
// scripts/poi-seed-data.js qui reste la source des 26 lieux éditoriaux existants).
//
// Limitations assumées (documentées plutôt que masquées) :
// - best_duration / best_season / practical_tips / how_to_get_there ne sont pas fournis
//   par DATAtourisme : laissés à null, à enrichir manuellement si besoin plus tard.
// - ambiance_tags est laissé vide ([]) : DATAtourisme n'a pas d'équivalent direct de nos
//   tags d'ambiance éditoriaux.
// - La catégorisation (ville / site naturel / monument / activité) est déduite par
//   mots-clés sur les classes d'ontologie DATAtourisme (`type`) : best-effort, pas
//   garanti à 100 %. Les POI dont aucun mot-clé ne matche sont classés en dernier
//   recours 'activité' (catégorie la plus générique) ET logués sur stderr pour revue
//   manuelle, plutôt que d'être silencieusement mal classés sans trace.
// - La licence/crédit est générique "DATAtourisme — Licence Ouverte / Etalab 2.0" sauf
//   si une info de licence plus précise est présente sur la représentation média.

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.DATATOURISME_API_KEY;
if (!API_KEY) {
  console.error('Erreur : la variable d\'environnement DATATOURISME_API_KEY est manquante.');
  console.error('Usage : DATATOURISME_API_KEY=xxxx node scripts/import-datatourisme.js');
  process.exit(1);
}

const BASE = 'https://api.datatourisme.fr/v1';
const TARGET_COUNT = 50; // nombre de nouveaux POI visés
const MAX_PAGES = 60; // garde-fou (rate limit ~1000 req/h, ~10 req/s soutenu)
const PAGE_SIZE = 50;
const MIN_DISTANCE_KM = 3; // dédoublonnage géographique
const REQUEST_DELAY_MS = 150; // throttle, bien en-dessous de 10 req/s

const existingPois = require('./poi-seed-data.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Distance Haversine en km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Mots-clés (en minuscules, sans accents) recherchés dans les URI/libellés de classe
// d'ontologie DATAtourisme (`type`) pour déduire une catégorie de notre schéma.
const CATEGORY_KEYWORDS = [
  { category: 'site naturel', keywords: ['naturel', 'nature', 'parc-naturel', 'montagne', 'lac', 'cascade', 'grotte', 'plage', 'foret', 'gorge', 'cirque', 'dune', 'reserve', 'site-naturel', 'naturalsite', 'naturalheritage'] },
  { category: 'monument', keywords: ['chateau', 'castle', 'monument', 'eglise', 'cathedrale', 'abbaye', 'patrimoine', 'religi', 'fortif', 'remparts', 'basilique', 'culturalsite', 'historicalsite', 'religioussite', 'heritage'] },
  { category: 'ville', keywords: ['ville', 'cite', 'village', 'bourg', 'city'] },
  // 'activité' est le fallback générique (dégustation, loisirs, sport de nature, artisanat...)
];

function categoryFromTypes(types) {
  const joined = (types || []).join(' ').toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => joined.includes(kw))) return category;
  }
  return 'activité'; // fallback documenté — logué par l'appelant si on atterrit ici
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} sur ${url}`);
  }
  return res.json();
}

function extractDescription(poi) {
  // hasDescription peut être un objet unique ou un tableau selon les POI ; on prend
  // le premier texte en français disponible (shortDescription puis longDescription).
  const descs = Array.isArray(poi.hasDescription) ? poi.hasDescription : [poi.hasDescription].filter(Boolean);
  for (const d of descs) {
    if (!d) continue;
    const short = d.shortDescription?.fr || d.shortDescription;
    const long = d.descriptionFR || d.longDescription?.fr || d.longDescription;
    if (short || long) return { short: short || null, long: long || short || null };
  }
  return { short: null, long: null };
}

function extractPhoto(poi) {
  const reps = []
    .concat(poi.hasMainRepresentation || [])
    .concat(poi.hasRepresentation || []);
  for (const rep of reps) {
    if (!rep) continue;
    const url = rep.ebucore_hasRelatedResource?.ebucore_locator || rep.isReprOf || rep.url || rep.ebucore_locator;
    if (url && typeof url === 'string') {
      const rights = rep.ebucore_hasRelatedResource?.ebucore_rights || rep.dc_rights || null;
      return {
        url,
        credit: rights ? `${rights} (DATAtourisme)` : 'DATAtourisme',
        license: 'Licence Ouverte / Etalab 2.0',
      };
    }
  }
  return null;
}

function extractLabel(poi) {
  if (!poi.label) return null;
  if (typeof poi.label === 'string') return poi.label;
  return poi.label.fr || Object.values(poi.label)[0] || null;
}

function extractGeo(poi) {
  const geo = poi.isLocatedAt?.[0]?.schema_geo || poi.isLocatedAt?.schema_geo || poi.isLocatedAt?.[0]?.geo || poi.isLocatedAt?.geo;
  if (!geo) return null;
  const lat = parseFloat(geo.schema_latitude ?? geo.latitude);
  const lon = parseFloat(geo.schema_longitude ?? geo.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

function extractRegion(poi) {
  const addr = poi.isLocatedAt?.[0]?.address || poi.isLocatedAt?.address;
  return addr?.hasAddressCity?.isPartOfDepartment?.isPartOfRegion?.rdfs_label?.fr
    || addr?.hasAddressCity?.rdfs_label?.fr
    || 'France';
}

async function run() {
  console.log(`Import DATAtourisme — objectif ${TARGET_COUNT} nouveaux POI, dédoublonnage ${MIN_DISTANCE_KM} km.`);

  const selected = [];
  const unmappedTypesLog = new Set();
  const seenSlugs = new Set(existingPois.map((p) => p.slug));

  let nextUrl = `${BASE}/placeOfInterest?page_size=${PAGE_SIZE}&fields=label,type,hasDescription,hasMainRepresentation,hasRepresentation,isLocatedAt`;
  let page = 0;

  while (nextUrl && page < MAX_PAGES && selected.length < TARGET_COUNT) {
    page += 1;
    let data;
    try {
      data = await fetchJSON(nextUrl);
    } catch (err) {
      console.error(`Page ${page} : échec de récupération (${err.message}). Arrêt de la pagination.`);
      break;
    }

    const items = data.member || data.data || data.results || [];
    for (const poi of items) {
      if (selected.length >= TARGET_COUNT) break;

      const geo = extractGeo(poi);
      const name = extractLabel(poi);
      if (!geo || !name) continue;

      const { short, long } = extractDescription(poi);
      if (!long || long.length < 60) continue; // description trop pauvre, on saute

      const photo = extractPhoto(poi);
      if (!photo) continue; // pas de photo exploitable, on saute (cohérent avec les 26 lieux existants)

      // Dédoublonnage vs les 26 lieux déjà en base
      const tooCloseToExisting = existingPois.some(
        (p) => haversineKm(p.lat, p.lon, geo.lat, geo.lon) < MIN_DISTANCE_KM
      );
      if (tooCloseToExisting) continue;

      // Dédoublonnage vs les POI déjà sélectionnés dans ce run
      const tooCloseToSelected = selected.some(
        (p) => haversineKm(p.lat, p.lon, geo.lat, geo.lon) < MIN_DISTANCE_KM
      );
      if (tooCloseToSelected) continue;

      const types = poi.type || [];
      const category = categoryFromTypes(types);
      if (category === 'activité' && !types.length) {
        unmappedTypesLog.add(`${name} -> type vide`);
      }

      let slug = slugify(name);
      if (seenSlugs.has(slug)) {
        let i = 2;
        while (seenSlugs.has(`${slug}-${i}`)) i += 1;
        slug = `${slug}-${i}`;
      }
      seenSlugs.add(slug);

      selected.push({
        slug,
        name,
        region: extractRegion(poi),
        category,
        lat: geo.lat,
        lon: geo.lon,
        description_courte: short ? short.slice(0, 220) : long.slice(0, 220),
        description_longue: long,
        ambiance_tags: [],
        best_duration: null,
        best_season: null,
        practical_tips: null,
        how_to_get_there: null,
        popularity: 'moyenne',
        hidden_gem: false,
        photos: [photo],
        _source: 'datatourisme',
      });
    }

    console.log(`Page ${page} traitée — ${selected.length}/${TARGET_COUNT} retenus jusqu'ici.`);

    nextUrl = data.meta?.next || null;
    if (nextUrl) await sleep(REQUEST_DELAY_MS);
  }

  if (unmappedTypesLog.size) {
    console.error('\nPOI avec classe DATAtourisme non reconnue (catégorisés "activité" par défaut, à vérifier manuellement) :');
    unmappedTypesLog.forEach((l) => console.error(`  - ${l}`));
  }

  if (!selected.length) {
    console.error('\nAucun POI retenu. Vérifie la clé API et la connectivité réseau.');
    process.exit(1);
  }

  const outPath = path.join(__dirname, 'poi-seed-data-datatourisme.js');
  const header = `// Lieux "Explorer France" importés depuis l'API DATAtourisme (épics #29/#30).\n` +
    `// Généré automatiquement par scripts/import-datatourisme.js le ${new Date().toISOString().slice(0, 10)}.\n` +
    `// Ne pas éditer à la main : relancer le script pour régénérer.\n` +
    `// Champs laissés à null (best_duration, best_season, practical_tips, how_to_get_there) :\n` +
    `// non fournis par DATAtourisme, à enrichir manuellement si besoin.\n\n` +
    `module.exports = `;

  fs.writeFileSync(outPath, header + JSON.stringify(selected, null, 2) + ';\n');

  console.log(`\n${selected.length} POI écrits dans scripts/poi-seed-data-datatourisme.js`);
  console.log('Prochaine étape : node scripts/generate-poi-sql-datatourisme.js > scripts/migration-datatourisme.sql');
}

run().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
