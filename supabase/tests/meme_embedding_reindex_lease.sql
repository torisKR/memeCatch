-- BEGIN + 신규 lease migration + 이 파일 + ROLLBACK으로 disposable/local DB에서 실행.
-- 기존 vector migration은 적용되어 있어야 한다. 실제 모델·cron·운영 DB는 사용하지 않는다.
create temp table reindex_baseline as select * from public.meme_embedding_backlog();
grant select on reindex_baseline to service_role;

insert into public.memes(id, title, slug, moderation_status) values
  ('94000000-0000-4000-8000-000000000001', '변경분 색인 QA 공개1', 'delta-embedding-qa-1', 'approved'),
  ('94000000-0000-4000-8000-000000000002', '변경분 색인 QA 공개2', 'delta-embedding-qa-2', 'approved'),
  ('94000000-0000-4000-8000-000000000003', '변경분 색인 QA 제한', 'delta-embedding-qa-limited', 'limited'),
  ('94000000-0000-4000-8000-000000000004', '변경분 색인 QA 비공개', 'delta-embedding-qa-hidden', 'pending');

do $$
declare v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(v_role, 'private.meme_embedding_reindex_state', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
       or has_function_privilege(v_role, 'public.acquire_meme_embedding_run(uuid,integer)', 'EXECUTE')
       or has_function_privilege(v_role, 'public.finish_meme_embedding_run(uuid,text,integer,integer,integer,text)', 'EXECUTE')
       or has_function_privilege(v_role, 'public.meme_embedding_backlog()', 'EXECUTE') then
      raise exception 'reindex state and RPCs must be service-only: %', v_role;
    end if;
  end loop;
  if not has_table_privilege('service_role', 'private.meme_embedding_reindex_state', 'SELECT')
     or not has_table_privilege('service_role', 'private.meme_embedding_reindex_state', 'UPDATE')
     or has_table_privilege('service_role', 'private.meme_embedding_reindex_state', 'INSERT,DELETE,TRUNCATE') then
    raise exception 'service state grant must be limited to select/update';
  end if;
  if exists (
    select 1 from pg_proc where oid in (
      'public.acquire_meme_embedding_run(uuid,integer)'::regprocedure,
      'public.finish_meme_embedding_run(uuid,text,integer,integer,integer,text)'::regprocedure,
      'public.meme_embedding_backlog()'::regprocedure
    ) and (prosecdef or not ('search_path=pg_catalog' = any(proconfig)))
  ) then raise exception 'lease RPC must be invoker with fixed search path'; end if;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform * from public.meme_embedding_backlog();
    raise exception 'anon backlog RPC accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.acquire_meme_embedding_run('94000000-0000-4000-8000-000000999001');
    raise exception 'anon acquire RPC accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.finish_meme_embedding_run('94000000-0000-4000-8000-000000999001', 'succeeded', 0, 0, 0);
    raise exception 'anon finish RPC accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from private.meme_embedding_reindex_state;
    raise exception 'anon state read accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"94000000-0000-4000-8000-000000999999"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.acquire_meme_embedding_run('94000000-0000-4000-8000-000000999001');
    raise exception 'authenticated acquire RPC accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update private.meme_embedding_reindex_state set last_status = 'succeeded';
    raise exception 'authenticated state write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  v_owner uuid := '94000000-0000-4000-8000-000000999001';
  v_other uuid := '94000000-0000-4000-8000-000000999002';
  v_pending integer := (select pending::integer from reindex_baseline) + 3;
  v_json jsonb;
begin
  if (select count(*) from public.meme_embedding_backlog()) <> 1
     or (select pending from public.meme_embedding_backlog()) <> v_pending then
    raise exception 'backlog must count only missing approved/limited documents';
  end if;
  select to_jsonb(b) into v_json from public.meme_embedding_backlog() b;
  if v_json ?| array['meme_id', 'document', 'source_hash', 'embedding', 'lease_owner'] then
    raise exception 'backlog must not expose documents/vectors/owner';
  end if;
  if not public.acquire_meme_embedding_run(v_owner) then
    raise exception 'initial lease acquisition failed';
  end if;
  if (select not lease_active or last_status <> 'running'
      or lease_until - last_started_at <> interval '180 seconds' from public.meme_embedding_backlog()) then
    raise exception 'acquisition must set active lease/default TTL';
  end if;
  if public.acquire_meme_embedding_run(v_other) or public.acquire_meme_embedding_run(v_owner) then
    raise exception 'overlapping acquisition must not succeed or renew lease';
  end if;
  if public.finish_meme_embedding_run(v_other, 'succeeded', 0, 0, v_pending) then
    raise exception 'different owner must not finish another run';
  end if;
  if not public.finish_meme_embedding_run(v_owner, 'partial', 1, 1, v_pending, 'deadline_exceeded') then
    raise exception 'matching owner must release partial run';
  end if;
  if public.finish_meme_embedding_run(v_owner, 'partial', 1, 1, v_pending) then
    raise exception 'duplicate finish must be idempotently false';
  end if;
  if (select lease_active or lease_until is not null or last_status <> 'partial'
      or last_indexed <> 1 or last_stale <> 1 or last_remaining <> v_pending
      or last_finished_at is null or retry_after is not null
      or consecutive_failures <> 0 or last_error_code <> 'deadline_exceeded'
      from public.meme_embedding_backlog()) then
    raise exception 'partial finish metrics/release are incorrect';
  end if;

  if not public.acquire_meme_embedding_run(v_owner, 99999)
     or (select lease_until - last_started_at from public.meme_embedding_backlog()) <> interval '300 seconds' then
    raise exception 'TTL must cap at300 seconds';
  end if;
  -- 만료된 이전 owner는 종료할 수 없고 다음 실행이 lease를 회수한다.
  update private.meme_embedding_reindex_state set lease_until = clock_timestamp() - interval '1 second';
  if public.finish_meme_embedding_run(v_owner, 'succeeded', 0, 0, v_pending)
     or not public.acquire_meme_embedding_run(v_other, 1)
     or public.finish_meme_embedding_run(v_owner, 'succeeded', 0, 0, v_pending) then
    raise exception 'expired/stale owner must be rejected and lease recoverable';
  end if;
  if not public.finish_meme_embedding_run(v_other, 'succeeded', 0, 0, v_pending) then
    raise exception 'replacement owner cannot finish';
  end if;
  begin
    perform public.acquire_meme_embedding_run(null);
    raise exception 'null owner accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- 첫 실패900초→두번째1800초→이후3600초. 대기 중 요청은 false로 거절한다.
do $$
declare
  v_owner uuid := '94000000-0000-4000-8000-000000999003';
  v_pending integer := (select pending::integer from public.meme_embedding_backlog());
  v_attempt integer;
  v_expected integer;
begin
  for v_attempt in 1..4 loop
    if v_attempt > 1 then
      update private.meme_embedding_reindex_state set retry_after = clock_timestamp() - interval '1 second';
    end if;
    if not public.acquire_meme_embedding_run(v_owner) then raise exception 'retry cannot acquire'; end if;
    if not public.finish_meme_embedding_run(v_owner, 'failed', 0, 0, v_pending, 'model_unavailable') then
      raise exception 'failed finish cannot release lease';
    end if;
    v_expected := case v_attempt when 1 then 900 when 2 then 1800 else 3600 end;
    if (select lease_active or consecutive_failures <> v_attempt or failed_runs <> v_attempt
        or last_status <> 'failed' or last_error_code <> 'model_unavailable'
        or extract(epoch from retry_after - last_finished_at)::integer <> v_expected
        from public.meme_embedding_backlog()) then
      raise exception 'failure backoff/stats incorrect for attempt %', v_attempt;
    end if;
    if public.acquire_meme_embedding_run(v_owner) then
      raise exception 'failure retry_after was ignored';
    end if;
  end loop;
  update private.meme_embedding_reindex_state set retry_after = clock_timestamp() - interval '1 second';
  if not public.acquire_meme_embedding_run(v_owner)
     or not public.finish_meme_embedding_run(v_owner, 'succeeded', 0, 0, v_pending) then
    raise exception 'successful recovery failed';
  end if;
  if (select consecutive_failures <> 0 or retry_after is not null
      or last_error_code is not null or failed_runs <> 4 from public.meme_embedding_backlog()) then
    raise exception 'success must clear backoff but preserve historical failures';
  end if;
end $$;

-- 임의의 provider 응답을 오류로 저장하지 않는다. 결과 수는 run당 최대25건.
do $$
declare
  v_owner uuid := '94000000-0000-4000-8000-000000999004';
  v_pending integer := (select pending::integer from public.meme_embedding_backlog());
  v_invalid integer;
begin
  if not public.acquire_meme_embedding_run(v_owner) then raise exception 'validation lease not acquired'; end if;
  for v_invalid in 1..7 loop
    begin
      perform public.finish_meme_embedding_run(v_owner,
        case when v_invalid = 1 then 'unknown' else 'partial' end,
        case when v_invalid = 2 then -1 when v_invalid = 3 then 26 when v_invalid = 4 then 20 else 0 end,
        case when v_invalid = 4 then 6 else 0 end,
        case when v_invalid = 5 then -1 when v_invalid = 6 then 10000001 else v_pending end,
        case when v_invalid = 7 then 'raw provider private response' else null end);
      raise exception 'invalid result % accepted', v_invalid;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if not public.finish_meme_embedding_run(v_owner, 'succeeded', 0, 0, v_pending) then
    raise exception 'invalid result should not release lease';
  end if;
end $$;

-- approved/limited만 delta queue가 된다. 저장 후 기존 baseline까지 감소한다.
do $$
declare
  v_id uuid;
  v_hash text;
  v_vector double precision[] := array[1.0::double precision] || array_fill(0.0::double precision, array[383]);
  v_remaining integer := (select pending::integer from reindex_baseline) + 3;
begin
  foreach v_id in array array[
    '94000000-0000-4000-8000-000000000001'::uuid,
    '94000000-0000-4000-8000-000000000002'::uuid,
    '94000000-0000-4000-8000-000000000003'::uuid
  ] loop
    select md5(public.meme_embedding_document(m)) into v_hash from public.memes m where m.id = v_id;
    if not public.store_meme_embedding(v_id, v_hash, v_vector) then
      raise exception 'fixture indexing failed';
    end if;
    v_remaining := v_remaining - 1;
    if (select pending from public.meme_embedding_backlog()) <> v_remaining then
      raise exception 'backlog did not decrease after delta source indexed';
    end if;
  end loop;
  -- 기존 공개 backlog가 없는 DB에서는 실제 empty queue의 성공 처리도 검증한다.
  if not public.acquire_meme_embedding_run('94000000-0000-4000-8000-000000999005')
     or not public.finish_meme_embedding_run('94000000-0000-4000-8000-000000999005', 'succeeded', 0, 0, v_remaining) then
    raise exception 'empty/no-new-work run must finish and release';
  end if;
  if (select lease_active or last_indexed <> 0 or last_stale <> 0
      or last_remaining <> v_remaining or last_status <> 'succeeded' from public.meme_embedding_backlog()) then
    raise exception 'empty/no-new-work stats incorrect';
  end if;
end $$;
reset role;

-- 기존 공개 상태·벡터 무효화 trigger를 유지한다. fixture 편집만으로 delta를 확인.
update public.memes set summary = '변경된 공개 원문'
where id = '94000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
begin
  if (select pending from public.meme_embedding_backlog()) <> (select pending + 1 from reindex_baseline) then
    raise exception 'existing invalidation trigger must queue changed source';
  end if;
end $$;
reset role;
