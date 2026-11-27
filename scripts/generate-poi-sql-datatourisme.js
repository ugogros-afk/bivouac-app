// Génère le SQL de migration pour les POI importés depuis DATAtourisme (épics #29/#30).
// Usage : node scripts/generate-poi-sql-datatourisme.js > scripts/migration-datatourisme.sql
// Idempotent : upsert on conflict (slug), comme scripts/generate-poi-sql.js.
//
// Pré-requis : avoir d'abord généré scripts/poi-seed-data-datatourisme.js via
// `DATATOURISME_API_KEY=xxx node scripts/import-datatourisme.js` (en local, voir ce
// fichier pour le pourquoi).

const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, 'poi-seed-data-datatourisme.js');
if (!fs.existsSync(seedPath)) {
  console.error('Erreur : scripts/poi-seed-data-datatourisme.js est introuvable.');
  console.error('Lance d\'abord : DATATOURISME_API_KEY=xxx node scripts/import-datatourisme.js');
  process.exit(1);
}

const pois = require(seedPath);

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlJsonArray(arr) {
  return "'" + JSON.stringify(arr).replace(/'/g, "''") + "'::jsonb";
}

let out = [];

out.push(`-- =========================================================
-- Migration "DATAtourisme" (épics #29/#30) - généré le ${new Date().toISOString().slice(0, 10)}
-- A exécuter dans l'éditeur SQL Supabase du projet bivouac-app, APRÈS migration-explorer-france.sql
-- (la table points_interet doit déjà exister).
-- Idempotent : peut être ré-exécuté sans danger (upsert on conflict (slug)).
-- =========================================================

insert into public.points_interet
  (slug, name, region, category, lat, lon, description_courte, description_longue, ambiance_tags, best_duration, best_season, practical_tips, how_to_get_there, popularity, hidden_gem, photo_urls, photo_credits)
values
`);

const rows = pois.map((p) => {
  const photoUrls = (p.photos || []).map((ph) => ph.url);
  const photoCredits = (p.photos || []).map((ph) => ph.credit + (ph.license ? ' — ' + ph.license : ''));
  return `  (${sqlStr(p.slug)}, ${sqlStr(p.name)}, ${sqlStr(p.region)}, ${sqlStr(p.category)}, ${p.lat}, ${p.lon}, ${sqlStr(p.description_courte)}, ${sqlStr(p.description_longue)}, ${sqlJsonArray(p.ambiance_tags)}, ${sqlStr(p.best_duration)}, ${sqlStr(p.best_season)}, ${sqlStr(p.practical_tips)}, ${sqlStr(p.how_to_get_there)}, ${sqlStr(p.popularity)}, ${p.hidden_gem}, ${sqlJsonArray(photoUrls)}, ${sqlJsonArray(photoCredits)})`;
});
out.push(
  rows.join(',\n') +
  '\non conflict (slug) do update set\n  name = excluded.name, region = excluded.region, category = excluded.category,\n  lat = excluded.lat, lon = excluded.lon,\n  description_courte = excluded.description_courte, description_longue = excluded.description_longue,\n  ambiance_tags = excluded.ambiance_tags, best_duration = excluded.best_duration, best_season = excluded.best_season,\n  practical_tips = excluded.practical_tips, how_to_get_there = excluded.how_to_get_there,\n  popularity = excluded.popularity, hidden_gem = excluded.hidden_gem,\n  photo_urls = excluded.photo_urls, photo_credits = excluded.photo_credits;\n'
);

console.log(out.join(''));
