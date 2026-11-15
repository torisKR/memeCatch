-- Flagged schema for Q-09 (content last-reviewed date).
-- This is a new column. It is not safety_reviewed_at and does not change
-- the memes_touch_safety_reviewed_at trigger.
-- Apply this migration BEFORE data/memes/sql/20261111-loop028-priority-enrichment.sql.
-- Do not apply to prod from the PR alone; wait for toris approval.
--
-- Official apply command (do not omit either flag):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261111160000_meme_content_reviewed_at.sql
-- This file has no BEGIN/COMMIT. The -1 flag wraps the whole file in one transaction.
-- Without ON_ERROR_STOP, a failed run can exit 0 after ROLLBACK.
--
-- content_reviewed_at is the editorial review date only. It has no default and is not
-- the apply time. This migration does not backfill it. Editorial SQL must set it
-- explicitly, and the editorial process must update it whenever the explanation body
-- is edited later; otherwise the displayed "최종 검토일" goes stale. There is no
-- trigger that maintains this column.

set local lock_timeout = '15s';
set local statement_timeout = '10min';

alter table public.memes
  add column if not exists content_reviewed_at timestamptz;

comment on column public.memes.content_reviewed_at is
  'Editorial review date of the Korean explanation body (meaning, origin, examples, sources). Set only by editorial SQL, not by a trigger and not as the apply time. The editorial process must update this column on later content edits. Distinct from safety_reviewed_at.';
