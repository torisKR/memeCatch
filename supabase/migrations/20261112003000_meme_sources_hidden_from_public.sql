-- Flagged schema: hide a meme_sources row from public citation lists without deleting it.
-- Apply after 20261111160000_meme_content_reviewed_at.sql and BEFORE the loop-028 data SQL.
-- Do not apply to prod from the PR alone; wait for toris approval.
--
-- Official apply command (do not omit either flag):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261112003000_meme_sources_hidden_from_public.sql
-- This file has no BEGIN/COMMIT. The -1 flag wraps the whole file in one transaction.
--
-- hidden_from_public is nullable. Null or false means the row may render; true hides it
-- from public citation lists and the inline 출처 line. The editorial process sets this
-- flag. Clearing it (set to false or null) brings the row back. This is not a delete.

set local lock_timeout = '15s';
set local statement_timeout = '10min';

alter table public.meme_sources
  add column if not exists hidden_from_public boolean;

comment on column public.meme_sources.hidden_from_public is
  'When true, keep the row but omit it from public citation lists and the inline source line. Null or false means visible. Reversible; not a delete.';
