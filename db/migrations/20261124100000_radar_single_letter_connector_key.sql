-- The radar's X connector is keyed `x`, and so are its signals' platform:
-- `external_signals_platform` lists 'x', the text-platform checks name it, and
-- `submit_trend_candidate_evidence` writes it. But the shape checks on
-- `external_signals.platform`, `external_signals.connector_key` and
-- `connector_health.connector_key` asked for two characters or more
-- (`{1,63}` after the first), so no X signal and no X connector health row
-- could ever be written (PLAN.md R8-2). Allow one character: the first
-- character class stays, and so does the 64-character limit. Relaxing a
-- check keeps every existing row valid.
--
-- Rollback (fails if a one-character key has been stored since; delete or
-- rename those rows first):
--   alter table public.external_signals
--     drop constraint external_signals_platform_check,
--     add constraint external_signals_platform_check
--       check (platform ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
--     drop constraint external_signals_connector_key_check,
--     add constraint external_signals_connector_key_check
--       check (connector_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$');
--   alter table public.connector_health
--     drop constraint connector_health_connector_key_check,
--     add constraint connector_health_connector_key_check
--       check (connector_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$');

begin;

alter table public.external_signals
  drop constraint external_signals_platform_check,
  add constraint external_signals_platform_check
    check (platform ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  drop constraint external_signals_connector_key_check,
  add constraint external_signals_connector_key_check
    check (connector_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

alter table public.connector_health
  drop constraint connector_health_connector_key_check,
  add constraint connector_health_connector_key_check
    check (connector_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

commit;
