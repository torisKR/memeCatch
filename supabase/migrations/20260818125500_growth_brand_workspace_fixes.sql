alter table public.brand_fit_evaluations
  add column matched_forbidden_expressions text[] not null default '{}';

alter table public.brand_fit_evaluations
  add constraint brand_fit_evaluations_matched_forbidden_check check (
    cardinality(matched_forbidden_expressions) <= 50
    and array_position(matched_forbidden_expressions, '') is null
  );

create or replace function public.save_brand_fit_evaluation(
  p_meme_name text,
  p_proposed_copy text,
  p_fit_score smallint,
  p_risk_level text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_forbidden_expressions text[];
  v_matched_forbidden_expressions text[];
  v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode = '42501', message = 'plus_required'; end if;

  select id, forbidden_expressions into v_workspace_id, v_forbidden_expressions
    from public.brand_workspaces
   where owner_id = v_uid;
  if v_workspace_id is null then raise exception using errcode = '22023', message = 'workspace_required'; end if;

  select coalesce(array_agg(expression order by position), '{}')
    into v_matched_forbidden_expressions
    from unnest(v_forbidden_expressions) with ordinality as item(expression, position)
   where position(lower(expression) in lower(btrim(p_proposed_copy))) > 0;

  insert into public.brand_fit_evaluations(
    workspace_id, owner_id, meme_name, proposed_copy, fit_score, risk_level, rationale,
    matched_forbidden_expressions
  ) values (
    v_workspace_id, v_uid, btrim(p_meme_name), btrim(p_proposed_copy),
    p_fit_score, p_risk_level, btrim(p_rationale), v_matched_forbidden_expressions
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.save_brand_fit_evaluation(text, text, smallint, text, text)
  from public, anon, authenticated;
grant execute on function public.save_brand_fit_evaluation(text, text, smallint, text, text)
  to authenticated;
