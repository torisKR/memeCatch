-- 20261120100000_meme_contribution_limits.sql
-- 문서 보강 제보 제출 함수 보강(2026-11-20 리뷰 후속). 함수 하나만 교체한다.
--   - 같은 사용자의 제출을 advisory lock으로 직렬화(1시간 10건 제한의 경쟁 조건 제거)
--   - 사용자당 검수 대기(pending/reviewing) 20건 상한 — 검수 큐가 오래된 100건만 보여 주므로
--     소수 계정이 큐를 채워 다른 제보를 가리지 못하게 한다
--   - 호스트 앞에 userinfo(@)가 붙은 링크 거부
--   - 같은 밈에 이미 대기 중인 동일 예문 거부
--   - 닉네임 공개는 명시적으로 동의했을 때만(기본 false)
--
-- Additive only (create or replace). Signature and grants are unchanged.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/migrations/20261120100000_meme_contribution_limits.sql

set local lock_timeout = '15s';

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
  v_pending int;
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
    -- https://youtube.com@evil.example/ reads as youtube.com but opens evil.example.
    if v_url ~ '^https://[^/?#]*@' then
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
    if exists (
      select 1 from public.meme_contributions c
       where c.meme_id = p_meme_id
         and c.kind = 'example'
         and c.status in ('pending', 'reviewing')
         and lower(c.example_text) = lower(v_text)
    ) then
      raise exception using errcode = '23505', message = 'already_pending';
    end if;
  end if;

  -- One contributor's submissions run one at a time, so parallel calls cannot
  -- all pass the counts below before any of them inserts.
  perform pg_advisory_xact_lock(hashtextextended('meme_contribution:' || v_user::text, 0));

  select count(*) into v_recent
    from public.meme_contributions c
   where c.contributor_id = v_user
     and c.created_at > now() - interval '60 minutes';
  if v_recent >= 10 then
    raise exception using errcode = 'P0429', message = 'rate_limited';
  end if;

  -- The review queue shows the oldest rows first. Without a cap, a few accounts
  -- could push everyone else's contributions out of the operator's view.
  select count(*) into v_pending
    from public.meme_contributions c
   where c.contributor_id = v_user
     and c.status in ('pending', 'reviewing');
  if v_pending >= 20 then
    raise exception using errcode = 'P0429', message = 'too_many_pending';
  end if;

  begin
    insert into public.meme_contributions (
      meme_id, contributor_id, kind, source_url, note,
      example_situation, example_text, credit_public
    ) values (
      p_meme_id, v_user, p_kind, v_url, v_note,
      v_situation, v_text, coalesce(p_credit_public, false)
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
