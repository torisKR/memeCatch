begin;

create table public.source_ingestions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.media_sources(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  target_meme_id uuid references public.memes(id) on delete set null,
  status text not null
    check (status in ('metadata_ready', 'duplicate', 'linked', 'failed', 'blocked')),
  processing_rights_mode text not null
    check (processing_rights_mode in (
      'EMBED_ONLY',
      'METADATA_ONLY',
      'OWNER_AUTHORIZED',
      'USER_UPLOADED',
      'LICENSED_MEDIA',
      'BLOCKED'
    )),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index source_ingestions_status_created_idx
  on public.source_ingestions (status, created_at desc);

alter table public.source_ingestions enable row level security;

create policy source_ingestions_operator
  on public.source_ingestions
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

revoke all on table public.source_ingestions from public, anon, authenticated;
grant all on table public.source_ingestions to authenticated, service_role;

commit;
