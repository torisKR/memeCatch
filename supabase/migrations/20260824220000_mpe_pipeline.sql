begin;

create table public.media_ingestions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.media_sources(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ingest_mode text not null
    check (ingest_mode in ('USER_UPLOADED', 'OWNER_AUTHORIZED', 'LICENSED_MEDIA')),
  mime_type text not null
    check (mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm'
    )),
  media_kind text not null check (media_kind in ('image', 'video')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  temporary_storage_key text not null unique,
  expires_at timestamptz not null,
  rights_attested_at timestamptz not null,
  source_role text
    check (source_role is null or source_role in (
      'original', 'official_reupload', 'earliest_known',
      'secondary_reference', 'usage_example'
    )),
  rights_basis text
    check (rights_basis is null or rights_basis in (
      'official_embed', 'creator_permission', 'creative_commons',
      'public_data', 'link_only', 'unknown', 'blocked'
    )),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (media_kind = 'image' and mime_type like 'image/%')
    or (media_kind = 'video' and mime_type like 'video/%')
  )
);

create index media_ingestions_user_created_idx
  on public.media_ingestions (user_id, created_at desc);
create index media_ingestions_expiry_idx
  on public.media_ingestions (expires_at)
  where deleted_at is null;
create index media_ingestions_sha256_idx
  on public.media_ingestions (sha256);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  ingestion_id uuid not null references public.media_ingestions(id) on delete cascade,
  job_type text not null
    check (job_type in (
      'inspect', 'scene_frames', 'ocr', 'stt', 'fingerprint',
      'text_embedding', 'draft', 'render', 'cleanup'
    )),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  processor_name text not null,
  processor_version text not null,
  input_hash text not null,
  lease_token uuid,
  output_json jsonb not null default '{}'::jsonb,
  error_code text,
  cost_units numeric(12, 4) not null default 0 check (cost_units >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (ingestion_id, job_type, processor_version, input_hash),
  check (completed_at is null or started_at is not null)
);

create index processing_jobs_claim_idx
  on public.processing_jobs (created_at, id)
  where status = 'queued';
create index processing_jobs_stale_lease_idx
  on public.processing_jobs (started_at, id)
  where status = 'running';
create index processing_jobs_ingestion_idx
  on public.processing_jobs (ingestion_id, created_at);
create unique index processing_jobs_render_input_idx
  on public.processing_jobs (ingestion_id, input_hash)
  where job_type = 'render';

create table public.text_segments (
  id uuid primary key default gen_random_uuid(),
  ingestion_id uuid not null references public.media_ingestions(id) on delete cascade,
  origin text not null check (origin in ('OCR', 'STT', 'CAPTION', 'METADATA')),
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= 0),
  raw_text text not null check (btrim(raw_text) <> ''),
  normalized_text text,
  language text,
  confidence numeric(5, 4) check (confidence is null or confidence between 0 and 1),
  bounding_box_json jsonb,
  created_at timestamptz not null default now(),
  check (end_ms is null or start_ms is null or end_ms >= start_ms)
);

create index text_segments_ingestion_time_idx
  on public.text_segments (ingestion_id, start_ms, id);

create table public.media_fingerprints (
  id uuid primary key default gen_random_uuid(),
  ingestion_id uuid not null references public.media_ingestions(id) on delete cascade,
  fingerprint_type text not null
    check (fingerprint_type in ('SHA256', 'PHASH', 'FRAME_PHASH', 'AUDIO', 'TEXT_EMBEDDING')),
  hash_value text not null check (btrim(hash_value) <> ''),
  embedding double precision[],
  frame_ms integer check (frame_ms is null or frame_ms >= 0),
  processor_version text not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (
    ingestion_id,
    fingerprint_type,
    hash_value,
    processor_version,
    frame_ms
  )
);

create index media_fingerprints_lookup_idx
  on public.media_fingerprints (fingerprint_type, hash_value);

