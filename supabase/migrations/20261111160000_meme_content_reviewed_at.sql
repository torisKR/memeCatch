-- Flagged schema for Q-09 (content last-reviewed date).
-- This is a new column. It is not safety_reviewed_at and does not change
-- the memes_touch_safety_reviewed_at trigger.
-- Apply this migration BEFORE data/memes/sql/20261111-loop028-priority-enrichment.sql.
-- Do not apply to prod from the PR alone; wait for toris approval.

begin;

alter table public.memes
  add column if not exists content_reviewed_at timestamptz;

comment on column public.memes.content_reviewed_at is
  'When the Korean explanation body (meaning, origin, examples, sources) was last editorially reviewed. Distinct from safety_reviewed_at.';

commit;
