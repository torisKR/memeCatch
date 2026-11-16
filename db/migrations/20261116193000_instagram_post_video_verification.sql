-- Manually reviewed media-kind evidence for ambiguous Instagram /p/ posts.
--
-- The private event ledger is authoritative. The public boolean on
-- meme_contents is only a small list/cache projection; URL shape, oEmbed,
-- meme_contents.type, and legacy rows never set it automatically.

begin;

alter table public.meme_contents
  add column manual_video_verified boolean not null default false,
  add column manual_video_verification_generation bigint not null default 0
    check (manual_video_verification_generation >= 0);

comment on column public.meme_contents.manual_video_verified is
  'Public projection of the latest explicit manual video-kind decision for this exact content identity. Managed by private.instagram_post_video_verification_events; never infer from URL, oEmbed, type, or legacy data.';
comment on column public.meme_contents.manual_video_verification_generation is
  'Managed identity generation for manual video verification. Increments when platform, URL, or external content ID changes so old evidence cannot reactivate.';

create table private.instagram_post_video_verification_events (
  id bigint generated always as identity primary key,
  operation_id uuid not null unique,
  -- Deliberately no FK: deleting a public projection must not erase or block
  -- the durable review history. The operator RPC validates the target row.
  content_id uuid not null,
  content_generation bigint not null check (content_generation >= 0),
  decision text not null check (decision in ('verify', 'revoke')),
  content_created_at timestamptz not null,
  content_platform text not null,
  content_url text not null,
  external_content_id text not null,
  evidence_note text not null check (
    char_length(btrim(evidence_note)) between 10 and 2000
  ),
  recorded_by uuid not null,
  recorded_at timestamptz not null default now()
);

comment on table private.instagram_post_video_verification_events is
  'Append-only operator-recorded decisions about video evidence in an Instagram /p/ post. recorded_by is the authenticated operator submitting the decision; the evidence note identifies how the content was observed. The latest event for the exact content incarnation and generation is authoritative and revocable. A missing lazy-loaded video element alone is not negative evidence.';

comment on column private.instagram_post_video_verification_events.recorded_by is
  'Authenticated operator account that submitted the decision; does not imply that the operator personally observed the evidence.';
comment on column private.instagram_post_video_verification_events.recorded_at is
  'Time at which the authenticated operator account submitted the decision.';
comment on column private.instagram_post_video_verification_events.operation_id is
  'Caller-generated idempotency key. Each operation has exactly one immutable receipt; retries must match the original actor, content, decision, and evidence note.';

create index instagram_post_video_verification_events_content_latest_idx
  on private.instagram_post_video_verification_events
    (content_id, content_generation desc, id desc);

revoke all on table private.instagram_post_video_verification_events
  from public, anon, authenticated, service_role;
revoke all on sequence private.instagram_post_video_verification_events_id_seq
  from public, anon, authenticated, service_role;

create or replace function private.guard_meme_content_manual_video_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_expected boolean := false;
  v_prior_generation bigint;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(new.id::text, 0)
  ) then
    raise exception using
      errcode = '40001',
      message = 'concurrent_meme_content_incarnation_change';
  end if;

  if tg_op = 'INSERT' then
    -- The primary key permits only one live row for an id. Serialize generation
    -- allocation without waiting: a blocking lock here could deadlock with a
    -- transaction that already deleted the live row and is reinserting it.
    -- SQLSTATE 40001 tells a concurrent contender to retry from a fresh snapshot.
    select max(event.content_generation)
      into v_prior_generation
      from private.instagram_post_video_verification_events as event
     where event.content_id = new.id;

    new.manual_video_verification_generation :=
      case
        when v_prior_generation is null then 0
        else v_prior_generation + 1
      end;
    new.manual_video_verified := false;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception using
      errcode = '55000',
      message = 'meme_content_id_is_immutable';
  end if;

  if new.created_at is distinct from old.created_at
     or new.platform is distinct from old.platform
     or new.url is distinct from old.url
     or new.content_id is distinct from old.content_id then
    new.manual_video_verification_generation := old.manual_video_verification_generation + 1;
    new.manual_video_verified := false;
    return new;
  end if;

  -- The generation is managed even when a caller tries to write it directly.
  new.manual_video_verification_generation := old.manual_video_verification_generation;

  select coalesce(latest.decision = 'verify', false)
    into v_expected
    from (
      select event.decision
        from private.instagram_post_video_verification_events as event
       where event.content_id = new.id
         and event.content_generation = new.manual_video_verification_generation
         and event.content_created_at = new.created_at
         and event.content_platform = new.platform
         and event.content_url = new.url
         and event.external_content_id = new.content_id
       order by event.id desc
       limit 1
    ) as latest;

  if new.manual_video_verified is distinct from coalesce(v_expected, false) then
    raise exception using
      errcode = '42501',
      message = 'manual_video_verification_projection_is_managed';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_meme_content_manual_video_projection()
  from public, anon, authenticated, service_role;

drop trigger if exists meme_contents_manual_video_projection_guard on public.meme_contents;
create trigger meme_contents_manual_video_projection_guard
before insert or update of id, created_at, platform, url, content_id, manual_video_verified,
  manual_video_verification_generation
