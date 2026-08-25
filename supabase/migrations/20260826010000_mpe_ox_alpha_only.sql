begin;

do $migration_gate$
begin
  if exists (
    select 1
      from public.processing_jobs as job
     where job.job_type = 'stt'
       and job.status = 'running'
  ) then
    raise exception using errcode = '55000', message = 'running_stt_jobs_must_be_drained';
  end if;
end;
$migration_gate$;

create temporary table mpe_legacy_stt_candidates on commit drop as
select distinct candidate.id
  from public.meme_candidates as candidate
  left join public.claim_evidence as evidence
    on evidence.candidate_id = candidate.id
  left join public.text_segments as evidence_segment
    on evidence_segment.id = evidence.text_segment_id
 where evidence_segment.origin = 'STT'
    or exists (
      select 1
        from public.text_segments as ingestion_segment
       where ingestion_segment.ingestion_id = candidate.ingestion_id
         and ingestion_segment.origin = 'STT'
    );

do $migration_gate$
begin
  if exists (
    select 1
      from public.meme_candidates as candidate
      join mpe_legacy_stt_candidates as affected on affected.id = candidate.id
     where candidate.target_meme_id is not null
  ) then
    raise exception using errcode = '55000', message = 'published_stt_candidates_require_manual_remediation';
  end if;
end;
$migration_gate$;

delete from public.claim_evidence as evidence
 using public.text_segments as segment
 where evidence.text_segment_id = segment.id
   and segment.origin = 'STT';

delete from public.review_decisions as decision
 using mpe_legacy_stt_candidates as affected
 where decision.candidate_id = affected.id;

delete from public.candidate_matches as match
 using mpe_legacy_stt_candidates as affected
 where match.candidate_id = affected.id;

update public.meme_candidates as candidate
   set draft_json = '{}'::jsonb,
       review_status = 'FACT_CHECKING',
       overall_confidence = null,
       target_meme_id = null,
       updated_at = now()
  from mpe_legacy_stt_candidates as affected
 where candidate.id = affected.id;

delete from public.text_segments as segment
 where segment.origin = 'STT';

create or replace function public.complete_processing_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_output_json jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_cost_units numeric default 0
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.processing_jobs;
  v_media_kind text;
  v_downstream_type text;
  v_downstream_types text[];
