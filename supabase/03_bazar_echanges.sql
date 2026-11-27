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
