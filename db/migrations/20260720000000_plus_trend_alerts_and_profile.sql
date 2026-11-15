-- Plus 혜택 확장:
--   A1) 트렌드 알림 — 관심 카테고리에서 급상승(rising)한 밈을 인앱 알림으로 팬아웃.
--   C1) 프로필 커스터마이징 — Plus 전용 flair(칭호)·accent 색상.
-- 결제 상태는 profiles(공개 읽기)에 두지 않는 원칙에 따라, 알림/커스터마이징도
-- 별도 테이블 + Plus 게이팅 RPC로만 쓰기가 가능하게 한다. has_active_plus()는
-- 20260719160000 마이그레이션에서 정의됨.

-- ── A1: 트렌드 알림 ─────────────────────────────────────────────
create table if not exists public.trend_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  meme_id uuid not null references public.memes(id) on delete cascade,
  kind text not null default 'rising' check (kind in ('rising')),
  trend_score double precision not null default 0,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, meme_id, kind)
);

create index if not exists trend_alerts_user_idx
  on public.trend_alerts (user_id, created_at desc);

alter table public.trend_alerts enable row level security;

-- 본인 알림만 읽는다. 쓰기 정책 없음 → 삽입은 service_role(cron)/definer RPC로만.
drop policy if exists trend_alerts_self_read on public.trend_alerts;
create policy trend_alerts_self_read on public.trend_alerts
  for select using (user_id = (select auth.uid()));

grant select on public.trend_alerts to authenticated;

-- 팬아웃: Plus 사용자별로 관심 카테고리의 rising 밈을 알림으로 삽입.
-- unique 제약으로 같은 밈은 사용자당 1회만 알림. 사용자당 상위 15개로 제한해 폭주 방지.
create or replace function public.fan_out_trend_alerts()
returns integer language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  with plus_users as (
    select p.id as user_id, p.interests
    from public.profiles p
    where coalesce(array_length(p.interests, 1), 0) > 0
      and public.has_active_plus(p.id)
  ),
  candidates as (
    select
      pu.user_id,
      m.id as meme_id,
      m.trend_score,
      row_number() over (
        partition by pu.user_id
        order by m.trend_score desc, m.published_at desc nulls last
      ) as rn
    from plus_users pu
    join public.memes m
      on m.category::text = any(pu.interests)
     and m.lifecycle_status = 'rising'
     and m.moderation_status in ('approved', 'limited')
     and m.published_at > now() - interval '14 days'
  ),
  ins as (
    insert into public.trend_alerts (user_id, meme_id, kind, trend_score)
    select user_id, meme_id, 'rising', trend_score
    from candidates
    where rn <= 15
    on conflict (user_id, meme_id, kind) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  -- 오래된 알림 정리(30일). 여전히 rising이면 다음 실행에서 재알림될 수 있으나 허용.
  delete from public.trend_alerts where created_at < now() - interval '30 days';

  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.fan_out_trend_alerts() from public, anon, authenticated;
grant execute on function public.fan_out_trend_alerts() to service_role;

-- 읽음 처리 — 본인 미읽음 알림 전체를 읽음으로.
create or replace function public.mark_trend_alerts_read()
returns integer language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then raise exception using errcode='42501', message='auth_required'; end if;
  update public.trend_alerts set read_at = now()
   where user_id = v_uid and read_at is null;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.mark_trend_alerts_read() from public, anon;
grant execute on function public.mark_trend_alerts_read() to authenticated;

-- cron(admin=service_role)이 롤업 함수를 호출할 수 있도록 보장(멱등).
grant execute on function public.compute_trend_scores() to service_role;

-- ── C1: 프로필 커스터마이징 (Plus 전용) ─────────────────────────
create table if not exists public.profile_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  flair text
    check (flair is null or (btrim(flair) <> '' and char_length(flair) <= 24)),
  accent_color text
    check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);

alter table public.profile_customizations enable row level security;

-- 커스터마이징은 장식용(결제 정보 아님)이라 공개 읽기 허용. 쓰기는 정책 없음 → definer RPC로만.
drop policy if exists profile_customizations_public_read on public.profile_customizations;
create policy profile_customizations_public_read on public.profile_customizations
  for select using (true);

grant select on public.profile_customizations to anon, authenticated;

create or replace function public.update_profile_customization(p_flair text, p_accent text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_flair text := nullif(btrim(coalesce(p_flair, '')), '');
  v_accent text := nullif(btrim(coalesce(p_accent, '')), '');
begin
  if v_uid is null then raise exception using errcode='42501', message='auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode='42501', message='plus_required'; end if;
  if v_flair is not null and char_length(v_flair) > 24 then raise exception using errcode='22023', message='flair_too_long'; end if;
  if v_accent is not null and v_accent !~ '^#[0-9a-fA-F]{6}$' then raise exception using errcode='22023', message='invalid_color'; end if;

  insert into public.profile_customizations (user_id, flair, accent_color, updated_at)
  values (v_uid, v_flair, v_accent, now())
  on conflict (user_id) do update
    set flair = excluded.flair, accent_color = excluded.accent_color, updated_at = now();

  return jsonb_build_object('flair', v_flair, 'accentColor', v_accent);
end;
$function$;

revoke all on function public.update_profile_customization(text, text) from public, anon;
grant execute on function public.update_profile_customization(text, text) to authenticated;
