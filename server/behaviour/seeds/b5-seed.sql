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

-- The translated meme document (/{locale}/memes/{key}). Without triggers, so
-- the translations stay current: pgpas006 gets usage contexts in every
-- level, and its English translation a usage note, a caution and two
-- examples; pgb2art1 gets only green contexts (the "not confirmed" line)
-- and an English usage note; pgrich01, a reviewed variant of pgpas006, gets
-- a current English translation, so the English passport links it.
begin;
set local session_replication_role = replica;
update memes set usage_context = '{"work": "yellow", "friends": "green", "sns": "red", "family": "gray"}'
 where short_id = 'pgpas006';
update memes set usage_context = '{"work": "green", "sns": "green"}' where short_id = 'pgb2art1';
update meme_translations t
   set usage_note = 'Edition usage of pgpas006, in a sentence.',
       caution = 'Edition caution of pgpas006.',
       usage_examples = '[{"situation": "chat", "text": "one"}, {"situation": "post", "text": "two"}]'
  from memes m
 where m.id = t.meme_id and m.short_id = 'pgpas006' and t.locale = 'en';
update meme_translations t set usage_note = 'Edition usage of pgb2art1.'
  from memes m
 where m.id = t.meme_id and m.short_id = 'pgb2art1' and t.locale = 'en';
insert into meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status, source_updated_at, provider, model, reviewed_at, reviewed_by, updated_at)
select id, 'en', 'parity-rich-en', 'Edition rich', 'Edition summary of pgrich01',
       'Edition meaning of pgrich01', 'Edition origin of pgrich01', 'reviewed', updated_at,
       'parity', 'parity', '2026-06-02T00:00:00Z', '00000000-0000-4000-8000-0000000000c1',
       '2026-10-20T12:00:00Z'
  from memes where short_id = 'pgrich01'
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, status = excluded.status,
  source_updated_at = excluded.source_updated_at, updated_at = excluded.updated_at;
-- Three more B2 phrases in English, so the related memes of pgb2art1 (a
-- phrase, related by category) include three translated ones and the
-- section is drawn. (A blank summary, which only a related card allows, is
-- refused by the table's check.)
insert into meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status, source_updated_at, provider, model, reviewed_at, reviewed_by, updated_at)
select id, 'en', short_id || '-en', 'Edition ' || right(short_id, 4), 'Edition summary of ' || short_id,
       'Edition meaning of ' || short_id, 'Edition origin of ' || short_id, 'reviewed', updated_at,
       'parity', 'parity', '2026-06-02T00:00:00Z', '00000000-0000-4000-8000-0000000000c1',
       '2026-10-21T12:00:00Z'
  from memes where short_id in ('pgb2g14e', 'pgb2s11b', 'pgb2g15f')
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, status = excluded.status,
  source_updated_at = excluded.source_updated_at, updated_at = excluded.updated_at;
commit;
