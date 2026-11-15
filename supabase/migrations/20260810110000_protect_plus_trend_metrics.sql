-- Raw per-meme history is a Plus entitlement served only by the gated server API.
-- Keep service-role aggregation available while preventing direct PostgREST bypasses.
drop policy if exists metrics_public_read on public.meme_trend_metrics;

revoke select on table public.meme_trend_metrics from anon, authenticated;
