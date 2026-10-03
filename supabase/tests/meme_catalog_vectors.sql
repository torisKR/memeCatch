-- disposable/local DB에서 BEGIN + migration + 이 파일 + ROLLBACK으로 실행한다.
-- 실제 외부 모델 호출 없이 단위 벡터로 권한, 검색, stale 저장을 검증한다.
create temp table embedding_test_vectors as
select
  array[1.0::double precision, 0.0] || array_fill(0.0::double precision, array[382]) as query,
  array[0.8::double precision, 0.6] || array_fill(0.0::double precision, array[382]) as first,
  array[0.7::double precision, 0.714142842854285] || array_fill(0.0::double precision, array[382]) as second,
  array[-1.0::double precision, 0.0] || array_fill(0.0::double precision, array[382]) as distant;
grant select on embedding_test_vectors to anon, authenticated, service_role;

insert into public.memes(id, title, slug, moderation_status)
select ('93100000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '벡터 SQL QA ' || i, 'vector-sql-qa-' || i,
  (case when i = 2 then 'limited' else 'approved' end)::public.moderation_status
from generate_series(1, 42) i;
insert into public.memes(id, title, slug, moderation_status) values
  ('93100000-0000-4000-8000-000000999001', '벡터 SQL QA 대기', 'vector-sql-qa-pending', 'pending'),
  ('93100000-0000-4000-8000-000000999002', '벡터 SQL QA 거절', 'vector-sql-qa-rejected', 'rejected');

-- 비공개 벡터가 더 가까워도 공개 top-K를 먼저 제한해야 한다.
insert into private.meme_semantic_embeddings(meme_id, embedding, source_hash)
select m.id, private.meme_embedding_vector(case
    when m.id = '93100000-0000-4000-8000-000000000001' then v.first
    when m.id = '93100000-0000-4000-8000-000000000002' then v.second
    when m.moderation_status not in ('approved', 'limited') then v.query
    else v.distant end), md5(public.meme_embedding_document(m))
from public.memes m cross join embedding_test_vectors v
where m.id::text like '93100000-0000-4000-8000-%';

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('93100000-0000-4000-8000-000000999999', 'vector-sql-operator@example.com', now(),
  '{"nickname":"vector_qa_operator"}'::jsonb, now(), now());
update public.profiles set role = 'operator' where id = '93100000-0000-4000-8000-000000999999';

do $$
declare v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if not has_schema_privilege(v_role, 'private', 'USAGE')
       or not has_table_privilege(v_role, 'private.meme_semantic_embeddings', 'SELECT')
       or has_table_privilege(v_role, 'private.meme_semantic_embeddings', 'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'embeddings must be read-only for %', v_role;
    end if;
    if has_function_privilege(v_role, 'public.list_meme_embedding_jobs(uuid,integer)', 'EXECUTE')
       or has_function_privilege(v_role, 'public.store_meme_embedding(uuid,text,double precision[])', 'EXECUTE')
       or has_function_privilege(v_role, 'public.meme_embedding_document(public.memes)', 'EXECUTE')
       or has_function_privilege(v_role, 'private.invalidate_meme_embedding()', 'EXECUTE') then
      raise exception 'embedding internal functions exposed to %', v_role;
    end if;
  end loop;
  if exists (
    select 1 from pg_proc where oid in (
      'public.match_meme_embeddings(double precision[],integer,uuid)'::regprocedure,
      'public.related_meme_embeddings(uuid,integer)'::regprocedure,
      'public.list_meme_embedding_jobs(uuid,integer)'::regprocedure,
      'public.store_meme_embedding(uuid,text,double precision[])'::regprocedure
    ) and prosecdef
  ) then raise exception 'RPC must preserve caller permissions and RLS'; end if;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  v_query double precision[] := (select query from embedding_test_vectors);
  v_bad double precision[];
  v_index integer;
begin
  if (select count(*) from private.meme_semantic_embeddings
      where meme_id::text like '93100000-0000-4000-8000-%') <> 42 then
    raise exception 'anon can read a hidden parent embedding';
  end if;
  if (select meme_id from public.match_meme_embeddings(v_query, 1)) <>
      '93100000-0000-4000-8000-000000000001'::uuid then
    raise exception 'public filter must precede top-K';
  end if;
  if abs((select similarity from public.match_meme_embeddings(v_query, 1)) - 0.8) > 0.00001 then
    raise exception 'cosine similarity is incorrect';
  end if;
  if abs((select similarity from public.match_meme_embeddings(
      array[1e300::double precision, 1e-300::double precision]
      || array_fill(0.0::double precision, array[382]), 1)) - 0.8) > 0.00001 then
    raise exception 'finite extreme vector must normalize safely';
  end if;
  if (select meme_id from public.match_meme_embeddings(v_query, 1,
      '93100000-0000-4000-8000-000000000001')) <>
      '93100000-0000-4000-8000-000000000002'::uuid then
    raise exception 'exclude must apply before top-K and limited must be public';
  end if;
  if (select count(*) from public.match_meme_embeddings(v_query, 999)) <> 40
     or (select count(*) from public.match_meme_embeddings(v_query, -8)) <> 1
     or (select count(*) from public.match_meme_embeddings(v_query, null)) <> 20 then
    raise exception 'match limit must clamp to 1..40 and default to 20';
  end if;
  if (select count(*) from public.related_meme_embeddings(
        '93100000-0000-4000-8000-000000000001', 999)) <> 40
     or exists (select 1 from public.related_meme_embeddings(
        '93100000-0000-4000-8000-000000000001')
        where meme_id = '93100000-0000-4000-8000-000000000001')
     or exists (select 1 from public.related_meme_embeddings(
        '93100000-0000-4000-8000-000000999001'))
     or exists (select 1 from public.related_meme_embeddings(
        '93100000-0000-4000-8000-000000999002'))
     or exists (select 1 from public.related_meme_embeddings(
        '93100000-0000-4000-8000-000000999003')) then
    raise exception 'related lookup must exclude self and require a public stored seed';
  end if;

  for v_index in 1..9 loop
    v_bad := case v_index
      when 1 then null
      when 2 then array_fill(1.0::double precision, array[383])
      when 3 then array_fill(1.0::double precision, array[385])
      when 4 then array_fill(0.0::double precision, array[384])
      when 5 then array_fill(0.01::double precision, array[2, 192])
      else v_query end;
    if v_index = 6 then v_bad[1] := null; end if;
    if v_index = 7 then v_bad[1] := 'NaN'::double precision; end if;
    if v_index = 8 then v_bad[1] := 'Infinity'::double precision; end if;
    if v_index = 9 then v_bad[1] := '-Infinity'::double precision; end if;
    begin
      perform public.match_meme_embeddings(v_bad);
      raise exception 'invalid vector % was accepted', v_index;
    exception when invalid_parameter_value then null;
    end;
  end loop;
end $$;
reset role;

-- 긴 별칭도 batch encoder의 7000자 입력 한도를 넘지 않는다.
do $$
declare v_meme public.memes;
begin
  select m.* into v_meme from public.memes m
    where id = '93100000-0000-4000-8000-000000000001';
  v_meme.aliases := array[repeat('긴 별칭 ', 3000)];
  if char_length(public.meme_embedding_document(v_meme)) <> 6900 then
    raise exception 'canonical embedding document must cap at 6900 characters';
  end if;
end $$;

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"93100000-0000-4000-8000-000000999998"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000999001') then
    raise exception 'authenticated RLS exposes hidden parent';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"93100000-0000-4000-8000-000000999999"}', true);
set local role authenticated;
do $$
begin
  if not public.is_operator() then raise exception 'operator fixture is invalid'; end if;
  if exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000999001')
     or exists (select 1 from public.related_meme_embeddings(
      '93100000-0000-4000-8000-000000999001')) then
    raise exception 'operator must still see only public catalog embeddings';
  end if;
end $$;
reset role;

-- 상시 변경되는 점수/updated_at, 동일 원문의 UPDATE는 벡터를 유지한다.
update public.memes set trend_score = trend_score + 1, updated_at = now()
  where id = '93100000-0000-4000-8000-000000000001';
update public.memes set title = title where id = '93100000-0000-4000-8000-000000000001';
do $$
begin
  if not exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000000001') then
    raise exception 'trend-only or identical source update should preserve vector';
  end if;
end $$;

create temp table embedding_stale_hash as select source_hash
  from private.meme_semantic_embeddings where meme_id = '93100000-0000-4000-8000-000000000001';
grant select on embedding_stale_hash to service_role;
update public.memes set summary = E'changed \n    summary', aliases = array['alias one', 'alias two'],
  description = repeat('d', 3000) || 'excluded_description',
  origin = repeat('o', 1500) || 'excluded_origin',
  usage_note = repeat('u', 1000) || 'excluded_usage'
where id = '93100000-0000-4000-8000-000000000001';
do $$
declare v_document text;
begin
  if exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000000001') then
    raise exception 'source update must invalidate embedding';
  end if;
  select public.meme_embedding_document(m) into v_document from public.memes m
    where id = '93100000-0000-4000-8000-000000000001';
  if strpos(v_document, 'excluded_') > 0 or strpos(v_document, 'changed summary') = 0
     or strpos(v_document, 'alias one alias two') = 0 then
    raise exception 'document must normalize whitespace and cap long fields';
  end if;
end $$;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  v_id uuid := '93100000-0000-4000-8000-000000000001';
  v_query double precision[] := (select query from embedding_test_vectors);
  v_hash text;
begin
  if public.store_meme_embedding(v_id, (select source_hash from embedding_stale_hash), v_query) then
    raise exception 'stale source hash must return false';
  end if;
  select j.source_hash into v_hash from public.list_meme_embedding_jobs(
    '93100000-0000-4000-8000-000000000000', 100) j where j.meme_id = v_id;
  if v_hash is null then raise exception 'invalidated source must be queued again'; end if;
  if not public.store_meme_embedding(v_id, v_hash, v_query)
     or not public.store_meme_embedding(v_id, v_hash, v_query) then
    raise exception 'fresh store and idempotent retry must succeed';
  end if;
  if exists (select 1 from public.list_meme_embedding_jobs(null, 100) j where j.meme_id = v_id) then
    raise exception 'embedded source must not remain queued';
  end if;
  if public.store_meme_embedding('93100000-0000-4000-8000-000000999001',
      (select md5(public.meme_embedding_document(m)) from public.memes m
        where m.id = '93100000-0000-4000-8000-000000999001'), v_query)
     or public.store_meme_embedding('93100000-0000-4000-8000-000000999003', v_hash, v_query) then
    raise exception 'missing or nonpublic source cannot be stored';
  end if;
  if exists (select 1 from public.match_meme_embeddings(v_query, 40)
      where meme_id in ('93100000-0000-4000-8000-000000999001',
        '93100000-0000-4000-8000-000000999002')) then
    raise exception 'service public search must also exclude hidden vectors';
  end if;
  begin
    perform public.store_meme_embedding(v_id, v_hash, array_fill(0.0::double precision, array[384]));
    raise exception 'store accepted zero vector';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- 각 원문 필드가 단독으로 변경되어도 trigger가 작동해야 한다.
do $$
declare
  v_id uuid := '93100000-0000-4000-8000-000000000001';
  v_field text;
  v_hash text;
  v_query double precision[] := (select query from embedding_test_vectors);
begin
  foreach v_field in array array['title', 'aliases', 'summary', 'description', 'origin', 'usage_note'] loop
    select source_hash into v_hash from private.meme_semantic_embeddings where meme_id = v_id;
    if v_field = 'aliases' then
      update public.memes set aliases = array_prepend('changed_alias', aliases) where id = v_id;
    else
      execute format('update public.memes set %I = %L || coalesce(%I, %L) where id = $1',
        v_field, 'source change ', v_field, '') using v_id;
    end if;
    if exists (select 1 from private.meme_semantic_embeddings where meme_id = v_id)
       or public.store_meme_embedding(v_id, v_hash, v_query) then
      raise exception 'source field % did not invalidate stale embedding', v_field;
    end if;
    select md5(public.meme_embedding_document(m)) into v_hash from public.memes m where m.id = v_id;
    if not public.store_meme_embedding(v_id, v_hash, v_query) then
      raise exception 'fresh embedding cannot be restored after source change';
    end if;
  end loop;
end $$;

-- 상태 변경은 원문이 같아도 무효화한다. 삭제는 companion row를 cascade한다.
update public.memes set moderation_status = 'fact_checking'
  where id = '93100000-0000-4000-8000-000000000001';
do $$
begin
  if exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000000001') then
    raise exception 'status change must invalidate vector';
  end if;
  begin
    update private.meme_semantic_embeddings set model_profile = 'other-model'
      where meme_id = '93100000-0000-4000-8000-000000000002';
    raise exception 'mixed model profile accepted';
  exception when check_violation then null;
  end;
end $$;
delete from public.memes where id = '93100000-0000-4000-8000-000000000002';
do $$
begin
  if exists (select 1 from private.meme_semantic_embeddings
      where meme_id = '93100000-0000-4000-8000-000000000002') then
    raise exception 'parent deletion must cascade embedding';
  end if;
end $$;

-- 아직 임베딩이 없는 다수 행에서도 작업 batch는 최대100, UUID keyset을 지킨다.
insert into public.memes(id, title, slug, moderation_status)
select ('93200000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '벡터 batch QA ' || i, 'vector-batch-qa-' || i, 'approved'
from generate_series(1, 105) i;
set local role service_role;
do $$
declare v_after uuid := '93200000-0000-4000-8000-000000000100';
begin
  if (select count(*) from public.list_meme_embedding_jobs(
      '93200000-0000-4000-8000-000000000000', 1000)) <> 100
     or (select count(*) from public.list_meme_embedding_jobs(v_after, 100)
         where meme_id::text like '93200000-%') <> 5
     or (select count(*) from public.list_meme_embedding_jobs(v_after, 100)) > 100
     or exists (select 1 from public.list_meme_embedding_jobs(v_after, 100) j where j.meme_id <= v_after)
     or (select count(*) from public.list_meme_embedding_jobs(v_after, -1)) <> 1 then
    raise exception 'job listing must be bounded and use exclusive UUID keyset';
  end if;
end $$;
reset role;
