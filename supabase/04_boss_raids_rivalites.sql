-- ANIME RIFT — étape 4 : boss mondial, raids à 3 et rivalités entre Ordres.
-- À coller une seule fois dans Supabase : SQL Editor → New query → coller → Run (après les fichiers 02 et 03).

-- ═════════ Boss mondial : tous les joueurs contre un seul boss chaque semaine ═════════
create table if not exists public.world_damage (
  user_id uuid not null references auth.users (id) on delete cascade,
  week text not null,
  damage bigint not null default 0,
  tries int not null default 0,
  primary key (user_id, week)
);
alter table public.world_damage enable row level security;
drop policy if exists "boss mondial lisible" on public.world_damage;
create policy "boss mondial lisible" on public.world_damage for select using (true);

-- 3 essais par jour (21 par semaine) ; dégâts plafonnés par essai pour limiter la triche.
create or replace function public.hit_world_boss(wk text, dmg bigint) returns text language plpgsql security definer set search_path = public as $$
declare t int;
begin
  if auth.uid() is null then return 'Connecte-toi d''abord.'; end if;
  if wk <> to_char(date_trunc('week', now()), 'YYYY-MM-DD') then return 'Ce boss n''est plus là.'; end if;
  insert into world_damage (user_id, week) values (auth.uid(), wk) on conflict do nothing;
  select tries into t from world_damage where user_id = auth.uid() and week = wk;
  if t >= 21 then return 'Plus d''essai cette semaine.'; end if;
  update world_damage set damage = damage + least(greatest(dmg, 0), 2000000), tries = tries + 1 where user_id = auth.uid() and week = wk;
  return 'ok';
end $$;
grant execute on function public.hit_world_boss(text, bigint) to authenticated;

create or replace function public.world_total(wk text) returns table (damage bigint, players bigint) language sql stable security definer set search_path = public as $$
  select coalesce(sum(damage), 0)::bigint, count(*)::bigint from world_damage where week = wk
$$;
grant execute on function public.world_total(text) to anon, authenticated;

-- ═════════ Raids : 3 joueurs, un code de groupe, 30 minutes ═════════
create table if not exists public.raids (
  id bigint generated always as identity primary key,
  code text not null unique,
  leader uuid not null references auth.users (id) on delete cascade,
  boss_hp bigint not null default 6000000,
  ends_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);
