-- Approving a source contribution adds a meme_sources row. It does not change the
-- Korean body, so it must not move memes.updated_at:
--   * the sitemap publishes memes.updated_at as <lastmod>;
--   * isTranslationCurrent compares meme_translations.source_updated_at with
--     memes.updated_at, so a bump with no body change made every reviewed
--     translation look out of date (dropped from the sitemap, localized URL 404)
--     while the stale trigger, which watches body columns only, never fired.
-- The example branch still bumps updated_at: it edits usage_examples (body).
--
-- Additive only (create or replace). Signature and grants are unchanged.
-- Apply by hand: psql -v ON_ERROR_STOP=1 -1 -f <this-file>

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
    -- No memes.updated_at bump: a new source is not a body edit (see header).
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