create table public.meme_candidates (
  id uuid primary key default gen_random_uuid(),
  ingestion_id uuid not null references public.media_ingestions(id) on delete cascade,
  target_meme_id uuid references public.memes(id) on delete set null,
  title text not null check (btrim(title) <> ''),
  meme_type text not null,
  review_status text not null default 'FACT_CHECKING'
    check (review_status in (
      'FACT_CHECKING', 'RIGHTS_CHECKING', 'PUBLISH',
      'APPROVED', 'LIMITED', 'REJECTED'
    )),
  overall_confidence numeric(5, 4)
    check (overall_confidence is null or overall_confidence between 0 and 1),
  draft_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  model_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meme_candidates_review_idx
  on public.meme_candidates (review_status, created_at);
create index meme_candidates_ingestion_idx
  on public.meme_candidates (ingestion_id);

create table public.candidate_matches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.meme_candidates(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete cascade,
  rank integer not null check (rank > 0),
  overall_score numeric(5, 4) not null check (overall_score between 0 and 1),
  text_score numeric(5, 4) check (text_score is null or text_score between 0 and 1),
  visual_score numeric(5, 4) check (visual_score is null or visual_score between 0 and 1),
  audio_score numeric(5, 4) check (audio_score is null or audio_score between 0 and 1),
  classification text not null
    check (classification in ('DUPLICATE', 'RELATED', 'DERIVED', 'SEPARATE')),
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (candidate_id, meme_id),
  unique (candidate_id, rank)
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.meme_candidates(id) on delete cascade,
  claim_field text not null check (btrim(claim_field) <> ''),
  claim_text text not null check (btrim(claim_text) <> ''),
  ingestion_id uuid references public.media_ingestions(id) on delete set null,
  source_id uuid references public.media_sources(id) on delete set null,
  text_segment_id uuid references public.text_segments(id) on delete set null,
  confidence numeric(5, 4) check (confidence is null or confidence between 0 and 1),
  review_status text not null default 'PENDING'
    check (review_status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  check (ingestion_id is not null or source_id is not null or text_segment_id is not null)
);

create index claim_evidence_candidate_idx
  on public.claim_evidence (candidate_id, review_status);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.meme_candidates(id) on delete cascade,
  review_stage text not null
    check (review_stage in ('FACT_CHECKING', 'RIGHTS_CHECKING', 'PUBLISH')),
  decision text not null
    check (decision in ('APPROVED', 'PUBLISHED', 'LIMITED', 'REJECTED', 'CHANGES_REQUESTED')),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create index review_decisions_candidate_idx
  on public.review_decisions (candidate_id, created_at);

create table public.candidate_revisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.meme_candidates(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  draft_json jsonb not null,
  model_version text not null,
  prompt_version text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (candidate_id, revision_number)
);

alter table public.media_ingestions enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.text_segments enable row level security;
alter table public.media_fingerprints enable row level security;
alter table public.meme_candidates enable row level security;
alter table public.candidate_matches enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.review_decisions enable row level security;
alter table public.candidate_revisions enable row level security;

create policy media_ingestions_self_read
  on public.media_ingestions for select to authenticated
  using (user_id = (select auth.uid()));
create policy media_ingestions_operator
  on public.media_ingestions for select to authenticated
  using (public.is_operator());

create policy processing_jobs_self_read
  on public.processing_jobs for select to authenticated
  using (
    exists (
      select 1
        from public.media_ingestions as ingestion
       where ingestion.id = processing_jobs.ingestion_id
         and ingestion.user_id = (select auth.uid())
    )
  );
create policy processing_jobs_operator
  on public.processing_jobs for select to authenticated
  using (public.is_operator());

create policy text_segments_operator on public.text_segments
  for select to authenticated using (public.is_operator());
create policy media_fingerprints_operator on public.media_fingerprints
  for select to authenticated using (public.is_operator());
create policy meme_candidates_operator on public.meme_candidates
  for select to authenticated using (public.is_operator());
create policy candidate_matches_operator on public.candidate_matches
  for select to authenticated using (public.is_operator());
create policy claim_evidence_operator on public.claim_evidence
  for select to authenticated using (public.is_operator());
create policy review_decisions_operator on public.review_decisions
  for select to authenticated using (public.is_operator());
create policy candidate_revisions_operator on public.candidate_revisions
  for select to authenticated using (public.is_operator());

revoke all on table
  public.media_ingestions,
  public.processing_jobs,
  public.text_segments,
  public.media_fingerprints,
  public.meme_candidates,
  public.candidate_matches,
  public.claim_evidence,
  public.review_decisions,
  public.candidate_revisions
from public, anon, authenticated;

grant select on table
  public.media_ingestions,
  public.processing_jobs,
  public.text_segments,
  public.media_fingerprints,
  public.meme_candidates,
  public.candidate_matches,
  public.claim_evidence,
  public.review_decisions,
  public.candidate_revisions
to authenticated;

grant all on table
  public.media_ingestions,
  public.processing_jobs,
  public.text_segments,
  public.media_fingerprints,
  public.meme_candidates,
  public.candidate_matches,
  public.claim_evidence,
  public.review_decisions,
  public.candidate_revisions
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mpe-temporary',
  'mpe-temporary',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy mpe_temporary_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mpe-temporary'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and owner_id = (select auth.uid()::text)
  );
create or replace function public.create_media_ingestion(
  p_source_id uuid,
  p_ingest_mode text,
  p_mime_type text,
  p_media_kind text,
  p_byte_size bigint,
  p_sha256 text,
  p_temporary_storage_key text,
  p_expires_at timestamptz,
  p_rights_accepted boolean,
  p_width integer default null,
  p_height integer default null,
  p_duration_ms integer default null
)
returns table (ingestion_id uuid, job_ids uuid[])
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ingestion_id uuid;
  v_job_id uuid;
  v_job_ids uuid[] := '{}'::uuid[];
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if p_rights_accepted is not true then
    raise exception using errcode = '22023', message = 'rights_attestation_required';
  end if;
  if p_ingest_mode not in ('USER_UPLOADED', 'OWNER_AUTHORIZED', 'LICENSED_MEDIA') then
    raise exception using errcode = '22023', message = 'invalid_ingest_mode';
  end if;
  if p_source_id is not null and not public.is_operator() then
    raise exception using errcode = '42501', message = 'source_assignment_operator_required';
  end if;
  if p_media_kind not in ('image', 'video')
     or (p_media_kind = 'image' and p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
     or (p_media_kind = 'video' and p_mime_type not in ('video/mp4', 'video/webm')) then
    raise exception using errcode = '22023', message = 'invalid_media_type';
  end if;
  if p_byte_size <= 0 or p_byte_size > 20971520 then
    raise exception using errcode = '22023', message = 'invalid_byte_size';
  end if;
  if lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_sha256';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception using errcode = '22023', message = 'invalid_expiry';
  end if;
  if split_part(p_temporary_storage_key, '/', 1) <> v_user_id::text
     or split_part(p_temporary_storage_key, '/', 2) = '' then
    raise exception using errcode = '42501', message = 'invalid_storage_path';
  end if;
  if not exists (
    select 1
      from storage.objects as object
     where object.bucket_id = 'mpe-temporary'
       and object.name = p_temporary_storage_key
  ) then
    raise exception using errcode = '22023', message = 'temporary_object_not_found';
  end if;

  insert into public.media_ingestions (
    source_id,
    user_id,
    ingest_mode,
    mime_type,
    media_kind,
    byte_size,
    sha256,
    width,
    height,
    duration_ms,
    temporary_storage_key,
    expires_at,
    rights_attested_at
  ) values (
    p_source_id,
    v_user_id,
    p_ingest_mode,
    p_mime_type,
    p_media_kind,
    p_byte_size,
    lower(p_sha256),
    p_width,
    p_height,
    p_duration_ms,
    p_temporary_storage_key,
    p_expires_at,
    now()
  )
  returning id into v_ingestion_id;

  insert into public.processing_jobs (
    ingestion_id,
    job_type,
    processor_name,
    processor_version,
    input_hash
  ) values (
    v_ingestion_id,
    'inspect',
    'pending',
    'pending',
    lower(p_sha256)
  )
  returning id into v_job_id;
  v_job_ids := array_append(v_job_ids, v_job_id);

  return query select v_ingestion_id, v_job_ids;
end;
$function$;

create or replace function public.set_mpe_ingestion_source_rights(
  p_ingestion_id uuid,
  p_source_role text,
  p_rights_basis text
)
returns public.media_ingestions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ingestion public.media_ingestions;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_source_role not in (
    'original', 'official_reupload', 'earliest_known',
    'secondary_reference', 'usage_example'
  ) then
    raise exception using errcode = '22023', message = 'invalid_source_role';
  end if;
  if p_rights_basis not in (
    'official_embed', 'creator_permission', 'creative_commons',
    'public_data', 'link_only', 'unknown', 'blocked'
  ) then
    raise exception using errcode = '22023', message = 'invalid_rights_basis';
  end if;

  update public.media_ingestions as ingestion
     set source_role = p_source_role,
         rights_basis = p_rights_basis
   where ingestion.id = p_ingestion_id
  returning ingestion.* into v_ingestion;
  if not found then
    raise exception using errcode = 'P0002', message = 'ingestion_not_found';
  end if;

  return v_ingestion;
end;
$function$;

create or replace function public.replace_mpe_candidate_matches(
  p_candidate_id uuid,
  p_matches jsonb
)
returns setof public.candidate_matches
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match jsonb;
  v_candidate_id uuid;
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if not v_is_service and (auth.uid() is null or not public.is_operator()) then
    raise exception using errcode = '42501', message = 'operator_or_service_required';
  end if;
  if jsonb_typeof(p_matches) is distinct from 'array'
     or jsonb_array_length(p_matches) > 5 then
    raise exception using errcode = '22023', message = 'invalid_candidate_matches';
  end if;

  select candidate.id
    into v_candidate_id
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;

  delete from public.candidate_matches as existing
   where existing.candidate_id = p_candidate_id;

  for v_match in select value from jsonb_array_elements(p_matches) loop
    if jsonb_typeof(v_match) <> 'object'
       or jsonb_typeof(v_match -> 'meme_id') is distinct from 'string'
       or jsonb_typeof(v_match -> 'rank') is distinct from 'number'
       or jsonb_typeof(v_match -> 'overall_score') is distinct from 'number'
       or jsonb_typeof(v_match -> 'classification') is distinct from 'string'
       or jsonb_typeof(v_match -> 'evidence_json') is distinct from 'object'
       or (
         v_match ? 'candidate_id'
         and v_match ->> 'candidate_id' is distinct from p_candidate_id::text
       )
       or (
         v_match ? 'text_score'
         and jsonb_typeof(v_match -> 'text_score') not in ('number', 'null')
       )
       or (
         v_match ? 'visual_score'
         and jsonb_typeof(v_match -> 'visual_score') not in ('number', 'null')
       )
       or (
         v_match ? 'audio_score'
         and jsonb_typeof(v_match -> 'audio_score') not in ('number', 'null')
       ) then
      raise exception using errcode = '22023', message = 'invalid_candidate_match_shape';
    end if;
    if (v_match ->> 'rank')::numeric not between 1 and 5
       or trunc((v_match ->> 'rank')::numeric) <> (v_match ->> 'rank')::numeric
       or (v_match ->> 'overall_score')::numeric not between 0 and 1
       or (
         jsonb_typeof(v_match -> 'text_score') = 'number'
         and (v_match ->> 'text_score')::numeric not between 0 and 1
       )
       or (
         jsonb_typeof(v_match -> 'visual_score') = 'number'
         and (v_match ->> 'visual_score')::numeric not between 0 and 1
       )
       or (
         jsonb_typeof(v_match -> 'audio_score') = 'number'
         and (v_match ->> 'audio_score')::numeric not between 0 and 1
       )
       or v_match ->> 'classification' not in ('DUPLICATE', 'RELATED', 'DERIVED', 'SEPARATE') then
      raise exception using errcode = '22023', message = 'invalid_candidate_match_values';
    end if;

    insert into public.candidate_matches (
      candidate_id,
      meme_id,
      rank,
      overall_score,
      text_score,
      visual_score,
      audio_score,
      classification,
      evidence_json
    ) values (
      p_candidate_id,
      (v_match ->> 'meme_id')::uuid,
      (v_match ->> 'rank')::integer,
      (v_match ->> 'overall_score')::numeric,
      case when jsonb_typeof(v_match -> 'text_score') = 'number'
        then (v_match ->> 'text_score')::numeric else null end,
      case when jsonb_typeof(v_match -> 'visual_score') = 'number'
        then (v_match ->> 'visual_score')::numeric else null end,
      case when jsonb_typeof(v_match -> 'audio_score') = 'number'
        then (v_match ->> 'audio_score')::numeric else null end,
      v_match ->> 'classification',
      v_match -> 'evidence_json'
    );
  end loop;

  return query
  select match.*
    from public.candidate_matches as match
   where match.candidate_id = p_candidate_id
   order by match.rank;
end;
$function$;

create or replace function public.replace_mpe_candidate_evidence(
  p_candidate_id uuid,
  p_draft_json jsonb,
  p_evidence jsonb
)
returns public.meme_candidates
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_evidence jsonb;
  v_candidate_source_id uuid;
  v_ingestion_id uuid;
  v_source_id uuid;
  v_text_segment_id uuid;
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if not v_is_service and (auth.uid() is null or not public.is_operator()) then
    raise exception using errcode = '42501', message = 'operator_or_service_required';
  end if;
  if jsonb_typeof(p_draft_json) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_candidate_draft';
  end if;
  if jsonb_typeof(p_evidence) is distinct from 'array'
     or jsonb_array_length(p_evidence) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid_candidate_evidence';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;
  if v_candidate.review_status <> 'FACT_CHECKING' then
    raise exception using errcode = '55000', message = 'claim_review_stage_closed';
  end if;
  if exists (
    select 1
      from public.claim_evidence as evidence
     where evidence.candidate_id = p_candidate_id
       and evidence.review_status <> 'PENDING'
  ) then
    raise exception using errcode = '55000', message = 'reviewed_claims_exist';
  end if;

  select ingestion.source_id
    into v_candidate_source_id
    from public.media_ingestions as ingestion
   where ingestion.id = v_candidate.ingestion_id;

  delete from public.claim_evidence as existing
   where existing.candidate_id = p_candidate_id;

  for v_evidence in select value from jsonb_array_elements(p_evidence) loop
    if jsonb_typeof(v_evidence) <> 'object'
       or jsonb_typeof(v_evidence -> 'claim_field') is distinct from 'string'
       or jsonb_typeof(v_evidence -> 'claim_text') is distinct from 'string'
       or btrim(v_evidence ->> 'claim_field') = ''
       or btrim(v_evidence ->> 'claim_text') = ''
       or char_length(v_evidence ->> 'claim_text') > 4000
       or (
         v_evidence ? 'candidate_id'
         and v_evidence ->> 'candidate_id' is distinct from p_candidate_id::text
       )
       or (
         v_evidence ? 'review_status'
         and v_evidence ->> 'review_status' is distinct from 'PENDING'
       )
       or (
         v_evidence ? 'confidence'
         and jsonb_typeof(v_evidence -> 'confidence') not in ('number', 'null')
       ) then
      raise exception using errcode = '22023', message = 'invalid_candidate_evidence_shape';
    end if;
    if jsonb_typeof(v_evidence -> 'confidence') = 'number'
       and (v_evidence ->> 'confidence')::numeric not between 0 and 1 then
      raise exception using errcode = '22023', message = 'invalid_candidate_evidence_confidence';
    end if;

    v_ingestion_id := case when jsonb_typeof(v_evidence -> 'ingestion_id') = 'string'
      then (v_evidence ->> 'ingestion_id')::uuid else null end;
    v_source_id := case when jsonb_typeof(v_evidence -> 'source_id') = 'string'
      then (v_evidence ->> 'source_id')::uuid else null end;
    v_text_segment_id := case when jsonb_typeof(v_evidence -> 'text_segment_id') = 'string'
      then (v_evidence ->> 'text_segment_id')::uuid else null end;

    if v_ingestion_id is null and v_source_id is null and v_text_segment_id is null then
      raise exception using errcode = '22023', message = 'candidate_evidence_reference_required';
    end if;
    if v_ingestion_id is not null and v_ingestion_id <> v_candidate.ingestion_id then
      raise exception using errcode = '23514', message = 'candidate_evidence_ingestion_mismatch';
    end if;
    if v_source_id is not null
       and v_source_id is distinct from v_candidate_source_id then
      raise exception using errcode = '23514', message = 'candidate_evidence_source_mismatch';
    end if;
    if v_text_segment_id is not null and not exists (
      select 1
        from public.text_segments as segment
       where segment.id = v_text_segment_id
         and segment.ingestion_id = v_candidate.ingestion_id
    ) then
      raise exception using errcode = '23514', message = 'candidate_evidence_segment_mismatch';
    end if;

    insert into public.claim_evidence (
      candidate_id,
      claim_field,
      claim_text,
      ingestion_id,
      source_id,
      text_segment_id,
      confidence,
      review_status
    ) values (
      p_candidate_id,
      btrim(v_evidence ->> 'claim_field'),
      btrim(v_evidence ->> 'claim_text'),
      v_ingestion_id,
      v_source_id,
      v_text_segment_id,
      case when jsonb_typeof(v_evidence -> 'confidence') = 'number'
        then (v_evidence ->> 'confidence')::numeric else null end,
      'PENDING'
    );
  end loop;

  update public.meme_candidates as candidate
     set draft_json = p_draft_json,
         review_status = 'FACT_CHECKING',
         updated_at = now()
   where candidate.id = p_candidate_id
  returning candidate.* into v_candidate;

  return v_candidate;
end;
$function$;

create or replace function public.claim_processing_job(
  p_processor_name text,
  p_processor_version text,
  p_job_types text[] default null
)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if btrim(coalesce(p_processor_name, '')) = ''
     or btrim(coalesce(p_processor_version, '')) = '' then
    raise exception using errcode = '22023', message = 'processor_identity_required';
  end if;

  return query
  with candidate as (
    select job.id
      from public.processing_jobs as job
     where (
         job.status = 'queued'
         or (
           job.status = 'running'
           and job.started_at < now() - interval '15 minutes'
         )
       )
       and (p_job_types is null or job.job_type = any (p_job_types))
     order by (job.status = 'queued') desc, job.created_at, job.id
     for update skip locked
     limit 1
  )
  update public.processing_jobs as job
     set status = 'running',
         attempts = job.attempts + 1,
         processor_name = p_processor_name,
         processor_version = p_processor_version,
         lease_token = gen_random_uuid(),
         started_at = now(),
         completed_at = null,
         error_code = null
    from candidate
   where job.id = candidate.id
  returning job.*;
end;
$function$;

create or replace function public.queue_mpe_render_job(
  p_ingestion_id uuid,
  p_segments jsonb,
  p_preset text,
  p_attribution text
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ingestion public.media_ingestions;
  v_job public.processing_jobs;
  v_attribution text := btrim(coalesce(p_attribution, ''));
  v_input_hash text;
  v_artifact_key text;
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  select ingestion.*
    into v_ingestion
    from public.media_ingestions as ingestion
   where ingestion.id = p_ingestion_id
   for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'ingestion_not_found';
  end if;
  if not v_is_service
     and (
       auth.uid() is null
       or (v_ingestion.user_id <> auth.uid() and not public.is_operator())
     ) then
    raise exception using errcode = '42501', message = 'ingestion_owner_or_operator_required';
  end if;
  if v_ingestion.rights_attested_at is null then
    raise exception using errcode = '23514', message = 'rights_attestation_required';
  end if;
  if v_ingestion.media_kind <> 'video' then
    raise exception using errcode = '23514', message = 'video_ingestion_required';
  end if;
  if v_ingestion.deleted_at is not null then
    raise exception using errcode = '55000', message = 'ingestion_deleted';
  end if;
  if p_preset is null or p_preset not in ('vertical', 'square', 'link') then
    raise exception using errcode = '22023', message = 'invalid_render_preset';
  end if;
  if v_attribution = '' or char_length(v_attribution) > 500 then
    raise exception using errcode = '22023', message = 'invalid_attribution';
  end if;
  if p_segments is null
     or jsonb_typeof(p_segments) <> 'array'
     or jsonb_array_length(p_segments) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid_render_segments';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_segments) as item(segment)
     where jsonb_typeof(item.segment) <> 'object'
        or jsonb_typeof(item.segment -> 'startMs') is distinct from 'number'
        or jsonb_typeof(item.segment -> 'endMs') is distinct from 'number'
        or jsonb_typeof(item.segment -> 'text') is distinct from 'string'
  ) then
    raise exception using errcode = '22023', message = 'invalid_render_segment_shape';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_segments) as item(segment)
     where (item.segment ->> 'startMs')::numeric < 0
        or trunc((item.segment ->> 'startMs')::numeric) <> (item.segment ->> 'startMs')::numeric
        or (item.segment ->> 'endMs')::numeric <= (item.segment ->> 'startMs')::numeric
        or trunc((item.segment ->> 'endMs')::numeric) <> (item.segment ->> 'endMs')::numeric
        or (item.segment ->> 'endMs')::numeric > coalesce(v_ingestion.duration_ms, 86400000)
        or btrim(item.segment ->> 'text') = ''
        or char_length(item.segment ->> 'text') > 500
  ) then
    raise exception using errcode = '22023', message = 'invalid_render_segment_bounds';
  end if;

  v_input_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        p_segments::text || E'\n' || p_preset || E'\n' || v_attribution,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  v_artifact_key := v_ingestion.user_id::text
    || '/' || v_ingestion.id::text
    || '/renders/' || v_input_hash || '.mp4';

  insert into public.processing_jobs (
    ingestion_id,
    job_type,
    processor_name,
    processor_version,
    input_hash,
    output_json
  ) values (
    v_ingestion.id,
    'render',
    'pending',
    'pending',
    v_input_hash,
    jsonb_build_object(
      'segments', p_segments,
      'preset', p_preset,
      'attribution', v_attribution,
      'artifactKey', v_artifact_key
    )
  )
  on conflict (ingestion_id, input_hash) where job_type = 'render'
  do update set input_hash = excluded.input_hash
  returning * into v_job;

  return v_job;
