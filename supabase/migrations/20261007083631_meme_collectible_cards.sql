-- Free catalog discovery and private ownership. Revealing a card creates no row.
create table public.meme_collectible_cards (
  id text primary key,
  card_no integer not null unique check (card_no between 1 and 1000),
  meme_id uuid unique references public.memes(id) on delete set null,
  edition integer not null default 1 check (edition = 1),
  art_seed integer not null check (art_seed between 0 and 2147483647),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint meme_collectible_card_identity check (id = 'mc-' || lpad(card_no::text, 4, '0'))
);

create table public.user_meme_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.meme_collectible_cards(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index user_meme_cards_recent_idx
  on public.user_meme_cards(user_id, created_at desc, card_id);

alter table public.meme_collectible_cards enable row level security;
alter table public.user_meme_cards enable row level security;

-- Remove inherited broad grants before exposing only the intended operations.
revoke all on public.meme_collectible_cards, public.user_meme_cards
  from public, anon, authenticated;
grant select on public.meme_collectible_cards to anon, authenticated;
grant select on public.user_meme_cards to authenticated;
grant insert (user_id, card_id) on public.user_meme_cards to authenticated;
grant all on public.meme_collectible_cards, public.user_meme_cards to service_role;

create policy meme_collectible_catalog_public_read
  on public.meme_collectible_cards for select to anon, authenticated
  using (
    active and exists (
      select 1 from public.memes m
      where m.id = meme_id
        and m.moderation_status = 'approved'
        and m.safety_level = 'green'
        and m.published_at is not null
    )
  );

create policy user_meme_cards_owner_read
  on public.user_meme_cards for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'true'
  );

create policy user_meme_cards_owner_claim
  on public.user_meme_cards for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'true'
    and exists (
      select 1 from public.meme_collectible_cards c
      join public.memes m on m.id = c.meme_id
      where c.id = card_id and c.active
        and m.moderation_status = 'approved'
        and m.safety_level = 'green'
        and m.published_at is not null
    )
  );

comment on table public.meme_collectible_cards is
  'Free, unlimited collectible catalog; no price, rarity, supply, draw, or reward state.';
comment on table public.user_meme_cards is
  'One private owned card per authenticated user and catalog card. Unavailable content retains ownership.';
