create table if not exists public.meme_market_profiles (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes(id) on delete cascade,
  market_code text not null check (market_code ~ '^[A-Z][A-Z0-9_-]{1,11}$'),
  language_tag text not null check (char_length(language_tag) between 2 and 35),
  role text not null check (role in ('origin', 'adopted', 'active')),
  local_title text not null check (char_length(trim(local_title)) between 1 and 300),
  local_aliases text[] not null default '{}',
  usage_note text,
  caution text,
  evidence_source_id uuid references public.meme_sources(id) on delete set null,
  review_state text not null default 'pending'
    check (review_state in ('pending', 'reviewed', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meme_id, market_code, role),
  check (review_state <> 'reviewed' or (reviewed_at is not null and reviewed_by is not null)),
  check (review_state = 'reviewed' or reviewed_at is null)
);

create index if not exists meme_market_profiles_public_idx
  on public.meme_market_profiles (meme_id, market_code, role)
  where review_state = 'reviewed';

create table if not exists public.meme_variant_links (
  id uuid primary key default gen_random_uuid(),
  source_meme_id uuid not null references public.memes(id) on delete cascade,
  target_meme_id uuid not null references public.memes(id) on delete cascade,
  relation_kind text not null
    check (relation_kind in ('derived_from', 'local_variant', 'local_equivalent')),
  evidence_source_id uuid references public.meme_sources(id) on delete set null,
  review_state text not null default 'pending'
    check (review_state in ('pending', 'reviewed', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_meme_id, target_meme_id, relation_kind),
  check (source_meme_id <> target_meme_id),
  check (review_state <> 'reviewed' or (reviewed_at is not null and reviewed_by is not null)),
  check (review_state = 'reviewed' or reviewed_at is null)
);

create index if not exists meme_variant_links_public_source_idx
  on public.meme_variant_links (source_meme_id, relation_kind)
  where review_state = 'reviewed';
create index if not exists meme_variant_links_public_target_idx
  on public.meme_variant_links (target_meme_id, relation_kind)
  where review_state = 'reviewed';

alter table public.meme_market_profiles enable row level security;
alter table public.meme_variant_links enable row level security;

drop policy if exists meme_market_profiles_public_read on public.meme_market_profiles;
create policy meme_market_profiles_public_read on public.meme_market_profiles
  for select using (
    review_state = 'reviewed'
    and exists (
      select 1 from public.memes m
      where m.id = meme_market_profiles.meme_id
        and m.moderation_status in ('approved', 'limited')
    )
  );

drop policy if exists meme_market_profiles_operator on public.meme_market_profiles;
create policy meme_market_profiles_operator on public.meme_market_profiles
  for all using (public.is_operator()) with check (public.is_operator());

drop policy if exists meme_variant_links_public_read on public.meme_variant_links;
create policy meme_variant_links_public_read on public.meme_variant_links
  for select using (
    review_state = 'reviewed'
    and exists (
      select 1 from public.memes source_meme
      where source_meme.id = meme_variant_links.source_meme_id
        and source_meme.moderation_status in ('approved', 'limited')
    )
    and exists (
      select 1 from public.memes target_meme
      where target_meme.id = meme_variant_links.target_meme_id
        and target_meme.moderation_status in ('approved', 'limited')
    )
  );

drop policy if exists meme_variant_links_operator on public.meme_variant_links;
create policy meme_variant_links_operator on public.meme_variant_links
  for all using (public.is_operator()) with check (public.is_operator());
