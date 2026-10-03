-- 공개 밈 카탈로그의 의미 검색용 companion table.
-- 별도 벡터 서버나 유료 API 대신 기존 PostgreSQL의 pgvector를 사용한다.
-- 초기 약 5천 행은 exact cosine 검색으로 시작한다. HNSW는 측정 후 추가한다.
-- private는 PostgREST exposed schemas에 추가하지 않는다.
create extension if not exists vector with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table private.meme_semantic_embeddings (
  meme_id uuid primary key references public.memes(id) on delete cascade,
  embedding extensions.vector(384) not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{32}$'),
  model_profile text not null default 'multilingual-e5-small-v1'
    check (model_profile = 'multilingual-e5-small-v1'),
  embedded_at timestamptz not null default now()
);

alter table private.meme_semantic_embeddings enable row level security;
create policy meme_semantic_embeddings_public_read
  on private.meme_semantic_embeddings for select to anon, authenticated
  using (exists (
    select 1 from public.memes m
    where m.id = meme_id and m.moderation_status in ('approved', 'limited')
  ));

revoke all on table private.meme_semantic_embeddings from public, anon, authenticated;
grant select on table private.meme_semantic_embeddings to anon, authenticated;
grant all on table private.meme_semantic_embeddings to service_role;
comment on table private.meme_semantic_embeddings is
  '공개 카탈로그 전용 384차원 multilingual-e5-small-v1. API 비노출 schema; service_role만 쓰기.';

-- 임베딩과 source_hash의 공통 원문. 날짜/유행 점수 갱신은 재임베딩하지 않는다.
create or replace function public.meme_embedding_document(p_meme public.memes)
returns text
language sql immutable security invoker
set search_path = pg_catalog
as $$
  select left(btrim(regexp_replace(concat_ws(E'\n',
    (p_meme).title,
    array_to_string((p_meme).aliases, ' '),
    (p_meme).summary,
    left((p_meme).description, 3000),
    left((p_meme).origin, 1500),
    left((p_meme).usage_note, 1000)
  ), '[[:space:]]+', ' ', 'g')), 6900);
$$;
revoke all on function public.meme_embedding_document(public.memes) from public, anon, authenticated;
grant execute on function public.meme_embedding_document(public.memes) to service_role;

-- bounded array 검증 후 정규화한다. scale을 먼저 나누어 극단적인 유한 값도
-- norm 계산에서 overflow/underflow하지 않고 pgvector float32로 안전하게 변환한다.
create or replace function private.meme_embedding_vector(p_embedding double precision[])
returns extensions.vector
language plpgsql immutable security invoker
set search_path = pg_catalog
as $$
declare
  v_scale double precision;
  v_norm double precision;
  v_values double precision[];
begin
  if p_embedding is null or array_ndims(p_embedding) is distinct from 1
     or cardinality(p_embedding) <> 384
     or exists (
       select 1 from unnest(p_embedding) x(value)
       where x.value is null or x.value in (
         'NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision
       )
     ) then
    raise exception using errcode = '22023', message = 'invalid_embedding';
  end if;

  select max(abs(x.value)) into v_scale from unnest(p_embedding) x(value);
  if v_scale = 0 then
    raise exception using errcode = '22023', message = 'invalid_embedding';
  end if;
  -- float32 정밀도보다 작은 상대 성분은 0으로 처리하여 극단적인 범위의
  -- 유한 float64 입력에서도 나눗셈/제곱/float32 변환의 underflow를 피한다.
  select array_agg(case
      when abs(x.value)::numeric < v_scale::numeric * 1e-30::numeric then 0.0::double precision
      else x.value / v_scale end order by x.ordinality)
    into v_values from unnest(p_embedding) with ordinality x(value, ordinality);
  select sqrt(sum(power(x.value, 2))) into v_norm from unnest(v_values) x(value);
  select array_agg(x.value / v_norm order by x.ordinality)
    into v_values from unnest(v_values) with ordinality x(value, ordinality);
  return v_values::extensions.vector(384);
end;
$$;
revoke all on function private.meme_embedding_vector(double precision[]) from public;
grant execute on function private.meme_embedding_vector(double precision[]) to anon, authenticated, service_role;

create or replace function public.match_meme_embeddings(
  p_embedding double precision[],
  p_limit integer default 20,
  p_exclude_meme_id uuid default null
)
returns table(meme_id uuid, similarity double precision)
language plpgsql stable security invoker
set search_path = pg_catalog
as $$
declare
  v_embedding extensions.vector(384) := private.meme_embedding_vector(p_embedding);
begin
  return query
    select e.meme_id,
      greatest(-1.0::double precision, least(1.0::double precision,
        1 - (e.embedding operator(extensions.<=>) v_embedding)))
    from private.meme_semantic_embeddings e
    join public.memes m on m.id = e.meme_id
    where m.moderation_status in ('approved', 'limited')
      and (p_exclude_meme_id is null or e.meme_id <> p_exclude_meme_id)
    order by e.embedding operator(extensions.<=>) v_embedding, e.meme_id
    limit greatest(1, least(coalesce(p_limit, 20), 40));
