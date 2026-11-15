create table public.tiktok_provider_identities (
  provider_subject text primary key,
  internal_email text not null unique,
  user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiktok_provider_subject_sha256 check (provider_subject ~ '^[0-9a-f]{64}$'),
  constraint tiktok_provider_internal_email check (
    internal_email ~ '^[0-9a-f]{64}@auth\.memecatch\.internal$'
  )
);

alter table public.tiktok_provider_identities enable row level security;
revoke all on table public.tiktok_provider_identities from public, anon, authenticated;
grant select, insert, update on table public.tiktok_provider_identities to service_role;
