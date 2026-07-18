-- 레인 3 — 커뮤니티 게시판 (글/댓글/좋아요)
-- 원칙(스키마 v2와 동일): RLS 기본 deny / 쓰기는 security definer RPC로만.

-- ── 테이블 ────────────────────────────────────────────────
create table community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  meme_id uuid references memes(id) on delete set null, -- 밈 첨부(옵션)
  like_count int not null default 0,
  comment_count int not null default 0,
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);
create index idx_community_posts_recent on community_posts (status, created_at desc);
create index idx_community_posts_user on community_posts (user_id);
create table community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index idx_community_comments_post on community_comments (post_id, created_at);
create table community_post_likes (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index idx_community_post_likes_post on community_post_likes (post_id);
-- ── RLS ──────────────────────────────────────────────────
alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table community_post_likes enable row level security;
-- select: visible 공개(작성자·운영자는 hidden도), comments/likes는 공개
create policy community_posts_read on community_posts for select
  using (status = 'visible' or user_id = (select auth.uid()) or is_operator());
create policy community_comments_read on community_comments for select using (true);
create policy community_post_likes_read on community_post_likes for select using (true);
-- 운영자 숨김/해제
create policy community_posts_operator_update on community_posts for update
  using (is_operator()) with check (is_operator());
-- INSERT/DELETE 정책 없음 = 직접 쓰기 기본 거부 (RPC 경유만)

-- ── check_rate_limit 확장 (community_posts/community_comments 분기 추가) ──
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
  elsif p_table = 'community_posts' then
    select count(*) into cnt from community_posts where user_id = auth.uid() and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'community_comments' then
    select count(*) into cnt from community_comments where user_id = auth.uid() and created_at > now() - make_interval(mins => p_minutes);
  else
    cnt := 0;
  end if;
  if cnt >= p_limit then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
end $$;
-- ── RPC: 쓰기 경계 ────────────────────────────────────────
create or replace function create_community_post(p_title text, p_body text, p_meme_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('community_posts', 5, 60);
  if p_meme_id is not null and not exists (
    select 1 from memes where id = p_meme_id and moderation_status in ('approved','limited')
  ) then
    raise exception 'invalid_meme';
  end if;
  insert into community_posts (user_id, title, body, meme_id)
  values (auth.uid(), p_title, p_body, p_meme_id)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function create_community_post(text, text, uuid) to authenticated;
create or replace function create_community_comment(p_post_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('community_comments', 10, 10);
  if not exists (select 1 from community_posts where id = p_post_id and status = 'visible') then
    raise exception 'post_not_found';
  end if;
  insert into community_comments (post_id, user_id, body)
  values (p_post_id, auth.uid(), p_body)
  returning id into v_id;
  update community_posts set comment_count = comment_count + 1 where id = p_post_id;
  return v_id;
end $$;
grant execute on function create_community_comment(uuid, text) to authenticated;
create or replace function toggle_post_like(p_post_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare removed boolean := false;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  delete from community_post_likes where user_id = auth.uid() and post_id = p_post_id;
  if found then
    removed := true;
    update community_posts set like_count = greatest(like_count - 1, 0) where id = p_post_id;
  else
    insert into community_post_likes (user_id, post_id) values (auth.uid(), p_post_id);
    update community_posts set like_count = like_count + 1 where id = p_post_id;
  end if;
  return not removed; -- true = 좋아요 추가됨
end $$;
grant execute on function toggle_post_like(uuid) to authenticated;
