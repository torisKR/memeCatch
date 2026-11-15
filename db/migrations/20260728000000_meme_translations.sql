-- Precomputed public translations for meme dictionary content.
-- Runtime page requests only read these rows; translation providers are called
-- by the offline/service-role batch script.

create table if not exists public.meme_translations (
  meme_id uuid not null references public.memes(id) on delete cascade,
  locale text not null check (locale in ('en', 'ja', 'zh', 'zh-tw')),
  localized_slug text not null check (btrim(localized_slug) <> ''),
  title text not null check (btrim(title) <> ''),
  summary text not null check (btrim(summary) <> ''),
  description text not null default '',
  origin text not null default '',
  usage_note text,
  caution text,
  aliases text[] not null default '{}',
  usage_examples jsonb,
  status text not null default 'machine'
    check (status in ('machine', 'reviewed', 'stale')),
  source_updated_at timestamptz not null,
  provider text not null,
  model text not null,
  prompt_version integer not null default 1 check (prompt_version > 0),
  translated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meme_id, locale),
  constraint meme_translations_usage_examples_array
    check (usage_examples is null or jsonb_typeof(usage_examples) = 'array'),
  constraint meme_translations_review_audit
    check (
      (status = 'reviewed' and reviewed_at is not null and reviewed_by is not null)
      or status <> 'reviewed'
    )
);

create index if not exists meme_translations_locale_status_idx
  on public.meme_translations (locale, status, updated_at desc);
create index if not exists meme_translations_source_version_idx
  on public.meme_translations (meme_id, source_updated_at);
create index if not exists meme_translations_reviewed_by_idx
  on public.meme_translations (reviewed_by)
  where reviewed_by is not null;

alter table public.meme_translations enable row level security;

drop policy if exists meme_translations_public_read on public.meme_translations;
create policy meme_translations_public_read on public.meme_translations
  for select
  using (
    status in ('machine', 'reviewed', 'stale')
    and exists (
      select 1
        from public.memes source_meme
       where source_meme.id = meme_translations.meme_id
         and source_meme.moderation_status in ('approved', 'limited')
    )
  );

drop policy if exists meme_translations_operator_write on public.meme_translations;
create policy meme_translations_operator_write on public.meme_translations
  for all
  using (public.is_operator())
  with check (public.is_operator());

grant select on public.meme_translations to anon, authenticated;
grant insert, update, delete on public.meme_translations to authenticated;
grant all on public.meme_translations to service_role;

-- Keep updated_at trustworthy for operator edits as well as service-role upserts.
create or replace function public.touch_meme_translation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_meme_translation_updated_at
  on public.meme_translations;
create trigger touch_meme_translation_updated_at
  before update on public.meme_translations
  for each row execute function public.touch_meme_translation_updated_at();

-- Any source prose change invalidates every locale derived from that source.
-- source_updated_at deliberately remains the version that was translated, so
-- readers and the batch can distinguish a stale row from the current meme.
create or replace function public.mark_meme_translations_stale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.title,
    new.summary,
    new.description,
    new.origin,
    new.usage_note,
    new.caution,
    new.aliases,
    new.usage_examples
  ) is distinct from (
    old.title,
    old.summary,
    old.description,
    old.origin,
    old.usage_note,
    old.caution,
    old.aliases,
    old.usage_examples
  ) then
    update public.meme_translations
       set status = 'stale'
     where meme_id = new.id
       and status <> 'stale';
  end if;
  return new;
end;
$$;

drop trigger if exists mark_meme_translations_stale_after_update
  on public.memes;
create trigger mark_meme_translations_stale_after_update
  after update of title, summary, description, origin, usage_note, caution,
    aliases, usage_examples
  on public.memes
  for each row execute function public.mark_meme_translations_stale();

revoke all on function public.touch_meme_translation_updated_at()
  from public, anon, authenticated;
revoke all on function public.mark_meme_translations_stale()
  from public, anon, authenticated;
