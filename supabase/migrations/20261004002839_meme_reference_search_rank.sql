-- 의미 검색과 단어 검색을 하나의 읽기 전용 RPC로 합친다.
-- 동일 FP32 임베딩/profile을 사용하며 공개 카탈로그의 호출자 RLS를 보존한다.
-- 독립 dev 평가에서 선택한 RRF k=60, lexical=1, semantic=1을 고정한다.
create or replace function public.search_meme_references(
  p_query text,
  p_embedding double precision[],
  p_limit integer default 12
)
returns table(id uuid, short_id text, slug text, title text, summary text)
language plpgsql stable security invoker
set search_path = pg_catalog
as $$
declare
  v_query text;
  v_compact text;
  v_chosung text;
  v_tokens text[];
  v_embedding extensions.vector(384);
  v_stops constant text[] := array[
    '사람', '행동', '상황', '하는', '때', '것', '수', '말', '뜻', '어떤', '어떻게',
    '그냥', '정말', '너무', '하는데', '하고', '같은', '이렇게', '누가', '있는',
    '없는', '많이', '밈', '추천', '찾아', '찾기'
  ];
  v_rrf_k constant double precision := 60.0;
  v_lexical_weight constant double precision := 1.0;
  v_semantic_weight constant double precision := 1.0;
begin
  if p_query is null then
    raise exception using errcode = '22023', message = 'invalid_query';
  end if;
  v_query := regexp_replace(p_query, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(v_query) not between 2 and 120
     or p_limit is null or p_limit not between 1 and 20 then
    raise exception using errcode = '22023', message = 'invalid_query_or_limit';
  end if;
  v_query := regexp_replace(lower(normalize(v_query, NFKC)),
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(v_query) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'invalid_query';
  end if;
  v_embedding := private.meme_embedding_vector(p_embedding);
  v_compact := regexp_replace(v_query, '[[:space:]]+', '', 'g');
  -- NFKC는 호환 초성을 조합 자모로 바꾸므로 저장된 title_chosung에는 원문을 쓴다.
  v_chosung := regexp_replace(lower(p_query), '[[:space:]]+', '', 'g');

  select coalesce(array_agg(t.token order by t.first_position), '{}'::text[])
    into v_tokens
  from (
    select s.token, min(r.position) as first_position
    from regexp_split_to_table(v_query, '[^[:alnum:]가-힣ㄱ-ㅎ]+')
      with ordinality r(raw_token, position)
    cross join lateral (
      select case when r.raw_token ~ '^[가-힣]+$' then regexp_replace(r.raw_token,
        '(으로|에서|에게|한테|처럼|까지|부터|보다|라고|하고|을|를|은|는|이|가|와|과|의|에|도|만)$', '')
        else r.raw_token end as stem
    ) stripped
    cross join lateral (
      select case when char_length(stripped.stem) >= 2 then stripped.stem else r.raw_token end as token
    ) s
    where char_length(s.token) >= 2
      and r.raw_token <> all(v_stops) and s.token <> all(v_stops)
    group by s.token
    order by min(r.position)
    limit 12
  ) t;

  return query
  with semantic_candidates as materialized (
    select e.meme_id, e.embedding operator(extensions.<=>) v_embedding as distance
    from private.meme_semantic_embeddings e
    join public.memes m on m.id = e.meme_id
    where m.moderation_status in ('approved', 'limited')
    order by e.embedding operator(extensions.<=>) v_embedding, e.meme_id
    limit 40
  ), semantic_ranks as (
    select s.meme_id, row_number() over (order by s.distance, s.meme_id) as rank
    from semantic_candidates s
  ), lexical_candidates as materialized (
    select m.id as meme_id, names.priority, words.score
    from public.memes m
    -- OFFSET 0 keeps bounded normalization in one per-row lateral evaluation,
    -- avoiding a catalog-sized materialization of full normalized documents.
    cross join lateral (
      select lower(normalize(m.title, NFKC)) as normalized_title,
        array(select lower(normalize(a.alias, NFKC))
          from unnest(m.aliases) a(alias)) as normalized_aliases,
        lower(normalize(m.summary, NFKC)) as normalized_summary,
        lower(normalize(concat_ws(' ', left(m.description, 3000),
          left(m.origin, 1500), left(m.usage_note, 1000)), NFKC)) as normalized_body
      offset 0
    ) normalized
    cross join lateral (
      select regexp_replace(normalized.normalized_title, '[[:space:]]+', '', 'g') as compact_title,
        array(select regexp_replace(a.alias, '[[:space:]]+', '', 'g')
          from unnest(normalized.normalized_aliases) a(alias)) as compact_aliases
      offset 0
    ) compact
    cross join lateral (
      select case
        when v_compact = compact.compact_title or v_compact = any(compact.compact_aliases) then 2
        when strpos(compact.compact_title, v_compact) > 0
          or exists (select 1 from unnest(compact.compact_aliases) a(alias)
            where strpos(a.alias, v_compact) > 0)
          or (v_chosung ~ '^[ㄱ-ㅎ]+$' and strpos(coalesce(m.title_chosung, ''), v_chosung) > 0)
          then 1 else 0 end as priority
    ) names
    cross join lateral (
      select coalesce(sum(
        case when strpos(normalized.normalized_title, t.token) > 0
          or exists (select 1 from unnest(normalized.normalized_aliases) a(alias)
            where strpos(a.alias, t.token) > 0) then 3 else 0 end
        + case when strpos(normalized.normalized_summary, t.token) > 0 then 2 else 0 end
        + case when strpos(normalized.normalized_body, t.token) > 0 then 1 else 0 end
      ), 0)::integer as score
      from unnest(v_tokens) t(token)
    ) words
    where m.moderation_status in ('approved', 'limited')
      and (names.priority > 0 or words.score > 0)
    order by names.priority desc, words.score desc, m.id
    limit 40
  ), lexical_ranks as (
    select l.meme_id, l.priority,
      row_number() over (order by l.priority desc, l.score desc, l.meme_id) as rank
    from lexical_candidates l
  ), contributions as (
    select l.meme_id, l.priority, v_lexical_weight / (v_rrf_k + l.rank) as score
    from lexical_ranks l
    union all
    select s.meme_id, 0, v_semantic_weight / (v_rrf_k + s.rank)
    from semantic_ranks s
  ), fused as (
    select c.meme_id, max(c.priority) as priority, sum(c.score) as score
    from contributions c group by c.meme_id
  )
  select m.id, m.short_id::text, m.slug::text, m.title::text, m.summary::text
  from fused f join public.memes m on m.id = f.meme_id
  where m.moderation_status in ('approved', 'limited')
    -- 비어 있는 의미 색인은 서버가 정직한 index_empty/keyword fallback으로 처리한다.
    and exists (select 1 from semantic_candidates)
  order by f.priority desc, f.score desc, m.id
  limit p_limit;
end;
$$;

revoke all on function public.search_meme_references(text, double precision[], integer) from public;
grant execute on function public.search_meme_references(text, double precision[], integer) to anon, authenticated, service_role;
comment on function public.search_meme_references(text, double precision[], integer) is
  '공개 approved/limited 및 호출자 RLS. 정확한 제목/별칭·초성 우선, 단어+384D 의미 RRF. 최소 DTO, 최대20건, 읽기 전용.';