begin
  if p_status not in ('completed', 'failed', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid_completion_status';
  end if;
  if p_cost_units < 0 then
    raise exception using errcode = '22023', message = 'invalid_cost_units';
  end if;
  if p_status = 'failed' and btrim(coalesce(p_error_code, '')) = '' then
    raise exception using errcode = '22023', message = 'error_code_required';
  end if;

  select job.*
    into v_job
    from public.processing_jobs as job
   where job.id = p_job_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;
  if v_job.status <> 'running' then
    raise exception using errcode = '55000', message = 'job_not_running';
  end if;
  if p_lease_token is null or v_job.lease_token is distinct from p_lease_token then
    raise exception using errcode = '55000', message = 'lease_token_mismatch';
  end if;

  if v_job.job_type = 'stt' and p_status = 'completed' then
    raise exception using errcode = '22023', message = 'stt_completion_not_allowed';
  elsif v_job.job_type in ('ocr', 'scene_frames') and p_status = 'completed' then
    if jsonb_typeof(p_output_json) is distinct from 'object'
       or p_output_json ->> 'provider' is distinct from 'openrouter'
       or p_output_json ->> 'model' is distinct from 'stealth/ox-alpha'
       or p_output_json -> 'providerBacked' is distinct from 'true'::jsonb
       or jsonb_typeof(p_output_json -> 'segmentsWritten') is distinct from 'number'
       or (v_job.job_type = 'scene_frames' and v_job.processor_version <> '1.1.0') then
      raise exception using errcode = '22023', message = 'provider_completion_marker_required';
    end if;
    if (p_output_json ->> 'segmentsWritten')::numeric < 0
       or trunc((p_output_json ->> 'segmentsWritten')::numeric)
          <> (p_output_json ->> 'segmentsWritten')::numeric then
      raise exception using errcode = '22023', message = 'invalid_segments_written';
    end if;
  elsif v_job.job_type = 'stt' and p_status = 'skipped' then
    if p_output_json is distinct from jsonb_build_object('reason', 'no_audio')
       and p_output_json is distinct from jsonb_build_object(
         'reason', 'no_audio',
         'segmentsWritten', 0,
         'audioDetected', false
       )
       and p_output_json is distinct from jsonb_build_object(
         'reason', 'audio_stt_disabled',
         'provider', 'openrouter',
         'model', 'stealth/ox-alpha',
         'providerBacked', false,
         'segmentsWritten', 0,
         'audioDetected', true
       ) then
      raise exception using errcode = '22023', message = 'invalid_no_audio_marker';
    end if;
    if p_output_json ->> 'reason' = 'audio_stt_disabled'
       and not exists (
         select 1
           from public.processing_jobs as inspect_job
          where inspect_job.ingestion_id = v_job.ingestion_id
            and inspect_job.job_type = 'inspect'
            and inspect_job.status = 'completed'
            and inspect_job.output_json -> 'hasAudio' = 'true'::jsonb
       ) then
      raise exception using errcode = '22023', message = 'audio_stt_disabled_requires_audio';
    end if;
  elsif v_job.job_type = 'ocr' and p_status = 'skipped' then
    raise exception using errcode = '22023', message = 'ocr_skip_not_allowed';
  end if;

  update public.processing_jobs as job
     set status = p_status,
         output_json = coalesce(p_output_json, '{}'::jsonb),
         error_code = case when p_status = 'failed' then p_error_code else null end,
         cost_units = p_cost_units,
         lease_token = null,
         completed_at = now()
   where job.id = p_job_id
     and job.status = 'running'
     and job.lease_token = p_lease_token
  returning job.* into v_job;

  if v_job.job_type = 'inspect' and p_status = 'completed' then
    select ingestion.media_kind
      into v_media_kind
      from public.media_ingestions as ingestion
     where ingestion.id = v_job.ingestion_id;

    v_downstream_types := case
      when v_media_kind = 'image' then array['fingerprint', 'ocr']::text[]
      else array['fingerprint', 'scene_frames', 'stt']::text[]
    end;

    foreach v_downstream_type in array v_downstream_types loop
      insert into public.processing_jobs (
        ingestion_id,
        job_type,
        processor_name,
        processor_version,
        input_hash
      ) values (
        v_job.ingestion_id,
        v_downstream_type,
        'pending',
        'pending',
        v_job.input_hash
      )
      on conflict (ingestion_id, job_type, processor_version, input_hash) do nothing;
    end loop;
  end if;

  return v_job;
end;
$function$;

revoke all on function public.complete_processing_job(uuid, uuid, text, jsonb, text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_processing_job(uuid, uuid, text, jsonb, text, numeric)
  to service_role;

update public.processing_jobs as job
   set status = 'queued',
       output_json = '{}'::jsonb,
       error_code = null,
       completed_at = null
 where job.job_type = 'scene_frames'
   and job.status = 'completed'
   and job.lease_token is null
   and (
     job.processor_version <> '1.1.0'
     or job.output_json ->> 'provider' is distinct from 'openrouter'
     or job.output_json ->> 'model' is distinct from 'stealth/ox-alpha'
     or job.output_json -> 'providerBacked' is distinct from 'true'::jsonb
     or jsonb_typeof(job.output_json -> 'segmentsWritten') is distinct from 'number'
   );

update public.processing_jobs as job
   set status = 'skipped',
       output_json = jsonb_build_object(
         'reason', 'audio_stt_disabled',
         'provider', 'openrouter',
         'model', 'stealth/ox-alpha',
         'providerBacked', false,
         'segmentsWritten', 0,
         'audioDetected', true
       ),
       error_code = null,
       completed_at = now()
 where job.job_type = 'stt'
   and job.status in ('queued', 'completed')
   and job.lease_token is null
   and exists (
     select 1
       from public.processing_jobs as inspect_job
      where inspect_job.ingestion_id = job.ingestion_id
        and inspect_job.job_type = 'inspect'
        and inspect_job.status = 'completed'
        and inspect_job.output_json -> 'hasAudio' = 'true'::jsonb
   );

update public.processing_jobs as job
   set status = 'skipped',
       output_json = jsonb_build_object(
         'reason', 'no_audio',
         'segmentsWritten', 0,
         'audioDetected', false
       ),
       error_code = null,
       completed_at = now()
 where job.job_type = 'stt'
   and job.status in ('queued', 'completed')
   and job.lease_token is null
   and exists (
     select 1
       from public.processing_jobs as inspect_job
      where inspect_job.ingestion_id = job.ingestion_id
        and inspect_job.job_type = 'inspect'
        and inspect_job.status = 'completed'
        and inspect_job.output_json -> 'hasAudio' = 'false'::jsonb
   );

create or replace function public.project_mpe_candidate_publication(
  p_candidate_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_ingestion public.media_ingestions;
  v_meme_id uuid;
  v_title text;
  v_summary text;
  v_description text;
  v_origin text;
  v_usage_note text;
  v_caution text;
  v_required_jobs text[];
  v_target_status public.moderation_status;
begin
  if p_decision not in ('PUBLISHED', 'LIMITED') then
    raise exception using errcode = '22023', message = 'invalid_publish_decision';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;
  if v_candidate.review_status <> 'PUBLISH' then
    raise exception using errcode = '55000', message = 'candidate_not_publishable';
  end if;

  select ingestion.*
    into v_ingestion
    from public.media_ingestions as ingestion
   where ingestion.id = v_candidate.ingestion_id
   for update;
  if not found then
    raise exception using errcode = '23514', message = 'ingestion_required';
  end if;
  if v_ingestion.rights_attested_at is null
     or v_ingestion.ingest_mode not in ('USER_UPLOADED', 'OWNER_AUTHORIZED', 'LICENSED_MEDIA') then
    raise exception using errcode = '23514', message = 'source_and_rights_required';
  end if;
  if v_ingestion.source_id is null and v_ingestion.ingest_mode <> 'USER_UPLOADED' then
    raise exception using errcode = '23514', message = 'source_and_rights_required';
  end if;
  if v_ingestion.source_role is null
     or v_ingestion.rights_basis is null
     or v_ingestion.rights_basis in ('unknown', 'blocked') then
    raise exception using errcode = '23514', message = 'reviewed_source_rights_required';
  end if;
  if v_ingestion.source_id is not null and exists (
    select 1
      from public.media_sources as source
     where source.id = v_ingestion.source_id
       and (source.removed_at is not null or source.public_status = 'private')
  ) then
    raise exception using errcode = '23514', message = 'source_not_publishable';
  end if;

  if (
    select decision.decision
      from public.review_decisions as decision
     where decision.candidate_id = p_candidate_id
       and decision.review_stage = 'FACT_CHECKING'
     order by decision.created_at desc, decision.id desc
     limit 1
  ) is distinct from 'APPROVED' then
    raise exception using errcode = '23514', message = 'fact_approval_required';
  end if;
  if (
    select decision.decision
      from public.review_decisions as decision
     where decision.candidate_id = p_candidate_id
       and decision.review_stage = 'RIGHTS_CHECKING'
     order by decision.created_at desc, decision.id desc
     limit 1
  ) is distinct from 'APPROVED' then
    raise exception using errcode = '23514', message = 'rights_approval_required';
  end if;
  if (
    select decision.decision
      from public.review_decisions as decision
     where decision.candidate_id = p_candidate_id
       and decision.review_stage = 'PUBLISH'
     order by decision.created_at desc, decision.id desc
     limit 1
  ) is distinct from p_decision then
    raise exception using errcode = '23514', message = 'operator_publish_decision_required';
  end if;

  if jsonb_typeof(v_candidate.draft_json -> 'claims') is distinct from 'array'
     or jsonb_array_length(v_candidate.draft_json -> 'claims') = 0 then
    raise exception using errcode = '23514', message = 'reviewed_draft_required';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_candidate.draft_json -> 'claims') as draft(claim)
     where nullif(btrim(draft.claim ->> 'field'), '') is null
        or nullif(btrim(draft.claim ->> 'text'), '') is null
        or char_length(draft.claim ->> 'text') > 2000
        or not exists (
          select 1
            from public.claim_evidence as evidence
           where evidence.candidate_id = p_candidate_id
             and evidence.claim_field = draft.claim ->> 'field'
             and evidence.claim_text = draft.claim ->> 'text'
             and evidence.review_status = 'APPROVED'
        )
  ) or exists (
    select 1
      from public.claim_evidence as evidence
     where evidence.candidate_id = p_candidate_id
       and evidence.review_status <> 'APPROVED'
  ) then
    raise exception using errcode = '23514', message = 'approved_evidence_required';
  end if;
  if exists (
    select 1
      from public.claim_evidence as evidence
      join public.text_segments as segment on segment.id = evidence.text_segment_id
     where evidence.candidate_id = p_candidate_id
       and segment.origin = 'STT'
  ) then
    raise exception using errcode = '23514', message = 'stt_evidence_not_publishable';
  end if;

  v_required_jobs := case v_ingestion.media_kind
    when 'image' then array['inspect', 'fingerprint', 'ocr']::text[]
    when 'video' then array['inspect', 'fingerprint', 'scene_frames', 'stt']::text[]
    else array[]::text[]
  end;
  if cardinality(v_required_jobs) = 0 or exists (
       select 1
         from unnest(v_required_jobs) as required(job_type)
        where not exists (
          select 1
            from public.processing_jobs as job
           where job.ingestion_id = v_ingestion.id
             and job.job_type = required.job_type
             and (
               (
                 job.status = 'completed'
                 and required.job_type <> 'stt'
                 and (
                   required.job_type <> 'scene_frames'
                   or (
                     job.processor_version = '1.1.0'
                     and job.output_json ->> 'provider' = 'openrouter'
                     and job.output_json ->> 'model' = 'stealth/ox-alpha'
                     and job.output_json -> 'providerBacked' = 'true'::jsonb
                     and jsonb_typeof(job.output_json -> 'segmentsWritten') = 'number'
                     and (job.output_json ->> 'segmentsWritten') ~ '^[0-9]+$'
                   )
                 )
               )
               or (
                 required.job_type = 'stt'
                 and job.status = 'skipped'
                 and (
                   (
                     (
                       job.output_json = jsonb_build_object('reason', 'no_audio')
                       or job.output_json = jsonb_build_object(
                         'reason', 'no_audio',
                         'segmentsWritten', 0,
                         'audioDetected', false
                       )
                     )
                     and exists (
                       select 1
                         from public.processing_jobs as inspect_job
                        where inspect_job.ingestion_id = v_ingestion.id
                          and inspect_job.job_type = 'inspect'
                          and inspect_job.status = 'completed'
                          and inspect_job.output_json -> 'hasAudio' = 'false'::jsonb
                     )
                   )
                   or (
                     job.output_json = jsonb_build_object(
                       'reason', 'audio_stt_disabled',
                       'provider', 'openrouter',
                       'model', 'stealth/ox-alpha',
                       'providerBacked', false,
                       'segmentsWritten', 0,
                       'audioDetected', true
                     )
                     and exists (
                       select 1
                         from public.processing_jobs as inspect_job
                        where inspect_job.ingestion_id = v_ingestion.id
                          and inspect_job.job_type = 'inspect'
                          and inspect_job.status = 'completed'
                          and inspect_job.output_json -> 'hasAudio' = 'true'::jsonb
                     )
                     and exists (
                       select 1
              from public.processing_jobs as scene_job
             where scene_job.ingestion_id = v_ingestion.id
                and scene_job.job_type = 'scene_frames'
                and scene_job.status = 'completed'
                          and scene_job.processor_version = '1.1.0'
                          and scene_job.output_json ->> 'provider' = 'openrouter'
                          and scene_job.output_json ->> 'model' = 'stealth/ox-alpha'
                          and scene_job.output_json @> '{"providerBacked":true}'::jsonb
                          and jsonb_typeof(scene_job.output_json -> 'segmentsWritten') = 'number'
                     )
                   )
                 )
               )
             )
        )
     )
     or exists (
       select 1
         from public.processing_jobs as job
        where job.ingestion_id = v_ingestion.id
          and job.job_type = any(v_required_jobs)
          and job.status in ('queued', 'running', 'failed')
     ) then
    raise exception using errcode = '23514', message = 'processing_jobs_not_publishable';
  end if;
  if v_ingestion.media_kind = 'image' and not exists (
    select 1
      from public.processing_jobs as job
     where job.ingestion_id = v_ingestion.id
       and job.job_type = 'ocr'
       and job.status = 'completed'
       and job.output_json ->> 'provider' = 'openrouter'
       and job.output_json ->> 'model' = 'stealth/ox-alpha'
       and job.output_json @> '{"providerBacked":true}'::jsonb
       and jsonb_typeof(job.output_json -> 'segmentsWritten') = 'number'
       and (job.output_json ->> 'segmentsWritten') ~ '^[0-9]+$'
  ) then
    raise exception using errcode = '23514', message = 'provider_backed_ocr_required';
  end if;
  if v_ingestion.media_kind = 'video' and not exists (
    select 1
      from public.processing_jobs as job
     where job.ingestion_id = v_ingestion.id
       and job.job_type = 'stt'
       and (
         (
           job.status = 'skipped'
           and (
             job.output_json = jsonb_build_object('reason', 'no_audio')
             or job.output_json = jsonb_build_object(
               'reason', 'no_audio',
               'segmentsWritten', 0,
               'audioDetected', false
             )
           )
           and exists (
             select 1
               from public.processing_jobs as inspect_job
              where inspect_job.ingestion_id = v_ingestion.id
                and inspect_job.job_type = 'inspect'
                and inspect_job.status = 'completed'
                and inspect_job.output_json -> 'hasAudio' = 'false'::jsonb
           )
         )
         or (
           job.status = 'skipped'
           and job.output_json = jsonb_build_object(
             'reason', 'audio_stt_disabled',
             'provider', 'openrouter',
             'model', 'stealth/ox-alpha',
             'providerBacked', false,
             'segmentsWritten', 0,
             'audioDetected', true
           )
           and exists (
             select 1
               from public.processing_jobs as inspect_job
              where inspect_job.ingestion_id = v_ingestion.id
                and inspect_job.job_type = 'inspect'
                and inspect_job.status = 'completed'
                and inspect_job.output_json -> 'hasAudio' = 'true'::jsonb
           )
           and exists (
             select 1
               from public.processing_jobs as scene_job
              where scene_job.ingestion_id = v_ingestion.id
               and scene_job.job_type = 'scene_frames'
               and scene_job.status = 'completed'
                and scene_job.processor_version = '1.1.0'
                and scene_job.output_json ->> 'provider' = 'openrouter'
                and scene_job.output_json ->> 'model' = 'stealth/ox-alpha'
                and scene_job.output_json @> '{"providerBacked":true}'::jsonb
                and jsonb_typeof(scene_job.output_json -> 'segmentsWritten') = 'number'
           )
         )
       )
  ) then
    raise exception using errcode = '23514', message = 'provider_backed_stt_required';
  end if;

  select nullif(btrim(draft.claim ->> 'text'), '')
    into v_title
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' = 'TITLE'
   order by draft.position
   limit 1;
  select nullif(btrim(draft.claim ->> 'text'), '')
    into v_summary
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' in ('DEFINITION', 'MEANING')
   order by case draft.claim ->> 'field' when 'DEFINITION' then 0 else 1 end, draft.position
   limit 1;
  select nullif(string_agg(btrim(draft.claim ->> 'text'), E'\n\n' order by draft.position), '')
    into v_description
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' in ('DEFINITION', 'MEANING', 'ORIGIN', 'USAGE');
  select nullif(btrim(draft.claim ->> 'text'), '')
    into v_origin
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' = 'ORIGIN'
   order by draft.position
   limit 1;
  select nullif(btrim(draft.claim ->> 'text'), '')
    into v_usage_note
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' = 'USAGE'
   order by draft.position
   limit 1;
  select nullif(btrim(draft.claim ->> 'text'), '')
    into v_caution
    from jsonb_array_elements(v_candidate.draft_json -> 'claims') with ordinality as draft(claim, position)
   where draft.claim ->> 'field' = 'SAFETY'
   order by draft.position
   limit 1;

  v_target_status := case p_decision
    when 'PUBLISHED' then 'approved'::public.moderation_status
    else 'limited'::public.moderation_status
  end;

  select match.meme_id
    into v_meme_id
    from public.candidate_matches as match
    join public.memes as meme on meme.id = match.meme_id
   where match.candidate_id = p_candidate_id
     and match.classification = 'DUPLICATE'
     and match.evidence_json ->> 'exactDuplicate' = 'true'
     and meme.moderation_status in ('approved', 'limited')
   order by match.overall_score desc, match.rank, match.id
   limit 1;

  if v_meme_id is null then
    insert into public.memes (
      title,
      slug,
      summary,
      description,
      origin,
      usage_note,
      caution,
      moderation_status,
      category,
      media_type,
      submitted_by
    ) values (
      coalesce(v_title, v_candidate.title),
      'mpe-' || replace(v_candidate.id::text, '-', ''),
      coalesce(v_summary, ''),
      coalesce(v_description, ''),
      coalesce(v_origin, ''),
      v_usage_note,
      v_caution,
      'pending',
      case
        when lower(v_candidate.meme_type) in ('phrase', 'dance', 'song', 'image', 'comment', 'challenge')
          then lower(v_candidate.meme_type)::public.meme_category
        else 'phrase'::public.meme_category
      end,
      v_ingestion.media_kind::public.media_type,
      v_ingestion.user_id
    )
    returning id into v_meme_id;

    update public.memes set moderation_status = 'fact_checking' where id = v_meme_id;
    update public.memes set moderation_status = 'rights_checking' where id = v_meme_id;
    update public.memes set moderation_status = v_target_status where id = v_meme_id;
  else
    update public.memes
       set moderation_status = v_target_status
     where id = v_meme_id
       and moderation_status is distinct from v_target_status;
  end if;

  if v_ingestion.source_id is not null then
    insert into public.meme_media (
      meme_id,
      source_id,
      source_role,
      rights_basis,
      review_state,
      reviewer_note,
      reviewed_at
    ) values (
      v_meme_id,
      v_ingestion.source_id,
      v_ingestion.source_role,
      v_ingestion.rights_basis,
      'approved',
      'MPE operator publication review',
      now()
    )
    on conflict on constraint meme_media_pkey do update
      set rights_basis = excluded.rights_basis,
          review_state = excluded.review_state,
          reviewer_note = excluded.reviewer_note,
          reviewed_at = excluded.reviewed_at;

    insert into public.meme_sources (
      meme_id,
      platform,
      source_url,
      title,
      creator_name,
      copyright_status
    )
    select
      v_meme_id,
      source.platform,
      source.canonical_url,
      source.title,
      source.channel_name,
      case
        when v_ingestion.rights_basis in ('official_embed', 'creator_permission', 'creative_commons', 'public_data')
          then 'embeddable'::public.copyright_status
        else 'permission_needed'::public.copyright_status
      end
    from public.media_sources as source
    where source.id = v_ingestion.source_id
      and not exists (
        select 1
          from public.meme_sources as existing
         where existing.meme_id = v_meme_id
           and existing.source_url = source.canonical_url
      );
  end if;

  insert into public.meme_claims (
    meme_id,
    source_id,
    claim_type,
    claim_text,
    confidence,
    verified
  )
  select distinct
    v_meme_id,
    evidence.source_id,
    case evidence.claim_field
      when 'ORIGIN' then 'origin'
      when 'USAGE' then 'usage_context'
      else 'meaning'
    end,
    evidence.claim_text,
    case
      when evidence.confidence >= 0.8 then 'high'
      when evidence.confidence >= 0.5 then 'medium'
      else 'low'
    end,
    true
  from public.claim_evidence as evidence
  where evidence.candidate_id = p_candidate_id
    and evidence.review_status = 'APPROVED'
    and not exists (
      select 1
        from public.text_segments as segment
       where segment.id = evidence.text_segment_id
         and segment.origin = 'STT'
    )
    and evidence.claim_field in ('DEFINITION', 'MEANING', 'ORIGIN', 'USAGE')
    and not exists (
      select 1
        from public.meme_claims as existing
       where existing.meme_id = v_meme_id
         and existing.source_id is not distinct from evidence.source_id
         and existing.claim_type = case evidence.claim_field
           when 'ORIGIN' then 'origin'
           when 'USAGE' then 'usage_context'
           else 'meaning'
         end
         and existing.claim_text = evidence.claim_text
    );

  update public.meme_candidates as candidate
     set target_meme_id = v_meme_id,
         updated_at = now()
   where candidate.id = p_candidate_id;

  return v_meme_id;
end;
$function$;

revoke all on function public.project_mpe_candidate_publication(uuid, text)
  from public, anon, authenticated, service_role;

commit;
