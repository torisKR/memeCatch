begin;

revoke select on table public.profiles from anon, authenticated;
grant select (id, nickname, created_at) on table public.profiles to anon, authenticated;
drop policy if exists profiles_self_insert on public.profiles;
revoke insert on table public.profiles from authenticated;

create or replace function public.get_own_profile()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select case when auth.uid() is null then null else to_jsonb(profile) end
    from public.profiles as profile
   where profile.id = auth.uid();
$function$;
revoke all on function public.get_own_profile() from public, anon;
grant execute on function public.get_own_profile() to authenticated;

drop policy if exists contents_public_read on public.meme_contents;
create policy contents_public_read on public.meme_contents for select
  using (
    public.meme_contents.moderation_status = 'approved'
    and exists (
      select 1 from public.memes as meme
       where meme.id = public.meme_contents.meme_id
         and meme.moderation_status in ('approved', 'limited')
    )
    or public.is_operator()
  );

create or replace function public.has_active_plus(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
      raise exception using errcode = '42501', message = 'auth_required';
    end if;
  elsif p_user_id is distinct from auth.uid() and not public.is_operator() then
    raise exception using errcode = '42501', message = 'self_or_operator_required';
  end if;
  return exists (
    select 1 from public.billing_subscriptions as subscription
     where subscription.user_id = p_user_id
       and subscription.status = 'active'
       and subscription.current_period_end > now()
  );
end;
$function$;
revoke all on function public.has_active_plus(uuid) from public, anon;
grant execute on function public.has_active_plus(uuid) to authenticated, service_role;

create or replace function public.post_comment(p_meme_id uuid, p_parent_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '42501', message = 'meme_not_public';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.discussions
     where id = p_parent_id and meme_id = p_meme_id and status = 'visible'
  ) then
    raise exception using errcode = '22023', message = 'invalid_parent';
  end if;
  perform public.check_rate_limit('discussions', 10, 10);
  insert into public.discussions (meme_id, user_id, parent_id, body)
  values (p_meme_id, auth.uid(), p_parent_id, p_body)
  returning id into v_id;
  return v_id;
end;
$function$;

drop policy if exists discussions_read on public.discussions;
create policy discussions_read on public.discussions for select
  using (
    user_id = auth.uid()
    or public.is_operator()
    or (
      status = 'visible'
      and exists (
        select 1 from public.memes as meme
         where meme.id = public.discussions.meme_id
           and meme.moderation_status in ('approved', 'limited')
      )
    )
  );

revoke execute on function public.increment_view(uuid, text) from public, anon, authenticated;
create or replace function public.record_meme_view(p_meme_id uuid, p_principal_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_principal_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_view_principal';
  end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_principal_hash, 0));
  if exists (
    select 1 from public.view_events
     where meme_id = p_meme_id
       and session_hash = p_principal_hash
       and created_at >= v_start
  ) then
    return false;
  end if;
  if (
    select count(*) from public.view_events
     where session_hash = p_principal_hash and created_at >= v_start
  ) >= 100 then
    raise exception using errcode = 'P0429', message = 'view_quota_exceeded';
  end if;
  insert into public.view_events (meme_id, session_hash)
  values (p_meme_id, p_principal_hash);
  return true;
end;
$function$;
revoke all on function public.record_meme_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_meme_view(uuid, text) to service_role;

create or replace function public.set_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_host text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) not between 20 and 2048
     or p_endpoint ~ '[#@]'
     or p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$'
     or p_auth !~ '^[A-Za-z0-9_-]{16,64}$'
     or char_length(coalesce(p_user_agent, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_push_subscription';
  end if;
  v_host := lower(split_part(split_part(p_endpoint, '://', 2), '/', 1));
  if v_host !~ '^(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)(:443)?$' then
    raise exception using errcode = '22023', message = 'unsupported_push_service';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('web-push:' || v_uid::text, 0));
  if not exists (
    select 1 from public.web_push_subscriptions
     where user_id = v_uid and endpoint = p_endpoint
  ) and (
    select count(*) from public.web_push_subscriptions where user_id = v_uid
  ) >= 5 then
    raise exception using errcode = 'P0429', message = 'subscription_limit_reached';
  end if;
  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, nullif(p_user_agent, ''))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now()
    where web_push_subscriptions.user_id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'subscription_owned_by_another_user';
  end if;
  return true;
