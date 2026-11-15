-- 밈캐치 스키마 v2 (plan-eng-review 확정안)
-- 원칙: 모든 테이블 RLS 기본 deny / 쓰기는 RPC(security definer)로만 / 서버 관리 컬럼 클라이언트 쓰기 차단

create extension if not exists pg_trgm;
-- ── enums ────────────────────────────────────────────────
create type user_role as enum ('user','operator');
create type lifecycle_status as enum ('rising','active','cooling','archived');
create type moderation_status as enum ('pending','fact_checking','rights_checking','approved','limited','rejected');
create type meme_category as enum ('phrase','dance','song','image','comment','challenge');
create type meme_difficulty as enum ('beginner','normal','deep');
create type meme_sentiment as enum ('funny','ironic','controversial','negative','wholesome');
create type safety_level as enum ('green','yellow','gray','red');
create type media_type as enum ('image','video','audio','text','embed');
create type availability_status as enum ('live','dead','region_blocked','unchecked');
create type copyright_status as enum ('unknown','embeddable','permission_needed','internal_only');
create type submission_status as enum ('pending','reviewing','approved','rejected');
create type report_status as enum ('open','resolved','dismissed');
create type report_target as enum ('meme','discussion','submission');
create type revision_status as enum ('proposed','approved','rejected');
create type reaction_type as enum ('understood','funny','just_learned','too_late','still_alive','risky');
create type discussion_status as enum ('visible','hidden','deleted');
-- ── 초성 추출 (IMMUTABLE — generated column용) ─────────────
create or replace function extract_chosung(input text) returns text
language plpgsql immutable strict as $$
declare
  result text := '';
  ch text; code int;
  chosungs text[] := array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
begin
  for i in 1..char_length(input) loop
    ch := substr(input, i, 1);
    code := ascii(ch);
    if code between 44032 and 55203 then
      result := result || chosungs[((code - 44032) / 588)::int + 1];
    else
      result := result || ch;
    end if;
  end loop;
  return result;
end $$;
-- short_id 생성 (URL용, T6 하이브리드 slug)
create or replace function gen_short_id() returns text
language sql volatile as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random()*31)+1)::int, 1), '')
  from generate_series(1, 8)
$$;
-- ── profiles ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null check (char_length(nickname) between 2 and 20),
  role user_role not null default 'user',
  trust_score int not null default 0,
  age_group text check (age_group in ('10s','20s','30s','40s','50s+')),
  interests text[] not null default '{}',
  created_at timestamptz not null default now()
);
-- 자기 role/trust_score 상승 차단 (service_role만 변경 가능)
-- 주의: PostgREST/Supabase는 복수형 request.jwt.claims(JSON)만 세팅한다.
--       단수 request.jwt.claim.role은 legacy GUC로 항상 비어 있어 service_role까지 차단됐었음.
--       JWT 자체가 없는 경로(psql/마이그레이션 등 직접 DB 접속)는 관리자 접속으로 보고 허용.
create or replace function protect_profile_columns() returns trigger
language plpgsql security definer as $$
begin
  if coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       'service_role'
     ) <> 'service_role'
     and (new.role is distinct from old.role or new.trust_score is distinct from old.trust_score) then
    raise exception 'role/trust_score can only be changed by service role';
  end if;
  return new;
end $$;
create trigger trg_protect_profile before update on profiles
  for each row execute function protect_profile_columns();
