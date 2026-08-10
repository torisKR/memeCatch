drop policy if exists trend_alerts_self_read on public.trend_alerts;
create policy trend_alerts_self_read on public.trend_alerts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_active_plus((select auth.uid()))
  );

drop policy if exists plus_saved_context_alerts_self_read
  on public.plus_saved_context_alerts;
create policy plus_saved_context_alerts_self_read
  on public.plus_saved_context_alerts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.has_active_plus((select auth.uid()))
  );
