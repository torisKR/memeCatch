-- disposable/local DB의 BEGIN + 이 migration + 이 파일 + ROLLBACK으로만 실행한다.
-- 임시 단위 벡터/카탈로그 fixture를 사용하며 모델·운영 데이터·외부 API는 사용하지 않는다.
create temp table reference_rank_vectors as
select
  array[1.0::double precision, 0.0] || array_fill(0.0::double precision, array[382]) as query,
  array[0.4::double precision, 0.916515138991168] || array_fill(0.0::double precision, array[382]) as medium,
  array[-1.0::double precision, 0.0] || array_fill(0.0::double precision, array[382]) as distant;
grant select on reference_rank_vectors to anon, authenticated, service_role;

insert into public.memes(id, title, slug, aliases, summary, description, origin, usage_note, moderation_status) values
  ('95300000-0000-4000-8000-000000000001', '랭크테스트 초성손민수', 'reference-rank-exact',
    array['손민수 QA', 'ＴＭＩ QA'], '', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000002', '랭크 의미 우선', 'reference-rank-semantic',
    '{}', '', '', '', '', 'limited'),
  ('95300000-0000-4000-8000-000000000003', '랭크 SQL 비공개', 'reference-rank-pending',
    array['숨긴 랭크'], 'qarankword qastemtag', '', '', '', 'pending'),
  ('95300000-0000-4000-8000-000000000004', '랭크 SQL 거절', 'reference-rank-rejected',
    array['숨긴 랭크'], 'qarankword qastemtag', '', '', '', 'rejected'),
  ('95300000-0000-4000-8000-000000000005', '랭크 문서 후보', 'reference-rank-document',
    '{}', '', 'qadescription qareindexlexmagic', 'qaorigin', 'qausage', 'approved'),
  ('95300000-0000-4000-8000-000000000007', '랭크 동점 앞', 'reference-rank-tie-first',
    '{}', 'qarankword', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000008', '랭크 동점 뒤', 'reference-rank-tie-second',
    '{}', 'qarankword', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000009', 'qaranktitle', 'reference-rank-title-weight',
    '{}', '', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000010', '랭크 요약 가중', 'reference-rank-summary-weight',
    '{}', 'qaranktitle', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000011', '랭크 본문 반복', 'reference-rank-body-repeat',
    '{}', '', 'qaranktitle', 'qaranktitle', 'qaranktitle', 'approved'),
  ('95300000-0000-4000-8000-000000000012', '랭크 본문 단일', 'reference-rank-body-single',
    '{}', '', 'qaranktitle', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000013', '랭크 원문 상한', 'reference-rank-capped-document',
    '{}', '', repeat('x', 3000) || 'qabeyondedge', repeat('y', 1500) || 'qaoriginbeyond',
    repeat('z', 1000) || 'qausagebeyond', 'approved'),
  ('95300000-0000-4000-8000-000000000014', '랭크 조사 비교', 'reference-rank-stem-control',
    '{}', '', 'qastemtag', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000015', '랭크 조사 대상', 'reference-rank-stem-target',
    array['손민수'], '', 'qastemtag', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000016', 'qaboolean', 'reference-rank-boolean-title',
    array['qaboolean', 'qaboolean'], '', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000017', '랭크 별칭 요약', 'reference-rank-boolean-summary',
    array['qaboolean'], 'qaboolean', '', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000018', '랭크 짧은 어근 비교', 'reference-rank-short-stem-control',
    array['귀족'], '', 'qashortstemtag', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000019', '랭크 조사 이름 보존', 'reference-rank-short-stem',
    array['귀가'], '', 'qashortstemtag', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000020', '랭크 토큰 제외', 'reference-rank-token-cap-outside',
    '{}', '', 'qa13', '', '', 'approved'),
  ('95300000-0000-4000-8000-000000000021', '랭크 토큰 포함', 'reference-rank-token-cap-inside',
    '{}', '', 'qa12', '', '', 'approved');

