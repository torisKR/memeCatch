-- Idempotent meme content batch. The generator does not connect or write.
-- batch_id: loop-026-pending-2026-11-10
-- Apply only after review:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this-file>
-- or paste the transaction into the Supabase SQL editor.
-- Inserts are skipped when the slug, normalized title/alias, source URL,
-- content URL, canonical media URL, tag, or translation locale already exists.
-- This file does not change moderation_status of rows that already exist
-- and does not walk pending rows to limited or approved.
-- rejected memes 파라파라-챌린지: near-duplicate of "파라파라나-춰야겠다": Same 리센느 미나미 unaccompanied parapara reaction. Title keys differ, so this is a curator match.
-- rejected memes 그린그린-레드레드: normalized title/alias duplicates catalog slug "Green-Green-(그린그린-레드레드)" via "그린그린", "레드레드"
-- rejected memes 갸륵체: normalized title/alias duplicates catalog slug "챗GPT-갸륵체" via "챗GPT 어화둥둥체"
-- rejected memes 윤정아-챌린지: near-duplicate of "윤정아-윤정아-챌린지": Same 정이랑 쇼팽피아노학원 서윤정 challenge already filed under 윤정아-윤정아-챌린지 and 윤정아-윤정아-밈.
-- rejected memes 장시간-비행-밈: near-duplicate of "장시간-비행-옆자리-골라라-밈": Same long-haul seat-choice format.; near-duplicate of "장시간-비행,-옆자리를-골라라": Same long-haul seat-choice format, including alias 비행기 옆자리 챌린지.
-- rejected meme_sources 파라파라-챌린지 0: sources[0]: parent meme was not inserted
-- rejected meme_sources 그린그린-레드레드 1: sources[1]: parent meme was not inserted
-- rejected meme_sources 갸륵체 3: sources[3]: parent meme was not inserted
-- rejected meme_sources 윤정아-챌린지 5: sources[5]: parent meme was not inserted
-- rejected meme_sources 장시간-비행-밈 6: sources[6]: parent meme was not inserted
-- warning: 무마가가이: pending video has no contents and no media
-- warning: 무마가가이: pending meme is missing translations: en, ja, zh, zh-tw
-- Rollback for memes inserted by this file while they are still pending:
--   delete from public.memes where slug = '무마가가이' and moderation_status = 'pending';
begin;
insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '무마가가이', '무마가가이', array['Moo Ma Ga Gai', '돼지 개 까마귀 닭']::text[],
  '태국 동요의 동물 이름 부분을 따라 부르는 손동작 게임이 숏폼 챌린지로 번진 밈', '태국 동요를 바탕으로 한 「돼지(무)·개(마)·까마귀(가)·닭(가이)」 게임이 2025년 말부터 세계적으로 확산돼 한국 숏폼에서도 챌린지로 유행했다.', '태국 동요 기반 게임(2025년 말 해외 확산, 2026년 국내 유행).',
  null,
  null,
  'challenge'::public.meme_category,
  'video'::public.media_type,
  'yellow'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  null,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '무마가가이'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '무마가가이'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['무마가가이', 'moomagagai', '돼지개까마귀닭']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://filmora.wondershare.kr/useful-information/latest-meme-trends.html', '틱톡·인스타그램에서 인기 폭발! 요즘 유행하는 밈 베스트', 'Wondershare Filmora',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '무마가가이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://filmora.wondershare.kr/useful-information/latest-meme-trends.html'
  );
commit;