create table if not exists public.raid_members (
  raid_id bigint not null references public.raids (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  damage bigint not null default 0,
  hits int not null default 0,
  claimed boolean not null default false,
  primary key (raid_id, user_id)
);
alter table public.raids enable row level security;
alter table public.raid_members enable row level security;
drop policy if exists "raids lisibles" on public.raids;
create policy "raids lisibles" on public.raids for select using (true);
drop policy if exists "membres de raid lisibles" on public.raid_members;
create policy "membres de raid lisibles" on public.raid_members for select using (true);

-- Créer un groupe : renvoie son code à 6 caractères.
create or replace function public.create_raid() returns text language plpgsql security definer set search_path = public as $$
declare c text; rid bigint;
begin
  if auth.uid() is null then return 'Connecte-toi d''abord.'; end if;
  loop
    c := upper(translate(substr(md5(random()::text || clock_timestamp()::text), 1, 6), '01', 'XY'));
    exit when not exists (select 1 from raids where code = c);
  end loop;
  insert into raids (code, leader) values (c, auth.uid()) returning id into rid;
  insert into raid_members (raid_id, user_id) values (rid, auth.uid());
  return c;
end $$;
grant execute on function public.create_raid() to authenticated;

create or replace function public.join_raid(c text) returns text language plpgsql security definer set search_path = public as $$
declare r raids;
begin
  select * into r from raids where code = upper(c);
  if r is null then return 'Aucun groupe avec ce code.'; end if;
  if r.ends_at < now() then return 'Ce raid est terminé.'; end if;
  if exists (select 1 from raid_members where raid_id = r.id and user_id = auth.uid()) then return 'ok'; end if;
  if (select count(*) from raid_members where raid_id = r.id) >= 3 then return 'Ce groupe est complet (3 joueurs).'; end if;
  insert into raid_members (raid_id, user_id) values (r.id, auth.uid());
  return 'ok';
end $$;
grant execute on function public.join_raid(text) to authenticated;

-- Chaque joueur combat 3 fois pendant le raid (9 cartes au total à 3 joueurs).
create or replace function public.hit_raid(c text, dmg bigint) returns text language plpgsql security definer set search_path = public as $$
declare r raids; h int;
begin
  select * into r from raids where code = upper(c);
  if r is null or r.ends_at < now() then return 'Ce raid est terminé.'; end if;
  select hits into h from raid_members where raid_id = r.id and user_id = auth.uid();
  if h is null then return 'Rejoins le groupe d''abord.'; end if;
  if h >= 3 then return 'Tu as fait tes 3 combats de ce raid.'; end if;
  update raid_members set damage = damage + least(greatest(dmg, 0), 2000000), hits = hits + 1 where raid_id = r.id and user_id = auth.uid();
  return 'ok';
end $$;
grant execute on function public.hit_raid(text, bigint) to authenticated;

-- Le coffre : 100 Éclats garantis à chaque participant ; si le boss tombe, 300 Éclats et 3 Clés de Faille.
create or replace function public.claim_raid(c text) returns text language plpgsql security definer set search_path = public as $$
declare r raids; m raid_members; total bigint;
begin
  select * into r from raids where code = upper(c);
  if r is null then return 'Aucun raid.'; end if;
  select * into m from raid_members where raid_id = r.id and user_id = auth.uid() for update;
  if m is null or m.hits = 0 then return 'Il faut avoir combattu pour ouvrir le coffre.'; end if;
  if m.claimed then return 'Coffre déjà ouvert.'; end if;
  select coalesce(sum(damage), 0) into total from raid_members where raid_id = r.id;
  if r.ends_at > now() and total < r.boss_hp then return 'Le coffre s''ouvre quand le boss tombe ou à la fin du raid.'; end if;
  update raid_members set claimed = true where raid_id = r.id and user_id = auth.uid();
  if total >= r.boss_hp then insert into inbox (user_id, gems, tickets, note) values (auth.uid(), 300, 3, 'Coffre du raid : boss vaincu');
  else insert into inbox (user_id, gems, note) values (auth.uid(), 100, 'Coffre du raid'); end if;
  return 'ok';
end $$;
grant execute on function public.claim_raid(text) to authenticated;

-- ═════════ Rivalités entre Ordres ═════════
create table if not exists public.rivalries (
  id bigint generated always as identity primary key,
  a uuid not null references public.guilds (id) on delete cascade,
  b uuid not null references public.guilds (id) on delete cascade,
  week text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused')),
  created_at timestamptz not null default now(),
  check (a <> b)
);
alter table public.rivalries enable row level security;
drop policy if exists "rivalites lisibles" on public.rivalries;
create policy "rivalites lisibles" on public.rivalries for select using (true);

-- Le chef ou un adjoint déclare une rivalité par semaine. Il faut 3 membres de chaque côté.
create or replace function public.declare_rivalry(target uuid) returns text language plpgsql security definer set search_path = public as $$
declare gid uuid; wk text := to_char(date_trunc('week', now()), 'YYYY-MM-DD');
begin
  select guild_id into gid from guild_members where user_id = auth.uid() and role in ('chef', 'adjoint');
  if gid is null then return 'Réservé au chef et aux adjoints.'; end if;
  if gid = target then return 'Choisis un autre Ordre.'; end if;
  if (select count(*) from guild_members where guild_id = gid) < 3 or (select count(*) from guild_members where guild_id = target) < 3 then return 'Il faut au moins 3 membres de chaque côté.'; end if;
  if exists (select 1 from rivalries where week = wk and status <> 'refused' and (gid in (a, b) or target in (a, b))) then return 'Un des deux Ordres a déjà une rivalité cette semaine.'; end if;
  insert into rivalries (a, b, week) values (gid, target, wk);
  return 'ok';
end $$;
grant execute on function public.declare_rivalry(uuid) to authenticated;

-- L'Ordre défié accepte ou refuse sous 48 h.
create or replace function public.answer_rivalry(rid bigint, accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare r rivalries; gid uuid;
begin
  select * into r from rivalries where id = rid for update;
  if r is null or r.status <> 'pending' then return 'Cette rivalité n''attend plus de réponse.'; end if;
  if r.created_at < now() - interval '48 hours' then update rivalries set status = 'refused' where id = rid; return 'Trop tard : 48 h sont passées.'; end if;
  select guild_id into gid from guild_members where user_id = auth.uid() and role in ('chef', 'adjoint');
  if gid is distinct from r.b then return 'Réservé au chef et aux adjoints de l''Ordre défié.'; end if;
  update rivalries set status = case when accept then 'accepted' else 'refused' end where id = rid;
  return 'ok';
end $$;
grant execute on function public.answer_rivalry(bigint, boolean) to authenticated;

-- Scores : les dégâts au boss d'Ordre de la semaine, de chaque côté.
create or replace view public.rivalry_board as
  select r.id, r.a, r.b, r.week, r.status, r.created_at,
    ga.name as a_name, ga.tag as a_tag, gb.name as b_name, gb.tag as b_tag,
    coalesce((select sum(d.damage) from guild_damage d where d.guild_id = r.a and d.week = r.week), 0) as a_score,
    coalesce((select sum(d.damage) from guild_damage d where d.guild_id = r.b and d.week = r.week), 0) as b_score,
    (r.week < to_char(date_trunc('week', now()), 'YYYY-MM-DD')) as finished
  from rivalries r join guilds ga on ga.id = r.a join guilds gb on gb.id = r.b;
grant select on public.rivalry_board to anon, authenticated;