-- ── memes ────────────────────────────────────────────────
create table memes (
  id uuid primary key default gen_random_uuid(),
  short_id text not null unique default gen_short_id(),
  title text not null,
  slug text not null,
  aliases text[] not null default '{}',
  title_chosung text generated always as (extract_chosung(title)) stored,
  summary text not null default '',
  description text not null default '',
  origin text not null default '',
  usage_context jsonb not null default '{}'::jsonb, -- {"work":"green","friends":"green","family":"yellow","sns":"yellow"}
  usage_note text,
  caution text,
  safety_level safety_level not null default 'yellow',
  lifecycle_status lifecycle_status not null default 'active',
  moderation_status moderation_status not null default 'pending',
  category meme_category not null default 'phrase',
  media_type media_type not null default 'image',
  difficulty meme_difficulty not null default 'normal',
  sentiment meme_sentiment not null default 'funny',
  origin_year int check (origin_year between 1980 and 2100),
  trend_score double precision not null default 0,
  submitted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (slug)
);
create index idx_memes_public on memes (moderation_status, published_at desc);
create index idx_memes_trend on memes (moderation_status, trend_score desc);
create index idx_memes_lifecycle on memes (lifecycle_status, trend_score desc);
create index idx_memes_category on memes (category, trend_score desc);
create index idx_memes_year on memes (origin_year desc);
create index idx_memes_title_trgm on memes using gin (title gin_trgm_ops);
create index idx_memes_summary_trgm on memes using gin (summary gin_trgm_ops);
create index idx_memes_chosung_trgm on memes using gin (title_chosung gin_trgm_ops);
create index idx_memes_aliases on memes using gin (aliases);
-- 검수 상태 전이 규칙
create or replace function check_moderation_transition() returns trigger
language plpgsql as $$
begin
  if old.moderation_status = new.moderation_status then return new; end if;
  if not (
    (old.moderation_status = 'pending' and new.moderation_status in ('fact_checking','rejected')) or
    (old.moderation_status = 'fact_checking' and new.moderation_status in ('rights_checking','rejected','pending')) or
    (old.moderation_status = 'rights_checking' and new.moderation_status in ('approved','limited','rejected','fact_checking')) or
    (old.moderation_status = 'limited' and new.moderation_status in ('approved','rejected')) or
    (old.moderation_status = 'approved' and new.moderation_status in ('limited'))
  ) then
    raise exception 'invalid moderation transition: % -> %', old.moderation_status, new.moderation_status;
  end if;
  if new.moderation_status in ('approved','limited') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger trg_meme_moderation before update on memes
  for each row execute function check_moderation_transition();
