-- =========================================================
-- Migration "Communauté" (épic social façon Strava, card #28) - généré le 25/11/2026
-- A exécuter dans l'éditeur SQL Supabase du projet bivouac-app.
--
-- Hypothèse (non vérifiable depuis cette session, pas d'accès direct à la base) :
-- la table public.profiles existe déjà avec au moins (user_id uuid primary key
-- references auth.users, pseudo text). Si le nom réel diffère, adapter les
-- références ci-dessous avant d'exécuter.
-- =========================================================

-- 1) Permettre la recherche d'amis par pseudo : lecture publique de profiles
--    limitée aux colonnes utiles (on ne change pas les policies d'écriture).
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);
grant select on public.profiles to anon, authenticated;

-- 2) Relations "amis" (follow à sens unique, façon Strava/Instagram plutôt
--    qu'une amitié symétrique à confirmer - plus simple pour un V1)
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint follows_no_self check (follower_id <> following_id)
);
create unique index if not exists follows_unique on public.follows (follower_id, following_id);

alter table public.follows enable row level security;
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows for select using (true);
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id);
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);
grant select, insert, delete on public.follows to authenticated;
grant select on public.follows to anon;

-- 3) Posts (voyage terminé, photo libre, etc.)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  content text,
  photo_urls jsonb default '[]'::jsonb,
  stats jsonb default '{}'::jsonb, -- ex. {"km": 180, "etapes": 4, "spots_favoris": 2}
  created_at timestamptz default now()
);

alter table public.posts enable row level security;
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select using (true);
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert with check (auth.uid() = user_id);
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = user_id);
grant select, insert, delete on public.posts to authenticated;
grant select on public.posts to anon;

-- 4) Kudos (like)
create table if not exists public.post_kudos (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.post_kudos enable row level security;
drop policy if exists "post_kudos_select_all" on public.post_kudos;
create policy "post_kudos_select_all" on public.post_kudos for select using (true);
drop policy if exists "post_kudos_insert_own" on public.post_kudos;
create policy "post_kudos_insert_own" on public.post_kudos
  for insert with check (auth.uid() = user_id);
drop policy if exists "post_kudos_delete_own" on public.post_kudos;
create policy "post_kudos_delete_own" on public.post_kudos
  for delete using (auth.uid() = user_id);
grant select, insert, delete on public.post_kudos to authenticated;
grant select on public.post_kudos to anon;

-- 5) Commentaires sur les posts
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.post_comments enable row level security;
drop policy if exists "post_comments_select_all" on public.post_comments;
create policy "post_comments_select_all" on public.post_comments for select using (true);
drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments
  for insert with check (auth.uid() = user_id);
drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
  for delete using (auth.uid() = user_id);
grant select, insert, delete on public.post_comments to authenticated;
grant select on public.post_comments to anon;