end;
$function$;

create or replace function public.complete_processing_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_output_json jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_cost_units numeric default 0
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.processing_jobs;
  v_media_kind text;
  v_downstream_type text;
  v_downstream_types text[];
begin
  if p_status not in ('completed', 'failed', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid_completion_status';
  end if;
  if p_cost_units < 0 then
    raise exception using errcode = '22023', message = 'invalid_cost_units';
  end if;
  if p_status = 'failed' and btrim(coalesce(p_error_code, '')) = '' then
    raise exception using errcode = '22023', message = 'error_code_required';
  end if;

  select job.*
    into v_job
    from public.processing_jobs as job
   where job.id = p_job_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;
  if v_job.status <> 'running' then
    raise exception using errcode = '55000', message = 'job_not_running';
  end if;
  if p_lease_token is null or v_job.lease_token is distinct from p_lease_token then
    raise exception using errcode = '55000', message = 'lease_token_mismatch';
  end if;

  if v_job.job_type in ('ocr', 'stt') and p_status = 'completed' then
    if jsonb_typeof(p_output_json) is distinct from 'object'
       or p_output_json ->> 'provider' is null
       or btrim(p_output_json ->> 'provider') = ''
       or p_output_json ->> 'model' is null
       or btrim(p_output_json ->> 'model') = ''
       or p_output_json -> 'providerBacked' is distinct from 'true'::jsonb
       or jsonb_typeof(p_output_json -> 'segmentsWritten') is distinct from 'number'
       or (v_job.job_type = 'stt' and p_output_json -> 'audioDetected' is distinct from 'true'::jsonb) then
      raise exception using errcode = '22023', message = 'provider_completion_marker_required';
    end if;
    if (p_output_json ->> 'segmentsWritten')::numeric < 0
       or trunc((p_output_json ->> 'segmentsWritten')::numeric)
          <> (p_output_json ->> 'segmentsWritten')::numeric then
      raise exception using errcode = '22023', message = 'invalid_segments_written';
    end if;
  elsif v_job.job_type = 'stt' and p_status = 'skipped' then
    if p_output_json is distinct from jsonb_build_object('reason', 'no_audio') then
      raise exception using errcode = '22023', message = 'invalid_no_audio_marker';
    end if;
  elsif v_job.job_type = 'ocr' and p_status = 'skipped' then
    raise exception using errcode = '22023', message = 'ocr_skip_not_allowed';
  end if;

  update public.processing_jobs as job
     set status = p_status,
         output_json = coalesce(p_output_json, '{}'::jsonb),
         error_code = case when p_status = 'failed' then p_error_code else null end,
         cost_units = p_cost_units,
         lease_token = null,
         completed_at = now()
   where job.id = p_job_id
     and job.status = 'running'
     and job.lease_token = p_lease_token
  returning job.* into v_job;

  if v_job.job_type = 'inspect' and p_status = 'completed' then
    select ingestion.media_kind
      into v_media_kind
      from public.media_ingestions as ingestion
     where ingestion.id = v_job.ingestion_id;

    v_downstream_types := case
      when v_media_kind = 'image' then array['fingerprint', 'ocr']::text[]
      else array['fingerprint', 'scene_frames', 'stt']::text[]
    end;

    foreach v_downstream_type in array v_downstream_types loop
      insert into public.processing_jobs (
        ingestion_id,
        job_type,
        processor_name,
        processor_version,
        input_hash
      ) values (
        v_job.ingestion_id,
        v_downstream_type,
        'pending',
        'pending',
        v_job.input_hash
      )
      on conflict (ingestion_id, job_type, processor_version, input_hash) do nothing;
    end loop;
  end if;

  return v_job;
end;
$function$;

create or replace function public.reprocess_mpe_job(p_job_id uuid)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.processing_jobs;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  select job.*
    into v_job
    from public.processing_jobs as job
   where job.id = p_job_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;
  if v_job.status not in ('completed', 'failed', 'skipped') then
    raise exception using errcode = '55000', message = 'job_not_terminal';
  end if;

  if v_job.job_type = 'inspect' then
    if exists (
      select 1
        from public.processing_jobs as downstream
       where downstream.ingestion_id = v_job.ingestion_id
         and downstream.id <> v_job.id
         and downstream.job_type <> 'cleanup'
         and downstream.status = 'running'
    ) then
      raise exception using errcode = '55000', message = 'downstream_job_running';
    end if;

    delete from public.processing_jobs as downstream
     where downstream.ingestion_id = v_job.ingestion_id
       and downstream.id <> v_job.id
       and downstream.job_type in (
         'fingerprint', 'scene_frames', 'ocr', 'stt',
         'text_embedding', 'draft'
       );

    update public.processing_jobs as render_job
       set status = 'skipped',
           output_json = render_job.output_json || jsonb_build_object(
             'invalidated', true,
             'invalidatedReason', 'analysis_reprocessed'
           ),
           error_code = null,
           started_at = coalesce(render_job.started_at, now()),
           completed_at = now()
     where render_job.ingestion_id = v_job.ingestion_id
       and render_job.job_type = 'render';
  end if;

  if v_job.job_type not in ('render', 'cleanup') then
    if exists (
      select 1
        from public.meme_candidates as candidate
       where candidate.ingestion_id = v_job.ingestion_id
         and candidate.review_status <> 'FACT_CHECKING'
    ) then
      raise exception using errcode = '55000', message = 'candidate_review_stage_closed';
    end if;

    if v_job.job_type in ('ocr', 'stt') and exists (
      select 1
        from public.processing_jobs as derived
       where derived.ingestion_id = v_job.ingestion_id
         and derived.job_type in ('text_embedding', 'draft')
         and derived.status = 'running'
    ) then
      raise exception using errcode = '55000', message = 'derived_job_running';
    end if;

    if v_job.job_type in ('ocr', 'stt') then
      delete from public.processing_jobs as derived
       where derived.ingestion_id = v_job.ingestion_id
         and derived.job_type in ('text_embedding', 'draft')
         and derived.status <> 'running';
    end if;

    delete from public.claim_evidence as evidence
     where evidence.candidate_id in (
       select candidate.id
         from public.meme_candidates as candidate
        where candidate.ingestion_id = v_job.ingestion_id
     );

    delete from public.candidate_matches as match
     where match.candidate_id in (
       select candidate.id
         from public.meme_candidates as candidate
        where candidate.ingestion_id = v_job.ingestion_id
     );

    update public.meme_candidates as candidate
       set draft_json = '{}'::jsonb,
           review_status = 'FACT_CHECKING',
           updated_at = now()
     where candidate.ingestion_id = v_job.ingestion_id;

    delete from public.text_segments as segment
     where segment.ingestion_id = v_job.ingestion_id
       and (
         v_job.job_type = 'inspect'
         or (v_job.job_type = 'ocr' and segment.origin = 'OCR')
         or (v_job.job_type = 'stt' and segment.origin = 'STT')
       );

    delete from public.media_fingerprints as fingerprint
     where fingerprint.ingestion_id = v_job.ingestion_id
       and (
         v_job.job_type = 'inspect'
         or (
           v_job.job_type = 'fingerprint'
           and fingerprint.fingerprint_type <> 'TEXT_EMBEDDING'
         )
         or (
           v_job.job_type = 'text_embedding'
           and fingerprint.fingerprint_type = 'TEXT_EMBEDDING'
         )
       );
  end if;

  update public.processing_jobs as job
     set status = 'queued',
         output_json = '{}'::jsonb,
         error_code = null,
         lease_token = null,
         started_at = null,
         completed_at = null
   where job.id = p_job_id
  returning job.* into v_job;

  return v_job;
end;
$function$;

create or replace function public.review_mpe_candidate(
  p_candidate_id uuid,
  p_stage text,
  p_decision text,
  p_reason text default null
)
returns public.meme_candidates
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_has_approved_evidence boolean;
  v_has_unapproved_evidence boolean;
  v_has_source boolean;
  v_has_rights boolean;
  v_next_status text;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_stage not in ('FACT_CHECKING', 'RIGHTS_CHECKING', 'PUBLISH') then
    raise exception using errcode = '22023', message = 'invalid_review_stage';
  end if;
  if (p_stage in ('FACT_CHECKING', 'RIGHTS_CHECKING')
      and p_decision not in ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED'))
     or (p_stage = 'PUBLISH'
      and p_decision not in ('PUBLISHED', 'LIMITED', 'REJECTED', 'CHANGES_REQUESTED')) then
    raise exception using errcode = '22023', message = 'invalid_review_decision';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;
  if v_candidate.review_status <> p_stage then
    raise exception using errcode = '55000', message = 'review_stage_out_of_order';
  end if;

  select
    exists (
      select 1 from public.claim_evidence as evidence
       where evidence.candidate_id = p_candidate_id
         and evidence.review_status = 'APPROVED'
    ),
    exists (
      select 1 from public.claim_evidence as evidence
       where evidence.candidate_id = p_candidate_id
         and evidence.review_status <> 'APPROVED'
    )
    into v_has_approved_evidence, v_has_unapproved_evidence;

  select
    ingestion.source_id is not null or ingestion.ingest_mode = 'USER_UPLOADED',
    ingestion.rights_attested_at is not null
      and ingestion.ingest_mode in ('USER_UPLOADED', 'OWNER_AUTHORIZED', 'LICENSED_MEDIA')
      and ingestion.source_role is not null
      and ingestion.rights_basis is not null
      and ingestion.rights_basis not in ('unknown', 'blocked')
    into v_has_source, v_has_rights
    from public.media_ingestions as ingestion
   where ingestion.id = v_candidate.ingestion_id;

  if p_decision in ('APPROVED', 'PUBLISHED', 'LIMITED')
     and p_stage in ('FACT_CHECKING', 'PUBLISH')
     and (not v_has_approved_evidence or v_has_unapproved_evidence) then
    raise exception using errcode = '23514', message = 'approved_evidence_required';
  end if;
  if p_decision in ('APPROVED', 'PUBLISHED', 'LIMITED')
     and p_stage in ('RIGHTS_CHECKING', 'PUBLISH')
     and (not v_has_source or not v_has_rights) then
    raise exception using errcode = '23514', message = 'source_and_rights_required';
  end if;

  insert into public.review_decisions (
    candidate_id,
    review_stage,
    decision,
    reviewer_id,
    reason
  ) values (
    p_candidate_id,
    p_stage,
    p_decision,
    auth.uid(),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  v_next_status := case
    when p_decision = 'REJECTED' then 'REJECTED'
    when p_decision = 'CHANGES_REQUESTED' then p_stage
    when p_stage = 'FACT_CHECKING' then 'RIGHTS_CHECKING'
    when p_stage = 'RIGHTS_CHECKING' then 'PUBLISH'
    when p_decision = 'PUBLISHED' then 'APPROVED'
    when p_decision = 'LIMITED' then 'LIMITED'
  end;

  update public.meme_candidates as candidate
     set review_status = v_next_status,
         updated_at = now()
   where candidate.id = p_candidate_id
  returning candidate.* into v_candidate;

  return v_candidate;
end;
$function$;

create or replace function public.review_mpe_claim(
  p_candidate_id uuid,
  p_claim_id uuid,
  p_decision text
)
returns public.claim_evidence
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_claim public.claim_evidence;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception using errcode = '22023', message = 'invalid_claim_decision';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;
  if v_candidate.review_status <> 'FACT_CHECKING' then
    raise exception using errcode = '55000', message = 'claim_review_stage_closed';
  end if;

  select evidence.*
    into v_claim
    from public.claim_evidence as evidence
   where evidence.id = p_claim_id
     and evidence.candidate_id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'claim_not_found';
  end if;
  if v_claim.ingestion_id is not null
     and v_claim.ingestion_id <> v_candidate.ingestion_id then
    raise exception using errcode = '23514', message = 'claim_ingestion_mismatch';
  end if;
  if v_claim.text_segment_id is not null
     and not exists (
       select 1
         from public.text_segments as segment
        where segment.id = v_claim.text_segment_id
          and segment.ingestion_id = v_candidate.ingestion_id
     ) then
    raise exception using errcode = '23514', message = 'claim_segment_mismatch';
  end if;

  update public.claim_evidence as evidence
     set review_status = p_decision
   where evidence.id = p_claim_id
  returning evidence.* into v_claim;

  return v_claim;
end;
$function$;

create or replace function public.save_mpe_candidate_revision(
  p_candidate_id uuid,
  p_draft_json jsonb
)
returns public.meme_candidates
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_revision_number integer;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_draft_json is null then
    raise exception using errcode = '22023', message = 'draft_required';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;

  select coalesce(max(revision.revision_number), 0)
    into v_revision_number
    from public.candidate_revisions as revision
   where revision.candidate_id = p_candidate_id;

  if v_revision_number = 0 then
    insert into public.candidate_revisions (
      candidate_id,
      revision_number,
      draft_json,
      model_version,
      prompt_version,
      created_by
    ) values (
      p_candidate_id,
      1,
      v_candidate.draft_json,
      v_candidate.model_version,
      v_candidate.prompt_version,
      auth.uid()
    );
    v_revision_number := 1;
  end if;

  insert into public.candidate_revisions (
    candidate_id,
    revision_number,
    draft_json,
    model_version,
    prompt_version,
    created_by
  ) values (
    p_candidate_id,
    v_revision_number + 1,
    p_draft_json,
    v_candidate.model_version,
    v_candidate.prompt_version,
    auth.uid()
  );

  update public.meme_candidates as candidate
     set draft_json = p_draft_json,
         updated_at = now()
   where candidate.id = p_candidate_id
  returning candidate.* into v_candidate;

  return v_candidate;
end;
$function$;

revoke all on function public.create_media_ingestion(
  uuid, text, text, text, bigint, text, text, timestamptz, boolean, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_media_ingestion(
  uuid, text, text, text, bigint, text, text, timestamptz, boolean, integer, integer, integer
) to authenticated, service_role;

revoke all on function public.set_mpe_ingestion_source_rights(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_mpe_ingestion_source_rights(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.replace_mpe_candidate_matches(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_mpe_candidate_matches(uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.replace_mpe_candidate_evidence(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_mpe_candidate_evidence(uuid, jsonb, jsonb)
  to authenticated, service_role;

revoke all on function public.claim_processing_job(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.claim_processing_job(text, text, text[])
  to service_role;

revoke all on function public.queue_mpe_render_job(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.queue_mpe_render_job(uuid, jsonb, text, text)
  to authenticated, service_role;

revoke all on function public.complete_processing_job(uuid, uuid, text, jsonb, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_processing_job(uuid, uuid, text, jsonb, text, numeric)
  to service_role;

revoke all on function public.reprocess_mpe_job(uuid)
  from public, anon, authenticated;
grant execute on function public.reprocess_mpe_job(uuid)
  to authenticated, service_role;

revoke all on function public.review_mpe_candidate(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_mpe_candidate(uuid, text, text, text)
  to authenticated, service_role;

revoke all on function public.review_mpe_claim(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_mpe_claim(uuid, uuid, text)
  to authenticated, service_role;

revoke all on function public.save_mpe_candidate_revision(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_mpe_candidate_revision(uuid, jsonb)
  to authenticated, service_role;

commit;
