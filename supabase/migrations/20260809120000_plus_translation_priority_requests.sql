create table if not exists public.plus_translation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete cascade,
  locale text not null check (locale in ('en', 'ja', 'zh', 'zh-tw')),
  status text not null default 'requested'
    check (status in ('requested', 'in_review', 'completed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, meme_id, locale),
  constraint plus_translation_requests_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index if not exists plus_translation_requests_queue_idx
  on public.plus_translation_requests (status, meme_id, locale, created_at desc)
  where status in ('requested', 'in_review');
create index if not exists plus_translation_requests_user_pending_idx
  on public.plus_translation_requests (user_id, status, updated_at desc)
  where status in ('requested', 'in_review');

alter table public.plus_translation_requests enable row level security;

drop policy if exists plus_translation_requests_self_read
  on public.plus_translation_requests;
create policy plus_translation_requests_self_read
  on public.plus_translation_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_active_plus((select auth.uid()))
  );

drop policy if exists plus_translation_requests_operator_read
  on public.plus_translation_requests;
create policy plus_translation_requests_operator_read
  on public.plus_translation_requests
  for select to authenticated
  using (public.is_operator());

drop policy if exists plus_translation_requests_operator_update
  on public.plus_translation_requests;
create policy plus_translation_requests_operator_update
  on public.plus_translation_requests
  for update to authenticated
  using (public.is_operator())
  with check (public.is_operator());

revoke all on table public.plus_translation_requests from public, anon, authenticated;
grant select, update on table public.plus_translation_requests to authenticated;

create or replace function public.touch_plus_translation_request_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists touch_plus_translation_request_updated_at
  on public.plus_translation_requests;
create trigger touch_plus_translation_request_updated_at
before update on public.plus_translation_requests
for each row execute function public.touch_plus_translation_request_updated_at();

create or replace function public.request_plus_translation(
  p_meme_id uuid,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_locale text := lower(btrim(coalesce(p_locale, '')));
  v_meme public.memes%rowtype;
  v_existing public.plus_translation_requests%rowtype;
  v_request_id uuid;
  v_pending_count integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if v_locale not in ('en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;

  select m.*
    into v_meme
    from public.memes m
   where m.id = p_meme_id
     and m.moderation_status in ('approved', 'limited');
  if not found then
    raise exception using errcode = '22023', message = 'public_meme_required';
  end if;

  if not exists (
    select 1
      from public.saved_memes sm
     where sm.user_id = v_uid
       and sm.meme_id = p_meme_id
  ) then
    raise exception using errcode = '42501', message = 'saved_meme_required';
  end if;

  if exists (
    select 1
      from public.meme_translations mt
     where mt.meme_id = p_meme_id
       and mt.locale = v_locale
       and mt.status = 'reviewed'
       and mt.source_updated_at = v_meme.updated_at
  ) then
    return jsonb_build_object(
      'status', 'already_available',
      'memeId', p_meme_id,
      'locale', v_locale
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('plus_translation:' || v_uid::text, 0));

  select r.*
    into v_existing
    from public.plus_translation_requests r
   where r.user_id = v_uid
     and r.meme_id = p_meme_id
     and r.locale = v_locale;

  if found and v_existing.status in ('requested', 'in_review') then
    return jsonb_build_object(
      'status', 'already_requested',
      'requestId', v_existing.id,
      'memeId', p_meme_id,
      'locale', v_locale
    );
  end if;

  select count(*)
    into v_pending_count
    from public.plus_translation_requests r
   where r.user_id = v_uid
     and r.status in ('requested', 'in_review');
  if v_pending_count >= 20 then
    raise exception using errcode = 'P0429', message = 'too_many_translation_requests';
  end if;

  insert into public.plus_translation_requests (
    user_id,
    meme_id,
    locale,
    status,
    created_at,
    updated_at,
    completed_at
  ) values (
    v_uid,
    p_meme_id,
    v_locale,
    'requested',
    now(),
    now(),
    null
  )
  on conflict (user_id, meme_id, locale) do update
    set status = 'requested',
        created_at = now(),
        updated_at = now(),
        completed_at = null
  returning id into v_request_id;

  return jsonb_build_object(
    'status', 'requested',
    'requestId', v_request_id,
    'memeId', p_meme_id,
    'locale', v_locale
  );
end;
$function$;

create or replace function public.list_translation_priority_queue(
  p_limit integer default 50
)
returns table (
  meme_id uuid,
  locale text,
  request_count bigint,
  latest_requested_at timestamptz,
  status text,
  meme_title text,
  meme_summary text,
  meme_short_id text,
  meme_slug text,
  meme_updated_at timestamptz,
  translation_status text,
  translation_title text,
  translation_summary text,
  translation_updated_at timestamptz,
  source_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'invalid_limit';
  end if;

  return query
  with demand as (
    select
      r.meme_id,
      r.locale,
      count(*) as request_count,
      max(r.created_at) as latest_requested_at,
      case
        when bool_or(r.status = 'in_review') then 'in_review'
        else 'requested'
      end as status
    from public.plus_translation_requests r
    where r.status in ('requested', 'in_review')
    group by r.meme_id, r.locale
  )
  select
    d.meme_id,
    d.locale,
    d.request_count,
    d.latest_requested_at,
    d.status,
    m.title as meme_title,
    m.summary as meme_summary,
    m.short_id as meme_short_id,
    m.slug as meme_slug,
    m.updated_at as meme_updated_at,
    mt.status as translation_status,
    mt.title as translation_title,
    mt.summary as translation_summary,
    mt.updated_at as translation_updated_at,
    mt.source_updated_at as source_updated_at
  from demand d
  join public.memes m on m.id = d.meme_id
  left join public.meme_translations mt
    on mt.meme_id = d.meme_id
   and mt.locale = d.locale
  order by d.request_count desc, d.latest_requested_at desc, d.meme_id, d.locale
  limit p_limit;
end;
$function$;

create or replace function public.claim_translation_priority_request(
  p_meme_id uuid,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_locale text := lower(btrim(coalesce(p_locale, '')));
  v_count integer;
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if v_locale not in ('en', 'ja', 'zh', 'zh-tw') then
    raise exception using errcode = '22023', message = 'invalid_locale';
  end if;

  update public.plus_translation_requests r
     set status = 'in_review'
   where r.meme_id = p_meme_id
     and r.locale = v_locale
     and r.status = 'requested';
  get diagnostics v_count = row_count;

  if v_count = 0 and not exists (
    select 1
      from public.plus_translation_requests r
     where r.meme_id = p_meme_id
       and r.locale = v_locale
       and r.status = 'in_review'
  ) then
    raise exception using errcode = '22023', message = 'translation_request_not_found';
  end if;

  return jsonb_build_object(
    'status', 'in_review',
    'memeId', p_meme_id,
    'locale', v_locale,
    'claimedRequestCount', v_count
  );
end;
$function$;

create or replace function public.complete_plus_translation_requests()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_event_id bigint;
begin
  if new.status <> 'reviewed' or not exists (
    select 1
      from public.memes m
     where m.id = new.meme_id
       and m.moderation_status in ('approved', 'limited')
       and new.source_updated_at = m.updated_at
  ) then
    return new;
  end if;

  insert into public.meme_public_change_events (
    meme_id,
    kind,
    locale,
    source_updated_at
  ) values (
    new.meme_id,
    'translation_reviewed',
    new.locale,
    new.updated_at
  )
  on conflict do nothing;

  select e.id
    into v_event_id
    from public.meme_public_change_events e
   where e.meme_id = new.meme_id
     and e.kind = 'translation_reviewed'
     and e.locale = new.locale
     and e.source_updated_at = new.updated_at
   order by e.id
   limit 1;

  if v_event_id is null then
    raise exception 'translation_reviewed_event_missing';
  end if;

  with completed as (
    update public.plus_translation_requests r
       set status = 'completed',
           completed_at = now()
     where r.meme_id = new.meme_id
       and r.locale = new.locale
       and r.status in ('requested', 'in_review')
    returning r.user_id
  )
  insert into public.plus_saved_context_alerts (user_id, event_id)
  select distinct c.user_id, v_event_id
    from completed c
   where public.has_active_plus(c.user_id)
  on conflict (user_id, event_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists complete_plus_translation_requests_after_write
  on public.meme_translations;
create trigger complete_plus_translation_requests_after_write
after insert or update of status, source_updated_at, updated_at
on public.meme_translations
for each row execute function public.complete_plus_translation_requests();

revoke all on function public.touch_plus_translation_request_updated_at()
  from public, anon, authenticated;
revoke all on function public.request_plus_translation(uuid, text)
  from public, anon;
grant execute on function public.request_plus_translation(uuid, text)
  to authenticated;
revoke all on function public.list_translation_priority_queue(integer)
  from public, anon;
grant execute on function public.list_translation_priority_queue(integer)
  to authenticated;
revoke all on function public.claim_translation_priority_request(uuid, text)
  from public, anon;
grant execute on function public.claim_translation_priority_request(uuid, text)
  to authenticated;
revoke all on function public.complete_plus_translation_requests()
  from public, anon, authenticated;
