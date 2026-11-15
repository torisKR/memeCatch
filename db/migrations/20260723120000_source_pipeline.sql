-- 출처 수집 파이프라인 (media_sources / meme_media / meme_claims)
-- 원칙: 원본 영상·이미지 파일은 저장하지 않고 플랫폼 링크·공식 임베드만 게시한다.
-- - media_sources: 플랫폼 콘텐츠 1건 = 1행. YouTube/TikTok/Instagram 공통 정규화.
-- - meme_media: 밈 ↔ 출처 다대다 + 권리 근거(rights_basis) + 검수 상태(review_state).
-- - meme_claims: 유래·의미 등 주장과 근거 출처 연결. LLM 생성분은 verified=false.
-- 게시는 기존 meme_contents/meme_sources로 승인 시에만 복사된다(공개 읽기 정책 유지).

-- ── memes: 연도 분리 ─────────────────────────────────────
-- YouTube 업로드 날짜 ≠ 밈 발생 연도. 원작 연도/최초 밈 사용/국내 유행을 분리한다.
alter table memes
  add column if not exists source_work_year smallint
    check (source_work_year between 1980 and 2100),
  add column if not exists meme_first_seen_year smallint
    check (meme_first_seen_year between 1980 and 2100),
  add column if not exists korea_viral_year smallint
    check (korea_viral_year between 1980 and 2100),
  add column if not exists revival_years smallint[] not null default '{}',
  add column if not exists year_precision text not null default 'unknown'
    check (year_precision in ('exact','year','approximate','decade','unknown')),
  add column if not exists era_type text
    check (era_type in ('pre_internet','early_web','social_media','shortform'));

-- ── media_sources ────────────────────────────────────────
create table if not exists media_sources (
  id uuid primary key default gen_random_uuid(),

  platform text not null
    check (platform in (
      'youtube',
      'youtube_shorts',
      'tiktok',
      'instagram',
      'broadcast_archive',
      'public_archive',
      'web'
    )),

  external_id text,
  canonical_url text not null check (canonical_url ~* '^https?://'),

  title text,
  channel_name text,
  channel_id text,

  platform_published_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  public_status text
    check (public_status is null or public_status in ('public','unlisted','private','unknown')),
  embeddable boolean,
  license_code text,
  made_for_kids boolean,

  -- URL만 저장한다. 썸네일 파일은 다운로드·재호스팅하지 않는다.
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https?://'),

  -- YouTube 공개 API 데이터는 30일을 넘겨 저장하지 않는다(갱신 또는 삭제).
  metadata_refreshed_at timestamptz,
  metadata_expires_at timestamptz,
  last_checked_at timestamptz,
  removed_at timestamptz,

  created_at timestamptz not null default now()
);

create unique index if not exists media_sources_platform_external_id_idx
  on media_sources (platform, external_id)
  where external_id is not null;
create unique index if not exists media_sources_canonical_url_idx
  on media_sources (canonical_url);
-- 재확인 배치 커서: 살아 있는 출처를 확인 시각 오름차순으로 가져간다.
create index if not exists media_sources_refresh_idx
  on media_sources (last_checked_at nulls first)
  where removed_at is null;

-- ── meme_media (다대다 + 권리·검수 원장) ──────────────────
create table if not exists meme_media (
  meme_id uuid not null references memes(id) on delete cascade,
  source_id uuid not null references media_sources(id) on delete cascade,

  -- original은 권리자·제작사 공식 계정이 확인될 때만 붙인다.
  source_role text not null default 'usage_example'
    check (source_role in (
      'original',
      'official_reupload',
      'earliest_known',
      'secondary_reference',
      'usage_example'
    )),

  rights_basis text not null default 'unknown'
    check (rights_basis in (
      'official_embed',
      'creator_permission',
      'creative_commons',
      'public_data',
      'link_only',
      'unknown',
      'blocked'
    )),

  review_state text not null default 'pending'
    check (review_state in ('pending','approved','rejected','removed')),

  reviewer_note text,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),

  primary key (meme_id, source_id)
);
create index if not exists meme_media_review_idx
  on meme_media (review_state, created_at);
create index if not exists meme_media_source_idx
  on meme_media (source_id);

-- ── meme_claims (주장 ↔ 근거) ────────────────────────────
create table if not exists meme_claims (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references memes(id) on delete cascade,
  source_id uuid references media_sources(id) on delete set null,

  claim_type text not null
    check (claim_type in (
      'origin',
      'meaning',
      'first_use',
      'viral_period',
      'creator',
      'usage_context'
    )),

  claim_text text not null check (char_length(claim_text) <= 2000),
  confidence text not null default 'low'
    check (confidence in ('high','medium','low')),

  -- 근거 출처가 연결되고 운영자가 확인하기 전까지 게시하지 않는다.
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists meme_claims_meme_idx on meme_claims (meme_id);

-- ── RLS ──────────────────────────────────────────────────
-- 공개 화면은 기존 meme_contents/meme_sources 정책을 그대로 쓰고,
-- 이 원장 테이블은 운영자와 service_role만 접근한다.
alter table media_sources enable row level security;
alter table meme_media enable row level security;
alter table meme_claims enable row level security;

drop policy if exists media_sources_operator on media_sources;
create policy media_sources_operator on media_sources for all
  using (is_operator()) with check (is_operator());
drop policy if exists meme_media_operator on meme_media;
create policy meme_media_operator on meme_media for all
  using (is_operator()) with check (is_operator());
drop policy if exists meme_claims_operator on meme_claims;
create policy meme_claims_operator on meme_claims for all
  using (is_operator()) with check (is_operator());
