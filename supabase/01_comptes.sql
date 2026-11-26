-- ANIME RIFT — étape 1 : comptes, numéro de joueur, sauvegarde en ligne, Hall of Fame.
-- À coller une seule fois dans Supabase : SQL Editor → New query → coller → Run.

-- Profil public de chaque joueur. Le numéro (player_no) est donné dans l'ordre d'inscription : 1, 2, 3…
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  player_no bigint generated always as identity unique,
  name text not null default 'Joueur' check (char_length(name) between 1 and 20),
  avatar text not null default '',
  title text not null default '',
  bio text not null default '' check (char_length(bio) <= 160),
  level int not null default 1,
  rebirths int not null default 0,
  collection int not null default 0,
  mr int not null default 0,
  lr int not null default 0,
  achievements int not null default 0,
  spire int not null default 0,
  arena int not null default 1000,
  score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La partie complète, visible seulement par son propriétaire.
create table if not exists public.saves (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;

-- Tout le monde peut lire les profils (classement, fiches joueurs) ; chacun ne modifie que le sien.
drop policy if exists "profils lisibles" on public.profiles;
create policy "profils lisibles" on public.profiles for select using (true);
drop policy if exists "mon profil" on public.profiles;
create policy "mon profil" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- La sauvegarde : seulement la mienne.
drop policy if exists "ma sauvegarde lecture" on public.saves;
create policy "ma sauvegarde lecture" on public.saves for select using (auth.uid() = id);
drop policy if exists "ma sauvegarde ajout" on public.saves;
create policy "ma sauvegarde ajout" on public.saves for insert with check (auth.uid() = id);
drop policy if exists "ma sauvegarde maj" on public.saves;
create policy "ma sauvegarde maj" on public.saves for update using (auth.uid() = id) with check (auth.uid() = id);

-- À l'inscription, le profil est créé tout seul et reçoit le numéro suivant.
create or replace function public.new_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data ->> 'name', 20), ''), 'Joueur'));
  return new;
end $$;
drop trigger if exists on_new_player on auth.users;
create trigger on_new_player after insert on auth.users for each row execute function public.new_player();

-- Le numéro de joueur ne peut pas être changé par le joueur.
revoke update (player_no, id, created_at) on public.profiles from anon, authenticated;

-- Nombre total de joueurs (pour « 2 978 joueurs » dans le Hall of Fame).
create or replace function public.player_count() returns bigint
language sql stable security definer set search_path = public as $$ select count(*) from public.profiles $$;
grant execute on function public.player_count() to anon, authenticated;
