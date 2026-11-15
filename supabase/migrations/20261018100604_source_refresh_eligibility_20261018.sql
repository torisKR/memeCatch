-- 20261018100604_source_refresh_eligibility_20261018.sql
begin;

create or replace function public.list_source_refresh_candidates(
  p_stale_before timestamptz,
  p_platforms text[],
  p_limit integer
) returns setof public.media_sources
language sql security invoker set search_path = pg_catalog as $function$
  select source.*
    from public.media_sources as source
   where source.removed_at is null
     and (source.last_checked_at is null or source.last_checked_at < p_stale_before)
     and source.platform = any(p_platforms)
     and not exists (
       select 1
         from public.source_acquisition_recovery as recovery
        where recovery.source_id = source.id
          and recovery.resolved_at is null
     )
   order by source.last_checked_at asc nulls first, source.created_at asc, source.id asc
   limit least(greatest(p_limit, 1), 100)
$function$;

revoke all on function public.list_source_refresh_candidates(timestamptz,text[],integer) from public, anon, authenticated;
grant execute on function public.list_source_refresh_candidates(timestamptz,text[],integer) to service_role;

commit;
;
