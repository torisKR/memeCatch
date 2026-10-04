-- 공개 카탈로그의 변경분 색인은 기존 벡터 부재를 queue로 사용한다.
-- singleton lease는 독립 cron 중복 실행만 막으며 기존 개인 미디어 job과 분리한다.
create table private.meme_embedding_reindex_state (
  singleton boolean primary key default true check (singleton),
  lease_owner uuid,
  lease_until timestamptz,
  last_status text not null default 'idle'
    check (last_status in ('idle', 'running', 'succeeded', 'partial', 'failed')),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_indexed integer not null default 0 check (last_indexed between 0 and 25),
  last_stale integer not null default 0 check (last_stale between 0 and 25),
  last_remaining integer not null default 0 check (last_remaining between 0 and 10000000),
  consecutive_failures integer not null default 0 check (consecutive_failures between 0 and 16),
  failed_runs bigint not null default 0 check (failed_runs >= 0),
  retry_after timestamptz,
  last_error_code text check (last_error_code in (
    'model_unavailable', 'model_mismatch', 'invalid_embedding', 'rpc_unavailable',
    'deadline_exceeded', 'store_failed', 'internal_error'
  )),
  check ((lease_owner is null) = (lease_until is null)),
  check (last_indexed + last_stale <= 25)
);
insert into private.meme_embedding_reindex_state(singleton) values (true);
alter table private.meme_embedding_reindex_state enable row level security;
revoke all on table private.meme_embedding_reindex_state from public, anon, authenticated, service_role;
grant select, update on table private.meme_embedding_reindex_state to service_role;
comment on table private.meme_embedding_reindex_state is
  '공개 밈 의미 색인 단일 실행 lease와 최근 bounded 결과. owner UUID는 작업 식별자이며 인증 토큰이 아님.';

create or replace function public.acquire_meme_embedding_run(
  p_owner uuid,
  p_ttl_seconds integer default 180
)
returns boolean
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ttl integer := greatest(1, least(coalesce(p_ttl_seconds, 180), 300));
begin
  if p_owner is null then
    raise exception using errcode = '22023', message = 'invalid_embedding_run_owner';
  end if;

  -- 단일 조건부 UPDATE로 동시에 들어온 요청도 하나만 lease를 얻는다.
  update private.meme_embedding_reindex_state s set
    lease_owner = p_owner,
    lease_until = v_now + make_interval(secs => v_ttl),
    last_status = 'running',
    last_started_at = v_now,
    retry_after = null,
    last_error_code = null
  where s.singleton
    and (s.lease_until is null or s.lease_until <= v_now)
    and (s.retry_after is null or s.retry_after <= v_now);
  return found;
end;
$$;
revoke all on function public.acquire_meme_embedding_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.acquire_meme_embedding_run(uuid, integer) to service_role;

create or replace function public.finish_meme_embedding_run(
  p_owner uuid,
  p_status text,
  p_indexed integer,
  p_stale integer,
  p_remaining integer,
  p_error_code text default null
)
returns boolean
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_error text := case when p_status = 'failed' then coalesce(p_error_code, 'internal_error') else p_error_code end;
begin
  if p_owner is null or p_status is null or p_status not in ('succeeded', 'partial', 'failed')
     or p_indexed is null or p_indexed not between 0 and 25
     or p_stale is null or p_stale not between 0 and 25 or p_indexed + p_stale > 25
     or p_remaining is null or p_remaining not between 0 and 10000000
     or (p_status = 'succeeded' and v_error is not null)
     or (v_error is not null and v_error not in (
       'model_unavailable', 'model_mismatch', 'invalid_embedding', 'rpc_unavailable',
       'deadline_exceeded', 'store_failed', 'internal_error'
     )) then
    raise exception using errcode = '22023', message = 'invalid_embedding_run_result';
  end if;

  update private.meme_embedding_reindex_state s set
    lease_owner = null,
    lease_until = null,
    last_status = p_status,
    last_finished_at = v_now,
    last_indexed = p_indexed,
    last_stale = p_stale,
    last_remaining = p_remaining,
    consecutive_failures = case when p_status = 'failed'
      then least(s.consecutive_failures + 1, 16) else 0 end,
    failed_runs = s.failed_runs + case when p_status = 'failed' then 1 else 0 end,
    retry_after = case when p_status = 'failed'
      then v_now + make_interval(secs => 900 * power(2, least(s.consecutive_failures, 2))) else null end,
    last_error_code = v_error
  where s.singleton and s.lease_owner = p_owner and s.lease_until > v_now;
  return found;
end;
$$;
revoke all on function public.finish_meme_embedding_run(uuid, text, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.finish_meme_embedding_run(uuid, text, integer, integer, integer, text)
  to service_role;

create or replace function public.meme_embedding_backlog()
returns table (
  pending bigint,
  lease_active boolean,
  lease_until timestamptz,
  last_status text,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_indexed integer,
  last_stale integer,
  last_remaining integer,
  consecutive_failures integer,
  failed_runs bigint,
  retry_after timestamptz,
  last_error_code text
)
language sql stable security invoker
set search_path = pg_catalog
as $$
  select (
      select count(*) from public.memes m
      where m.moderation_status in ('approved', 'limited')
        and not exists (select 1 from private.meme_semantic_embeddings e where e.meme_id = m.id)
    ),
    s.lease_owner is not null and s.lease_until > statement_timestamp(),
    s.lease_until, s.last_status, s.last_started_at, s.last_finished_at,
    s.last_indexed, s.last_stale, s.last_remaining, s.consecutive_failures,
    s.failed_runs, s.retry_after, s.last_error_code
  from private.meme_embedding_reindex_state s where s.singleton;
$$;
revoke all on function public.meme_embedding_backlog() from public, anon, authenticated;
grant execute on function public.meme_embedding_backlog() to service_role;
comment on function public.meme_embedding_backlog() is
  '서비스 전용 공개 변경분 수와 최근 실행 상태. 원문·meme ID·벡터·lease owner는 반환하지 않음.';
