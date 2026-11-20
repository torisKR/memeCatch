-- Idempotent meme content batch. The generator does not connect or write.
-- batch_id: content-pending-2026-11-20
-- Apply only after review:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this-file>
-- with psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f <file>.
-- Inserts are skipped when the slug, normalized title/alias, source URL,
-- content URL, canonical media URL, tag, or translation locale already exists.
-- This file does not change moderation_status of rows that already exist
-- and does not walk pending rows to limited or approved.
-- warning: 늑구: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 라을라: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 한정선: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 떡지순례: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 왁뿌볼: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 키캡-키링: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 요리하는-돌아이: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 테토남: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 부캉이: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 서담시: pending video has no contents and no media
-- warning: 서담시: pending meme is missing translations: en, ja, zh, zh-tw
-- Rollback for memes inserted by this file while they are still pending:
--   delete from public.memes where slug = '늑구' and moderation_status = 'pending';
--   delete from public.memes where slug = '라을라' and moderation_status = 'pending';
--   delete from public.memes where slug = '한정선' and moderation_status = 'pending';
--   delete from public.memes where slug = '떡지순례' and moderation_status = 'pending';
--   delete from public.memes where slug = '왁뿌볼' and moderation_status = 'pending';
--   delete from public.memes where slug = '키캡-키링' and moderation_status = 'pending';
--   delete from public.memes where slug = '요리하는-돌아이' and moderation_status = 'pending';
--   delete from public.memes where slug = '테토남' and moderation_status = 'pending';
--   delete from public.memes where slug = '부캉이' and moderation_status = 'pending';
--   delete from public.memes where slug = '서담시' and moderation_status = 'pending';
begin;
insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '늑구', '늑구', array['도련님 늑구', '늑준표']::text[],
  '2026년 4월 대전 오월드에서 탈출했다가 열흘 만에 생포된 늑대 늑구를 두고 번진 응원과 패러디 밈', '대전 오월드에서 탈출한 늑대 ''늑구''의 이름이다. 2026년 4월 열흘가량 이어진 탈출 소동 끝에 4월 17일 생포돼 동물원으로 돌아왔다. 이후 무사한 생환을 반기는 분위기가 번져, 대전의 한 빵집이 늑구 얼굴을 올린 ''늑구빵''을 내놓았고 야구 팬들이 구단 응원과 엮어 농담을 주고받았다. 탈출 경로를 추적하는 놀이, AI로 만든 모험 이미지, ''도련님 늑구'' 같은 별명도 함께 퍼졌다.', '2026년 4월 대전 오월드 늑대 탈출 사건에서 시작됐다. 생포 뒤 시민들이 밈과 상품으로 호응했다.',
  '대전 오월드 소식이나 늑구 관련 밈을 가볍게 공유할 때 쓴다.',
  '실제 동물이 탈출해 생포된 사건을 소재로 하므로, 동물을 놀리거나 사건 자체를 웃음거리로 삼는 식으로 쓰지 않는다.',
  'image'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'cooling'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"오늘 대전 가면 늑구빵부터 사야지"},{"situation":"SNS 댓글","text":"늑구 무사 생환 축하합니다… 이제 오월드 늑구 투어 가야겠다"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '늑구'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '늑구'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['늑구', '도련님늑구', '늑준표']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '라을라', '라을라', array['라을라함']::text[],
  '하품 소리를 흉내 낸 신조어로, 하품을 라을라라고 부르거나 감탄이 나올 때 두루 쓰는 말', '하품할 때 성대가 열리며 나는 소리를 옮긴 신조어다. 한 직장인이 사무실에서 하품하다 이 소리를 낸 이야기가 퍼지면서, 하품을 ''하품''이라 부르지 않고 ''라을라''라고 말하는 유행이 생겼다. 울림 있는 하품 소리를 누가 더 잘 내는지 겨루는 놀이로 번졌고, 지금은 감탄이 나오는 순간이나 입이 저절로 벌어지는 상황에도 쓴다. 성악처럼 울림이 좋은 목소리를 가진 사람을 ''라을라''라고 부르기도 한다.', '사무실에서 하품하다 성대가 열려 라을라 소리가 난 직장인의 이야기가 퍼지며 시작됐다. 처음 쓴 시점은 확인되지 않는다.',
  '하품을 할 때나 감탄이 나오는 순간에 가볍게 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"회의 세 시간째인데 라을라가 계속 나와"},{"situation":"친구에게","text":"이 노을 봐… 라을라"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '라을라'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '라을라'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['라을라', '라을라함']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '한정선', '한정선', array['한정선 찹쌀떡']::text[],
  '과일 찹쌀떡 브랜드 한정선 매장 앞에 줄이 늘어서는 2026년 떡 디저트 유행을 가리키는 말', '과일과 요거트를 넣은 찹쌀떡을 파는 디저트 브랜드 ''한정선''의 이름이다. 팥 대신 딸기, 골드키위, 홍시 같은 과일을 넣은 찹쌀떡이 SNS에서 입소문을 타며, 오프라인 매장 앞에 오픈런 줄이 늘어서는 현상이 생겼다. 2026년 가을 기사에서는 두쫀쿠 다음 유행으로 떡 디저트 웨이팅이 소개될 때 ''한정선''이 대표 사례로 꼽혔다. 브랜드 이름이 유행을 가리키는 말로도 쓰이므로 특정 매장을 추천하는 말투로 쓰지 않는다.', '2026년 9월 기사에서 SNS 입소문과 오픈런 줄이 소개되며 알려졌다. 11월 보도에서도 두쫀쿠 다음 떡 디저트 유행의 예로 언급됐다.',
  '떡 디저트나 줄 서는 디저트 이야기를 할 때 쓴다.',
  '브랜드 이름이므로 특정 매장을 추천하거나 홍보하는 뜻으로 쓰지 않는다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"한정선 줄 서서 찹쌀떡 사 왔는데 두 시간 기다렸어"},{"situation":"SNS 캡션","text":"두쫀쿠 다음은 한정선이지 🍡"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '한정선'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '한정선'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['한정선', '한정선찹쌀떡']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '떡지순례', '떡지순례', '{}'::text[],
  '떡집과 성지순례를 합친 말로, 전국의 유명 떡집을 찾아다니는 미식 탐방을 뜻한다', '떡집과 성지순례를 합친 신조어로, 전국의 유명 떡집을 찾아다니는 미식 탐방을 뜻한다. 2024년 2월 경향신문은 떡이 젊은 층의 핫템으로 떠오르면서 ''떡픈런'', ''떡케팅''과 함께 ''떡지순례''라는 말이 생겼다고 소개했다. 2026년에는 찹쌀떡 오픈런 줄을 다루는 기사에서 떡지순례가 뜨는 이유를 짚었다. 쓸 때는 떡집을 찾아 줄을 서는 방문을 가리키는 말로 쓰면 된다.', '2024년 떡 열풍 속에서 생긴 신조어로 소개됐다. 2026년 찹쌀떡 웨이팅 유행과 함께 다시 쓰였다.',
  '떡집 투어 계획이나 떡집 방문 인증에 가볍게 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2024::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"이번 주말 떡지순례 가자, 떡집 세 군데 돌기"},{"situation":"SNS 캡션","text":"오늘의 떡지순례 🍡 찹쌀떡 세 개 인증"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '떡지순례'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '떡지순례'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['떡지순례']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '왁뿌볼', '왁뿌볼', array['왁스 부수기 볼']::text[],
  '스트레스 볼 말랑이에서 진화한, 왁스를 손으로 부수며 소리와 촉감을 즐기는 2026년 촉감 장난감', '스트레스 볼 ''말랑이''에서 진화한 장난감으로, 점토를 실리콘 볼에 넣고 겉면에 녹인 왁스를 발라 굳힌 제품이다. 손으로 왁스를 깨뜨릴 때 나는 소리와 촉감이 매력이라 2026년 상반기부터 10대와 20·30대 사이에서 유행했다. 보통 하나를 깨고 다음 볼로 넘어가는 식으로 쓰인다. 2026년 가을 기사에서는 두쫀쿠와 떡 디저트 다음으로 이어진 촉감 소비 흐름의 예로 소개됐다.', '2026년 5월 신조어 뉴스레터에서 말랑이에서 진화한 ''왁스 부수기 볼''로 소개됐다. 처음 만든 사람은 확인되지 않는다.',
  '스트레스를 풀 때 쓰는 촉감 장난감 이야기를 할 때 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"스트레스 받으면 왁뿌볼 하나 깨고 와야지"},{"situation":"친구에게","text":"창신동 가서 왁뿌볼 샀어, 같이 깰래?"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '왁뿌볼'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '왁뿌볼'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['왁뿌볼', '왁스부수기볼']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '키캡-키링', '키캡 키링', '{}'::text[],
  '기계식 키보드 키캡으로 만든 열쇠고리를 연타하며 딸깍 소리를 즐기는 2026년 스트레스 해소 소품', '기계식 키보드 스위치(키캡)로 만든 손가락 한 마디 크기의 열쇠고리를 가리킨다. 2026년 5월 무렵 틱톡과 인스타그램에서 키캡 키링을 누르는 ''딸깍'' 소리가 퍼지며 Z세대 사이에서 인기를 얻었다. 가방에 달아 두었다가 스트레스를 받을 때 눌러서 소리와 촉감을 즐기는 것이 주된 쓰임이다. 클릭 소리가 나는 소품이라 ''클릭 소리 소품''이라고도 부르며, 직접 꾸민 키캡을 키링처럼 달고 다니는 경우도 있다.', '2026년 5월 SNS에서 키캡 키링을 연타하는 영상이 퍼지며 알려졌다. 처음 올린 사람은 확인되지 않는다.',
  '스트레스 해소용 소품이나 딸깍 소리 이야기를 할 때 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"회의 중에 키캡 키링 딸깍 눌렀다가 눈치 봤어"},{"situation":"SNS 캡션","text":"가방에 키캡 키링 하나 달았더니 자꾸 누르게 됨"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '키캡-키링'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '키캡-키링'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['키캡키링']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '요리하는-돌아이', '요리하는 돌아이', '{}'::text[],
  '흑백요리사에서 윤남노 셰프에게 붙은 별명으로, 일에 푹 빠져 끈질기게 몰두하는 사람을 장난스럽게 부르는 말', '넷플릭스 예능 ''흑백요리사''에 출연한 윤남노 셰프에게 붙은 별명이다. 셰프 본인은 돌아이라는 말을 일에 푹 빠져 있거나 끈질긴 사람이라는 뜻으로 설명하며 이 표현을 좋아한다고 밝혔다. 방송 이후 그의 ''사바용'' 표정이 흑백요리사를 통틀어 대표 짤이 되면서 별명도 밈으로 퍼졌다. 실존 인물의 별명이므로 개인을 깎아내리는 말로 쓰지 않는다.', '2024년 9월 흑백요리사 방영 때 출연 셰프들에게 붙은 별명 가운데 하나다. 최초로 붙인 사람은 확인되지 않는다.',
  '일을 집요하게 파고드는 사람을 칭찬하거나 농담으로 말할 때 쓴다.',
  '실존 인물의 별명이므로 외모나 성격을 비꼬는 맥락으로 쓰지 않는다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'cooling'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2024::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"이번 보고서 밤새 붙잡고 있었다니, 요리하는 돌아이 인정"},{"situation":"SNS 댓글","text":"이 셰프 완전 요리하는 돌아이네 ㅋㅋ 사바용 나옴"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '요리하는-돌아이'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '요리하는-돌아이'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['요리하는돌아이']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '테토남', '테토남', '{}'::text[],
  '테스토스테론에 빗댄 성향 분류로, 리더십 있고 직설적이며 주도적인 남성을 가리키는 말', '남성호르몬 테스토스테론에 빗댄 성향 분류 신조어다. 리더십이 있고 직설적이며 주도적인 남성을 가리킨다. 2025년 3월 무렵 온라인 커뮤니티에서 ''에겐남''과 함께 주목받았고, 성향을 유형으로 나누는 온라인 테스트와 함께 퍼졌다. ''에겐''과 ''테토''는 각각 여성호르몬 에스트로겐과 테스토스테론에서 따온 말이며, 실제 호르몬 수치와는 무관한 비유다. MBTI처럼 사람을 유형으로 나누는 농담으로 쓰인다.', '2021년 6월 한 다이어트 크리에이터의 블로그 글에서 시작된 것으로 알려진다. 2025년에 온라인 테스트와 함께 널리 퍼졌다.',
  '농담 삼아 상대의 성향을 유형으로 나눠 말할 때 쓴다.',
  '성별로 성격을 단정하는 말이라 특정인에게 붙이면 무례하게 들릴 수 있다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'yellow'::public.safety_level,
  'cooling'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2021::integer, 'approximate', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  '[{"situation":"단톡방","text":"회의 바로 정리해 버리는 거 보니 완전 테토남이네"},{"situation":"SNS 댓글","text":"에겐남 말고 테토남이 취향인 사람 손 ✋"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '테토남'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '테토남'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['테토남']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '부캉이', '부캉이', '{}'::text[],
  '2026년 9월 부산 북항 친수공원에 나타난 상어의 이름으로, 상어 마케팅과 밈 코인까지 번진 이름', '2026년 9월 부산 북항 친수공원 수로에 나타난 상어를 부르는 이름이다. 9월 18일 처음 발견된 뒤 머무는 동안 화제가 됐다. 커피 체인은 상어 사진을 올리면 상품을 주는 이벤트를 열었고, 수족관과 주류 업체도 상어를 활용한 게시물을 올렸다. 상어 이름을 딴 밈 코인이 발행돼 거래됐고, 부산 동구는 상어를 마스코트로 삼을 계획을 밝혔다.', '2026년 9월 18일 북항 친수공원 수로에서 처음 발견된 뒤 SNS와 언론에서 화제가 됐다.',
  '화제가 된 동물이나 지역 이슈를 가볍게 언급할 때 쓴다.',
  '밈 코인은 투기성이 강하므로 코인 투자를 권하는 뜻으로 쓰지 않는다.',
  'image'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"부산 가는 김에 북항 가서 부캉이 인사하고 옴 🦈"},{"situation":"단톡방","text":"부캉이 아직도 북항에 있대? 뉴스 봤어?"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '부캉이'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '부캉이'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['부캉이']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '서담시', '서담시', array['seodamcity']::text[],
  'AI로 만든 가상의 한국 도시 서담시를 배경으로, 이상현상과 이를 추적하는 TF팀을 다룬 인스타그램 공포 시리즈', 'AI로 만든 가상의 한국 도시 ''서담시''를 배경으로 한 공포·미스터리 연작 콘텐츠다. 평범한 한국 중소도시처럼 보이지만 정체불명의 이상현상이 벌어지고, 이를 추적하는 TF팀이 등장한다. 인스타그램과 유튜브 계정(@seodamcity)으로 시리즈가 공개되며 2026년 여름 인기를 끌었다. 이 도시를 진짜처럼 믿는 척하거나, 공무원이라 서담시 발령이 날까 걱정한다는 식의 농담으로 쓰인다.', '2026년 여름 인스타그램에서 인기를 얻었다는 보도가 있다. 제작 시작 시점과 제작자는 확인하지 못했다.',
  '가상의 설정을 진짜인 척 농담할 때 쓴다.',
  '실제 지명이나 공공기관 공지처럼 보이게 꾸며 올리지 않는다. 가상의 도시라는 점을 밝힌다.',
  'image'::public.meme_category,
  'video'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 댓글","text":"서담시는 진짜다… 이 영상 보고 밤에 잠 안 와"},{"situation":"단톡방","text":"나 공무원인데 서담시 발령 안 나게 빌어줘"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '서담시'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '서담시'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['서담시', 'seodamcity']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.segye.com/newsView/20260419506952', '성심당 잇는 새 아이콘 늑구?… 늑구빵 완판·전광판 응원 대전은 ‘늑구 열풍’ 중', '세계일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '늑구'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.segye.com/newsView/20260419506952'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://m.seoul.co.kr/news/2026/04/17/20260417500190', '“호르무즈 봉쇄 뚫은 늑구” “유퀴즈 출연”…돌아온 늑구에 ‘밈’도 폭발했다', '서울신문',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '늑구'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://m.seoul.co.kr/news/2026/04/17/20260417500190'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://maily.so/trendaword/posts/1do1dw90ox6', '[Trend A Word #539] 오늘도 사무실에서 라을라함', 'Trend A Word(메일리)',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '라을라'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://maily.so/trendaword/posts/1do1dw90ox6'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yugacrew.com/yugawiki/%EB%9D%BC%EC%9D%84%EB%9D%BC', '라을라', '유가위키',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '라을라'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yugacrew.com/yugawiki/%EB%9D%BC%EC%9D%84%EB%9D%BC'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mt.co.kr/article/2026092114023942938', '''1개 7500원'' 찹쌀떡 오픈런 줄에 입이 ''떡''…''떡지순례''가 뜨는 이유', '머니투데이',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '한정선'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mt.co.kr/article/2026092114023942938'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankyung.com/article/202611119661H', '두쫀쿠 이어 한정선까지 1020 ''열광''…대박 난 이유 있었다 [트렌드+]', '한국경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '한정선'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankyung.com/article/202611119661H'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.khan.co.kr/article/202402090800011', '소문난 그 떡 찾아 ‘떡지순례’ 떠나볼까', '경향신문',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '떡지순례'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.khan.co.kr/article/202402090800011'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mt.co.kr/article/2026092114023942938', '''1개 7500원'' 찹쌀떡 오픈런 줄에 입이 ''떡''…''떡지순례''가 뜨는 이유', '머니투데이',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '떡지순례'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mt.co.kr/article/2026092114023942938'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://maily.so/trendaword/posts/w6ovp2k3ok5', '[Trend A Word #540] 와뽀뿔 아니고 왁뿌뽈 아니고 왁뿌볼', 'Trend A Word(메일리)',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '왁뿌볼'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://maily.so/trendaword/posts/w6ovp2k3ok5'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankyung.com/article/202611119661H', '두쫀쿠 이어 한정선까지 1020 ''열광''…대박 난 이유 있었다 [트렌드+]', '한국경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '왁뿌볼'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankyung.com/article/202611119661H'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mt.co.kr/world/2026/05/31/2026052817055953554', '"눌러야 심신 안정" 시도때도 없이 ''딸깍''…키캡에 빠진 젠지, 왜[트민자]', '머니투데이',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '키캡-키링'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mt.co.kr/world/2026/05/31/2026052817055953554'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.newsis.com/view/NISX20260526_0003644502', '여기저기서 ''딸깍딸깍''…MZ 스트레스 해소템 ''키캡'' 인기 비결[출동!인턴]', '뉴시스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '키캡-키링'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.newsis.com/view/NISX20260526_0003644502'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.vogue.co.kr/2024/09/24/%ec%95%88%ec%a3%bc%ea%be%bc%ec%9d%b4%ec%9e%90-%ed%8c%8c%ec%88%98%ea%be%bc-%ec%9a%94%eb%a6%ac%ed%95%98%eb%8a%94-%eb%8f%8c%ec%95%84%ec%9d%b4-%ec%9c%a4%eb%82%a8%eb%85%b8', '안주꾼이자 파수꾼! 요리하는 돌아이 윤남노', '보그 코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '요리하는-돌아이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.vogue.co.kr/2024/09/24/%ec%95%88%ec%a3%bc%ea%be%bc%ec%9d%b4%ec%9e%90-%ed%8c%8c%ec%88%98%ea%be%bc-%ec%9a%94%eb%a6%ac%ed%95%98%eb%8a%94-%eb%8f%8c%ec%95%84%ec%9d%b4-%ec%9c%a4%eb%82%a8%eb%85%b8'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.huffingtonpost.kr/article/232059', '넷플릭스 오리지널 예능 ‘흑백요리사’에서 ‘요리하는 돌아이’로 출연한 윤남노 셰프가 건달 출신이라는 오해에 대해 해명했다', '허프포스트코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '요리하는-돌아이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.huffingtonpost.kr/article/232059'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://v.daum.net/v/20250324104352907?f=p', 'MBTI 다음 유행은 ''에겐남''·''테토녀''⋯무슨 뜻인데?', '아이뉴스24',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '테토남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://v.daum.net/v/20250324104352907?f=p'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankyung.com/article/2025051909387', '테토·에겐 용어와 MBTI 비교 설명 기사 (2025년 5월 20일)', '한국경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '테토남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankyung.com/article/2025051909387'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankyung.com/article/202609244686Y', '부산 북항 ''부캉이'' 인기에 기업·지자체도 ''상어 마케팅''', '한국경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '부캉이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankyung.com/article/202609244686Y'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.insight.co.kr/news/575583', '''부캉이'' 인기 어디까지?... 밈 코인도 등장', '인사이트',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '부캉이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.insight.co.kr/news/575583'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://maily.so/trendaword/posts/92zekj58zep', '[Trend A Word #602] ※주의※ 서담시에서는 절대 안내 방송을 따라가지 마십시오', 'Trend A Word(메일리)',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '서담시'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://maily.so/trendaword/posts/92zekj58zep'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://inside.ampm.co.kr/insight/60445', 'AI 영상 마케팅 — 서담시 흥행의 비밀', 'inside.ampm',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '서담시'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://inside.ampm.co.kr/insight/60445'
  );
commit;
