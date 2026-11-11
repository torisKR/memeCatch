-- 20261013191504_atomic_source_review_20261014.sql
begin;

-- Public media rows are independently reviewed children. A public parent must
-- never make a pending or rejected child readable to anonymous callers.
drop policy if exists contents_public_read on public.meme_contents;
create policy contents_public_read on public.meme_contents
  for select
  using (
    public.is_operator()
    or (
      moderation_status = 'approved'::public.submission_status
      and exists (
        select 1
          from public.memes as meme
         where meme.id = meme_id
           and meme.moderation_status in ('approved', 'limited')
      )
    )
  );

-- One database call owns the ledger transition, public projections, and audit
-- row. Any error therefore rolls the complete review back to pending.
create or replace function public.review_meme_source_atomic(
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
  v_meme public.memes%rowtype;
  v_ledger public.meme_media%rowtype;
  v_source public.media_sources%rowtype;
  v_platform text;
  v_link_only boolean;
begin
  if v_actor is null or public.is_operator() is distinct from true then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_meme_id is null or p_source_id is null then
    raise exception using errcode = '22023', message = 'invalid_source_review_target';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_source_review_decision';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception using errcode = '22023', message = 'source_review_note_too_long';
  end if;

  -- A stable lock order prevents two reviews for the same meme/source from
  -- publishing duplicate natural-key rows.
  select * into v_meme
    from public.memes
   where id = p_meme_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;

  select * into v_ledger
    from public.meme_media
   where meme_id = p_meme_id
     and source_id = p_source_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'source_review_not_found';
  end if;

  select * into v_source
    from public.media_sources
   where id = p_source_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'media_source_not_found';
  end if;

  if p_decision = 'reject' then
    if v_note is null then
      raise exception using errcode = '22023', message = 'source_rejection_note_required';
    end if;
    if v_ledger.review_state = 'rejected' and v_ledger.reviewer_note = v_note then
      return jsonb_build_object('decision', 'reject', 'idempotent', true);
    end if;
    if v_ledger.review_state <> 'pending' then
      raise exception using errcode = '55000', message = 'source_review_already_decided';
    end if;

    update public.meme_media
       set review_state = 'rejected',
           reviewer_note = v_note,
           reviewed_at = now()
     where meme_id = p_meme_id
       and source_id = p_source_id;

    insert into public.admin_audit_log (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      v_actor,
      'source.reject',
      'meme_media',
      p_meme_id::text || ':' || p_source_id::text,
      jsonb_build_object('note', v_note)
    );

    return jsonb_build_object('decision', 'reject', 'idempotent', false);
  end if;

  if p_source_role is null or p_source_role not in (
    'original', 'official_reupload', 'earliest_known',
    'secondary_reference', 'usage_example'
  ) then
    raise exception using errcode = '22023', message = 'invalid_source_role';
  end if;
  if p_rights_basis is null or p_rights_basis not in (
    'official_embed', 'creator_permission', 'creative_commons',
    'public_data', 'link_only'
  ) then
    raise exception using errcode = '22023', message = 'invalid_rights_basis';
  end if;
  if p_source_role = 'original' and p_rights_basis = 'link_only' then
    raise exception using errcode = '22023', message = 'link_only_cannot_be_original';
  end if;
  if v_source.platform not in ('youtube', 'youtube_shorts', 'tiktok', 'instagram') then
    raise exception using errcode = '22023', message = 'unsupported_public_media_platform';
  end if;
  if (case v_source.platform
       when 'youtube' then
         v_source.external_id ~ '^[A-Za-z0-9_-]{11}$'
         and v_source.canonical_url = 'https://www.youtube.com/watch?v=' || v_source.external_id
       when 'youtube_shorts' then
         v_source.external_id ~ '^[A-Za-z0-9_-]{11}$'
         and v_source.canonical_url = 'https://www.youtube.com/shorts/' || v_source.external_id
       when 'tiktok' then
         v_source.external_id ~ '^[0-9]{10,25}$'
         and v_source.canonical_url ~ ('^https://www\.tiktok\.com/@[^/?#]+/video/' || v_source.external_id || '$')
       when 'instagram' then
         v_source.external_id ~ '^[A-Za-z0-9_-]{5,80}$'
         and v_source.canonical_url ~ ('^https://www\.instagram\.com/(p|reel|tv)/' || v_source.external_id || '/$')
       else false
     end) is distinct from true then
    raise exception using errcode = '22023', message = 'media_source_identity_mismatch';
  end if;
  if v_source.removed_at is not null then
    raise exception using errcode = '22023', message = 'media_source_removed';
  end if;
  if v_source.public_status is distinct from 'public' then
    raise exception using errcode = '22023', message = 'media_source_not_public';
  end if;
  if v_source.metadata_refreshed_at is null
     or v_source.last_checked_at is null
     or v_source.metadata_expires_at is null
     or v_source.metadata_expires_at <= now()
     or v_source.metadata_refreshed_at < now() - interval '30 days'
     or v_source.metadata_refreshed_at > now() + interval '5 minutes'
     or v_source.last_checked_at < now() - interval '30 days'
     or v_source.last_checked_at > now() + interval '5 minutes'
     or v_source.metadata_expires_at > v_source.metadata_refreshed_at + interval '30 days 5 minutes' then
    raise exception using errcode = '22023', message = 'media_source_metadata_stale';
  end if;

  v_link_only := p_rights_basis = 'link_only';
  if not v_link_only
     and (v_source.embeddable is distinct from true or v_source.external_id is null) then
    raise exception using errcode = '22023', message = 'official_embed_unavailable';
  end if;

  if v_ledger.review_state = 'approved'
     and v_ledger.source_role = p_source_role
     and v_ledger.rights_basis = p_rights_basis
     and v_ledger.reviewer_note is not distinct from v_note then
    return jsonb_build_object('decision', 'approve', 'idempotent', true);
  end if;
  if v_ledger.review_state <> 'pending' then
    raise exception using errcode = '55000', message = 'source_review_already_decided';
  end if;

  v_platform := case v_source.platform
    when 'youtube' then 'YouTube'
    when 'youtube_shorts' then 'YouTube Shorts'
    when 'tiktok' then 'TikTok'
    when 'instagram' then 'Instagram'
  end;

  update public.meme_media
     set review_state = 'approved',
         source_role = p_source_role,
         rights_basis = p_rights_basis,
         reviewer_note = v_note,
         reviewed_at = now()
   where meme_id = p_meme_id
     and source_id = p_source_id;

  update public.meme_sources
     set platform = v_platform,
         title = v_source.title,
         creator_name = v_source.channel_name,
         captured_at = now(),
         copyright_status = case
           when v_link_only then 'unknown'::public.copyright_status
           else 'embeddable'::public.copyright_status
         end,
         source_role = p_source_role,
         rights_basis = p_rights_basis
   where meme_id = p_meme_id
     and source_url = v_source.canonical_url;
  if not found then
    insert into public.meme_sources (
      meme_id, platform, source_url, title, creator_name, captured_at,
      copyright_status, source_role, rights_basis
    ) values (
      p_meme_id, v_platform, v_source.canonical_url, v_source.title,
      v_source.channel_name, now(),
      case
        when v_link_only then 'unknown'::public.copyright_status
        else 'embeddable'::public.copyright_status
      end,
      p_source_role, p_rights_basis
    );
  end if;

  if v_link_only then
    -- A retry after a legacy partial write must not leave an embed public when
    -- the operator chose link-only publication.
    update public.meme_contents
       set moderation_status = 'rejected'::public.submission_status
     where meme_id = p_meme_id
       and type = 'embed'::public.media_type
       and platform = v_platform
       and content_id = v_source.external_id;
  else
    update public.meme_contents
       set url = v_source.canonical_url,
           thumbnail_url = v_source.thumbnail_url,
           caption = v_source.title,
           availability = 'live'::public.availability_status,
           moderation_status = 'approved'::public.submission_status
     where meme_id = p_meme_id
       and type = 'embed'::public.media_type
       and platform = v_platform
       and content_id = v_source.external_id;
    if not found then
      insert into public.meme_contents (
        meme_id, type, platform, content_id, url, thumbnail_url, caption,
        is_representative, availability, moderation_status
      ) values (
        p_meme_id, 'embed'::public.media_type, v_platform,
        v_source.external_id, v_source.canonical_url, v_source.thumbnail_url,
        v_source.title, false, 'live'::public.availability_status,
        'approved'::public.submission_status
      );
    end if;
  end if;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor,
    'source.approve',
    'meme_media',
    p_meme_id::text || ':' || p_source_id::text,
    jsonb_build_object(
      'source_role', p_source_role,
      'rights_basis', p_rights_basis,
      'link_only', v_link_only
    )
  );

  return jsonb_build_object('decision', 'approve', 'idempotent', false);
end;
$function$;

revoke all on function public.review_meme_source_atomic(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.review_meme_source_atomic(
  uuid, uuid, text, text, text, text
) to authenticated;

commit;
;
