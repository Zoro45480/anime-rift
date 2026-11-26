-- ANIME RIFT — étape 2 : social (amis, messages), échanges de cartes, guildes, marché entre joueurs, chat, parrainage, arène.
-- À coller une seule fois dans Supabase : SQL Editor → New query → coller → Run.
-- Principe : la partie reste sur l'appareil ; tout ce qui passe d'un joueur à un autre (âmes, cartes) arrive par une
-- « boîte de réception » (inbox) que le jeu ouvre tout seul. Les opérations sensibles passent par des fonctions serveur.

-- ── Profil : réglages et données publiques en plus ──
alter table public.profiles add column if not exists dm_policy text not null default 'all' check (dm_policy in ('all', 'friends', 'nobody'));
alter table public.profiles add column if not exists last_seen timestamptz not null default now();
alter table public.profiles add column if not exists team jsonb not null default '[]';
alter table public.profiles add column if not exists referred_by bigint;
alter table public.profiles add column if not exists guild_id uuid;

-- ── Boîte de réception : âmes, sceaux et cartes envoyés au joueur ──
create table if not exists public.inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  gems int not null default 0,
  tickets int not null default 0,
  cards jsonb not null default '[]', -- liste d'identifiants de cartes
  note text not null default '',
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inbox enable row level security;
drop policy if exists "ma boite" on public.inbox;
create policy "ma boite" on public.inbox for select using (auth.uid() = user_id);
drop policy if exists "je vide ma boite" on public.inbox;
create policy "je vide ma boite" on public.inbox for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Amis ──
create table if not exists public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friends enable row level security;
drop policy if exists "mes amis" on public.friends;
create policy "mes amis" on public.friends for select using (auth.uid() in (user_id, friend_id));
drop policy if exists "demande ami" on public.friends;
create policy "demande ami" on public.friends for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "accepter ami" on public.friends;
create policy "accepter ami" on public.friends for update using (auth.uid() = friend_id) with check (status = 'accepted');
drop policy if exists "retirer ami" on public.friends;
create policy "retirer ami" on public.friends for delete using (auth.uid() in (user_id, friend_id));

create or replace function public.are_friends(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friends where status = 'accepted' and ((user_id = a and friend_id = b) or (user_id = b and friend_id = a)))
$$;

-- ── Messages privés ──
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "mes messages" on public.messages;
create policy "mes messages" on public.messages for select using (auth.uid() in (from_id, to_id));
drop policy if exists "ecrire" on public.messages;
create policy "ecrire" on public.messages for insert with check (
  auth.uid() = from_id and from_id <> to_id and (
    (select dm_policy from profiles where id = to_id) = 'all'
    or ((select dm_policy from profiles where id = to_id) = 'friends' and public.are_friends(from_id, to_id))
  ));
drop policy if exists "lu" on public.messages;
create policy "lu" on public.messages for update using (auth.uid() = to_id) with check (auth.uid() = to_id);

