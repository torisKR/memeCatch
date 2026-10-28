-- Local-only until explicitly approved. Extend the existing operator editor;
-- do not classify parents in bulk or approve source/content projections.
create or replace function public.update_meme_with_safety_review(
  p_meme_id uuid,
  p_content jsonb,
  p_proposed_level public.safety_level
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_current_level public.safety_level;
  v_previous_media_type public.media_type;
  v_saved_media_type public.media_type;
  v_review_id uuid;
begin
  if v_actor is null or public.is_operator() is distinct from true then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_content is null or jsonb_typeof(p_content) is distinct from 'object'
     or nullif(btrim(p_content ->> 'title'), '') is null
     or jsonb_typeof(p_content -> 'aliases') is distinct from 'array'
     or jsonb_typeof(p_content -> 'usage_context') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_meme_content';
  end if;
  if p_content ? 'media_type' and (
    jsonb_typeof(p_content -> 'media_type') is distinct from 'string'
    or (p_content ->> 'media_type') not in ('image', 'video', 'audio', 'text', 'embed')
  ) then
    raise exception using errcode = '22023', message = 'invalid_media_type';
  end if;

  select safety_level, media_type into v_current_level, v_previous_media_type
    from public.memes where id = p_meme_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;

  update public.memes
     set title = btrim(p_content ->> 'title'),
         summary = btrim(coalesce(p_content ->> 'summary', '')),
         description = btrim(coalesce(p_content ->> 'description', '')),
         origin = btrim(coalesce(p_content ->> 'origin', '')),
         usage_note = nullif(btrim(coalesce(p_content ->> 'usage_note', '')), ''),
         caution = nullif(btrim(coalesce(p_content ->> 'caution', '')), ''),
         aliases = array(select btrim(value) from jsonb_array_elements_text(p_content -> 'aliases') value where btrim(value) <> ''),
         lifecycle_status = (p_content ->> 'lifecycle_status')::public.lifecycle_status,
         category = (p_content ->> 'category')::public.meme_category,
         media_type = case when p_content ? 'media_type'
           then (p_content ->> 'media_type')::public.media_type
           else media_type end,
         difficulty = (p_content ->> 'difficulty')::public.meme_difficulty,
         sentiment = (p_content ->> 'sentiment')::public.meme_sentiment,
         origin_year = nullif(p_content ->> 'origin_year', '')::integer,
         usage_context = p_content -> 'usage_context',
         updated_at = now()
   where id = p_meme_id
   returning media_type into v_saved_media_type;

  if v_current_level <> p_proposed_level then
    v_review_id := public.enqueue_safety_review(
      p_meme_id,
      p_proposed_level,
      'operator_editor_request',
      jsonb_build_object('source', 'admin_meme_editor', 'requested_by', v_actor),
      null
    );
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor, 'meme.update', 'meme', p_meme_id::text,
    jsonb_build_object(
      'safety_review_queued', v_review_id is not null,
      'media_type_requested', p_content ? 'media_type',
      'previous_media_type', v_previous_media_type,
      'media_type', v_saved_media_type
    )
  );

  return v_review_id is not null;
end;
$function$;

revoke all on function public.update_meme_with_safety_review(
  uuid, jsonb, public.safety_level
) from public, anon, authenticated;
grant execute on function public.update_meme_with_safety_review(
  uuid, jsonb, public.safety_level
) to authenticated;
