create table if not exists public.meme_public_change_events (
  id bigint generated always as identity primary key,
  meme_id uuid not null references public.memes(id) on delete cascade,
  kind text not null check (kind in (
    'editorial_update',
    'safety_update',
    'translation_reviewed',
    'translation_stale',
    'lifecycle_update'
  )),
  locale text check (locale is null or locale in ('en', 'ja', 'zh', 'zh-tw')),
  source_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists meme_public_change_events_identity_idx
  on public.meme_public_change_events (
    meme_id,
    kind,
    coalesce(locale, ''),
    source_updated_at
  );
create index if not exists meme_public_change_events_recent_idx
  on public.meme_public_change_events (created_at desc, meme_id);

alter table public.meme_public_change_events enable row level security;

drop policy if exists meme_public_change_events_authenticated_read
  on public.meme_public_change_events;
create policy meme_public_change_events_authenticated_read
  on public.meme_public_change_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.memes
      where memes.id = meme_public_change_events.meme_id
        and memes.moderation_status in ('approved', 'limited')
    )
  );

grant select on public.meme_public_change_events to authenticated;

create table if not exists public.plus_saved_context_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id bigint not null references public.meme_public_change_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, event_id)
);

create index if not exists plus_saved_context_alerts_user_idx
  on public.plus_saved_context_alerts (user_id, created_at desc);

alter table public.plus_saved_context_alerts enable row level security;

drop policy if exists plus_saved_context_alerts_self_read
  on public.plus_saved_context_alerts;
create policy plus_saved_context_alerts_self_read
  on public.plus_saved_context_alerts
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.plus_saved_context_alerts to authenticated;

create or replace function public.record_meme_public_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.moderation_status not in ('approved', 'limited') then
    return new;
  end if;

  if (
    old.moderation_status not in ('approved', 'limited')
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.description is distinct from old.description
    or new.origin is distinct from old.origin
    or new.usage_note is distinct from old.usage_note
    or new.caution is distinct from old.caution
    or new.aliases is distinct from old.aliases
    or new.usage_examples is distinct from old.usage_examples
  ) then
    insert into public.meme_public_change_events (meme_id, kind, source_updated_at)
    values (new.id, 'editorial_update', coalesce(new.updated_at, now()))
    on conflict do nothing;
  end if;

  if new.safety_level is distinct from old.safety_level then
    insert into public.meme_public_change_events (meme_id, kind, source_updated_at)
    values (new.id, 'safety_update', coalesce(new.updated_at, now()))
    on conflict do nothing;
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    insert into public.meme_public_change_events (meme_id, kind, source_updated_at)
    values (new.id, 'lifecycle_update', now())
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists record_meme_public_change_after_update on public.memes;
create trigger record_meme_public_change_after_update
after update of title, summary, description, origin, usage_note, caution,
  aliases, usage_examples, safety_level, lifecycle_status, moderation_status
on public.memes
for each row execute function public.record_meme_public_change();

create or replace function public.record_translation_public_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'reviewed' then
      insert into public.meme_public_change_events (
        meme_id, kind, locale, source_updated_at
      )
      values (new.meme_id, 'translation_reviewed', new.locale, new.updated_at)
      on conflict do nothing;
    end if;
    return new;
  end if;

  if new.status = 'stale' and old.status is distinct from new.status then
    insert into public.meme_public_change_events (
      meme_id, kind, locale, source_updated_at
    )
    values (new.meme_id, 'translation_stale', new.locale, new.updated_at)
    on conflict do nothing;
  elsif new.status = 'reviewed' and (
    old.status is distinct from new.status
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.description is distinct from old.description
    or new.origin is distinct from old.origin
    or new.usage_note is distinct from old.usage_note
    or new.caution is distinct from old.caution
    or new.aliases is distinct from old.aliases
    or new.usage_examples is distinct from old.usage_examples
  ) then
    insert into public.meme_public_change_events (
      meme_id, kind, locale, source_updated_at
    )
    values (new.meme_id, 'translation_reviewed', new.locale, new.updated_at)
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists record_translation_public_change_after_write
  on public.meme_translations;
create trigger record_translation_public_change_after_write
after insert or update of status, title, summary, description, origin,
  usage_note, caution, aliases, usage_examples
on public.meme_translations
for each row execute function public.record_translation_public_change();

create or replace function public.fan_out_saved_context_alerts()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  with candidates as (
    select
      sm.user_id,
      e.id as event_id,
      e.created_at
    from public.saved_memes sm
    join public.meme_public_change_events e on e.meme_id = sm.meme_id
    join public.memes m on m.id = e.meme_id
    where public.has_active_plus(sm.user_id)
      and e.created_at > sm.created_at
      and e.created_at > now() - interval '30 days'
      and m.moderation_status in ('approved', 'limited')
  ),
  ranked as (
    select
      user_id,
      event_id,
      row_number() over (
        partition by user_id
        order by created_at desc, event_id desc
      ) as rn
    from candidates
  ),
  ins as (
    insert into public.plus_saved_context_alerts (user_id, event_id)
    select user_id, event_id
    from ranked
    where rn <= 30
    on conflict (user_id, event_id) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  delete from public.plus_saved_context_alerts
  where created_at < now() - interval '30 days';
  delete from public.meme_public_change_events
  where created_at < now() - interval '90 days';

  return coalesce(v_count, 0);
end;
$function$;

create or replace function public.mark_saved_context_alerts_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if not public.has_active_plus(v_uid) then
    raise exception using errcode = '42501', message = 'plus_required';
  end if;

  update public.plus_saved_context_alerts
  set read_at = now()
  where user_id = v_uid and read_at is null;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.record_meme_public_change() from public, anon, authenticated;
revoke all on function public.record_translation_public_change() from public, anon, authenticated;
revoke all on function public.fan_out_saved_context_alerts() from public, anon, authenticated;
grant execute on function public.fan_out_saved_context_alerts() to service_role;
revoke all on function public.mark_saved_context_alerts_read() from public, anon;
grant execute on function public.mark_saved_context_alerts_read() to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'memecatch-daily-saved-context-alerts';

select cron.schedule(
  'memecatch-daily-saved-context-alerts',
  '40 15 * * *',
  'select public.fan_out_saved_context_alerts();'
);

do $function$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'memecatch-daily-saved-context-alerts'
      and schedule = '40 15 * * *'
      and command = 'select public.fan_out_saved_context_alerts();'
  ) then
    raise exception 'memecatch-daily-saved-context-alerts cron was not scheduled';
  end if;
end
$function$;
