-- ANIME RIFT — étape 3 : règles du Bazar vérifiées par le serveur.
-- À coller une seule fois dans Supabase : SQL Editor → New query → coller → Run (après le fichier 02).

-- Un petit mot avec chaque proposition d'échange.
alter table public.trades add column if not exists note text not null default '' check (char_length(note) <= 140);

-- Échanges équitables : autant de cartes de chaque côté, entre 1 et 3.
alter table public.trades drop constraint if exists trades_equitable;
alter table public.trades add constraint trades_equitable check (
  jsonb_typeof(give) = 'array' and jsonb_typeof(want) = 'array'
  and jsonb_array_length(give) between 1 and 3
  and jsonb_array_length(give) = jsonb_array_length(want)
) not valid;

-- On ne s'échange pas de cartes avec soi-même.
alter table public.trades drop constraint if exists trades_pas_soi;
alter table public.trades add constraint trades_pas_soi check (from_id <> to_id) not valid;

-- Une annonce dure au plus 3 jours.
alter table public.listings drop constraint if exists listings_duree;
alter table public.listings add constraint listings_duree check (ends_at <= created_at + interval '3 days 1 minute') not valid;

-- Ordres : la date de création apparaît dans le classement (pour les insignes d'ancienneté).
drop view if exists public.guild_board;
create view public.guild_board as
  select g.id, g.name, g.tag, g.emblem, g.color, g.kind, g.max_members, g.min_level, g.description, g.created_at,
    (select count(*) from guild_members m where m.guild_id = g.id) as members,
    coalesce((select sum(d.damage) from guild_damage d where d.guild_id = g.id and d.week = to_char(date_trunc('week', now()), 'YYYY-MM-DD')), 0) as week_damage
  from guilds g;
grant select on public.guild_board to anon, authenticated;

-- RGPD : chaque joueur peut supprimer son compte (tout ce qui lui appartient part avec, grâce aux « on delete cascade »).
create or replace function public.delete_me() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  -- d'abord quitter son Ordre : un chef passe la main (ou l'Ordre disparaît s'il était seul)
  perform public.leave_guild();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