-- 후보 제한과 단순 의미 순위에 충분한, 단어가 겹치지 않는 추가 fixture.
insert into public.memes(id, title, slug, moderation_status)
select ('95300000-0000-4000-8000-' || lpad((100 + i)::text, 12, '0'))::uuid,
  '단위 벡터 후보 ' || i, 'reference-rank-candidate-' || i, 'approved'
from generate_series(1, 42) i;

insert into private.meme_semantic_embeddings(meme_id, embedding, source_hash)
select m.id, private.meme_embedding_vector(case
  when m.id in ('95300000-0000-4000-8000-000000000002',
    '95300000-0000-4000-8000-000000000003', '95300000-0000-4000-8000-000000000004') then v.query
  when m.id in ('95300000-0000-4000-8000-000000000007', '95300000-0000-4000-8000-000000000008') then v.medium
  else v.distant end), md5(public.meme_embedding_document(m))
from public.memes m cross join reference_rank_vectors v
where m.id::text like '95300000-0000-4000-8000-%'
  and m.id not in ('95300000-0000-4000-8000-000000000005',
    '95300000-0000-4000-8000-000000000013', '95300000-0000-4000-8000-000000000014',
    '95300000-0000-4000-8000-000000000015', '95300000-0000-4000-8000-000000000016',
    '95300000-0000-4000-8000-000000000017', '95300000-0000-4000-8000-000000000018',
    '95300000-0000-4000-8000-000000000019', '95300000-0000-4000-8000-000000000020',
    '95300000-0000-4000-8000-000000000021');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('95300000-0000-4000-8000-000000999999', 'reference-rank-operator@example.com', now(),
  '{"nickname":"순위운영"}'::jsonb, now(), now());
update public.profiles set role = 'operator' where id = '95300000-0000-4000-8000-000000999999';

do $$
declare v_role text; v_proc pg_proc;
begin
  select * into v_proc from pg_proc
    where oid = 'public.search_meme_references(text,double precision[],integer)'::regprocedure;
  if v_proc.prosecdef or v_proc.provolatile <> 's'
     or v_proc.proconfig is distinct from array['search_path=pg_catalog']
     or v_proc.proargnames[4:8] is distinct from array['id','short_id','slug','title','summary'] then
    raise exception 'reference search must be stable, invoker, fixed-path and minimal DTO';
  end if;
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if not has_function_privilege(v_role,
      'public.search_meme_references(text,double precision[],integer)', 'EXECUTE') then
      raise exception 'reference search not readable by %', v_role;
    end if;
  end loop;
  foreach v_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(v_role, 'private.meme_semantic_embeddings', 'INSERT,UPDATE,DELETE,TRUNCATE')
       or has_function_privilege(v_role, 'public.store_meme_embedding(uuid,text,double precision[])', 'EXECUTE') then
      raise exception 'reference search expanded write privileges for %', v_role;
    end if;
  end loop;
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  v_vector double precision[] := (select query from reference_rank_vectors);
  v_result uuid[];
  v_repeat uuid[];
  v_query text;
  v_limit integer;
  v_bad double precision[];
  v_index integer;
