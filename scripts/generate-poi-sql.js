// Génère le SQL de migration pour l'epic "Explorer France" :
// - table points_interet (+ RLS/GRANT)
// - colonnes poi_id sur comments et trip_stops
// - extension de favorites (item_type + poi_id) pour les favoris unifiés (#16)
// - seed des lieux éditoriaux (#11), avec photos Wikimedia Commons (photo_urls/photo_credits)
// Usage : node scripts/generate-poi-sql.js > scripts/migration-explorer-france.sql
// Idempotent : peut être ré-exécuté sans danger (upsert on conflict (slug), colonnes en "add if not exists").

const pois = require('./poi-seed-data.js');

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlJsonArray(arr) {
  return "'" + JSON.stringify(arr).replace(/'/g, "''") + "'::jsonb";
}

let out = [];

out.push(`-- =========================================================
-- Migration "Explorer France" (epic #11-#17) - généré le 21/11/2026
-- A exécuter dans l'éditeur SQL Supabase du projet bivouac-app.
-- =========================================================

-- 1) Table points_interet (#12)
create table if not exists public.points_interet (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null,
  category text not null,
  lat double precision not null,
  lon double precision not null,
  photo_urls jsonb default '[]'::jsonb,
  description_courte text,
  description_longue text,
  ambiance_tags jsonb default '[]'::jsonb,
  best_duration text,
  best_season text,
  practical_tips text,
  how_to_get_there text,
  popularity text default 'moyenne', -- 'faible' | 'moyenne' | 'forte'
  hidden_gem boolean default false,
  created_at timestamptz default now()
);

alter table public.points_interet enable row level security;

drop policy if exists "points_interet_select_all" on public.points_interet;
create policy "points_interet_select_all" on public.points_interet
  for select using (true);

-- Écriture réservée (pas d'UI d'ajout public pour le proto) : pas de policy insert/update/delete
-- pour anon/authenticated. Les insertions se font ici via l'éditeur SQL (rôle service/owner).

grant select on public.points_interet to anon, authenticated;

-- 1bis) Photos (ajouté le 21/11/2026) : photo_urls existait déjà (vide) ; on ajoute photo_credits
-- en colonne parallèle (même ordre que photo_urls), pour afficher le crédit/licence Wikimedia Commons.
alter table public.points_interet add column if not exists photo_credits jsonb default '[]'::jsonb;

-- 2) Colonnes poi_id (#14, #15)
alter table public.comments add column if not exists poi_id uuid references public.points_interet(id);
alter table public.trip_stops add column if not exists poi_id uuid references public.points_interet(id);

-- 3) Favoris unifiés (#16) - Option A : extension de favorites
-- favorites avait (user_id, spot_id) en clé primaire composite : spot_id est donc NOT NULL
-- implicitement et ne peut pas devenir nullable tant qu'il fait partie de la PK.
-- On remplace par un id de substitution (uuid) + contraintes d'unicité partielles.
alter table public.favorites add column if not exists id uuid default gen_random_uuid();
update public.favorites set id = gen_random_uuid() where id is null;
alter table public.favorites alter column id set not null;

alter table public.favorites add column if not exists item_type text default 'spot'; -- 'spot' | 'poi'
alter table public.favorites add column if not exists poi_id uuid references public.points_interet(id);

alter table public.favorites drop constraint if exists favorites_pkey;
alter table public.favorites add constraint favorites_pkey primary key (id);

alter table public.favorites alter column spot_id drop not null;

drop index if exists favorites_user_spot_unique;
create unique index favorites_user_spot_unique on public.favorites (user_id, spot_id) where spot_id is not null;
drop index if exists favorites_user_poi_unique;
create unique index favorites_user_poi_unique on public.favorites (user_id, poi_id) where poi_id is not null;

-- 4) Seed des lieux éditoriaux (#11), avec photos Wikimedia Commons (licence libre uniquement)
insert into public.points_interet
  (slug, name, region, category, lat, lon, description_courte, description_longue, ambiance_tags, best_duration, best_season, practical_tips, how_to_get_there, popularity, hidden_gem, photo_urls, photo_credits)
values
`);

const rows = pois.map((p) => {
  const photoUrls = (p.photos || []).map((ph) => ph.url);
  const photoCredits = (p.photos || []).map((ph) => ph.credit + (ph.license ? ' — ' + ph.license : ''));
  return `  (${sqlStr(p.slug)}, ${sqlStr(p.name)}, ${sqlStr(p.region)}, ${sqlStr(p.category)}, ${p.lat}, ${p.lon}, ${sqlStr(p.description_courte)}, ${sqlStr(p.description_longue)}, ${sqlJsonArray(p.ambiance_tags)}, ${sqlStr(p.best_duration)}, ${sqlStr(p.best_season)}, ${sqlStr(p.practical_tips)}, ${sqlStr(p.how_to_get_there)}, ${sqlStr(p.popularity)}, ${p.hidden_gem}, ${sqlJsonArray(photoUrls)}, ${sqlJsonArray(photoCredits)})`;
});
out.push(rows.join(',\n') + '\non conflict (slug) do update set\n  name = excluded.name, region = excluded.region, category = excluded.category,\n  lat = excluded.lat, lon = excluded.lon,\n  description_courte = excluded.description_courte, description_longue = excluded.description_longue,\n  ambiance_tags = excluded.ambiance_tags, best_duration = excluded.best_duration, best_season = excluded.best_season,\n  practical_tips = excluded.practical_tips, how_to_get_there = excluded.how_to_get_there,\n  popularity = excluded.popularity, hidden_gem = excluded.hidden_gem,\n  photo_urls = excluded.photo_urls, photo_credits = excluded.photo_credits;\n');

console.log(out.join(''));
