begin;

-- The initial atomic review migration is already deployed. Preserve that
-- implementation for pending/reject transitions and wrap it with a narrowly
-- scoped repair path for an already-approved ledger whose public projections
-- are missing.
alter function public.review_meme_source_atomic(uuid, uuid, text, text, text, text)
  rename to review_meme_source_atomic_v1;

revoke all on function public.review_meme_source_atomic_v1(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;

create function public.review_meme_source_atomic(
  p_meme_id uuid,
  p_source_id uuid,
  p_decision text,
  p_source_role text default null,
  p_rights_basis text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_ledger public.meme_media%rowtype;
  v_source public.media_sources%rowtype;
  v_platform text;
  v_copyright public.copyright_status;
  v_link_only boolean;
  v_source_projection public.meme_sources%rowtype;
  v_content_projection public.meme_contents%rowtype;
  v_projection_count integer;
  v_repaired_source boolean := false;
  v_repaired_content boolean := false;
begin
  if v_actor is null or public.is_operator() is distinct from true then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  -- Pending approvals and all rejections retain the original, already-tested
  -- transaction. The wrapper only changes identical approved retries.
  select * into v_ledger
    from public.meme_media
   where meme_id = p_meme_id
     and source_id = p_source_id;
  if not found or p_decision is distinct from 'approve' or v_ledger.review_state <> 'approved' then
    return public.review_meme_source_atomic_v1(
      p_meme_id, p_source_id, p_decision, p_source_role, p_rights_basis, p_note
    );
  end if;

  -- The original function performs the complete authorization, identity,
  -- freshness, rights, and note-equality validation before returning its
  -- approved/idempotent result. Reuse it rather than weakening any gate here.
  perform public.review_meme_source_atomic_v1(
    p_meme_id, p_source_id, p_decision, p_source_role, p_rights_basis, p_note
  );

  select * into v_source
    from public.media_sources
   where id = p_source_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'media_source_not_found';
  end if;

  v_platform := case v_source.platform
    when 'youtube' then 'YouTube'
    when 'youtube_shorts' then 'YouTube Shorts'
    when 'tiktok' then 'TikTok'
    when 'instagram' then 'Instagram'
  end;
  v_link_only := p_rights_basis = 'link_only';
  v_copyright := case
    when v_link_only then 'unknown'::public.copyright_status
    else 'embeddable'::public.copyright_status
  end;

  select count(*)
    into v_projection_count
    from public.meme_sources as projected
   where projected.meme_id = p_meme_id
     and projected.source_url = v_source.canonical_url;

  if v_projection_count = 1 then
    select * into v_source_projection
      from public.meme_sources as projected
     where projected.meme_id = p_meme_id
       and projected.source_url = v_source.canonical_url;
  end if;

  if v_projection_count > 1
     or (v_projection_count = 1 and (
       v_source_projection.platform is distinct from v_platform
       or v_source_projection.source_role is distinct from p_source_role
       or v_source_projection.rights_basis is distinct from p_rights_basis
       or v_source_projection.copyright_status is distinct from v_copyright
     )) then
    raise exception using errcode = '22023', message = 'source_projection_conflict';
  end if;

  if v_projection_count = 0 then
    insert into public.meme_sources (
      meme_id, platform, source_url, title, creator_name, captured_at,
      copyright_status, source_role, rights_basis
    ) values (
      p_meme_id, v_platform, v_source.canonical_url, v_source.title,
      v_source.channel_name, now(), v_copyright, p_source_role, p_rights_basis
    );
    v_repaired_source := true;
  end if;

  if v_link_only then
    if exists (
      select 1
        from public.meme_contents as projected
       where projected.meme_id = p_meme_id
         and projected.moderation_status = 'approved'::public.submission_status
         and (projected.content_id = v_source.external_id or projected.url = v_source.canonical_url)
    ) then
      raise exception using errcode = '22023', message = 'content_projection_conflict';
    end if;
  else
    select count(*)
      into v_projection_count
      from public.meme_contents as projected
     where projected.meme_id = p_meme_id
       and (projected.content_id = v_source.external_id or projected.url = v_source.canonical_url);

    if v_projection_count = 1 then
      select * into v_content_projection
        from public.meme_contents as projected
       where projected.meme_id = p_meme_id
         and (projected.content_id = v_source.external_id or projected.url = v_source.canonical_url);
    end if;

    if v_projection_count > 1
       or (v_projection_count = 1 and (
         v_content_projection.type is distinct from 'embed'::public.media_type
         or v_content_projection.platform is distinct from v_platform
         or v_content_projection.content_id is distinct from v_source.external_id
         or v_content_projection.url is distinct from v_source.canonical_url
         or v_content_projection.availability is distinct from 'live'::public.availability_status
         or v_content_projection.moderation_status is distinct from 'approved'::public.submission_status
       )) then
      raise exception using errcode = '22023', message = 'content_projection_conflict';
    end if;

    if v_projection_count = 0 then
      insert into public.meme_contents (
        meme_id, type, platform, content_id, url, thumbnail_url, caption,
        is_representative, availability, moderation_status
      ) values (
        p_meme_id, 'embed'::public.media_type, v_platform,
        v_source.external_id, v_source.canonical_url, v_source.thumbnail_url,
        v_source.title, false, 'live'::public.availability_status,
        'approved'::public.submission_status
      );
      v_repaired_content := true;
    end if;
  end if;

  if not v_repaired_source and not v_repaired_content then
    return jsonb_build_object('decision', 'approve', 'idempotent', true);
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor,
    'source.repair_projection',
    'meme_media',
    p_meme_id::text || ':' || p_source_id::text,
    jsonb_build_object(
      'source_role', p_source_role,
      'rights_basis', p_rights_basis,
      'repaired_source', v_repaired_source,
      'repaired_content', v_repaired_content
    )
  );

  return jsonb_build_object(
    'decision', 'approve',
    'idempotent', false,
    'repaired', true,
    'repairedSource', v_repaired_source,
    'repairedContent', v_repaired_content
  );
end;
$function$;

revoke all on function public.review_meme_source_atomic(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.review_meme_source_atomic(
  uuid, uuid, text, text, text, text
) to authenticated;

commit;
