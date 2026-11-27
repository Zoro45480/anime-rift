-- ANIME RIFT — étape 5 : parrainage vérifié par le serveur (filleuls validés, en attente, refusés ; classement des parrains).
-- À coller une seule fois dans Supabase : SQL Editor → New query → coller → Run (après les fichiers 02, 03 et 04).

-- Jours de jeu différents, comptés par le serveur : chaque fois que la date de « dernière présence » change de jour.
alter table public.profiles add column if not exists play_days int not null default 1;
create or replace function public.count_play_days() returns trigger language plpgsql as $$
begin
  if new.last_seen is not null and (old.last_seen is null or new.last_seen::date > old.last_seen::date) then
    new.play_days := coalesce(old.play_days, 1) + 1;
  else
    new.play_days := old.play_days; -- le joueur ne peut pas changer ce compteur lui-même
  end if;
  return new;
end $$;
drop trigger if exists on_play_day on public.profiles;
create trigger on_play_day before update on public.profiles for each row execute function public.count_play_days();

-- Un filleul est VALIDÉ quand il a atteint le niveau 5 et joué 2 jours différents.
-- Il est REFUSÉ s'il n'a rien fait depuis 30 jours sans être validé. Sinon il est EN ATTENTE.
create or replace function public.referral_status(lvl int, days int, seen timestamptz) returns text language sql immutable as $$
  select case when lvl >= 5 and days >= 2 then 'valide'
              when coalesce(seen, now()) < now() - interval '30 days' then 'refuse'
              else 'attente' end
$$;

create or replace function public.my_referral_list() returns table (name text, player_no bigint, avatar text, level int, play_days int, created_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select p.name, p.player_no, p.avatar, p.level, p.play_days, p.created_at, referral_status(p.level, p.play_days, p.last_seen)
  from profiles p where p.referred_by = (select player_no from profiles where id = auth.uid())
  order by p.created_at desc limit 500
$$;
grant execute on function public.my_referral_list() to authenticated;

-- Le nombre de récompenses ouvertes = le nombre de filleuls validés.
create or replace function public.my_referrals() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from profiles p
  where p.referred_by = (select player_no from profiles where id = auth.uid()) and referral_status(p.level, p.play_days, p.last_seen) = 'valide'
$$;
grant execute on function public.my_referrals() to authenticated;

-- Classement des parrains : les 10 joueurs qui ont le plus de filleuls validés.
create or replace function public.referral_top() returns table (name text, player_no bigint, avatar text, validated bigint)
language sql stable security definer set search_path = public as $$
  select g.name, g.player_no, g.avatar, count(*) as validated
  from profiles f join profiles g on g.player_no = f.referred_by
  where referral_status(f.level, f.play_days, f.last_seen) = 'valide'
  group by g.name, g.player_no, g.avatar order by validated desc, g.player_no limit 10
$$;
grant execute on function public.referral_top() to anon, authenticated;
