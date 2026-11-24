-- The operator screens' gate state (B7), loaded into the test database after
-- the migrations and the other seeds:
--   docker exec -i <container> psql -U postgres -d memecatch < server/parity/pages/b7-seed.sql
--
-- Test database only: lets Next's /admin/growth render (it passes text[];
-- the function takes uuid[], PLAN B7-3) so its markup can be compared.
create or replace function public.get_growth_seo_related_counts(p_meme_ids text[])
returns table (meme_id uuid, related_count bigint)
language sql stable security invoker
as $$ select * from public.get_growth_seo_related_counts(p_meme_ids::uuid[]) $$;
grant execute on function public.get_growth_seo_related_counts(text[]) to authenticated;

-- /admin/radar-safety: three pending proposals (nested, flat and empty
-- evidence objects). The action cases put them back in this state.
insert into public.safety_review_queue (id, meme_id, proposed_level, reason, evidence, status, requested_at)
values
  ('00000000-0000-4000-8b70-000000000001', '00000000-0000-4000-8000-000000000001', 'yellow',
   '커뮤니티 신호가 급증했어요.' || chr(10) || '두 번째 줄', '{"signals": [1.0, {"source": "x", "count": 12}], "2": "two", "note": null}', 'pending', '2026-11-20T01:02:03Z'),
  ('00000000-0000-4000-8b70-000000000002', '00000000-0000-4000-8000-000000000002', 'red',
   '부정 맥락 보도', '{"url": "https://example.com/a", "summary": "기사 링크만 있음 \"인용\""}', 'pending', '2026-11-21T15:30:00Z'),
  ('00000000-0000-4000-8b70-000000000003', '00000000-0000-4000-8000-000000000004', 'green',
   '맥락 해소', '{}', 'pending', '2026-11-22T00:00:00Z')
on conflict (id) do update set status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null;
