-- 20261029183405_ai_review_automation_20261030.sql
-- 관리자 수동 검수를 AI 자동 검수로 대체한다.
-- 추가형 마이그레이션: 기존 함수·테이블은 변경하지 않는다. service_role 전용.
begin;

create table if not exists public.ai_review_runs (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('submission', 'meme', 'translation', 'usage_examples')),
  target_id text not null,
  input_hash text not null,
  model text not null,
  decision text not null check (decision in ('approve', 'limited', 'reject', 'skip')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reason text,
  risk_flags text[] not null default '{}',
  applied boolean not null default false,
  applied_action text,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, input_hash)
);

create index if not exists ai_review_runs_target_idx
  on public.ai_review_runs (target_type, target_id, created_at desc);

alter table public.ai_review_runs enable row level security;
revoke all on public.ai_review_runs from public, anon, authenticated;
grant select, insert, update on public.ai_review_runs to service_role;
grant usage, select on sequence public.ai_review_runs_id_seq to service_role;

-- 번역 검수 완료 처리용: reviewed_by는 profiles FK(ON DELETE SET NULL)이고 check 제약이
-- reviewed 상태에서 reviewed_by not null을 요구한다. AI 검수는 서비스 계정(운영자 프로필)으로 기록한다.
-- 별도 스키마 변경 없이 호출 측에서 운영자 프로필 id를 넘긴다.

-- service_role이 멱등하게 제보를 처리 대기 상태로 되돌릴 수 있도록 큐 조회 인덱스만 추가한다.
create index if not exists meme_submissions_status_created_idx
  on public.meme_submissions (status, created_at);;
commit;
