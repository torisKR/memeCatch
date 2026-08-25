create or replace function public.renew_processing_job_lease(
  p_job_id uuid,
  p_lease_token uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_started_at timestamptz;
begin
  update public.processing_jobs as job
     set started_at = now()
   where job.id = p_job_id
     and job.status = 'running'
     and p_lease_token is not null
     and job.lease_token = p_lease_token
  returning job.started_at into v_started_at;

  if found then
    return v_started_at;
  end if;
  if not exists (
    select 1 from public.processing_jobs as job where job.id = p_job_id
  ) then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;
  if exists (
    select 1
      from public.processing_jobs as job
     where job.id = p_job_id
       and job.status <> 'running'
  ) then
    raise exception using errcode = '55000', message = 'job_not_running';
  end if;
  raise exception using errcode = '55000', message = 'lease_token_mismatch';
end;
$function$;

revoke all on function public.renew_processing_job_lease(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.renew_processing_job_lease(uuid, uuid)
  to service_role;