-- ── 콘텐츠·출처·태그 ──────────────────────────────────────
create table meme_sources (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes(id) on delete cascade,
  platform text not null,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  title text,
  creator_name text,
  captured_at timestamptz not null default now(),
  copyright_status copyright_status not null default 'unknown'
);
create index idx_sources_meme on meme_sources (meme_id);
create table meme_contents (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes(id) on delete cascade,
  type media_type not null,
  platform text, -- YouTube | TikTok | Instagram | X | Community ...
  content_id text, -- 임베드 HTML 저장 금지: 플랫폼별 콘텐츠 ID만 (D-3)
  url text check (url is null or url ~* '^https?://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https?://'),
  caption text,
  is_representative boolean not null default false,
  availability availability_status not null default 'unchecked',
  moderation_status submission_status not null default 'approved',
  created_at timestamptz not null default now()
);
create index idx_contents_meme on meme_contents (meme_id, is_representative);
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null default 'topic' check (type in ('topic','generation','platform','emotion','risk'))
);
create table meme_tags_map (
  meme_id uuid not null references memes(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (meme_id, tag_id)
);
create index idx_tags_map_tag on meme_tags_map (tag_id);
-- ── 제보 ─────────────────────────────────────────────────
create table meme_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  seen_at text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  description text not null default '' check (char_length(description) <= 2000),
  attachment_path text,
  guess_reason text,
  tags text[] not null default '{}',
  status submission_status not null default 'pending',
  reject_reason text,
  dup_of uuid references memes(id) on delete set null,
  claimed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_submissions_status on meme_submissions (status, created_at);
create index idx_submissions_submitter on meme_submissions (submitter_id, created_at desc);
-- ── 반응·저장·투표 ────────────────────────────────────────
create table meme_reactions (
  user_id uuid not null references profiles(id) on delete cascade,
  meme_id uuid not null references memes(id) on delete cascade,
  reaction reaction_type not null,
  created_at timestamptz not null default now(),
  primary key (user_id, meme_id, reaction)
);
create index idx_reactions_meme on meme_reactions (meme_id, reaction);
create table saved_memes (
  user_id uuid not null references profiles(id) on delete cascade,
  meme_id uuid not null references memes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, meme_id)
);
create index idx_saved_meme on saved_memes (meme_id);
create table generation_votes (
  user_id uuid not null references profiles(id) on delete cascade,
  meme_id uuid not null references memes(id) on delete cascade,
  age_group text not null check (age_group in ('10s','20s','30s','40s','50s+')),
  vote text not null check (vote in ('know','dont_know','use','wont_use')),
  created_at timestamptz not null default now(),
  primary key (user_id, meme_id)
);
create index idx_gen_votes_meme on generation_votes (meme_id, age_group);
-- ── 커뮤니티 ──────────────────────────────────────────────
create table discussions (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references discussions(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status discussion_status not null default 'visible',
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_discussions_meme on discussions (meme_id, created_at desc);
create index idx_discussions_parent on discussions (parent_id);
create index idx_discussions_user on discussions (user_id, created_at desc);
create table discussion_reactions (
  user_id uuid not null references profiles(id) on delete cascade,
  discussion_id uuid not null references discussions(id) on delete cascade,
  reaction reaction_type not null,
  primary key (user_id, discussion_id, reaction)
);
-- ── 신고 (5회 누적 자동 숨김 — E-4) ────────────────────────
create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type report_target not null,
  target_id uuid not null,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status report_status not null default 'open',
  handled_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
create index idx_reports_open on reports (status, created_at);
create or replace function auto_hide_on_reports() returns trigger
language plpgsql security definer as $$
declare cnt int;
begin
  if new.target_type = 'discussion' then
    select count(*) into cnt from reports where target_type='discussion' and target_id=new.target_id and status='open';
    update discussions set report_count = cnt where id = new.target_id;
    if cnt >= 5 then
      update discussions set status='hidden' where id=new.target_id and status='visible';
    end if;
  end if;
  return new;
end $$;
create trigger trg_auto_hide after insert on reports
  for each row execute function auto_hide_on_reports();
-- ── 지표·이벤트 ───────────────────────────────────────────
create table meme_trend_metrics (
  meme_id uuid not null references memes(id) on delete cascade,
  date date not null, -- KST 기준 (배치에서 Asia/Seoul 계산)
  views int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  saves int not null default 0,
  reactions int not null default 0,
  reports int not null default 0,
  submissions int not null default 0,
  trend_score double precision not null default 0,
  primary key (meme_id, date)
);
create index idx_metrics_date on meme_trend_metrics (date desc, trend_score desc);
create table view_events (
  id bigint generated always as identity primary key,
  meme_id uuid not null references memes(id) on delete cascade,
  session_hash text not null,
  created_at timestamptz not null default now(),
  unique (meme_id, session_hash, created_at)
);
create index idx_view_events_recent on view_events (created_at);
create index idx_view_events_meme on view_events (meme_id, created_at);
-- ── 이력·감사·운영 ────────────────────────────────────────
create table meme_revisions (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes(id) on delete cascade,
  editor_id uuid references profiles(id) on delete set null,
  snapshot jsonb not null,
  note text,
  status revision_status not null default 'proposed',
  created_at timestamptz not null default now()
);
create index idx_revisions_meme on meme_revisions (meme_id, created_at desc);
create table admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create table job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb
);
create index idx_job_runs on job_runs (job_name, started_at desc);
-- ── 헬퍼: 운영자 판별 / 레이트리밋 ─────────────────────────
create or replace function is_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'operator')
$$;
create or replace function check_rate_limit(p_table text, p_limit int, p_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if p_table = 'discussions' then
    select count(*) into cnt from discussions where user_id = auth.uid() and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'meme_submissions' then
    select count(*) into cnt from meme_submissions where submitter_id = auth.uid() and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'reports' then
    select count(*) into cnt from reports where reporter_id = auth.uid() and created_at > now() - make_interval(mins => p_minutes);
  else
    cnt := 0;
  end if;
  if cnt >= p_limit then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
end $$;
-- ── RPC: 쓰기 경계 ────────────────────────────────────────
create or replace function increment_view(p_meme_id uuid, p_session_hash text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 세션×밈×일 dedup (같은 세션의 당일 중복 조회 무시)
  if exists (
    select 1 from view_events
    where meme_id = p_meme_id and session_hash = p_session_hash
      and created_at > date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
  ) then return; end if;
  insert into view_events (meme_id, session_hash) values (p_meme_id, p_session_hash);
end $$;
grant execute on function increment_view(uuid, text) to anon, authenticated;
create or replace function toggle_reaction(p_meme_id uuid, p_reaction reaction_type) returns boolean
language plpgsql security definer set search_path = public as $$
declare removed boolean := false;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  delete from meme_reactions where user_id = auth.uid() and meme_id = p_meme_id and reaction = p_reaction;
  if found then removed := true;
  else insert into meme_reactions (user_id, meme_id, reaction) values (auth.uid(), p_meme_id, p_reaction);
  end if;
  return not removed; -- true = 추가됨
end $$;
grant execute on function toggle_reaction(uuid, reaction_type) to authenticated;
create or replace function toggle_save(p_meme_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare removed boolean := false;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  delete from saved_memes where user_id = auth.uid() and meme_id = p_meme_id;
  if found then removed := true;
  else insert into saved_memes (user_id, meme_id) values (auth.uid(), p_meme_id);
  end if;
  return not removed;
end $$;
grant execute on function toggle_save(uuid) to authenticated;
create or replace function submit_meme(p_name text, p_seen_at text, p_url text, p_description text, p_guess text, p_tags text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('meme_submissions', 5, 60);
  if p_url is not null and p_url !~* '^https?://' then raise exception 'invalid_url'; end if;
  select id into v_dup from memes where title = p_name or p_name = any(aliases) limit 1;
  insert into meme_submissions (submitter_id, name, seen_at, source_url, description, guess_reason, tags, dup_of)
  values (auth.uid(), p_name, p_seen_at, p_url, p_description, p_guess, coalesce(p_tags,'{}'), v_dup)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function submit_meme(text, text, text, text, text, text[]) to authenticated;
create or replace function post_comment(p_meme_id uuid, p_parent_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('discussions', 10, 10);
  insert into discussions (meme_id, user_id, parent_id, body)
  values (p_meme_id, auth.uid(), p_parent_id, p_body)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function post_comment(uuid, uuid, text) to authenticated;
create or replace function file_report(p_target report_target, p_target_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('reports', 10, 60);
  insert into reports (target_type, target_id, reporter_id, reason)
  values (p_target, p_target_id, auth.uid(), p_reason)
  on conflict (target_type, target_id, reporter_id) do nothing
  returning id into v_id;
  return v_id;
end $$;
grant execute on function file_report(report_target, uuid, text) to authenticated;
create or replace function cast_generation_vote(p_meme_id uuid, p_age_group text, p_vote text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  insert into generation_votes (user_id, meme_id, age_group, vote)
  values (auth.uid(), p_meme_id, p_age_group, p_vote)
  on conflict (user_id, meme_id) do update set age_group = excluded.age_group, vote = excluded.vote;
end $$;
grant execute on function cast_generation_vote(uuid, text, text) to authenticated;
-- ── trend_score 일배치 (B-2/B-3: ln 정규화 + 72h 윈도 + 스무딩 + KST) ──
create or replace function compute_trend_scores() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_run_id bigint;
begin
  insert into job_runs (job_name) values ('compute_trend_scores') returning id into v_run_id;

  -- 오늘자 지표 롤업 (멱등 UPSERT)
  insert into meme_trend_metrics (meme_id, date, views, comments, saves, reactions, reports)
  select m.id, v_today,
    coalesce(v.cnt,0), coalesce(c.cnt,0), coalesce(s.cnt,0), coalesce(r.cnt,0), coalesce(rp.cnt,0)
  from memes m
  left join (select meme_id, count(*) cnt from view_events where created_at > now() - interval '24 hours' group by 1) v on v.meme_id = m.id
  left join (select meme_id, count(*) cnt from discussions where created_at > now() - interval '24 hours' group by 1) c on c.meme_id = m.id
  left join (select meme_id, count(*) cnt from saved_memes where created_at > now() - interval '24 hours' group by 1) s on s.meme_id = m.id
  left join (select meme_id, count(*) cnt from meme_reactions where created_at > now() - interval '24 hours' group by 1) r on r.meme_id = m.id
  left join (select target_id meme_id, count(*) cnt from reports where target_type='meme' and created_at > now() - interval '24 hours' group by 1) rp on rp.meme_id = m.id
  where m.moderation_status in ('approved','limited')
  on conflict (meme_id, date) do update
    set views=excluded.views, comments=excluded.comments, saves=excluded.saves,
        reactions=excluded.reactions, reports=excluded.reports;

  -- 72h 윈도 + ln(1+x) 정규화 + 신규 부스트 - 신고 감점
  update memes m set trend_score = sub.score, updated_at = now()
  from (
    select mm.id,
      ( ln(1 + coalesce(w.views,0))    * 0.25
      + ln(1 + coalesce(w.comments,0)) * 0.20
      + ln(1 + coalesce(w.reactions,0))* 0.20
      + ln(1 + coalesce(w.saves,0))    * 0.15
      - ln(1 + coalesce(w.reports,0))  * 0.10
      + case when mm.published_at > now() - interval '48 hours' then 0.5 else 0 end
      ) as score
    from memes mm
    left join (
      select meme_id, sum(views) views, sum(comments) comments, sum(reactions) reactions,
             sum(saves) saves, sum(reports) reports
      from meme_trend_metrics where date > v_today - 3 group by meme_id
    ) w on w.meme_id = mm.id
    where mm.moderation_status in ('approved','limited')
  ) sub where sub.id = m.id;

  -- 생애주기 자동 전환 (간단 규칙: 30일 무활동 → cooling, 90일 → archived)
  update memes set lifecycle_status = 'cooling'
  where lifecycle_status in ('rising','active') and moderation_status in ('approved','limited')
    and not exists (select 1 from meme_trend_metrics t where t.meme_id = memes.id and t.date > v_today - 30 and (t.views + t.comments + t.reactions) > 0);
  update memes set lifecycle_status = 'rising'
  where moderation_status in ('approved','limited') and trend_score > 1.5 and published_at > now() - interval '14 days' and lifecycle_status <> 'rising';

  -- 30일 지난 view_events 롤업 후 삭제 (E-4 용량 관리)
  delete from view_events where created_at < now() - interval '30 days';

  update job_runs set finished_at = now(), ok = true where id = v_run_id;
exception when others then
  -- 예외 진입 시 본문 전체(시작 INSERT 포함)가 서브트랜잭션 롤백으로 사라진다.
  -- 여기서 재-raise하면 이 실패 기록마저 외부 트랜잭션과 함께 롤백되므로,
  -- 실패 행을 새로 INSERT하고 warning만 남긴 채 정상 반환한다(감사 로그 보존).
  insert into job_runs (job_name, finished_at, ok, detail)
  values ('compute_trend_scores', now(), false, jsonb_build_object('error', sqlerrm));
  raise warning 'compute_trend_scores failed: %', sqlerrm;
end $$;
-- ── 검색 RPC (trgm + 초성 + aliases 통합) ──────────────────
create or replace function search_memes(p_query text, p_limit int default 20) returns setof memes
language sql stable security definer set search_path = public as $$
  select m.* from memes m
  where m.moderation_status in ('approved','limited')
    and (
      m.title ilike '%' || p_query || '%'
      or m.summary ilike '%' || p_query || '%'
      or m.title_chosung ilike '%' || p_query || '%'
      or exists (select 1 from unnest(m.aliases) a where a ilike '%' || p_query || '%')
      or similarity(m.title, p_query) > 0.25
    )
  order by (m.title ilike '%' || p_query || '%') desc, similarity(m.title, p_query) desc, m.trend_score desc
  limit least(p_limit, 50)
$$;
grant execute on function search_memes(text, int) to anon, authenticated;
-- ── RLS ──────────────────────────────────────────────────
alter table profiles enable row level security;
alter table memes enable row level security;
alter table meme_sources enable row level security;
alter table meme_contents enable row level security;
alter table tags enable row level security;
alter table meme_tags_map enable row level security;
alter table meme_submissions enable row level security;
alter table meme_reactions enable row level security;
alter table saved_memes enable row level security;
alter table generation_votes enable row level security;
alter table discussions enable row level security;
alter table discussion_reactions enable row level security;
alter table reports enable row level security;
alter table meme_trend_metrics enable row level security;
alter table view_events enable row level security;
alter table meme_revisions enable row level security;
alter table admin_audit_log enable row level security;
alter table job_runs enable row level security;
-- 공개 읽기 (approved/limited만; limited의 추천 제외는 쿼리 레벨)
create policy memes_public_read on memes for select
  using (moderation_status in ('approved','limited') or is_operator() or submitted_by = (select auth.uid()));
create policy sources_public_read on meme_sources for select
  using (exists (select 1 from memes m where m.id = meme_id and (m.moderation_status in ('approved','limited') or is_operator())));
create policy contents_public_read on meme_contents for select
  using (exists (select 1 from memes m where m.id = meme_id and (m.moderation_status in ('approved','limited') or is_operator())));
create policy tags_public_read on tags for select using (true);
create policy tags_map_public_read on meme_tags_map for select using (true);
create policy metrics_public_read on meme_trend_metrics for select using (true);
-- profiles
create policy profiles_self_read on profiles for select using (true);
-- 닉네임은 공개 정보
create policy profiles_self_insert on profiles for insert with check (id = (select auth.uid()));
create policy profiles_self_update on profiles for update using (id = (select auth.uid()));
-- 반응·저장·투표: 자기 것 읽기 + 집계는 뷰로
create policy reactions_read on meme_reactions for select using (true);
create policy saved_self on saved_memes for select using (user_id = (select auth.uid()));
create policy gen_votes_read on generation_votes for select using (true);
create policy disc_reactions_read on discussion_reactions for select using (true);
-- 댓글: visible 공개, hidden/deleted는 작성자·운영자만
create policy discussions_read on discussions for select
  using (status = 'visible' or user_id = (select auth.uid()) or is_operator());
-- 제보: 본인 것 + 운영자
create policy submissions_own_read on meme_submissions for select
  using (submitter_id = (select auth.uid()) or is_operator());
-- 신고: 본인 것 + 운영자
create policy reports_own_read on reports for select
  using (reporter_id = (select auth.uid()) or is_operator());
-- 운영자 전용
create policy revisions_operator on meme_revisions for select using (is_operator() or editor_id = (select auth.uid()));
create policy audit_operator on admin_audit_log for select using (is_operator());
create policy job_runs_operator on job_runs for select using (is_operator());
-- 운영자 쓰기 (관리자 콘솔 — service role 또는 operator)
create policy memes_operator_write on memes for all
  using (is_operator()) with check (is_operator());
create policy sources_operator_write on meme_sources for all
  using (is_operator()) with check (is_operator());
create policy contents_operator_write on meme_contents for all
  using (is_operator()) with check (is_operator());
create policy tags_operator_write on tags for all using (is_operator()) with check (is_operator());
create policy tags_map_operator_write on meme_tags_map for all using (is_operator()) with check (is_operator());
create policy submissions_operator_write on meme_submissions for update
  using (is_operator()) with check (is_operator());
create policy reports_operator_write on reports for update
  using (is_operator()) with check (is_operator());
create policy revisions_operator_write on meme_revisions for all
  using (is_operator()) with check (is_operator());
-- INSERT/DELETE는 전부 RPC(security definer) 경유 — 직접 insert 정책 없음 = 기본 거부
-- (meme_reactions/saved_memes/generation_votes/discussions/reports/view_events/metrics)

-- ── 집계 뷰 ──────────────────────────────────────────────
create view meme_reaction_counts with (security_invoker = on) as
  select meme_id, reaction, count(*)::int as cnt
  from meme_reactions group by meme_id, reaction;
create view generation_vote_stats with (security_invoker = on) as
  select meme_id, age_group, vote, count(*)::int as cnt
  from generation_votes group by meme_id, age_group, vote;
-- 회원가입 시 프로필 자동 생성
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', '밈러_' || substr(new.id::text, 1, 6)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