-- ── Échanges de cartes entre joueurs (cartes du proposant mises de côté jusqu'à la réponse) ──
create table if not exists public.trades (
  id bigint generated always as identity primary key,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  give jsonb not null,  -- cartes proposées
  want jsonb not null,  -- cartes demandées
  status text not null default 'open' check (status in ('open', 'accepted', 'refused', 'cancelled')),
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
drop policy if exists "mes echanges" on public.trades;
create policy "mes echanges" on public.trades for select using (auth.uid() in (from_id, to_id));
drop policy if exists "proposer" on public.trades;
create policy "proposer" on public.trades for insert with check (auth.uid() = from_id and status = 'open' and jsonb_array_length(give) = jsonb_array_length(want) and jsonb_array_length(give) between 1 and 5);

-- Répondre à un échange. Accepter : le destinataire a déjà retiré ses cartes ; chacun reçoit celles de l'autre.
create or replace function public.answer_trade(trade bigint, accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare t trades;
begin
  select * into t from trades where id = trade for update;
  if t is null or t.status <> 'open' then return 'Cet échange n''est plus ouvert.'; end if;
  if accept then
    if auth.uid() <> t.to_id then return 'Ce n''est pas à toi de répondre.'; end if;
    update trades set status = 'accepted' where id = trade;
    insert into inbox (user_id, cards, note) values (t.to_id, t.give, 'Échange accepté');
    insert into inbox (user_id, cards, note) values (t.from_id, t.want, 'Échange accepté');
  else
    if auth.uid() not in (t.to_id, t.from_id) then return 'Ce n''est pas ton échange.'; end if;
    update trades set status = case when auth.uid() = t.from_id then 'cancelled' else 'refused' end where id = trade;
    insert into inbox (user_id, cards, note) values (t.from_id, t.give, 'Échange annulé : tes cartes reviennent');
  end if;
  return 'ok';
end $$;
grant execute on function public.answer_trade(bigint, boolean) to authenticated;

-- ── Marché entre joueurs : vente à prix fixe et enchères ──
create table if not exists public.listings (
  id bigint generated always as identity primary key,
  seller uuid not null references auth.users (id) on delete cascade,
  hero_id text not null,
  level int not null default 1,
  kind text not null default 'fixed' check (kind in ('fixed', 'auction')),
  price int not null check (price between 1 and 10000000),
  best_bid int,
  best_bidder uuid,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'sold', 'cancelled', 'expired')),
  buyer uuid,
  created_at timestamptz not null default now()
);
alter table public.listings enable row level security;
drop policy if exists "annonces lisibles" on public.listings;
create policy "annonces lisibles" on public.listings for select using (true);
drop policy if exists "mettre en vente" on public.listings;
create policy "mettre en vente" on public.listings for insert with check (auth.uid() = seller and status = 'open' and best_bid is null and buyer is null);

-- Acheter à prix fixe : l'acheteur a déjà payé dans sa partie ; la carte arrive dans sa boîte, les âmes dans celle du vendeur.
create or replace function public.buy_listing(listing bigint) returns text language plpgsql security definer set search_path = public as $$
declare l listings;
begin
  select * into l from listings where id = listing for update;
  if l is null or l.status <> 'open' or l.kind <> 'fixed' or l.ends_at < now() then return 'Cette annonce n''est plus disponible.'; end if;
  if l.seller = auth.uid() then return 'Tu ne peux pas acheter ta propre carte.'; end if;
  update listings set status = 'sold', buyer = auth.uid() where id = listing;
  insert into inbox (user_id, cards, note) values (auth.uid(), jsonb_build_array(l.hero_id), 'Achat au marché');
  insert into inbox (user_id, gems, note) values (l.seller, l.price - l.price / 10, 'Vente au marché (10 % de commission)');
  return 'ok';
end $$;
grant execute on function public.buy_listing(bigint) to authenticated;

-- Enchérir : l'enchérisseur a déjà mis les âmes de côté ; l'ancien meilleur enchérisseur est remboursé.
create or replace function public.bid_listing(listing bigint, amount int) returns text language plpgsql security definer set search_path = public as $$
declare l listings;
begin
  select * into l from listings where id = listing for update;
  if l is null or l.status <> 'open' or l.kind <> 'auction' or l.ends_at < now() then return 'Cette enchère est terminée.'; end if;
  if l.seller = auth.uid() then return 'Tu ne peux pas enchérir sur ta propre carte.'; end if;
  if amount < greatest(l.price, coalesce(l.best_bid, 0) + 1) then return 'Ton enchère doit dépasser la meilleure offre.'; end if;
  if l.best_bidder is not null then insert into inbox (user_id, gems, note) values (l.best_bidder, l.best_bid, 'Enchère dépassée : tes âmes reviennent'); end if;
  update listings set best_bid = amount, best_bidder = auth.uid(),
    ends_at = case when l.ends_at - now() < interval '2 minutes' then now() + interval '2 minutes' else l.ends_at end where id = listing;
  return 'ok';
end $$;
grant execute on function public.bid_listing(bigint, int) to authenticated;

-- Retirer son annonce (sans enchère en cours), ou régler une annonce terminée : n'importe qui peut lancer le réglage.
create or replace function public.close_listing(listing bigint) returns text language plpgsql security definer set search_path = public as $$
declare l listings;
begin
  select * into l from listings where id = listing for update;
  if l is null or l.status <> 'open' then return 'déjà réglée'; end if;
  if l.ends_at > now() then
    if l.seller <> auth.uid() or l.best_bidder is not null then return 'Annonce encore en cours.'; end if;
    update listings set status = 'cancelled' where id = listing;
    insert into inbox (user_id, cards, note) values (l.seller, jsonb_build_array(l.hero_id), 'Annonce retirée : ta carte revient');
    return 'ok';
  end if;
  if l.best_bidder is not null then
    update listings set status = 'sold', buyer = l.best_bidder where id = listing;
    insert into inbox (user_id, cards, note) values (l.best_bidder, jsonb_build_array(l.hero_id), 'Enchère gagnée');
    insert into inbox (user_id, gems, note) values (l.seller, l.best_bid - l.best_bid / 10, 'Enchère vendue (10 % de commission)');
  else
    update listings set status = 'expired' where id = listing;
    insert into inbox (user_id, cards, note) values (l.seller, jsonb_build_array(l.hero_id), 'Pas d''acheteur : ta carte revient');
  end if;
  return 'ok';
end $$;
grant execute on function public.close_listing(bigint) to authenticated;

-- ── Guildes ──
create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 24),
  tag text not null unique check (tag ~ '^[A-Z0-9]{2,5}$'),
  description text not null default '' check (char_length(description) <= 200),
  kind text not null default 'open' check (kind in ('open', 'invite', 'closed')),
  min_level int not null default 0,
  max_members int not null default 50 check (max_members between 5 and 50),
  emblem text not null default '狐',
  color text not null default '#ff3d6e',
  owner uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade unique,
  role text not null default 'membre' check (role in ('chef', 'adjoint', 'membre')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
create table if not exists public.guild_requests (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
-- Dégâts au boss de guilde de la semaine (la semaine = lundi au format AAAA-MM-JJ).
create table if not exists public.guild_damage (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week text not null,
  damage bigint not null default 0,
  tries int not null default 0,
  primary key (guild_id, user_id, week)
);
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_requests enable row level security;
alter table public.guild_damage enable row level security;
drop policy if exists "guildes lisibles" on public.guilds;
create policy "guildes lisibles" on public.guilds for select using (true);
drop policy if exists "membres lisibles" on public.guild_members;
create policy "membres lisibles" on public.guild_members for select using (true);
drop policy if exists "degats lisibles" on public.guild_damage;
create policy "degats lisibles" on public.guild_damage for select using (true);
drop policy if exists "demandes visibles" on public.guild_requests;
create policy "demandes visibles" on public.guild_requests for select using (
  auth.uid() = user_id or exists (select 1 from guild_members m where m.guild_id = guild_requests.guild_id and m.user_id = auth.uid() and m.role in ('chef', 'adjoint')));
drop policy if exists "chef modifie" on public.guilds;
create policy "chef modifie" on public.guilds for update using (auth.uid() = owner) with check (auth.uid() = owner);

create or replace function public.create_guild(g_name text, g_tag text, g_desc text, g_kind text, g_min int, g_max int, g_emblem text, g_color text) returns text
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if exists (select 1 from guild_members where user_id = auth.uid()) then return 'Quitte d''abord ta guilde actuelle.'; end if;
  insert into guilds (name, tag, description, kind, min_level, max_members, emblem, color, owner)
  values (trim(g_name), upper(trim(g_tag)), coalesce(g_desc, ''), g_kind, greatest(0, g_min), g_max, g_emblem, g_color, auth.uid()) returning id into gid;
  insert into guild_members (guild_id, user_id, role) values (gid, auth.uid(), 'chef');
  update profiles set guild_id = gid where id = auth.uid();
  return 'ok';
exception when unique_violation then return 'Ce nom ou ce tag est déjà pris.';
end $$;
grant execute on function public.create_guild(text, text, text, text, int, int, text, text) to authenticated;

create or replace function public.join_guild(gid uuid) returns text language plpgsql security definer set search_path = public as $$
declare g guilds; n int; lvl int;
begin
  select * into g from guilds where id = gid;
  if g is null then return 'Guilde introuvable.'; end if;
  if exists (select 1 from guild_members where user_id = auth.uid()) then return 'Quitte d''abord ta guilde actuelle.'; end if;
  select count(*) into n from guild_members where guild_id = gid;
  if n >= g.max_members then return 'La guilde est pleine.'; end if;
  select level into lvl from profiles where id = auth.uid();
  if coalesce(lvl, 1) < g.min_level then return 'Niveau trop bas pour cette guilde.'; end if;
  if g.kind = 'closed' then return 'Cette guilde est fermée.'; end if;
  if g.kind = 'invite' then insert into guild_requests (guild_id, user_id) values (gid, auth.uid()) on conflict do nothing; return 'demande'; end if;
  insert into guild_members (guild_id, user_id) values (gid, auth.uid());
  update profiles set guild_id = gid where id = auth.uid();
  return 'ok';
end $$;
grant execute on function public.join_guild(uuid) to authenticated;

create or replace function public.answer_request(gid uuid, uid uuid, accept boolean) returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from guild_members where guild_id = gid and user_id = auth.uid() and role in ('chef', 'adjoint')) then return 'Réservé au chef et aux adjoints.'; end if;
  delete from guild_requests where guild_id = gid and user_id = uid;
  if accept and not exists (select 1 from guild_members where user_id = uid) then
    insert into guild_members (guild_id, user_id) values (gid, uid);
    update profiles set guild_id = gid where id = uid;
  end if;
  return 'ok';
end $$;
grant execute on function public.answer_request(uuid, uuid, boolean) to authenticated;

create or replace function public.leave_guild() returns text language plpgsql security definer set search_path = public as $$
declare m guild_members; heir uuid;
begin
  select * into m from guild_members where user_id = auth.uid();
  if m is null then return 'Tu n''es dans aucune guilde.'; end if;
  delete from guild_members where user_id = auth.uid();
  update profiles set guild_id = null where id = auth.uid();
  if m.role = 'chef' then
    select user_id into heir from guild_members where guild_id = m.guild_id order by (role = 'adjoint') desc, joined_at limit 1;
    if heir is null then delete from guilds where id = m.guild_id;
    else update guild_members set role = 'chef' where guild_id = m.guild_id and user_id = heir; update guilds set owner = heir where id = m.guild_id; end if;
  end if;
  return 'ok';
end $$;
grant execute on function public.leave_guild() to authenticated;

create or replace function public.set_member_role(uid uuid, new_role text) returns text language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select guild_id into gid from guild_members where user_id = auth.uid() and role = 'chef';
  if gid is null then return 'Réservé au chef.'; end if;
  if new_role = 'exclure' then delete from guild_members where guild_id = gid and user_id = uid and uid <> auth.uid(); update profiles set guild_id = null where id = uid; return 'ok'; end if;
  update guild_members set role = new_role where guild_id = gid and user_id = uid and uid <> auth.uid() and new_role in ('adjoint', 'membre');
  return 'ok';
end $$;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- Boss de guilde : 3 essais par jour max (≈ 21 par semaine), dégâts plafonnés par essai pour limiter la triche.
create or replace function public.hit_guild_boss(wk text, dmg bigint) returns text language plpgsql security definer set search_path = public as $$
declare gid uuid; t int;
begin
  select guild_id into gid from guild_members where user_id = auth.uid();
  if gid is null then return 'Rejoins une guilde d''abord.'; end if;
  insert into guild_damage (guild_id, user_id, week) values (gid, auth.uid(), wk) on conflict do nothing;
  select tries into t from guild_damage where guild_id = gid and user_id = auth.uid() and week = wk;
  if t >= 21 then return 'Plus d''essai cette semaine.'; end if;
  update guild_damage set damage = damage + least(greatest(dmg, 0), 2000000), tries = tries + 1 where guild_id = gid and user_id = auth.uid() and week = wk;
  return 'ok';
end $$;
grant execute on function public.hit_guild_boss(text, bigint) to authenticated;

-- Classement des guildes de la semaine.
create or replace view public.guild_board as
  select g.id, g.name, g.tag, g.emblem, g.color, g.kind, g.max_members, g.min_level, g.description,
    (select count(*) from guild_members m where m.guild_id = g.id) as members,
    coalesce((select sum(d.damage) from guild_damage d where d.guild_id = g.id and d.week = to_char(date_trunc('week', now()), 'YYYY-MM-DD')), 0) as week_damage
  from guilds g;
grant select on public.guild_board to anon, authenticated;

-- ── Chat par salons ──
create table if not exists public.chat (
  id bigint generated always as identity primary key,
  room text not null check (room in ('general', 'marche', 'arene', 'entraide')),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  card text,
  created_at timestamptz not null default now()
);
alter table public.chat enable row level security;
drop policy if exists "chat lisible" on public.chat;
create policy "chat lisible" on public.chat for select using (true);
drop policy if exists "chat ecrire" on public.chat;
create policy "chat ecrire" on public.chat for insert with check (auth.uid() = user_id);

-- ── Parrainage : le numéro du parrain est donné à l'inscription (lien ?ref=NUMERO) ──
create or replace function public.set_referrer(no bigint) returns text language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and referred_by is not null) then return 'déjà parrainé'; end if;
  if not exists (select 1 from profiles where player_no = no and id <> auth.uid()) then return 'parrain introuvable'; end if;
  update profiles set referred_by = no where id = auth.uid() and created_at > now() - interval '1 day';
  return 'ok';
end $$;
grant execute on function public.set_referrer(bigint) to authenticated;
create or replace function public.my_referrals() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from profiles where referred_by = (select player_no from profiles where id = auth.uid())
$$;
grant execute on function public.my_referrals() to authenticated;

-- Ce que chacun peut modifier lui-même, colonne par colonne. Le reste (numéro, parrain, guilde, montants reçus)
-- n'est changé que par les fonctions du serveur.
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar, title, bio, level, rebirths, collection, mr, lr, achievements, spire, arena, score, updated_at, dm_policy, last_seen, team) on public.profiles to authenticated;
revoke update on public.inbox from anon, authenticated;
grant update (claimed) on public.inbox to authenticated;
revoke update on public.messages from anon, authenticated;
grant update (read) on public.messages to authenticated;
revoke update on public.friends from anon, authenticated;
grant update (status) on public.friends to authenticated;
revoke update on public.guilds from anon, authenticated;
grant update (description, kind, min_level, max_members, emblem, color) on public.guilds to authenticated;
