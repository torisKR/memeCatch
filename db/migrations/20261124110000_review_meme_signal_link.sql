-- An operator decides a radar match the radar left `pending` (confidence under
-- 0.9). `meme_signal_links` was made for this decision: its `review_state`
-- has `reviewed` and `rejected`, each with `reviewed_by` and `reviewed_at`
-- (the table check), and `record_radar_trend_observation` accepts a link
-- that is `auto_matched` or `reviewed`. But operators may only read the
-- table, and no function wrote either state (PLAN.md D3-8). This adds that
-- function on the pattern of `apply_safety_review`: operators only, one
-- decision per pending match (a decided match returns false and changes
-- nothing), the operator and time on the row, one audit record.
--
-- Rollback:
--   drop function public.review_meme_signal_link(uuid, uuid, text);

begin;

create or replace function public.review_meme_signal_link(
  p_meme_id uuid,
  p_signal_id uuid,
  p_decision text
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_link public.meme_signal_links%rowtype;
  v_actor uuid := auth.uid();
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_signal_link_decision';
  end if;

  select * into v_link
    from public.meme_signal_links
   where meme_id = p_meme_id and signal_id = p_signal_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'signal_link_not_found';
  end if;
  if v_link.review_state <> 'pending' then
    return false;
  end if;

  update public.meme_signal_links
     set review_state = case p_decision when 'approved' then 'reviewed' else 'rejected' end,
         reviewed_by = v_actor,
         reviewed_at = now()
   where meme_id = p_meme_id and signal_id = p_signal_id;

  insert into public.admin_audit_log (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    v_actor, 'radar_signal_link.' || p_decision, 'meme_signal_link',
    p_meme_id::text || ':' || p_signal_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'match_method', v_link.match_method,
      'match_confidence', v_link.match_confidence
    )
  );

  return true;
end;
$function$;

revoke all on function public.review_meme_signal_link(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_meme_signal_link(uuid, uuid, text) to authenticated;

commit;
