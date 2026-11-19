-- 20261119170000_meme_contributions_20261119.sql
-- 밈 상세에서 받는 문서 보강 제보(출처 링크·사용 예문).
--
-- 기존 meme_submissions는 "새 밈 제보" 큐다. 승인하면 밈을 새로 만든다. 보강 제보를
-- 그 테이블에 섞으면 승인 경로(approveSubmission, 외부 AI 검수 자동화)가 기존 밈과 같은
-- 이름의 새 밈을 만들 수 있어 별도 테이블로 분리한다.
--
-- 쓰기는 전부 security definer RPC로만 한다(직접 insert/update 정책 없음).
--   submit_meme_contribution  — 로그인 사용자, 공개 밈에만, 1시간 10건
--   review_meme_contribution  — 운영자, 승인 시 meme_sources 또는 memes.usage_examples에 반영
--   get_meme_contributors     — 공개, 승인되고 이름 공개에 동의한 기여자 닉네임만
--
-- Additive only. Do not apply to prod from the PR alone; wait for toris approval.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/migrations/20261119170000_meme_contributions_20261119.sql

set local lock_timeout = '15s';

create table if not exists public.meme_contributions (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid not null references public.memes(id) on delete cascade,
  contributor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('source', 'example')),
  source_url text check (
    source_url is null
    or (char_length(source_url) <= 500 and source_url ~* '^https://\S+\.\S+$')
  ),
  note text check (note is null or char_length(note) <= 300),
  example_situation text check (
    example_situation is null or char_length(example_situation) between 1 and 120
  ),
  example_text text check (
    example_text is null or char_length(example_text) between 1 and 500
  ),
  credit_public boolean not null default true,
  status public.submission_status not null default 'pending',
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_source_id uuid references public.meme_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint meme_contributions_shape check (
    (kind = 'source' and source_url is not null
      and example_situation is null and example_text is null)
    or
    (kind = 'example' and source_url is null
      and example_situation is not null and example_text is not null)
  )
);

comment on table public.meme_contributions is
  '밈 상세에서 받는 출처 링크·사용 예문 보강 제보. 쓰기는 submit_/review_meme_contribution RPC로만.';

create index if not exists meme_contributions_queue_idx
  on public.meme_contributions (status, created_at);
create index if not exists meme_contributions_meme_idx
  on public.meme_contributions (meme_id, status);
create index if not exists meme_contributions_contributor_idx
  on public.meme_contributions (contributor_id, created_at desc);
-- 같은 밈에 같은 링크가 검토 대기 중이면 한 번만 받는다.
create unique index if not exists meme_contributions_pending_source_uniq
  on public.meme_contributions (meme_id, lower(source_url))
  where kind = 'source' and status in ('pending', 'reviewing');

alter table public.meme_contributions enable row level security;
revoke all on public.meme_contributions from public, anon, authenticated;
grant select on public.meme_contributions to authenticated;
grant all on public.meme_contributions to service_role;

drop policy if exists meme_contributions_read on public.meme_contributions;
create policy meme_contributions_read on public.meme_contributions for select
  using (public.is_operator() or contributor_id = (select auth.uid()));

