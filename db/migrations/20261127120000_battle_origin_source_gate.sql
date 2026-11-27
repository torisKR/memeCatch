-- 밈대결 원본 출처 자격 게이트 (DB 단일 기준)
--
-- 원본 출처가 확인된 항목만 밈대결(community_meme_battle) 및 상위 1% 승격
-- (promote_community_top_memes)에 오르도록 구조화 컬럼과 공통 판정 함수를 도입한다.
-- 원본 출처가 없는 커뮤니티 글은 삭제/숨김하지 않고 /community 게시판에는 유지한다.

begin;

alter table public.community_posts
  add column if not exists origin_source_url text,
  add column if not exists origin_source_platform text,
  add column if not exists origin_source_availability public.availability_status not null default 'unchecked',
  add column if not exists origin_source_checked_at timestamptz;

alter table public.community_posts
  drop constraint if exists community_posts_origin_source_url_check,
  drop constraint if exists community_posts_origin_source_platform_check,
  drop constraint if exists community_posts_origin_source_pair_check;

alter table public.community_posts
  add constraint community_posts_origin_source_url_check
    check (origin_source_url is null or origin_source_url ~* '^https://'),
  add constraint community_posts_origin_source_platform_check
    check (
      origin_source_platform is null
      or origin_source_platform in (
        'youtube',
        'youtube_shorts',
        'tiktok',
        'instagram',
        'x',
        'threads'
      )
    ),
  add constraint community_posts_origin_source_pair_check
    check ((origin_source_url is null) = (origin_source_platform is null));

create index if not exists idx_community_posts_battle_origin
  on public.community_posts (created_at desc, like_count desc)
  where status = 'visible'
    and origin_source_availability not in ('dead', 'region_blocked');

comment on column public.community_posts.origin_source_url is
  '정규화된 원본 출처 URL (YouTube/Shorts/TikTok/Instagram/X/Threads). 밈대결 참가 자격의 기준.';
comment on column public.community_posts.origin_source_platform is
  '원본 출처 플랫폼 식별자 (youtube, youtube_shorts, tiktok, instagram, x, threads).';
comment on column public.community_posts.origin_source_availability is
  '원본 출처 생존 상태. dead/region_blocked가 되면 밈대결에서 자동 제외된다.';
comment on column public.community_posts.origin_source_checked_at is
  '데드링크 크론이 원본 출처를 마지막으로 확인한 시각.';

-- ── 사전 밈의 살아있는 원본 출처 보유 여부 ─────────────────────
create or replace function public.meme_has_live_origin(p_meme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memes m
    where m.id = p_meme_id
      and m.moderation_status = 'approved'
      and (
        -- 1. 밈캐치 자체 제작 + 권리 근거 충족
        (
          m.origin_kind = 'house_original'
          and public.house_original_has_rights_evidence(m.id)
        )
        -- 2. 승인·생존 중인 원본 플랫폼 미디어 콘텐츠 보유
        or exists (
          select 1
          from public.meme_contents c
          where c.meme_id = m.id
            and c.moderation_status = 'approved'
            and c.availability not in ('dead', 'region_blocked')
            and c.type in ('video', 'embed')
            and c.url is not null
            and (
              c.url ~* '^https://([a-z0-9-]+\.)?(youtube\.com/(watch\?|shorts/|embed/)|youtu\.be/)'
              or c.url ~* '^https://([a-z0-9-]+\.)?tiktok\.com/.+/video/[0-9]{10,25}(/|\?|$)'
              or c.url ~* '^https://([a-z0-9-]+\.)?instagram\.com/(reel|tv)/[A-Za-z0-9_-]{5,80}(/|\?|$)'
              or (
                c.url ~* '^https://([a-z0-9-]+\.)?instagram\.com/p/[A-Za-z0-9_-]{5,80}(/|\?|$)'
                and c.manual_video_verified = true
              )
              or c.url ~* '^https://([a-z0-9-]+\.)?(x\.com|twitter\.com)/[^/?#]+/status/[0-9]+(/|\?|$)'
              or c.url ~* '^https://([a-z0-9-]+\.)?threads\.(net|com)/.+'
            )
            and not exists (
              select 1
              from public.meme_media mm
              join public.media_sources ms on ms.id = mm.source_id
              where mm.meme_id = m.id
                and (
                  (c.content_id is not null and ms.external_id = c.content_id)
                  or ms.canonical_url = c.url
                )
                and (
                  mm.review_state in ('rejected', 'removed')
                  or ms.removed_at is not null
                )
            )
        )
        -- 3. 검수 완료된 원본/공식 재업로드/최초 확인 출처 원장 보유
        or exists (
          select 1
          from public.meme_media mm
          join public.media_sources ms on ms.id = mm.source_id
          where mm.meme_id = m.id
            and mm.review_state = 'approved'
            and mm.source_role in ('original', 'official_reupload', 'earliest_known')
            and ms.removed_at is null
            and coalesce(ms.public_status, 'public') <> 'private'
            and ms.platform in ('youtube', 'youtube_shorts', 'tiktok', 'instagram')
        )
      )
  )
