-- Durable, private staging for owner-provided Google Sheet snapshots.
-- Sheet data is untrusted review input. Importing it never publishes content,
-- accepts a sheet status as approval, or changes a prior manual decision.

begin;

create table private.sheet_snapshot_rows (
  sheet_id text not null check (char_length(btrim(sheet_id)) between 1 and 256),
  row_id text not null check (row_id ~ '^(MEME|VID)-[^[:space:]]+$'),
  record_kind text not null check (record_kind in ('concept', 'video')),
  source_tab text not null check (char_length(btrim(source_tab)) between 1 and 256),
  source_row integer not null check (source_row >= 1),
  raw_data jsonb not null check (jsonb_typeof(raw_data) = 'array'),
  concept_url text,
  concept_url_key text,
  review_state text not null default 'pending'
    check (review_state in ('pending', 'reviewing', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  first_imported_at timestamptz not null default now(),
  source_updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (sheet_id, row_id),
  check (
    (record_kind = 'concept' and row_id like 'MEME-%')
    or (record_kind = 'video' and row_id like 'VID-%')
  )
);

comment on table private.sheet_snapshot_rows is
  'Private review staging for raw Google Sheet rows. It is not a publication table. Sheet statuses remain untrusted raw_data and never set review_state.';
comment on column private.sheet_snapshot_rows.source_row is
  'One-based Google Sheet row number: snapshot start plus the zero-based raw row offset.';
comment on column private.sheet_snapshot_rows.concept_url_key is
  'Deterministic lookup key only. It does not establish a concept/video relationship; ambiguous and unmatched URLs remain staged.';
comment on column private.sheet_snapshot_rows.review_state is
  'Service-owned manual review state. Snapshot re-imports never assign or overwrite this column or its review metadata.';

create index sheet_snapshot_rows_concept_url_key_idx
  on private.sheet_snapshot_rows (concept_url_key, record_kind)
  where concept_url_key is not null;
create index sheet_snapshot_rows_source_location_idx
  on private.sheet_snapshot_rows (sheet_id, source_tab, source_row);

alter table private.sheet_snapshot_rows enable row level security;

revoke all on table private.sheet_snapshot_rows
  from public, anon, authenticated, service_role;
grant select, insert, update on table private.sheet_snapshot_rows to service_role;

create table private.sheet_snapshot_row_revisions (
  sheet_id text not null,
  row_id text not null,
  revision_id text not null check (revision_id ~ '^[0-9a-f]{64}$'),
  record_kind text not null check (record_kind in ('concept', 'video')),
  source_tab text not null check (char_length(btrim(source_tab)) between 1 and 256),
  source_row integer not null check (source_row >= 1),
  raw_data jsonb not null check (jsonb_typeof(raw_data) = 'array'),
  concept_url text,
  concept_url_key text,
  review_state text not null default 'pending'
    check (review_state in ('pending', 'reviewing', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  first_imported_at timestamptz not null default now(),
  primary key (sheet_id, row_id, revision_id),
  foreign key (sheet_id, row_id)
    references private.sheet_snapshot_rows (sheet_id, row_id),
  check (
    (record_kind = 'concept' and row_id like 'MEME-%')
    or (record_kind = 'video' and row_id like 'VID-%')
  )
);

comment on table private.sheet_snapshot_row_revisions is
  'Private review queue and backup for changed payloads whose original snapshot row has review activity. Each distinct incoming payload and source location starts pending and never inherits approval.';
comment on column private.sheet_snapshot_row_revisions.revision_id is
  'Lowercase SHA-256 of the canonical JSONB document containing sheet/row identity, source location, and the complete normalized incoming snapshot payload.';

create index sheet_snapshot_row_revisions_review_idx
  on private.sheet_snapshot_row_revisions (review_state, first_imported_at);
create index sheet_snapshot_row_revisions_source_location_idx
  on private.sheet_snapshot_row_revisions (sheet_id, source_tab, source_row);

alter table private.sheet_snapshot_row_revisions enable row level security;

revoke all on table private.sheet_snapshot_row_revisions
  from public, anon, authenticated, service_role;
grant select, insert, update on table private.sheet_snapshot_row_revisions
  to service_role;

create or replace function public.import_sheet_snapshot_rows(
  p_sheet_id text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_sheet_id text := btrim(coalesce(p_sheet_id, ''));
  v_received integer;
  v_changed integer;
  v_conflicts integer;
  v_conflict_revisions_created integer;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if char_length(v_sheet_id) not between 1 and 256 then
    raise exception using errcode = '22023', message = 'invalid_sheet_id';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'rows_must_be_an_array';
  end if;

  v_received := jsonb_array_length(p_rows);
  if v_received > 1000 then
    raise exception using errcode = '22023', message = 'sheet_import_batch_too_large';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_rows) as item(value)
     where jsonb_typeof(item.value) is distinct from 'object'
        or coalesce(item.value->>'row_id', '') !~ '^(MEME|VID)-[^[:space:]]+$'
        or item.value->>'record_kind' not in ('concept', 'video')
        or (item.value->>'record_kind' = 'concept' and item.value->>'row_id' not like 'MEME-%')
        or (item.value->>'record_kind' = 'video' and item.value->>'row_id' not like 'VID-%')
        or char_length(btrim(coalesce(item.value->>'source_tab', ''))) not between 1 and 256
        or coalesce(item.value->>'source_row', '') !~ '^[1-9][0-9]*$'
        or jsonb_typeof(item.value->'raw_data') is distinct from 'array'
  ) then
    raise exception using errcode = '22023', message = 'invalid_sheet_snapshot_row';
  end if;

  if exists (
    select item.value->>'row_id'
      from jsonb_array_elements(p_rows) as item(value)
     group by item.value->>'row_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate_sheet_row_id_in_batch';
  end if;

  -- Serialize against a reviewer and against another import of the same rows.
  -- A row with any review activity is an immutable reviewed snapshot: a later
  -- changed sheet row is deferred instead of inheriting the old decision.
  perform 1
    from private.sheet_snapshot_rows as staged
    join jsonb_array_elements(p_rows) as item(value)
      on item.value->>'row_id' = staged.row_id
   where staged.sheet_id = v_sheet_id
   order by staged.row_id
   for update of staged;

  select count(*)::integer
    into v_conflicts
    from private.sheet_snapshot_rows as staged
    join jsonb_array_elements(p_rows) as item(value)
      on item.value->>'row_id' = staged.row_id
   where staged.sheet_id = v_sheet_id
     and (
       staged.review_state <> 'pending'
       or staged.reviewed_by is not null
       or staged.reviewed_at is not null
       or staged.review_note is not null
     )
     and (staged.record_kind,
          staged.source_tab,
          staged.source_row,
          staged.raw_data,
          staged.concept_url,
          staged.concept_url_key)
       is distinct from
           (item.value->>'record_kind',
            btrim(item.value->>'source_tab'),
            (item.value->>'source_row')::integer,
            item.value->'raw_data',
            nullif(item.value->>'concept_url', ''),
            nullif(item.value->>'concept_url_key', ''));

  -- Preserve the complete changed payload as a separately reviewable pending
  -- revision. JSONB text is canonical for object key order, so exact replays
  -- have the same collision-resistant identity and insert nothing.
  insert into private.sheet_snapshot_row_revisions (
    sheet_id,
    row_id,
    revision_id,
    record_kind,
    source_tab,
    source_row,
    raw_data,
    concept_url,
    concept_url_key,
    review_state
  )
  select
    v_sheet_id,
    item.value->>'row_id',
    encode(sha256(convert_to(jsonb_build_object(
      'sheet_id', v_sheet_id,
      'row_id', item.value->>'row_id',
      'record_kind', item.value->>'record_kind',
      'source_tab', btrim(item.value->>'source_tab'),
      'source_row', (item.value->>'source_row')::integer,
      'raw_data', item.value->'raw_data',
      'concept_url', nullif(item.value->>'concept_url', ''),
      'concept_url_key', nullif(item.value->>'concept_url_key', '')
    )::text, 'UTF8')), 'hex'),
    item.value->>'record_kind',
    btrim(item.value->>'source_tab'),
    (item.value->>'source_row')::integer,
    item.value->'raw_data',
    nullif(item.value->>'concept_url', ''),
    nullif(item.value->>'concept_url_key', ''),
    'pending'
  from private.sheet_snapshot_rows as staged
  join jsonb_array_elements(p_rows) as item(value)
    on item.value->>'row_id' = staged.row_id
  where staged.sheet_id = v_sheet_id
    and (
      staged.review_state <> 'pending'
      or staged.reviewed_by is not null
      or staged.reviewed_at is not null
      or staged.review_note is not null
    )
    and (staged.record_kind,
         staged.source_tab,
         staged.source_row,
         staged.raw_data,
         staged.concept_url,
         staged.concept_url_key)
      is distinct from
          (item.value->>'record_kind',
           btrim(item.value->>'source_tab'),
           (item.value->>'source_row')::integer,
           item.value->'raw_data',
           nullif(item.value->>'concept_url', ''),
           nullif(item.value->>'concept_url_key', ''))
  on conflict (sheet_id, row_id, revision_id) do nothing;

  get diagnostics v_conflict_revisions_created = row_count;

  with incoming as (
    select
      v_sheet_id as sheet_id,
      item.value->>'row_id' as row_id,
      item.value->>'record_kind' as record_kind,
      btrim(item.value->>'source_tab') as source_tab,
      (item.value->>'source_row')::integer as source_row,
      item.value->'raw_data' as raw_data,
      nullif(item.value->>'concept_url', '') as concept_url,
      nullif(item.value->>'concept_url_key', '') as concept_url_key
    from jsonb_array_elements(p_rows) as item(value)
  ), upserted as (
    insert into private.sheet_snapshot_rows as staged (
      sheet_id,
      row_id,
      record_kind,
      source_tab,
      source_row,
      raw_data,
      concept_url,
      concept_url_key
    )
    select
      incoming.sheet_id,
      incoming.row_id,
      incoming.record_kind,
      incoming.source_tab,
      incoming.source_row,
      incoming.raw_data,
      incoming.concept_url,
      incoming.concept_url_key
    from incoming
    on conflict (sheet_id, row_id) do update
      set record_kind = excluded.record_kind,
          source_tab = excluded.source_tab,
          source_row = excluded.source_row,
          raw_data = excluded.raw_data,
          concept_url = excluded.concept_url,
          concept_url_key = excluded.concept_url_key,
          source_updated_at = now(),
          last_seen_at = now()
      where staged.review_state = 'pending'
        and staged.reviewed_by is null
        and staged.reviewed_at is null
        and staged.review_note is null
        and (staged.record_kind,
             staged.source_tab,
             staged.source_row,
             staged.raw_data,
             staged.concept_url,
             staged.concept_url_key)
        is distinct from
            (excluded.record_kind,
             excluded.source_tab,
             excluded.source_row,
             excluded.raw_data,
             excluded.concept_url,
             excluded.concept_url_key)
    returning 1
  )
  select count(*)::integer into v_changed from upserted;

  -- Exact replays intentionally make no row changes. The conflict update
  -- reads review fields only as a guard and never assigns any of them.
  return jsonb_build_object(
    'received', v_received,
    'changed', v_changed,
    'unchanged', v_received - v_changed - v_conflicts,
    'conflicts', v_conflicts,
    'conflict_revisions_created', v_conflict_revisions_created
  );
end;
$function$;

revoke all on function public.import_sheet_snapshot_rows(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.import_sheet_snapshot_rows(text, jsonb)
  to service_role;

commit;