-- ── 제출 ────────────────────────────────────────────────
create or replace function public.submit_meme_contribution(
  p_meme_id uuid,
  p_kind text,
  p_source_url text,
  p_note text,
  p_situation text,
  p_text text,
  p_credit_public boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_situation text := nullif(btrim(coalesce(p_situation, '')), '');
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_recent int;
  v_id uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'login_required';
  end if;
  if p_kind is null or p_kind not in ('source', 'example') then
    raise exception using errcode = '22023', message = 'invalid_kind';
  end if;
  if not exists (
    select 1 from public.memes m
     where m.id = p_meme_id and m.moderation_status in ('approved', 'limited')
  ) then
    raise exception using errcode = '22023', message = 'meme_not_found';
  end if;

  if p_kind = 'source' then
    if v_url is null or char_length(v_url) > 500 or v_url !~* '^https://\S+\.\S+$' then
      raise exception using errcode = '22023', message = 'invalid_url';
    end if;
    if v_note is not null and char_length(v_note) > 300 then
      raise exception using errcode = '22023', message = 'invalid_note';
    end if;
    v_situation := null;
    v_text := null;
    if exists (
      select 1 from public.meme_sources s
       where s.meme_id = p_meme_id and lower(s.source_url) = lower(v_url)
    ) then
      raise exception using errcode = '23505', message = 'already_linked';
    end if;
  else
    if v_situation is null or char_length(v_situation) > 120 then
      raise exception using errcode = '22023', message = 'invalid_situation';
    end if;
    if v_text is null or char_length(v_text) > 500 then
      raise exception using errcode = '22023', message = 'invalid_text';
    end if;
    v_url := null;
    v_note := null;
  end if;

  select count(*) into v_recent
    from public.meme_contributions c
   where c.contributor_id = v_user
     and c.created_at > now() - interval '60 minutes';
  if v_recent >= 10 then
    raise exception using errcode = 'P0429', message = 'rate_limited';
  end if;

  begin
    insert into public.meme_contributions (
      meme_id, contributor_id, kind, source_url, note,
      example_situation, example_text, credit_public
    ) values (
      p_meme_id, v_user, p_kind, v_url, v_note,
      v_situation, v_text, coalesce(p_credit_public, true)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'already_pending';
  end;

  return v_id;
end;
$function$;

revoke all on function public.submit_meme_contribution(uuid, text, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.submit_meme_contribution(uuid, text, text, text, text, text, boolean)
  to authenticated, service_role;

-- ── 검수(승인·반려) ─────────────────────────────────────
-- 승인은 반영까지 한 트랜잭션이다. 출처는 meme_sources에 행을 더하고, 예문은
-- memes.usage_examples 배열 끝에 붙인다(공개 화면은 최대 3개만 보여 주므로 꽉 찼으면 거절).
create or replace function public.review_meme_contribution(
  p_id uuid,
  p_decision text,
  p_source_title text,
  p_situation text,
  p_text text,
  p_reject_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.meme_contributions%rowtype;
  v_examples jsonb;
  v_situation text;
  v_text text;
  v_title text := nullif(btrim(coalesce(p_source_title, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reject_reason, '')), '');
  v_platform text;
  v_source_id uuid;
begin
  if v_actor is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_decision';
  end if;

  select * into v_row from public.meme_contributions where id = p_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'contribution_not_found';
  end if;
  if v_row.status not in ('pending', 'reviewing') then
    raise exception using errcode = '22023', message = 'already_reviewed';
  end if;

  if p_decision = 'reject' then
    if v_reason is null or char_length(v_reason) > 500 then
      raise exception using errcode = '22023', message = 'reject_reason_required';
    end if;
    update public.meme_contributions
       set status = 'rejected', reject_reason = v_reason,
           reviewed_by = v_actor, reviewed_at = now()
     where id = p_id;
  elsif v_row.kind = 'source' then
    if v_title is not null and char_length(v_title) > 300 then
      raise exception using errcode = '22023', message = 'invalid_source_title';
    end if;
    v_platform := coalesce(
      nullif(regexp_replace(substring(v_row.source_url from '^https://([^/?#:]+)'), '^www\.', ''), ''),
      'web'
    );
    -- 제보 이후 운영자가 같은 링크를 이미 붙였으면 중복 행을 만들지 않고 그 행을 가리킨다.
    select s.id into v_source_id
      from public.meme_sources s
     where s.meme_id = v_row.meme_id and lower(s.source_url) = lower(v_row.source_url)
     limit 1;
    if v_source_id is null then
      insert into public.meme_sources (meme_id, platform, source_url, title)
      values (v_row.meme_id, v_platform, v_row.source_url, v_title)
      returning id into v_source_id;
    end if;
    update public.meme_contributions
       set status = 'approved', reviewed_by = v_actor, reviewed_at = now(),
           applied_source_id = v_source_id
     where id = p_id;
    update public.memes set updated_at = now() where id = v_row.meme_id;
  else
    v_situation := coalesce(nullif(btrim(coalesce(p_situation, '')), ''), v_row.example_situation);
    v_text := coalesce(nullif(btrim(coalesce(p_text, '')), ''), v_row.example_text);
    if char_length(v_situation) > 120 or char_length(v_text) > 500 then
      raise exception using errcode = '22023', message = 'invalid_example';
    end if;
    select coalesce(m.usage_examples, '[]'::jsonb) into v_examples
      from public.memes m where m.id = v_row.meme_id for update;
    if jsonb_array_length(v_examples) >= 3 then
      raise exception using errcode = '22023', message = 'examples_full';
    end if;
    update public.memes
       set usage_examples = v_examples || jsonb_build_array(
             jsonb_build_object('situation', v_situation, 'text', v_text)
           ),
           updated_at = now()
     where id = v_row.meme_id;
    update public.meme_contributions
       set status = 'approved', reviewed_by = v_actor, reviewed_at = now(),
           example_situation = v_situation, example_text = v_text
     where id = p_id;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'meme_contribution.' || p_decision,
    'meme_contribution',
    p_id::text,
    jsonb_build_object('meme_id', v_row.meme_id, 'kind', v_row.kind, 'reason', v_reason)
  );

  return jsonb_build_object(
    'memeId', v_row.meme_id,
    'kind', v_row.kind,
    'status', case when p_decision = 'approve' then 'approved' else 'rejected' end
  );
end;
$function$;

revoke all on function public.review_meme_contribution(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.review_meme_contribution(uuid, text, text, text, text, text)
  to authenticated, service_role;

-- ── 공개 기여자 목록 ────────────────────────────────────
-- 승인된 보강 중 이름 공개에 동의한 기여자 닉네임만 돌려준다(닉네임은 이미 공개 정보).
create or replace function public.get_meme_contributors(p_meme_id uuid)
returns table (nickname text, source_count int, example_count int)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select p.nickname,
         count(*) filter (where c.kind = 'source')::int,
         count(*) filter (where c.kind = 'example')::int
    from public.meme_contributions c
    join public.profiles p on p.id = c.contributor_id
    join public.memes m on m.id = c.meme_id
   where c.meme_id = p_meme_id
     and c.status = 'approved'
     and c.credit_public
     and m.moderation_status in ('approved', 'limited')
   group by p.id, p.nickname
   order by min(c.reviewed_at), p.nickname
   limit 20
$function$;

revoke all on function public.get_meme_contributors(uuid) from public;
grant execute on function public.get_meme_contributors(uuid) to anon, authenticated, service_role;