end;
$$;
revoke all on function public.match_meme_embeddings(double precision[], integer, uuid) from public;
grant execute on function public.match_meme_embeddings(double precision[], integer, uuid) to anon, authenticated, service_role;

-- 관련 밈은 저장된 벡터를 재사용하므로 방문 요청마다 모델을 실행하지 않는다.
create or replace function public.related_meme_embeddings(
  p_meme_id uuid,
  p_limit integer default 9
)
returns table(meme_id uuid, similarity double precision)
language plpgsql stable security invoker
set search_path = pg_catalog
as $$
declare
  v_embedding extensions.vector(384);
begin
  select e.embedding into v_embedding
    from private.meme_semantic_embeddings e
    join public.memes m on m.id = e.meme_id
    where e.meme_id = p_meme_id and m.moderation_status in ('approved', 'limited');
  if v_embedding is null then return; end if;

  return query
    select e.meme_id,
      greatest(-1.0::double precision, least(1.0::double precision,
        1 - (e.embedding operator(extensions.<=>) v_embedding)))
    from private.meme_semantic_embeddings e
    join public.memes m on m.id = e.meme_id
    where m.moderation_status in ('approved', 'limited') and e.meme_id <> p_meme_id
    order by e.embedding operator(extensions.<=>) v_embedding, e.meme_id
    limit greatest(1, least(coalesce(p_limit, 9), 40));
end;
$$;
revoke all on function public.related_meme_embeddings(uuid, integer) from public;
grant execute on function public.related_meme_embeddings(uuid, integer) to anon, authenticated, service_role;

-- 로컬 worker용 keyset batch. 모델은 고정하며 공개 상태만 처리한다.
create or replace function public.list_meme_embedding_jobs(
  p_after uuid default null,
  p_limit integer default 25
)
returns table(meme_id uuid, document text, source_hash text)
language sql stable security invoker
set search_path = pg_catalog
as $$
  with candidates as (
    select m.* from public.memes m
    where m.moderation_status in ('approved', 'limited')
      and (p_after is null or m.id > p_after)
      and not exists (select 1 from private.meme_semantic_embeddings e where e.meme_id = m.id)
    order by m.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  select m.id, d.document, md5(d.document)
  from candidates m
  cross join lateral (select public.meme_embedding_document(m::public.memes) as document) d
  order by m.id;
$$;
revoke all on function public.list_meme_embedding_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_meme_embedding_jobs(uuid, integer) to service_role;

-- 원문 조회→모델 처리 중 바뀐 결과는 저장하지 않는다.
-- FOR SHARE는 같은 부모 행의 UPDATE/DELETE와 경합하여 검증과 저장을 보호한다.
create or replace function public.store_meme_embedding(
  p_meme_id uuid,
  p_source_hash text,
  p_embedding double precision[]
)
returns boolean
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
declare
  v_meme public.memes;
  v_embedding extensions.vector(384) := private.meme_embedding_vector(p_embedding);
begin
  select m.* into v_meme from public.memes m where m.id = p_meme_id for share;
  if not found or v_meme.moderation_status not in ('approved', 'limited')
     or p_source_hash is distinct from md5(public.meme_embedding_document(v_meme)) then
    return false;
  end if;

  insert into private.meme_semantic_embeddings(meme_id, embedding, source_hash)
    values (p_meme_id, v_embedding, p_source_hash)
  on conflict (meme_id) do update set
    embedding = excluded.embedding,
    source_hash = excluded.source_hash,
    model_profile = 'multilingual-e5-small-v1',
    embedded_at = now();
  return true;
end;
$$;
revoke all on function public.store_meme_embedding(uuid, text, double precision[]) from public, anon, authenticated;
grant execute on function public.store_meme_embedding(uuid, text, double precision[]) to service_role;

create or replace function private.invalidate_meme_embedding()
returns trigger
language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  delete from private.meme_semantic_embeddings where meme_id = new.id;
  return new;
end;
$$;
revoke all on function private.invalidate_meme_embedding() from public, anon, authenticated, service_role;
create trigger trg_invalidate_meme_embedding
  after update of title, aliases, summary, description, origin, usage_note, moderation_status
  on public.memes for each row
  when (old.title is distinct from new.title
    or old.aliases is distinct from new.aliases
    or old.summary is distinct from new.summary
    or old.description is distinct from new.description
    or old.origin is distinct from new.origin
    or old.usage_note is distinct from new.usage_note
    or old.moderation_status is distinct from new.moderation_status)
  execute function private.invalidate_meme_embedding();

comment on function public.match_meme_embeddings(double precision[], integer, uuid) is
  '공개 approved/limited만. 384차원·유한·비제로 입력, exact cosine, 최대40건, 호출자 RLS.';
comment on function public.related_meme_embeddings(uuid, integer) is
  '공개 seed의 저장된 벡터를 재사용하는 관련 카탈로그 검색. 생성·권리 허가·자동 공개와 별개.';
