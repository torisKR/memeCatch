-- /submit of batch B6, TEST DATABASE ONLY. submitMemeWithAttachment (Next)
-- and POST /api/submit (Axum) both call reserve_submission_attempt() before
-- submit_meme_v2, and no migration in the repository defines it (PLAN.md
-- B6-28): without it both answer `submitFailed`. This stand-in reserves
-- nothing, so the behaviour gate can reach submit_meme_v2 on both servers:
--   psql < server/parity/pages/b6-submit.sql
-- Never apply it anywhere else.
create or replace function public.reserve_submission_attempt() returns void
  language sql security definer set search_path = public as $$ select $$;
revoke all on function public.reserve_submission_attempt() from public, anon;
grant execute on function public.reserve_submission_attempt() to authenticated;
