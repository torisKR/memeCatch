-- 커뮤니티 밈대결: 오늘·이번 주·이번 달(KST) 좋아요 순위와 상위 1% 승격
-- 원칙: 순위는 공개 읽기, 승격은 운영자/스케줄러만. 승격된 글은 바로 공개 밈이 되지 않고
-- meme_submissions(pending)로 들어가 기존 운영자 검수(사실 확인 → 저작권 확인)를 거친다.

-- ── 기간 계산 ───────────────────────────────────────────────
-- 기간 이름: 'day' | 'week' | 'month'. 주는 월요일 시작(ISO), 모두 Asia/Seoul 기준.
create or replace function public.community_period_start(p_period text, p_at timestamptz default now())
returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Seoul';
begin
  if p_period = 'day' then
    return date_trunc('day', v_local) at time zone 'Asia/Seoul';
  elsif p_period = 'week' then
    return date_trunc('week', v_local) at time zone 'Asia/Seoul';
  elsif p_period = 'month' then
    return date_trunc('month', v_local) at time zone 'Asia/Seoul';
  end if;
  raise exception 'invalid_period' using errcode = '22023';
end $$;

create or replace function public.community_period_end(p_period text, p_at timestamptz default now())
returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  v_start timestamptz := public.community_period_start(p_period, p_at);
  v_local timestamp := v_start at time zone 'Asia/Seoul';
begin
  if p_period = 'day' then
    return (v_local + interval '1 day') at time zone 'Asia/Seoul';
  elsif p_period = 'week' then
    return (v_local + interval '7 days') at time zone 'Asia/Seoul';
  end if;
  return (v_local + interval '1 month') at time zone 'Asia/Seoul';
end $$;

-- 기간 안의 글 N개 중 승격할 개수: 상위 1%를 올림. 글이 1~100개면 1개, 101~200개면 2개.
create or replace function public.community_promotion_count(p_total integer)
returns integer
language sql immutable as $$
  select case when coalesce(p_total, 0) <= 0 then 0 else ceil(p_total * 0.01)::integer end
$$;

-- ── 순위 (공개 읽기) ────────────────────────────────────────
-- 기간 안에 올라온 공개 글을 좋아요 순으로 정렬한다. 같은 좋아요면 먼저 올린 글이 앞선다.
-- is_promotion_candidate: 상위 1% 안이면서 좋아요가 1개 이상인 글.
create or replace function public.community_meme_battle(p_period text, p_limit integer default 10)
returns table (
  post_id uuid,
  title text,
  like_count integer,
  comment_count integer,
  meme_id uuid,
  created_at timestamptz,
  rank integer,
  total_posts integer,
  promotion_count integer,
  is_promotion_candidate boolean,
  period_start timestamptz,
  period_end timestamptz
)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select public.community_period_start(p_period) as s, public.community_period_end(p_period) as e
  ), ranked as (
    select cp.id, cp.title, cp.like_count, cp.comment_count, cp.meme_id, cp.created_at,
      row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
      count(*) over ()::integer as n
    from public.community_posts cp, bounds b
    where cp.status = 'visible' and cp.created_at >= b.s and cp.created_at < b.e
  )
  select r.id, r.title, r.like_count, r.comment_count, r.meme_id, r.created_at, r.rn, r.n,
    public.community_promotion_count(r.n),
    (r.rn <= public.community_promotion_count(r.n) and r.like_count > 0),
    b.s, b.e
  from ranked r, bounds b
  order by r.rn
  limit least(greatest(coalesce(p_limit, 10), 0), 50)
$$;
grant execute on function public.community_meme_battle(text, integer) to anon, authenticated;

-- ── 승격 기록 ───────────────────────────────────────────────
create table if not exists public.community_meme_promotions (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('day', 'week', 'month')),
  period_start timestamptz not null,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  rank integer not null check (rank >= 1),
  like_count integer not null check (like_count >= 0),
  total_posts integer not null check (total_posts >= 1),
  submission_id uuid references public.meme_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (period_type, period_start, post_id)
);
create index if not exists idx_community_meme_promotions_post on public.community_meme_promotions (post_id);
alter table public.community_meme_promotions enable row level security;
drop policy if exists community_meme_promotions_read on public.community_meme_promotions;
create policy community_meme_promotions_read on public.community_meme_promotions for select using (true);
-- INSERT/UPDATE/DELETE 정책 없음 = 직접 쓰기 거부 (아래 함수 경유만)

-- 끝난 기간의 상위 1%를 승격한다. p_at은 그 기간 안의 아무 시각(스케줄러는 기간이 끝난 직후의 '조금 전').
-- 이미 승격한 글은 다시 넣지 않으므로 여러 번 실행해도 결과가 같다.
create or replace function public.promote_community_top_memes(p_period text, p_at timestamptz)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := public.community_period_start(p_period, p_at);
  v_end timestamptz := public.community_period_end(p_period, p_at);
  v_label text := case p_period when 'day' then '오늘의 밈' when 'week' then '이번 주 밈' else '이번 달 밈' end;
  v_count integer := 0;
  v_row record;
  v_submission uuid;
begin
  -- 로그인 사용자는 운영자만. 스케줄러(pg_cron)는 auth.uid()가 없다.
  if auth.uid() is not null and not public.is_operator() then
    raise exception 'operator_required' using errcode = '42501';
  end if;
  if v_end > now() then
    raise exception 'period_not_finished' using errcode = '22023';
  end if;

  for v_row in
    with ranked as (
      select cp.id, cp.user_id, cp.title, cp.body, cp.meme_id, cp.like_count,
        row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
        count(*) over ()::integer as n
      from public.community_posts cp
      where cp.status = 'visible' and cp.created_at >= v_start and cp.created_at < v_end
    )
    select r.* from ranked r
    where r.rn <= public.community_promotion_count(r.n) and r.like_count > 0
      and not exists (
        select 1 from public.community_meme_promotions p
        where p.period_type = p_period and p.period_start = v_start and p.post_id = r.id
      )
    order by r.rn
  loop
    insert into public.meme_submissions (submitter_id, name, description, tags, status)
    values (
      v_row.user_id,
      left(v_row.title, 100),
      left(v_row.body, 2000),
      array['커뮤니티 밈대결', v_label],
      'pending'
    )
    returning id into v_submission;

    insert into public.community_meme_promotions
      (period_type, period_start, post_id, rank, like_count, total_posts, submission_id)
    values (p_period, v_start, v_row.id, v_row.rn, v_row.like_count, v_row.n, v_submission);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
revoke all on function public.promote_community_top_memes(text, timestamptz) from public, anon;
grant execute on function public.promote_community_top_memes(text, timestamptz) to authenticated;

-- ── 스케줄 (UTC 기준, KST = UTC+9) ─────────────────────────
-- 매일 00:05 KST: 어제 / 매주 월 00:10 KST: 지난주 / 매달 1일 00:15 KST: 지난달
select cron.unschedule(jobid) from cron.job
where jobname in ('memecatch-community-battle-day', 'memecatch-community-battle-week', 'memecatch-community-battle-month');
select cron.schedule('memecatch-community-battle-day', '5 15 * * *',
  $$select public.promote_community_top_memes('day', now() - interval '10 minutes');$$);
select cron.schedule('memecatch-community-battle-week', '10 15 * * 0',
  $$select public.promote_community_top_memes('week', now() - interval '15 minutes');$$);
select cron.schedule('memecatch-community-battle-month', '15 15 * * *',
  $$select public.promote_community_top_memes('month', now() - interval '20 minutes')
    where extract(day from now() at time zone 'Asia/Seoul') = 1;$$);