end;
$function$;

create or replace function public.enforce_media_ingestion_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_bytes bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('mpe-upload:' || new.user_id::text, 0));
  if (
    select count(*) from public.media_ingestions
     where user_id = new.user_id and created_at >= now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0429', message = 'daily_ingestion_limit_reached';
  end if;
  select coalesce(sum(byte_size), 0) into v_bytes
    from public.media_ingestions
   where user_id = new.user_id and deleted_at is null and expires_at > now();
  if v_bytes + new.byte_size > 104857600 then
    raise exception using errcode = 'P0429', message = 'active_ingestion_bytes_exceeded';
  end if;
  return new;
end;
$function$;
drop trigger if exists enforce_media_ingestion_quota on public.media_ingestions;
create trigger enforce_media_ingestion_quota
before insert on public.media_ingestions
for each row execute function public.enforce_media_ingestion_quota();

create or replace function public.enforce_processing_job_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid;
begin
  if new.job_type <> 'render' then return new; end if;
  select ingestion.user_id into strict v_user_id
    from public.media_ingestions as ingestion
   where ingestion.id = new.ingestion_id
     and ingestion.deleted_at is null
     and ingestion.expires_at > now();
  perform pg_advisory_xact_lock(hashtextextended('mpe-render:' || v_user_id::text, 0));
  if not exists (
    select 1 from public.processing_jobs
     where ingestion_id = new.ingestion_id
       and job_type = 'inspect'
       and status = 'completed'
  ) then
    raise exception using errcode = '55000', message = 'successful_inspection_required';
  end if;
  if (
    select count(*)
      from public.processing_jobs as job
      join public.media_ingestions as ingestion on ingestion.id = job.ingestion_id
     where ingestion.user_id = v_user_id
       and job.job_type = 'render'
       and job.status in ('queued', 'running')
  ) >= 3 then
    raise exception using errcode = 'P0429', message = 'active_render_limit_reached';
  end if;
  if (
    select count(*)
      from public.processing_jobs as job
      join public.media_ingestions as ingestion on ingestion.id = job.ingestion_id
     where ingestion.user_id = v_user_id
       and job.job_type = 'render'
       and job.created_at >= now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0429', message = 'daily_render_limit_reached';
  end if;
  return new;
end;
$function$;
drop trigger if exists enforce_processing_job_quota on public.processing_jobs;
create trigger enforce_processing_job_quota
before insert on public.processing_jobs
for each row execute function public.enforce_processing_job_quota();

create table public.mpe_user_openrouter_daily_budget (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_day_utc date not null,
  request_count integer not null check (request_count between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_day_utc)
);
alter table public.mpe_user_openrouter_daily_budget enable row level security;
revoke all on table public.mpe_user_openrouter_daily_budget
  from public, anon, authenticated, service_role;

create or replace function public.reserve_openrouter_user_request(
  p_user_id uuid,
  p_provider text,
  p_model text
) returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_provider is distinct from 'openrouter'
     or p_model is distinct from 'stealth/ox-alpha' then
    raise exception using errcode = '22023', message = 'openrouter_provider_model_required';
  end if;
  insert into public.mpe_user_openrouter_daily_budget as budget (
    user_id, request_day_utc, request_count, updated_at
  ) values (
    p_user_id, timezone('UTC', statement_timestamp())::date, 1, statement_timestamp()
  )
  on conflict (user_id, request_day_utc) do update
     set request_count = budget.request_count + 1,
         updated_at = statement_timestamp()
   where budget.request_count < 20
  returning request_count into v_count;
  if v_count is null then
    raise exception using errcode = 'P0429', message = 'user_openrouter_daily_budget_exhausted';
  end if;
  perform public.reserve_openrouter_daily_request(p_provider, p_model);
  return v_count;
end;
$function$;
revoke all on function public.reserve_openrouter_user_request(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_openrouter_user_request(uuid, text, text)
  to service_role;

alter table public.text_segments
  add constraint text_segments_raw_text_length_check
  check (char_length(raw_text) <= 2000) not valid,
  add constraint text_segments_normalized_text_length_check
  check (normalized_text is null or char_length(normalized_text) <= 2000) not valid,
  add constraint text_segments_language_length_check
  check (language is null or char_length(language) <= 35) not valid;

create or replace function public.enforce_text_segment_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('mpe-text:' || new.ingestion_id::text, 0));
  if (select count(*) from public.text_segments where ingestion_id = new.ingestion_id) >= 200 then
    raise exception using errcode = 'P0429', message = 'text_segment_limit_reached';
  end if;
  return new;
end;
$function$;
drop trigger if exists enforce_text_segment_quota on public.text_segments;
create trigger enforce_text_segment_quota
before insert on public.text_segments
for each row execute function public.enforce_text_segment_quota();

create or replace function public.protect_support_inquiry_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'self_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('support:' || new.user_id::text, 0));
  if (
    select count(*) from public.support_inquiries
     where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0429', message = 'rate_limited';
  end if;
  new.status := 'open';
  new.admin_reply := null;
  new.replied_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;
drop trigger if exists support_inquiries_rate_limit on public.support_inquiries;
drop trigger if exists protect_support_inquiry_insert on public.support_inquiries;
create trigger protect_support_inquiry_insert
before insert on public.support_inquiries
for each row execute function public.protect_support_inquiry_insert();

create table public.submission_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index submission_attempts_user_time_idx
  on public.submission_attempts (user_id, attempted_at desc);
alter table public.submission_attempts enable row level security;
revoke all on table public.submission_attempts from public, anon, authenticated;

create or replace function public.reserve_submission_attempt()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('submission:' || v_uid::text, 0));
  if (
    select count(*) from public.submission_attempts
     where user_id = v_uid and attempted_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = 'P0429', message = 'rate_limited';
  end if;
  insert into public.submission_attempts (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_submission_attempt() from public, anon;
grant execute on function public.reserve_submission_attempt() to authenticated;

create table public.oembed_request_attempts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index oembed_request_attempts_user_time_idx
  on public.oembed_request_attempts (user_id, requested_at desc);
alter table public.oembed_request_attempts enable row level security;
revoke all on table public.oembed_request_attempts from public, anon, authenticated;

create or replace function public.reserve_oembed_request()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oembed:' || v_uid::text, 0));
  delete from public.oembed_request_attempts
   where user_id = v_uid and requested_at < now() - interval '1 day';
  if (
    select count(*) from public.oembed_request_attempts
     where user_id = v_uid and requested_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception using errcode = 'P0429', message = 'oembed_quota_exceeded';
  end if;
  insert into public.oembed_request_attempts (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_oembed_request() from public, anon;
grant execute on function public.reserve_oembed_request() to authenticated;

create or replace function public.enforce_client_growth_event_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.source <> 'client' then return new; end if;
  if new.session_id is null then
    raise exception using errcode = '22023', message = 'client_session_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('growth:' || new.session_id::text, 0));
  if (
    select count(*) from public.growth_events
     where session_id = new.session_id
       and source = 'client'
       and created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception using errcode = 'P0429', message = 'growth_event_quota_exceeded';
  end if;
  new.created_at := now();
  return new;
end;
$function$;
drop trigger if exists enforce_client_growth_event_quota on public.growth_events;
create trigger enforce_client_growth_event_quota
before insert on public.growth_events
for each row execute function public.enforce_client_growth_event_quota();

create table public.client_growth_principal_budgets (
  principal_hash text not null check (principal_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  event_count integer not null check (event_count between 1 and 120),
  primary key (principal_hash, window_started_at)
);
create index client_growth_principal_budgets_window_idx
  on public.client_growth_principal_budgets (window_started_at);
create table public.client_growth_aggregate_budgets (
  window_started_at timestamptz primary key,
  event_count integer not null check (event_count between 1 and 10000)
);
alter table public.client_growth_principal_budgets enable row level security;
alter table public.client_growth_aggregate_budgets enable row level security;
revoke all on table public.client_growth_principal_budgets
  from public, anon, authenticated, service_role;
revoke all on table public.client_growth_aggregate_budgets
  from public, anon, authenticated, service_role;

create or replace function public.reserve_client_growth_event(p_principal_hash text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_principal_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_growth_principal';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('growth-global:' || v_window::text, 0));
  delete from public.client_growth_principal_budgets
   where window_started_at < v_window - interval '7 days';
  delete from public.client_growth_aggregate_budgets
   where window_started_at < v_window - interval '7 days';
  insert into public.client_growth_aggregate_budgets as budget (
    window_started_at, event_count
  ) values (v_window, 1)
  on conflict (window_started_at) do update
     set event_count = budget.event_count + 1
   where budget.event_count < 10000
  returning event_count into v_count;
  if v_count is null then
    raise exception using errcode = 'P0429', message = 'growth_global_quota_exceeded';
  end if;
  v_count := null;
  insert into public.client_growth_principal_budgets as budget (
    principal_hash, window_started_at, event_count
  ) values (p_principal_hash, v_window, 1)
  on conflict (principal_hash, window_started_at) do update
     set event_count = budget.event_count + 1
   where budget.event_count < 120
  returning event_count into v_count;
  if v_count is null then
    raise exception using errcode = 'P0429', message = 'growth_principal_quota_exceeded';
  end if;
end;
$function$;
revoke all on function public.reserve_client_growth_event(text)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_client_growth_event(text) to service_role;

create table public.affiliate_click_events (
  product_id uuid not null references public.affiliate_products(id) on delete cascade,
  metric_date date not null,
  principal_hash text not null check (principal_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (product_id, metric_date, principal_hash)
);
alter table public.affiliate_click_events enable row level security;
revoke all on table public.affiliate_click_events from public, anon, authenticated;

create or replace function public.record_affiliate_product_click(
  product_id uuid,
  metric_date date,
  principal_hash text
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if principal_hash !~ '^[0-9a-f]{64}$'
     or metric_date < current_date - 1
     or metric_date > current_date + 1 then
    raise exception using errcode = '22023', message = 'invalid_click_event';
  end if;
  insert into public.affiliate_click_events (
    product_id, metric_date, principal_hash
  ) values (
    record_affiliate_product_click.product_id,
    record_affiliate_product_click.metric_date,
    record_affiliate_product_click.principal_hash
  )
  on conflict do nothing;
  if found then
    insert into public.affiliate_product_daily_metrics(product_id, metric_date, clicks)
    values (
      record_affiliate_product_click.product_id,
      record_affiliate_product_click.metric_date,
      1
    )
    on conflict (product_id, metric_date)
    do update set clicks = public.affiliate_product_daily_metrics.clicks + 1;
  end if;
end;
$function$;
revoke all on function public.record_affiliate_product_click(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.record_affiliate_product_click(uuid, date, text)
  to service_role;
revoke execute on function public.record_affiliate_product_click(uuid, date)
  from service_role;

create or replace function public.audit_operator_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if public.is_operator() then
    insert into public.admin_audit_log (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      auth.uid(),
      'db.' || lower(tg_op),
      tg_table_name,
      v_row ->> 'id',
      jsonb_build_object('source', 'database_trigger')
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists audit_operator_mutation on public.meme_submissions;
create trigger audit_operator_mutation
after insert or update or delete on public.meme_submissions
for each row execute function public.audit_operator_mutation();
drop trigger if exists audit_operator_mutation on public.memes;
create trigger audit_operator_mutation
after insert or update or delete on public.memes
for each row execute function public.audit_operator_mutation();
drop trigger if exists audit_operator_mutation on public.reports;
create trigger audit_operator_mutation
after insert or update or delete on public.reports
for each row execute function public.audit_operator_mutation();
drop trigger if exists audit_operator_mutation on public.discussions;
create trigger audit_operator_mutation
after insert or update or delete on public.discussions
for each row execute function public.audit_operator_mutation();

create table public.feature_controls (
  feature text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);
insert into public.feature_controls (feature, enabled)
values ('community_writes', true);
alter table public.feature_controls enable row level security;
revoke all on table public.feature_controls from public, anon, authenticated;

create or replace function public.set_feature_control(
  p_feature text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.is_operator()
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_feature <> 'community_writes' then
    raise exception using errcode = '22023', message = 'unknown_feature';
  end if;
  update public.feature_controls
     set enabled = p_enabled, updated_at = now()
   where feature = p_feature;
end;
$function$;
revoke all on function public.set_feature_control(text, boolean) from public, anon;
grant execute on function public.set_feature_control(text, boolean)
  to authenticated, service_role;

create or replace function public.enforce_community_write_control()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if not public.is_operator()
     and not coalesce((
       select enabled from public.feature_controls where feature = 'community_writes'
     ), false) then
    raise exception using errcode = '55000', message = 'community_disabled';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists enforce_community_write_control on public.community_posts;
create trigger enforce_community_write_control
before insert or update or delete on public.community_posts
for each row execute function public.enforce_community_write_control();
drop trigger if exists enforce_community_write_control on public.community_comments;
create trigger enforce_community_write_control
before insert or update or delete on public.community_comments
for each row execute function public.enforce_community_write_control();
drop trigger if exists enforce_community_write_control on public.community_post_likes;
create trigger enforce_community_write_control
before insert or update or delete on public.community_post_likes
for each row execute function public.enforce_community_write_control();
drop trigger if exists enforce_community_write_control on public.meme_reactions;
create trigger enforce_community_write_control
before insert or update or delete on public.meme_reactions
for each row execute function public.enforce_community_write_control();
drop trigger if exists enforce_community_write_control on public.generation_votes;
create trigger enforce_community_write_control
before insert or update or delete on public.generation_votes
for each row execute function public.enforce_community_write_control();
drop trigger if exists enforce_community_write_control on public.discussions;
create trigger enforce_community_write_control
before insert or update or delete on public.discussions
for each row execute function public.enforce_community_write_control();

create or replace function public.create_billing_order(
  p_request_id text,
  p_growth_session_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_request_id text := btrim(p_request_id);
  v_order public.billing_orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if v_request_id is null or v_request_id = '' or char_length(v_request_id) > 200 then
    raise exception using errcode = '22023', message = 'invalid_request_id';
  end if;

  select orders.* into v_order
    from public.billing_orders as orders
   where orders.request_id = v_request_id;
  if found then
    if v_order.user_id is distinct from v_user_id then
      raise exception using errcode = '23505', message = 'request_owner_conflict';
    end if;
    perform public.record_growth_checkout_events(v_request_id, p_growth_session_id);
    return jsonb_build_object(
      'id', v_order.id, 'requestId', v_order.request_id, 'status', v_order.status
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing:' || v_user_id::text, 0));
  if (
    select count(*) from public.billing_orders
     where user_id = v_user_id
       and status = 'PENDING'
       and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception using errcode = 'P0429', message = 'billing_order_quota_exceeded';
  end if;

  insert into public.billing_orders (user_id, request_id)
  values (v_user_id, v_request_id)
  returning * into v_order;
  perform public.record_growth_checkout_events(v_request_id, p_growth_session_id);
  return jsonb_build_object(
    'id', v_order.id, 'requestId', v_order.request_id, 'status', v_order.status
  );
end;
$function$;

create table public.meme_export_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index meme_export_requests_user_time_idx
  on public.meme_export_requests (user_id, requested_at desc);
alter table public.meme_export_requests enable row level security;
revoke all on table public.meme_export_requests from public, anon, authenticated;

create or replace function public.reserve_meme_export()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('meme-export:' || v_uid::text, 0));
  if (
    select count(*) from public.meme_export_requests
     where user_id = v_uid and requested_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception using errcode = 'P0429', message = 'export_quota_exceeded';
  end if;
  insert into public.meme_export_requests (user_id) values (v_uid);
end;
$function$;
revoke all on function public.reserve_meme_export() from public, anon;
grant execute on function public.reserve_meme_export() to authenticated;

create or replace function public.search_memes(p_query text, p_limit int default 20)
returns setof public.memes
language sql
stable
security definer
set search_path = public
as $function$
  select meme.* from public.memes as meme
   where char_length(btrim(p_query)) between 1 and 100
     and meme.moderation_status in ('approved', 'limited')
     and (
       meme.title ilike '%' || btrim(p_query) || '%'
       or meme.summary ilike '%' || btrim(p_query) || '%'
       or meme.title_chosung ilike '%' || btrim(p_query) || '%'
       or exists (
         select 1 from unnest(meme.aliases) as alias
          where alias ilike '%' || btrim(p_query) || '%'
       )
       or similarity(meme.title, btrim(p_query)) > 0.25
     )
   order by
     (meme.title ilike '%' || btrim(p_query) || '%') desc,
     similarity(meme.title, btrim(p_query)) desc,
     meme.trend_score desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

create or replace function public.toggle_reaction(
  p_meme_id uuid,
  p_reaction public.reaction_type
) returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '42501', message = 'meme_not_public';
  end if;
  delete from public.meme_reactions
   where user_id = auth.uid() and meme_id = p_meme_id and reaction = p_reaction;
  if found then
    v_removed := true;
  else
    insert into public.meme_reactions (user_id, meme_id, reaction)
    values (auth.uid(), p_meme_id, p_reaction);
  end if;
  return not v_removed;
end;
$function$;

create or replace function public.toggle_save(p_meme_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '42501', message = 'meme_not_public';
  end if;
  delete from public.saved_memes where user_id = auth.uid() and meme_id = p_meme_id;
  if found then
    v_removed := true;
  else
    insert into public.saved_memes (user_id, meme_id) values (auth.uid(), p_meme_id);
  end if;
  return not v_removed;
end;
$function$;

create or replace function public.cast_generation_vote(
  p_meme_id uuid,
  p_age_group text,
  p_vote text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (
    select 1 from public.memes
     where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '42501', message = 'meme_not_public';
  end if;
  insert into public.generation_votes (user_id, meme_id, age_group, vote)
  values (auth.uid(), p_meme_id, p_age_group, p_vote)
  on conflict (user_id, meme_id)
  do update set age_group = excluded.age_group, vote = excluded.vote;
end;
$function$;

create or replace function public.can_store_meme_upload(
  p_name text,
  p_size bigint
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text;
  v_total bigint;
  v_count integer;
begin
  if v_uid is null or p_size not between 1 and 20971520 then return false; end if;
  v_prefix := v_uid::text || '/';
  if p_name not like (v_prefix || '%') or p_name like '%..%' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('upload:' || v_uid::text, 0));
  select count(*), coalesce(sum(
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
      then (metadata ->> 'size')::bigint else 0 end
  ), 0)
    into v_count, v_total
    from storage.objects
   where bucket_id = 'meme-uploads' and name like v_prefix || '%';
  return v_count < 20 and v_total + p_size <= 104857600;
end;
$function$;
revoke all on function public.can_store_meme_upload(text, bigint) from public, anon;
grant execute on function public.can_store_meme_upload(text, bigint) to authenticated;

update storage.buckets
   set public = false,
       file_size_limit = 20971520,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm'
       ]
 where id = 'meme-uploads';
drop policy if exists meme_uploads_public_read on storage.objects;
drop policy if exists "meme_uploads_public_read" on storage.objects;
drop policy if exists meme_uploads_controlled_read on storage.objects;
create policy meme_uploads_controlled_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meme-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.meme_submissions as submission
         where submission.attachment_path = 'meme-uploads/' || storage.objects.name
           and submission.status = 'approved'
      )
    )
  );
drop policy if exists meme_uploads_auth_insert on storage.objects;
drop policy if exists "meme_uploads_auth_insert" on storage.objects;
create policy meme_uploads_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meme-uploads'
    and public.can_store_meme_upload(
      name,
      case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
        then (metadata ->> 'size')::bigint else 0 end
    )
  );

commit;