$$;

revoke all on function public.meme_has_live_origin(uuid) from public;
grant execute on function public.meme_has_live_origin(uuid) to anon, authenticated, service_role;

-- ── 커뮤니티 글의 밈대결 참가 자격 판정 (단일 게이트) ──────────
create or replace function public.community_post_is_battle_eligible(
  p_status text,
  p_origin_url text,
  p_origin_platform text,
  p_origin_availability public.availability_status,
  p_meme_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_status = 'visible'
    and (
      case
        when p_origin_url is not null then
          p_origin_platform in ('youtube', 'youtube_shorts', 'tiktok', 'instagram', 'x', 'threads')
          and coalesce(p_origin_availability, 'unchecked') not in ('dead', 'region_blocked')
        when p_meme_id is not null then
          public.meme_has_live_origin(p_meme_id)
        else
          false
      end
    )
$$;

revoke all on function public.community_post_is_battle_eligible(
  text, text, text, public.availability_status, uuid
) from public;
grant execute on function public.community_post_is_battle_eligible(
  text, text, text, public.availability_status, uuid
) to anon, authenticated, service_role;

-- ── 밈대결 순위 RPC (원본 자격 게이트 적용) ────────────────────
create or replace function public.community_meme_battle(
  p_period text,
  p_limit integer default 10
)
returns table(
  post_id uuid,
  title text,
  like_count integer,
  comment_count integer,
  meme_id uuid,
  created_at timestamp with time zone,
  rank integer,
  total_posts integer,
  promotion_count integer,
  is_promotion_candidate boolean,
  period_start timestamp with time zone,
  period_end timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select public.community_period_start(p_period) as s, public.community_period_end(p_period) as e
  ), ranked as (
    select cp.id, cp.title, cp.like_count, cp.comment_count, cp.meme_id, cp.created_at,
      row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
      count(*) over ()::integer as n
    from public.community_posts cp, bounds b
    where cp.status = 'visible'
      and cp.created_at >= b.s
      and cp.created_at < b.e
      and public.community_post_is_battle_eligible(
        cp.status,
        cp.origin_source_url,
        cp.origin_source_platform,
        cp.origin_source_availability,
        cp.meme_id
      )
  )
  select r.id, r.title, r.like_count, r.comment_count, r.meme_id, r.created_at, r.rn, r.n,
    public.community_promotion_count(r.n),
    (r.rn <= public.community_promotion_count(r.n) and r.like_count > 0),
    b.s, b.e
  from ranked r, bounds b
  order by r.rn
  limit least(greatest(coalesce(p_limit, 10), 0), 50)
$$;

revoke all on function public.community_meme_battle(text, integer) from public;
grant execute on function public.community_meme_battle(text, integer) to anon, authenticated, service_role;

-- ── 상위 1% 승격 RPC (동일 게이트 + source_url 전파) ───────────
create or replace function public.promote_community_top_memes(
  p_period text,
  p_at timestamp with time zone
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
      select cp.id, cp.user_id, cp.title, cp.body, cp.meme_id, cp.like_count, cp.origin_source_url,
        row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
        count(*) over ()::integer as n
      from public.community_posts cp
      where cp.status = 'visible'
        and cp.created_at >= v_start
        and cp.created_at < v_end
        and public.community_post_is_battle_eligible(
          cp.status,
          cp.origin_source_url,
          cp.origin_source_platform,
          cp.origin_source_availability,
          cp.meme_id
        )
    )
    select r.* from ranked r
    where r.rn <= public.community_promotion_count(r.n) and r.like_count > 0
      and not exists (
        select 1 from public.community_meme_promotions p
        where p.period_type = p_period and p.period_start = v_start and p.post_id = r.id
      )
    order by r.rn
  loop
    insert into public.meme_submissions (submitter_id, name, source_url, description, tags, status)
    values (
      v_row.user_id,
      left(v_row.title, 100),
      v_row.origin_source_url,
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

revoke execute on function public.promote_community_top_memes(text, timestamp with time zone) from public, anon;
grant execute on function public.promote_community_top_memes(text, timestamp with time zone) to authenticated, service_role;

-- ── 커뮤니티 글 작성 RPC 확장 (하위 호환 3인자 호출 유지) ──────
drop function if exists public.create_community_post(text, text, uuid);

create or replace function public.create_community_post(
  p_title text,
  p_body text,
  p_meme_id uuid default null,
  p_origin_source_url text default null,
  p_origin_source_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_url text := nullif(btrim(coalesce(p_origin_source_url, '')), '');
  v_platform text := nullif(btrim(coalesce(p_origin_source_platform, '')), '');
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('community_posts', 5, 60);
  if p_meme_id is not null and not exists (
    select 1 from memes where id = p_meme_id and moderation_status in ('approved', 'limited')
  ) then
    raise exception 'invalid_meme';
  end if;
  if (v_url is null) <> (v_platform is null) then
    raise exception 'invalid_origin_source' using errcode = '22023';
  end if;
  if v_url is not null and (
    v_url !~* '^https://'
    or v_platform not in ('youtube', 'youtube_shorts', 'tiktok', 'instagram', 'x', 'threads')
  ) then
    raise exception 'invalid_origin_source' using errcode = '22023';
  end if;
  insert into public.community_posts (
    user_id, title, body, meme_id, origin_source_url, origin_source_platform
  )
  values (auth.uid(), p_title, p_body, p_meme_id, v_url, v_platform)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.create_community_post(text, text, uuid, text, text) from public, anon;
grant execute on function public.create_community_post(text, text, uuid, text, text) to authenticated;

-- ── 기존 게시글 1회성 가역 백필 (본문에 원본 플랫폼 링크가 있는 글) ─
-- 뉴스·트렌드 블로그(blog.hsad.co.kr, gogumafarm.kr 등)만 있는 글은 NULL로 남아
-- 밈대결에서 자동 제외된다.
with extracted as (
  select
    cp.id,
    case
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtube\.com/shorts/[A-Za-z0-9_-]{11}' then 'youtube_shorts'
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtube\.com/watch\?([^\s<>"'']*?&)?v=[A-Za-z0-9_-]{11}' then 'youtube'
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtu\.be/[A-Za-z0-9_-]{11}' then 'youtube'
      when cp.body ~* 'https://([a-z0-9-]+\.)?tiktok\.com/[^\s<>"'')\]]+/video/[0-9]{10,25}' then 'tiktok'
      when cp.body ~* 'https://([a-z0-9-]+\.)?instagram\.com/(reel|tv)/[A-Za-z0-9_-]{5,80}' then 'instagram'
      when cp.body ~* 'https://([a-z0-9-]+\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]{1,32}/status/[0-9]{5,25}' then 'x'
      when cp.body ~* 'https://([a-z0-9-]+\.)?threads\.(net|com)/[^\s<>"'')\]]+' then 'threads'
      else null
    end as platform,
    case
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtube\.com/shorts/[A-Za-z0-9_-]{11}' then
        'https://www.youtube.com/shorts/' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})', 'i'))[1]
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtube\.com/watch\?([^\s<>"'']*?&)?v=[A-Za-z0-9_-]{11}' then
        'https://www.youtube.com/watch?v=' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?youtube\.com/watch\?(?:[^\s<>"'']*?&)?v=([A-Za-z0-9_-]{11})', 'i'))[1]
      when cp.body ~* 'https://([a-z0-9-]+\.)?youtu\.be/[A-Za-z0-9_-]{11}' then
        'https://www.youtube.com/watch?v=' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?youtu\.be/([A-Za-z0-9_-]{11})', 'i'))[1]
      when cp.body ~* 'https://([a-z0-9-]+\.)?tiktok\.com/[^\s<>"'')\]]+/video/[0-9]{10,25}' then
        'https://www.tiktok.com/' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?tiktok\.com/([^\s<>"'')\]]+/video/[0-9]{10,25})', 'i'))[1]
      when cp.body ~* 'https://([a-z0-9-]+\.)?instagram\.com/(reel|tv)/[A-Za-z0-9_-]{5,80}' then
        'https://www.instagram.com/' ||
        lower((regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?instagram\.com/(reel|tv)/([A-Za-z0-9_-]{5,80})', 'i'))[1]) ||
        '/' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?instagram\.com/(reel|tv)/([A-Za-z0-9_-]{5,80})', 'i'))[2] ||
        '/'
      when cp.body ~* 'https://([a-z0-9-]+\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]{1,32}/status/[0-9]{5,25}' then
        'https://x.com/' ||
        (regexp_match(cp.body, 'https://(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com)/([A-Za-z0-9_]{1,32}/status/[0-9]{5,25})', 'i'))[1]
      when cp.body ~* 'https://([a-z0-9-]+\.)?threads\.(net|com)/[^\s<>"'')\]]+' then
        rtrim(
          (regexp_match(cp.body, '(https://(?:[a-z0-9-]+\.)?threads\.(?:net|com)/[^\s<>"'')\]]+)', 'i'))[1],
          '.,!?;:'
        )
      else null
    end as url
  from public.community_posts cp
  where cp.origin_source_url is null
)
update public.community_posts cp
   set origin_source_url = e.url,
       origin_source_platform = e.platform
  from extracted e
 where cp.id = e.id
   and e.url is not null
   and e.platform is not null;

commit;
