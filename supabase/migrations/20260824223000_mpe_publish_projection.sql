begin;

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
               job.status = 'completed'
               or (
                 required.job_type = 'stt'
                 and job.status = 'skipped'
                 and job.output_json @> '{"segmentsWritten":0,"audioDetected":false,"reason":"no_audio"}'::jsonb
                 and exists (
                   select 1
                     from public.processing_jobs as inspect_job
                    where inspect_job.ingestion_id = v_ingestion.id
                      and inspect_job.job_type = 'inspect'
                      and inspect_job.status = 'completed'
                      and inspect_job.output_json -> 'hasAudio' = 'false'::jsonb
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
       and nullif(btrim(job.output_json ->> 'provider'), '') is not null
       and nullif(btrim(job.output_json ->> 'model'), '') is not null
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
       and jsonb_typeof(job.output_json -> 'segmentsWritten') = 'number'
       and (job.output_json ->> 'segmentsWritten') ~ '^[0-9]+$'
       and (
         (
           job.status = 'completed'
           and nullif(btrim(job.output_json ->> 'provider'), '') is not null
           and nullif(btrim(job.output_json ->> 'model'), '') is not null
           and job.output_json @> '{"providerBacked":true,"audioDetected":true}'::jsonb
         )
         or (
           job.status = 'skipped'
           and job.output_json @> '{"segmentsWritten":0,"audioDetected":false,"reason":"no_audio"}'::jsonb
           and exists (
             select 1
               from public.processing_jobs as inspect_job
              where inspect_job.ingestion_id = v_ingestion.id
                and inspect_job.job_type = 'inspect'
                and inspect_job.status = 'completed'
                and inspect_job.output_json -> 'hasAudio' = 'false'::jsonb
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

create or replace function public.review_mpe_candidate(
  p_candidate_id uuid,
  p_stage text,
  p_decision text,
  p_reason text default null
)
returns public.meme_candidates
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.meme_candidates;
  v_has_approved_evidence boolean;
  v_has_unapproved_evidence boolean;
  v_has_source boolean;
  v_has_rights boolean;
  v_next_status text;
begin
  if auth.uid() is null or not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_stage not in ('FACT_CHECKING', 'RIGHTS_CHECKING', 'PUBLISH') then
    raise exception using errcode = '22023', message = 'invalid_review_stage';
  end if;
  if (p_stage in ('FACT_CHECKING', 'RIGHTS_CHECKING')
      and p_decision not in ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED'))
     or (p_stage = 'PUBLISH'
      and p_decision not in ('PUBLISHED', 'LIMITED', 'REJECTED', 'CHANGES_REQUESTED')) then
    raise exception using errcode = '22023', message = 'invalid_review_decision';
  end if;

  select candidate.*
    into v_candidate
    from public.meme_candidates as candidate
   where candidate.id = p_candidate_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
  end if;
  if v_candidate.review_status <> p_stage then
    raise exception using errcode = '55000', message = 'review_stage_out_of_order';
  end if;

  select
    exists (
      select 1 from public.claim_evidence as evidence
       where evidence.candidate_id = p_candidate_id
         and evidence.review_status = 'APPROVED'
    ),
    exists (
      select 1 from public.claim_evidence as evidence
       where evidence.candidate_id = p_candidate_id
         and evidence.review_status <> 'APPROVED'
    )
    into v_has_approved_evidence, v_has_unapproved_evidence;

  select
    ingestion.source_id is not null or ingestion.ingest_mode = 'USER_UPLOADED',
    ingestion.rights_attested_at is not null
      and ingestion.ingest_mode in ('USER_UPLOADED', 'OWNER_AUTHORIZED', 'LICENSED_MEDIA')
    into v_has_source, v_has_rights
    from public.media_ingestions as ingestion
   where ingestion.id = v_candidate.ingestion_id;

  if p_decision in ('APPROVED', 'PUBLISHED', 'LIMITED')
     and p_stage in ('FACT_CHECKING', 'PUBLISH')
     and (not v_has_approved_evidence or v_has_unapproved_evidence) then
    raise exception using errcode = '23514', message = 'approved_evidence_required';
  end if;
  if p_decision in ('APPROVED', 'PUBLISHED', 'LIMITED')
     and p_stage in ('RIGHTS_CHECKING', 'PUBLISH')
     and (not v_has_source or not v_has_rights) then
    raise exception using errcode = '23514', message = 'source_and_rights_required';
  end if;

  insert into public.review_decisions (
    candidate_id,
    review_stage,
    decision,
    reviewer_id,
    reason
  ) values (
    p_candidate_id,
    p_stage,
    p_decision,
    auth.uid(),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  if p_stage = 'PUBLISH' and p_decision in ('PUBLISHED', 'LIMITED') then
    perform public.project_mpe_candidate_publication(p_candidate_id, p_decision);
  end if;

  v_next_status := case
    when p_decision = 'REJECTED' then 'REJECTED'
    when p_decision = 'CHANGES_REQUESTED' then p_stage
    when p_stage = 'FACT_CHECKING' then 'RIGHTS_CHECKING'
    when p_stage = 'RIGHTS_CHECKING' then 'PUBLISH'
    when p_decision = 'PUBLISHED' then 'APPROVED'
    when p_decision = 'LIMITED' then 'LIMITED'
  end;

  update public.meme_candidates as candidate
     set review_status = v_next_status,
         updated_at = now()
   where candidate.id = p_candidate_id
  returning candidate.* into v_candidate;

  return v_candidate;
end;
$function$;

revoke all on function public.project_mpe_candidate_publication(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_mpe_candidate(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_mpe_candidate(uuid, text, text, text)
  to authenticated, service_role;

commit;
