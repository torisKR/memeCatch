create or replace function public.set_meme_origin_country_with_evidence(
  p_meme_id uuid,
  p_market_code text,
  p_local_title text,
  p_evidence_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_evidence_source_id is null then
    raise exception using errcode = '22023', message = 'evidence_source_required';
  end if;

  perform 1
    from public.meme_sources
   where id = p_evidence_source_id
     and meme_id = p_meme_id;
  if not found then
    raise exception using errcode = '22023', message = 'evidence_source_mismatch';
  end if;

  v_result := public.set_meme_origin_country(
    p_meme_id,
    p_market_code,
    p_local_title
  );

  update public.meme_market_profiles
     set evidence_source_id = p_evidence_source_id,
         updated_at = now()
   where meme_id = p_meme_id
     and role = 'origin'
     and reviewed_by = v_actor;

  insert into public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    detail
  ) values (
    v_actor,
    'meme.set_origin_country_evidence',
    'meme',
    p_meme_id::text,
    jsonb_build_object('evidence_source_id', p_evidence_source_id)
  );

  return v_result || jsonb_build_object('evidenceSourceId', p_evidence_source_id);
end;
$function$;

revoke all on function public.set_meme_origin_country_with_evidence(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.set_meme_origin_country_with_evidence(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.set_meme_origin_country_with_evidence(uuid, text, text, uuid)
  to service_role;
