begin;

create or replace function public.record_source_ingestion(
  p_platform text,
  p_external_id text,
  p_canonical_url text,
  p_title text,
  p_channel_name text,
  p_submitted_by uuid,
  p_target_meme_id uuid,
  p_processing_rights_mode text,
  p_metadata_refreshed_at timestamptz,
  p_metadata_expires_at timestamptz
)
returns table (
  ingestion_id uuid,
  source_id uuid,
  status text,
  duplicate boolean
)
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_source_id uuid;
  v_ingestion_id uuid;
  v_status text := 'metadata_ready';
  v_duplicate boolean := false;
  v_link_count integer;
begin
  if p_external_id is not null then
    select media.id
      into v_source_id
      from public.media_sources as media
     where media.platform = p_platform
       and media.external_id = p_external_id
     for update;
  end if;

  if v_source_id is null then
    select media.id
      into v_source_id
      from public.media_sources as media
     where media.canonical_url = p_canonical_url
     for update;
  end if;

  if v_source_id is null then
    begin
      insert into public.media_sources (
        platform,
        external_id,
        canonical_url,
        title,
        channel_name,
        public_status,
        embeddable,
        metadata_refreshed_at,
        metadata_expires_at,
        last_checked_at
      ) values (
        p_platform,
        p_external_id,
        p_canonical_url,
        p_title,
        p_channel_name,
        'unknown',
        true,
        p_metadata_refreshed_at,
        p_metadata_expires_at,
        p_metadata_refreshed_at
      )
      returning id into v_source_id;
    exception when unique_violation then
      if p_external_id is not null then
        select media.id
          into v_source_id
          from public.media_sources as media
         where media.platform = p_platform
           and media.external_id = p_external_id
         for update;
      end if;

      if v_source_id is null then
        select media.id
          into v_source_id
          from public.media_sources as media
         where media.canonical_url = p_canonical_url
         for update;
      end if;

      if v_source_id is null then
        raise;
      end if;
    end;
  end if;

  update public.media_sources as media
     set external_id = coalesce(media.external_id, p_external_id),
         title = coalesce(p_title, media.title),
         channel_name = coalesce(p_channel_name, media.channel_name),
         public_status = 'unknown',
         embeddable = true,
         metadata_refreshed_at = p_metadata_refreshed_at,
         metadata_expires_at = p_metadata_expires_at,
         last_checked_at = p_metadata_refreshed_at
   where media.id = v_source_id;

  if p_target_meme_id is not null then
    insert into public.meme_media (
      meme_id,
      source_id,
      source_role,
      rights_basis,
      review_state
    ) values (
      p_target_meme_id,
      v_source_id,
      'usage_example',
      'unknown',
      'pending'
    )
    on conflict on constraint meme_media_pkey do nothing;

    get diagnostics v_link_count = row_count;
    if v_link_count = 0 then
      v_status := 'duplicate';
      v_duplicate := true;
    else
      v_status := 'linked';
    end if;
  end if;

  insert into public.source_ingestions (
    source_id,
    submitted_by,
    target_meme_id,
    status,
    processing_rights_mode
  ) values (
    v_source_id,
    p_submitted_by,
    p_target_meme_id,
    v_status,
    p_processing_rights_mode
  )
  returning id into v_ingestion_id;

  return query
  select v_ingestion_id, v_source_id, v_status, v_duplicate;
end;
$function$;

revoke all on function public.record_source_ingestion(
  text, text, text, text, text, uuid, uuid, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_source_ingestion(
  text, text, text, text, text, uuid, uuid, text, timestamptz, timestamptz
) to service_role;

commit;