on public.meme_contents
for each row execute function private.guard_meme_content_manual_video_projection();

create or replace function private.sync_instagram_post_video_verification_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.meme_contents as content
     set manual_video_verified = (new.decision = 'verify')
   where content.id = new.content_id
     and content.manual_video_verification_generation = new.content_generation
     and content.created_at = new.content_created_at
     and content.platform = new.content_platform
     and content.url = new.content_url
     and content.content_id = new.external_content_id;
  return new;
end;
$function$;

revoke all on function private.sync_instagram_post_video_verification_projection()
  from public, anon, authenticated, service_role;

create trigger instagram_post_video_verification_projection_sync
after insert on private.instagram_post_video_verification_events
for each row execute function private.sync_instagram_post_video_verification_projection();

create or replace function private.reject_instagram_post_video_verification_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'instagram_post_video_verification_events_are_append_only';
end;
$function$;

revoke all on function private.reject_instagram_post_video_verification_event_mutation()
  from public, anon, authenticated, service_role;

create trigger instagram_post_video_verification_events_append_only
before update or delete on private.instagram_post_video_verification_events
for each row execute function private.reject_instagram_post_video_verification_event_mutation();

create or replace function public.record_instagram_post_video_verification(
  p_operation_id uuid,
  p_content_id uuid,
  p_decision text,
  p_evidence_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := btrim(coalesce(p_evidence_note, ''));
  v_content public.meme_contents%rowtype;
  v_url_match text[];
  v_existing private.instagram_post_video_verification_events%rowtype;
  v_event_id bigint;
begin
  if v_actor is null or public.is_operator() is distinct from true then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_content_id is null then
    raise exception using errcode = '22023', message = 'content_id_required';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'operation_id_required';
  end if;
  if v_decision not in ('verify', 'revoke') then
    raise exception using errcode = '22023', message = 'invalid_video_verification_decision';
  end if;
  if char_length(v_note) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'video_verification_evidence_note_required';
  end if;

  -- Serialize the caller-supplied operation before inspecting its receipt. A
  -- retry racing the original call fails fast and can retry from a fresh
  -- transaction after the original commits.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(p_operation_id::text, 1)
  ) then
    raise exception using
      errcode = '40001',
      message = 'concurrent_instagram_post_video_verification_operation';
  end if;

  select *
    into v_existing
    from private.instagram_post_video_verification_events as event
   where event.operation_id = p_operation_id;

  if found then
    -- Keep this error deliberately generic: an operation id supplied by a
    -- different actor must not reveal the original receipt or its fields.
    if v_existing.recorded_by is distinct from v_actor
       or v_existing.content_id is distinct from p_content_id
       or v_existing.decision is distinct from v_decision
       or v_existing.evidence_note is distinct from v_note then
      raise exception using
        errcode = '22023',
        message = 'video_verification_operation_mismatch';
    end if;

    return jsonb_build_object(
      'operationId', v_existing.operation_id,
      'contentId', v_existing.content_id,
      'decision', v_existing.decision,
      'eventId', v_existing.id,
      'idempotent', true,
      'manualVideoVerifiedAtDecision', v_existing.decision = 'verify'
    );
  end if;

  -- A separate UUID-scoped lock protects the content projection and makes
  -- different operations for the same content fail fast instead of waiting.
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(p_content_id::text, 0)
  ) then
    raise exception using
      errcode = '40001',
      message = 'concurrent_meme_content_incarnation_change';
  end if;

  select *
    into v_content
    from public.meme_contents
   where id = p_content_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_content_not_found';
  end if;

  v_url_match := regexp_match(
    coalesce(v_content.url, ''),
    '^https://(www\.)?instagram\.com/p/([A-Za-z0-9_-]+)/?([?#].*)?$'
  );
  if lower(coalesce(v_content.platform, '')) <> 'instagram'
     or v_content.content_id is null
     or v_url_match is null
     or v_url_match[2] is distinct from v_content.content_id then
    raise exception using errcode = '22023', message = 'instagram_post_content_required';
  end if;

  insert into private.instagram_post_video_verification_events (
    operation_id,
    content_id,
    content_generation,
    decision,
    content_created_at,
    content_platform,
    content_url,
    external_content_id,
    evidence_note,
    recorded_by
  ) values (
    p_operation_id,
    v_content.id,
    v_content.manual_video_verification_generation,
    v_decision,
    v_content.created_at,
    v_content.platform,
    v_content.url,
    v_content.content_id,
    v_note,
    v_actor
  ) returning id into v_event_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor,
    'meme_content.instagram_post_video_' || v_decision,
    'meme_content',
    v_content.id::text,
    jsonb_build_object(
      'event_id', v_event_id,
      'content_generation', v_content.manual_video_verification_generation
    )
  );

  return jsonb_build_object(
    'operationId', p_operation_id,
    'contentId', v_content.id,
    'decision', v_decision,
    'eventId', v_event_id,
    'idempotent', false,
    'manualVideoVerifiedAtDecision', v_decision = 'verify'
  );
end;
$function$;

revoke all on function public.record_instagram_post_video_verification(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_instagram_post_video_verification(uuid, uuid, text, text)
  to authenticated;

commit;