begin
  if (select id from public.search_meme_references('랭크테스트초성손민수', v_vector, 1)) <>
      '95300000-0000-4000-8000-000000000001'::uuid then
    raise exception 'whitespace-insensitive exact title must pin above closer semantics';
  end if;
  if (select id from public.search_meme_references('  ｔｍｉ　ｑａ  ', v_vector, 1)) <>
      '95300000-0000-4000-8000-000000000001'::uuid then
    raise exception 'NFKC casefold exact alias must pin above closer semantics';
  end if;
  if (select id from public.search_meme_references('랭크테스트초성손', v_vector, 1)) <>
      '95300000-0000-4000-8000-000000000001'::uuid
     or (select id from public.search_meme_references('ㅊㅅㅅㅁㅅ', v_vector, 1)) <>
      '95300000-0000-4000-8000-000000000001'::uuid then
    raise exception 'literal partial name and raw compatibility chosung must be prioritized';
  end if;
  if (select id from public.search_meme_references('%_', v_vector, 1)) <>
      '95300000-0000-4000-8000-000000000002'::uuid then
    raise exception 'percent and underscore must remain literal, never LIKE wildcards';
  end if;
  if (select count(*) from public.search_meme_references('qanonexistent qanoother', v_vector, 20)) <> 20
     or (select count(*) from public.search_meme_references('qanonexistent qanoother', v_vector)) <> 12 then
    raise exception 'semantic fallback within indexed catalog must honor 1..20/default12';
  end if;

  select array_agg(r.id) into v_result
    from public.search_meme_references('qarankword qanoother', v_vector, 20) r;
  select array_agg(r.id) into v_repeat
    from public.search_meme_references('qarankword qanoother', v_vector, 20) r;
  if v_result is distinct from v_repeat
     or array_position(v_result, '95300000-0000-4000-8000-000000000007'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000008'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000007'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000008'::uuid) then
    raise exception 'fusion must be deterministic and break equal rank evidence by UUID';
  end if;
  if exists(select 1 from public.search_meme_references('랭크 SQL 비공개', v_vector, 20)
      where id in ('95300000-0000-4000-8000-000000000003', '95300000-0000-4000-8000-000000000004')) then
    raise exception 'hidden exact names or closest vectors leaked to anon';
  end if;

  foreach v_query in array array['qadescription qanoother', 'qaorigin qanoother', 'qausage qanoother'] loop
    if not exists(select 1 from public.search_meme_references(v_query, v_vector, 20)
        where id = '95300000-0000-4000-8000-000000000005') then
      raise exception 'bounded document token candidate % was lost without its own embedding', v_query;
    end if;
  end loop;
  foreach v_query in array array['qabeyondedge qanoother', 'qaoriginbeyond qanoother', 'qausagebeyond qanoother'] loop
    if exists(select 1 from public.search_meme_references(v_query, v_vector, 20)
        where id = '95300000-0000-4000-8000-000000000013') then
      raise exception 'document field cap ignored for %', v_query;
    end if;
  end loop;

  select array_agg(r.id) into v_result
    from public.search_meme_references('qaranktitle qanoother', v_vector, 20) r;
  if array_position(v_result, '95300000-0000-4000-8000-000000000009'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000010'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000011'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000012'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000009'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000010'::uuid)
     or array_position(v_result, '95300000-0000-4000-8000-000000000010'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000011'::uuid)
     or array_position(v_result, '95300000-0000-4000-8000-000000000011'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000012'::uuid) then
    raise exception 'title3 > summary2 > one body1, with body category boolean and UUID ties';
  end if;

  select array_agg(r.id) into v_result
    from public.search_meme_references('qaboolean qanoother', v_vector, 20) r;
  if array_position(v_result, '95300000-0000-4000-8000-000000000017'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000016'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000017'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000016'::uuid) then
    raise exception 'title and alias matches must share one boolean3 category';
  end if;
  select array_agg(r.id) into v_result
    from public.search_meme_references('손민수를 qastemtag', v_vector, 20) r;
  if array_position(v_result, '95300000-0000-4000-8000-000000000015'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000014'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000015'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000014'::uuid) then
    raise exception 'Korean particle stripping must retain a stem of at least2 characters';
  end if;
  select array_agg(r.id) into v_result
    from public.search_meme_references('귀가 qashortstemtag', v_vector, 20) r;
  if array_position(v_result, '95300000-0000-4000-8000-000000000019'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000018'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000019'::uuid) >=
       array_position(v_result, '95300000-0000-4000-8000-000000000018'::uuid) then
    raise exception 'one-character stem must not replace the original two-character token';
  end if;

  select array_agg(r.id) into v_result
    from public.search_meme_references('qa01 qa02 qa03 qa04 qa05 qa06 qa07 qa08 qa09 qa10 qa11 qa12 qa13', v_vector, 20) r;
  if array_position(v_result, '95300000-0000-4000-8000-000000000021'::uuid) is null
     or array_position(v_result, '95300000-0000-4000-8000-000000000020'::uuid) is not null then
    raise exception 'tokens must preserve first occurrence order and cap at12 distinct values';
  end if;
  if not exists(select 1 from public.search_meme_references(
      'qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa01 qa12', v_vector, 20)
      where id = '95300000-0000-4000-8000-000000000021') then
    raise exception 'duplicate tokens must not consume the 12-token candidate budget';
  end if;

  foreach v_query in array array[null::text, '', 'x', E' \t\n ', repeat('x',121)] loop
    begin
      perform public.search_meme_references(v_query, v_vector);
      raise exception 'invalid query accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach v_limit in array array[null::integer, 0, -1, 21, 999] loop
    begin
      perform public.search_meme_references('정상 입력', v_vector, v_limit);
      raise exception 'invalid limit accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  for v_index in 1..9 loop
    v_bad := case v_index
      when 1 then null
      when 2 then array_fill(1.0::double precision, array[383])
      when 3 then array_fill(1.0::double precision, array[385])
      when 4 then array_fill(0.0::double precision, array[384])
      when 5 then array_fill(0.01::double precision, array[2,192])
      else v_vector end;
    if v_index = 6 then v_bad[1] := null; end if;
    if v_index = 7 then v_bad[1] := 'NaN'::double precision; end if;
    if v_index = 8 then v_bad[1] := 'Infinity'::double precision; end if;
    if v_index = 9 then v_bad[1] := '-Infinity'::double precision; end if;
    begin
      perform public.search_meme_references('정상 입력', v_bad);
      raise exception 'invalid vector % accepted', v_index;
    exception when invalid_parameter_value then null;
    end;
  end loop;
end $$;
reset role;

-- 운영자가 일반 memes RLS로 더 넓게 읽을 수 있어도 공개 검색은 공개 상태만 반환한다.
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"95300000-0000-4000-8000-000000999999"}', true);
set local role authenticated;
do $$
declare v_vector double precision[] := (select query from reference_rank_vectors);
begin
  if not public.is_operator() then raise exception 'operator fixture is invalid'; end if;
  if exists(select 1 from public.search_meme_references('숨긴 랭크', v_vector, 20)
      where id in ('95300000-0000-4000-8000-000000000003', '95300000-0000-4000-8000-000000000004')) then
    raise exception 'operator reference search leaked hidden catalog';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare v_vector double precision[] := (select query from reference_rank_vectors);
begin
  if exists(select 1 from public.search_meme_references('숨긴 랭크', v_vector, 20)
      where id in ('95300000-0000-4000-8000-000000000003', '95300000-0000-4000-8000-000000000004')) then
    raise exception 'service role must still return only public references';
  end if;
end $$;
reset role;

-- Rollback-only restrictive fixture proves caller RLS and an empty visible semantic index,
-- while one public lexical/name row remains visible; it never changes deployed policies.
create policy reference_rank_test_visible_scope on public.memes
  as restrictive for select to anon
  using (id = '95300000-0000-4000-8000-000000000005'::uuid);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_vector double precision[] := (select query from reference_rank_vectors);
begin
  if (select count(*) from public.memes) <> 1 then
    raise exception 'restrictive caller RLS fixture is invalid';
  end if;
  if exists(select 1 from public.search_meme_references('랭크 문서 후보', v_vector, 20)) then
    raise exception 'an empty caller-visible semantic index must signal lexical fallback';
  end if;
end $$;
reset role;
drop policy reference_rank_test_visible_scope on public.memes;
