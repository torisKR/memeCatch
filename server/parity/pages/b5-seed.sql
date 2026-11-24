-- Batch B5: the translated editions. Run after seed.sql, b2-seed.sql and
-- b3-seed.sql, on a throwaway database.
--
-- Five B2 list memes (owned art, a YouTube video, a TikTok post, a related
-- meme, a post: every kind of card) become Korean in origin (a reviewed KR
-- origin profile) with current, reviewed English and Japanese translations,
-- so each of those editions lists them: the edition home shows its newest
-- six without curated memes. The Japanese translation of the fifth is from
-- an older revision of its meme and is not listed. Each translation changed
-- a minute apart, the first newest.
begin;
delete from meme_translations where meme_id in (
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205');
delete from meme_market_profiles where role = 'origin' and meme_id in (
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205');
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select id, 'KR', 'ko', 'origin', title, 'reviewed', '2026-06-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'
  from memes where id in (
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205');
insert into meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status, source_updated_at, provider, model, reviewed_at, reviewed_by, updated_at)
select m.id, l.locale, m.short_id || '-' || l.locale,
       l.prefix || ' ' || right(m.short_id, 4), l.prefix || ' summary of ' || m.short_id,
       l.prefix || ' meaning of ' || m.short_id, l.prefix || ' origin of ' || m.short_id, 'reviewed',
       case when l.locale = 'ja' and m.id = '00000000-0000-4000-8000-000000000205' then m.updated_at - interval '1 day' else m.updated_at end,
       'parity', 'parity', '2026-06-02T00:00:00Z', '00000000-0000-4000-8000-0000000000c1',
       '2026-11-01T00:00:00Z'::timestamptz - (right(m.id::text, 1)::int || ' minutes')::interval
  from memes m
  cross join (values ('en', 'Edition'), ('ja', '版')) as l(locale, prefix)
 where m.id in (
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205');
commit;
