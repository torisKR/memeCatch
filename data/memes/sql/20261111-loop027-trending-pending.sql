-- Idempotent meme content batch. The generator does not connect or write.
-- batch_id: loop-027-pending-2026-11-11
-- Apply only after review:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this-file>
-- or paste the transaction into the Supabase SQL editor.
-- Inserts are skipped when the slug, normalized title/alias, source URL,
-- content URL, canonical media URL, tag, or translation locale already exists.
-- This file does not change moderation_status of rows that already exist
-- and does not walk pending rows to limited or approved.
-- warning: 체포하겠어-챌린지: pending video has no contents and no media
-- warning: 체포하겠어-챌린지: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 영원할-건가-보다: pending video has no contents and no media
-- warning: 영원할-건가-보다: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: l을-가져가: pending video has no contents and no media
-- warning: l을-가져가: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 빼난지원금: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 가로등-신사: pending video has no contents and no media
-- warning: 가로등-신사: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 느리구나-oo하는-것조차: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 책없쾌: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 줴줴이야: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 회크닉: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 엉가남: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 감다살: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 퇴사할게여-챌린지: pending video has no contents and no media
-- warning: 퇴사할게여-챌린지: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 오살힘: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 엔믹스하다: pending meme is missing translations: en, ja, zh, zh-tw
-- warning: 톤망진창: pending meme is missing translations: en, ja, zh, zh-tw
-- Rollback for memes inserted by this file while they are still pending:
--   delete from public.memes where slug = '체포하겠어-챌린지' and moderation_status = 'pending';
--   delete from public.memes where slug = '영원할-건가-보다' and moderation_status = 'pending';
--   delete from public.memes where slug = 'l을-가져가' and moderation_status = 'pending';
--   delete from public.memes where slug = '빼난지원금' and moderation_status = 'pending';
--   delete from public.memes where slug = '가로등-신사' and moderation_status = 'pending';
--   delete from public.memes where slug = '느리구나-oo하는-것조차' and moderation_status = 'pending';
--   delete from public.memes where slug = '책없쾌' and moderation_status = 'pending';
--   delete from public.memes where slug = '줴줴이야' and moderation_status = 'pending';
--   delete from public.memes where slug = '회크닉' and moderation_status = 'pending';
--   delete from public.memes where slug = '엉가남' and moderation_status = 'pending';
--   delete from public.memes where slug = '감다살' and moderation_status = 'pending';
--   delete from public.memes where slug = '퇴사할게여-챌린지' and moderation_status = 'pending';
--   delete from public.memes where slug = '오살힘' and moderation_status = 'pending';
--   delete from public.memes where slug = '엔믹스하다' and moderation_status = 'pending';
--   delete from public.memes where slug = '톤망진창' and moderation_status = 'pending';
begin;
insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  '체포하겠어-챌린지', '체포하겠어 챌린지', array['체포하겠어', '아일릿 체포하겠어 챌린지', 'You''re Under Arrest 챌린지']::text[],
  '아일릿 신곡 ''체포하겠어''의 호루라기 사운드에 맞춰 호루라기를 부는 시늉을 하고 손가락 총을 쏘는 숏폼 댄스 챌린지', '걸그룹 아일릿(ILLIT)의 미니 5집 ''BREAK EVEN'' 타이틀곡 ''체포하겠어''의 포인트 안무를 따라 하는 챌린지다. 반복되는 호루라기 소리에 맞춰 호루라기를 부는 시늉을 하고 손가락으로 총 모양을 만들어 쏘는 동작이 핵심이다. 아이유, 아이브 레이 등 다른 가수와 프로파일러 출신 권일용 교수까지 참여한 영상이 화제가 되며 숏폼에서 널리 퍼졌다.', '아일릿이 2026년 10월 5일 챌린지 티저를, 10월 18일 공식 챌린지 영상을 공개했고 곡은 10월 26일 발매됐다.',
  '포인트 안무를 따라 하는 챌린지 영상에 쓴다.',
  '경찰 제복 콘셉트 의상을 두고 성별 고정관념 논란도 있었으니, 실제 경찰·단속 상황을 희화화하는 용도로는 쓰지 않는 편이 좋다.',
  'challenge'::public.meme_category,
  'video'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"호루라기 소리 나오면 손가락 총! 체포하겠어 챌린지 🚨"},{"situation":"단톡방","text":"오늘 체포하겠어 챌린지 찍을 사람 손"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '체포하겠어-챌린지'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '체포하겠어-챌린지'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['체포하겠어챌린지', '체포하겠어', '아일릿체포하겠어챌린지', 'youreunderarrest챌린지']::text[])
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
  '영원할-건가-보다', '영원할 건가 보다', array['나 왜 이 순간이 영원할 것 같지', '난 왜 이 순간이 영원할 것 같지']::text[],
  '드라마 대사 ''나 왜 이 순간이 영원할 것 같지?''에 밴드 리도어의 ''영원은 그렇듯''을 붙여, 행복한 순간이나 끝나지 않는 고된 순간을 아련하게 보여주는 릴스 밈', 'tvN 드라마 ''스물다섯 스물하나''에서 나희도가 ''나 왜 이 순간이 영원할 것 같지?''라고 묻자 백이진이 ''영원할 건가 보다''라고 답하는 대사 뒤에 밴드 리도어의 노래 ''영원은 그렇듯''을 이어 붙인 숏폼 형식이다. 처음에는 결혼식, 불꽃놀이, 여행처럼 오래 간직하고 싶은 장면에 쓰였다. 이후 시험 기간, 야근, 출근, 취업 준비처럼 빨리 끝났으면 하는데 끝이 보이지 않는 상황에 반어적으로 붙이는 영상이 많아졌다. ''나 왜 이 야근이 영원할 것만 같지?''처럼 ''순간'' 자리에 힘든 일을 넣는 변형이 대표적이다.', '2022년 tvN 드라마 ''스물다섯 스물하나''의 대사와 리도어의 노래 ''영원은 그렇듯''을 조합한 릴스가 2026년 10월 인스타그램에서 유행했다. 처음 조합을 만든 사람은 확인되지 않는다.',
  '행복한 순간을 기록할 때도, 끝나지 않는 고된 일상을 자조할 때도 쓴다.',
  null,
  'phrase'::public.meme_category,
  'video'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"나 왜 이 시험 기간이 영원할 것만 같지? 영원할 건가 보다…"},{"situation":"단톡방","text":"회의가 3시간째야. 나 왜 이 순간이 영원할 것 같지"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '영원할-건가-보다'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '영원할-건가-보다'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['영원할건가보다', '나왜이순간이영원할것같지', '난왜이순간이영원할것같지']::text[])
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
  'l을-가져가', 'L을 가져가', array['Take the L', 'L 챌린지', 'L을 가져가 춤']::text[],
  '''Take the L(패배를 인정해)''을 그대로 옮긴 말로, 엄지와 검지로 만든 L자를 이마에 대고 다리를 차는 춤과 함께 외치는 놀림 섞인 유행어', '영어 속어 ''Take the L''에서 L은 패배(Loss)를 뜻해, ''졌으면 인정해''라는 의미다. 2018년 게임 ''포트나이트''의 감정 표현(이모트) ''Take the L''로 알려졌고, 엄지와 검지로 만든 L자를 이마에 대고 다리를 번갈아 옆으로 차는 동작이 함께 퍼졌다. 국내에서는 로블록스 게임 속 같은 동작을 유튜버 권루트가 따라 하며 ''L을 가져가''라고 외친 영상이 계기가 되어 초등학생 사이에서 크게 유행했고, 운동회·체육대회 영상과 연예인·기관 계정의 패러디로 번졌다.', '2018년 포트나이트 이모트 ''Take the L''에서 유래했고, 국내에서는 2026년 8월께부터 유튜버 권루트의 로블록스 영상으로 퍼졌다.',
  '게임이나 내기에서 이긴 뒤 친구를 장난스럽게 놀릴 때 쓴다.',
  '상대의 패배를 조롱하는 뜻이라 실제로 실패해 속상한 사람에게 쓰면 기분을 상하게 할 수 있다.',
  'dance'::public.meme_category,
  'video'::public.media_type,
  'yellow'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  '[{"situation":"친구와 게임 후","text":"내가 이겼지? L을 가져가~"},{"situation":"SNS 댓글","text":"운동회 계주 끝나고 다 같이 L을 가져가 춤 춘 거 너무 웃김"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = 'l을-가져가'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = 'l을-가져가'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['l을가져가', 'takethel', 'l챌린지', 'l을가져가춤']::text[])
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
  '빼난지원금', '빼난지원금', array['빼빼로 재난지원금']::text[],
  '빼빼로데이에 빼빼로를 받지 못한 친구에게 빼빼로를 나눠주는 일을 ''재난지원금''에 빗댄 초등학생발 신조어', '''빼빼로''와 ''재난지원금''을 합친 말로, 빼빼로데이(11월 11일)에 빼빼로를 하나도 받지 못한 친구에게 과자를 나눠 주며 챙겨 주는 일을 장난스럽게 부르는 말이다. 방송인 유병재의 유튜브 영상에서 한 초등학생이 또래 사이의 신조어로 소개했고, 출연한 아일릿 멤버들도 공감했다. 영상이 공개된 뒤 빼빼로데이를 앞두고 여러 언론과 SNS에서 소개되며 퍼졌다.', '2026년 11월 6일 공개된 유병재 유튜브 영상 ''웃으면 안되는 아일릿 팬미팅''에서 현장의 초등학생이 소개했다.',
  '빼빼로데이에 친구에게 과자를 나눠 주며 가볍게 쓴다.',
  '실제 정부 지원금이 아니다. ''빼난지원금 신청'' 같은 문자·링크는 사칭일 수 있으니 누르지 않는다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"학교에서","text":"너 빼빼로 하나도 못 받았어? 빼난지원금 지급한다"},{"situation":"단톡방","text":"빼난지원금 신청합니다… 저 아직 0개예요"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '빼난지원금'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '빼난지원금'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['빼난지원금', '빼빼로재난지원금']::text[])
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
  '가로등-신사', '가로등 신사', array['베스퍼', 'Vesper', '롯데월드 가로등 신사']::text[],
  '롯데월드 가을 퍼레이드에 나온 가스등 머리의 신사 캐릭터 ''베스퍼''가 아이돌급 인기를 얻으며 직캠·팬아트로 번진 팬덤 밈', '롯데월드 어드벤처의 가을 퍼레이드 ''다크 판타지 페스티벌''에 등장한 캐릭터 베스퍼를 부르는 별명이다. 가스등 모양의 머리에 연미복을 입은 신사가 표정 없이 우아한 손짓으로 관객에게 인사하는 모습이 화제가 됐다. 관객들이 아이돌 공연처럼 앞자리를 맡아 직캠을 찍고 팬아트와 인증샷을 올리면서 인터넷 밈이 됐고, 언론에서는 사람이 아닌 ''인외'' 캐릭터가 인기를 끈 사례로 소개했다. 양초 모양의 캐릭터 ''캔드라'' 등 함께 나오는 캐릭터도 관심을 받았다.', '2026년 9월 12일 시작한 롯데월드 어드벤처 퍼레이드 ''다크 판타지 페스티벌''의 캐릭터 베스퍼에서 시작됐다.',
  '표정은 없지만 묘하게 멋있는 대상을 두고 말하거나, 퍼레이드 직캠을 공유할 때 쓴다.',
  null,
  'image'::public.meme_category,
  'video'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 댓글","text":"표정 하나 없는데 손짓이 왜 이렇게 설레지… 가로등 신사 직캠 또 봄"},{"situation":"단톡방","text":"이번 주말 롯데월드 가로등 신사 보러 갈 사람"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '가로등-신사'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '가로등-신사'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['가로등신사', '베스퍼', 'vesper', '롯데월드가로등신사']::text[])
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
  '느리구나-oo하는-것조차', '느리구나, OO하는 것조차', array['느리구나', '느리구나 대피하는 것조차', '느리구나 쓰러지는 것조차']::text[],
  '애니메이션 「블리치」 쿠치키 뱌쿠야의 대사 ''느리구나, 쓰러지는 것조차''에서 동사만 바꿔, 느린 상대를 비장하게 놀리는 말투', '「블리치」의 쿠치키 뱌쿠야가 상대를 제압한 뒤 ''느리구나, 쓰러지는 것조차''라고 말하는 장면을 패러디한 문형이다. ''느리구나, 답장하는 것조차'', ''느리구나, 출근 준비하는 것조차''처럼 뒤의 동사만 바꿔 행동이 느린 사람이나 상황을 지나치게 진지한 톤으로 놀린다. 확인된 이른 변형 사례로 2026년 8월 29일 유튜버 우정잉이 올린 영상 ''느리구나... 이 영상을 누르는 것조차''가 있다. 이후 유튜브 채널 ''소방관 삼촌''이 화재 대피 방법을 다룬 영상에 ''느리구나, 대피하는 것조차''라는 제목을 붙였고, 이 영상이 X에서 크게 퍼지며 댓글에서도 블리치의 다른 대사를 패러디하는 반응이 이어졌다.', '「블리치」 쿠치키 뱌쿠야의 대사를 변형한 것으로, 확인된 이른 사례는 2026년 8월 29일 유튜버 우정잉의 영상이다. 처음 변형한 사람은 확인되지 않으며, 이후 ''소방관 삼촌'' 채널의 화재 대피 영상이 X에서 퍼지며 널리 알려졌다.',
  '답장이 늦거나 준비가 느린 친구에게 장난스럽게 쓴다.',
  '윗사람이나 친하지 않은 사람에게 쓰면 무례하게 들릴 수 있다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'yellow'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  '[{"situation":"단톡방","text":"3시간 만에 답장? 느리구나, 답장하는 것조차"},{"situation":"친구에게","text":"아직도 메뉴 못 골랐어? 느리구나, 고르는 것조차"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '느리구나-oo하는-것조차'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '느리구나-oo하는-것조차'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['느리구나oo하는것조차', '느리구나', '느리구나대피하는것조차', '느리구나쓰러지는것조차']::text[])
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
  '책없쾌', '책없쾌', array['책임 없는 쾌락']::text[],
  '''책임 없는 쾌락''의 줄임말로, 책임이나 부담 없이 즐거움만 누리는 상황을 뜻하며 2026년 야구팬 사이에서 중립 관람의 의미로 크게 퍼진 말', '''책임 없는 쾌락''을 줄인 말이다. 원래는 씻기기·재우기 같은 육아의 수고 없이 조카를 잠깐 귀여워만 해 주는 즐거움처럼, 책임은 지지 않고 즐거움만 누리는 상황을 가리켰다. 2026년 프로야구 시즌에는 응원팀이 아닌 경기를 보며 승패 스트레스 없이 응원과 먹거리만 즐기는 관람을 뜻하는 말로 야구팬 사이에서 다시 크게 퍼졌다. 경기장이나 야구장 음식 사진에 ''책없쾌''라는 한마디를 붙이는 식으로 쓴다.', '조카를 귀여워하는 즐거움을 가리키던 말이 2026년 여름 야구팬 커뮤니티를 중심으로 다시 유행했다. 처음 쓰인 시점은 확인되지 않는다.',
  '부담 없이 즐기기만 하는 상황을 가볍게 표현할 때 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'approximate', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"오늘 우리 팀 경기 없어서 책없쾌 직관 ⚾"},{"situation":"친구에게","text":"조카랑 반나절 놀아 주고 왔어. 이게 책없쾌지"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '책없쾌'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '책없쾌'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['책없쾌', '책임없는쾌락']::text[])
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
  '줴줴이야', '줴줴이야', array['줴줴']::text[],
  '게임 종료 인사 GG(Good Game)를 찰지게 늘여 발음한 말로, ''이미 끝났다, 망했다''는 체념을 장난스럽게 표현하는 유행어', '게임이 끝날 때 하는 인사 ''GG''를 특유의 억양으로 길게 외친 말이다. 리그 오브 레전드 스트리머 저라뎃이 경기를 관전하다 승부가 기울자 ''줴줴이야~''라고 외친 장면이 클립으로 퍼지며 유행어가 됐다. 지금은 게임 밖에서도 시험을 망치거나 일이 꼬였을 때 ''오늘 하루 줴줴이야''처럼 ''끝났다, 망했다''는 뜻으로 쓴다. 중국어처럼 들리지만 GG를 다르게 소리 낸 것일 뿐이다.', 'SOOP 스트리머 저라뎃의 리그 오브 레전드 관전 방송 클립에서 시작돼 2026년 숏폼과 SNS로 퍼졌다.',
  '친구끼리 일이 틀어졌을 때 장난스럽게 쓴다.',
  '경기 뒤 상대에게 하는 인사로 쓰면 비꼬는 느낌이 날 수 있으니, 인사는 원래대로 ''GG''라고 하는 편이 좋다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'yellow'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'approximate', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  '[{"situation":"단톡방","text":"과제 마감 10분 남았는데 파일 날아감… 줴줴이야"},{"situation":"게임 중","text":"한타 졌다, 이 판 줴줴이야"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '줴줴이야'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '줴줴이야'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['줴줴이야', '줴줴']::text[])
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
  '회크닉', '회크닉', array['회 피크닉']::text[],
  '''회''와 ''피크닉''을 합친 말로, 수산시장에서 회를 포장해 한강공원 같은 야외에서 즐기는 나들이', '수산시장이나 횟집에서 회를 포장해 한강공원, 노들섬 같은 야외에서 돗자리를 펴고 먹는 나들이를 가리킨다. ''치맥'', ''한강 라면''처럼 장소와 음식을 묶어 부르는 말의 새 변형으로, 2026년 가을 20~30대 사이에서 SNS 인증샷과 함께 퍼졌다. 언론 보도에 따르면 ''회크닉'' 검색량은 7월보다 9월 말에 크게 늘었다.', '2026년 9월 SNS에서 퍼져 9월 말~10월 언론에 ''한강 회크닉'' 열풍으로 소개됐다.',
  '나들이 계획이나 인증샷에 편하게 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"이번 주말 노량진 들렀다가 한강에서 회크닉 어때?"},{"situation":"SNS 캡션","text":"가을엔 치맥 말고 회크닉 🐟"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '회크닉'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '회크닉'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['회크닉', '회피크닉']::text[])
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
  '엉가남', '엉가남', array['엉덩이가 가벼운 남자']::text[],
  '''엉덩이가 가벼운 남자''의 줄임말로, 시키기 전에 먼저 일어나 필요한 일을 챙기는 부지런하고 배려심 있는 남자를 칭찬하는 말', '''엉덩이가 가볍다''는 표현을 살려, 시키지 않아도 먼저 일어나 밥을 가져다주고 음식을 나르는 등 필요한 일을 챙기는 사람을 칭찬하는 말이다. 2025년 10월 MBN ''전현무계획3''에서 전현무가 먼저 일어나 밥을 가져다주는 곽튜브를 보며 ''결혼하면 엉가남(엉덩이가 가벼운 남자)이 돼야 한다''고 말해 기사화됐다. 2026년 10월에는 연애 예능 ''나는 SOLO'' 34기에서 출연자 영호가 ''엉가남''으로 소개되고 첫인상 선택에서 3표를 받으며 다시 화제가 됐다.', '2025년 10월 MBN ''전현무계획3''에서 전현무가 쓴 말이 기사화됐고, 2026년 10월 ''나는 SOLO'' 34기 출연자 영호를 부르는 말로 다시 알려졌다. 처음 쓴 사람은 확인되지 않는다.',
  '먼저 나서서 일을 챙기는 사람을 칭찬할 때 쓴다.',
  '''엉덩이가 가볍다''는 원래 진득하지 못하다는 뜻으로도 쓰이니, 맥락 없이 쓰면 오해할 수 있다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2025::integer, 'approximate', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"모임 후","text":"설거지 벌써 다 했어? 완전 엉가남이네"},{"situation":"식사 자리","text":"말 안 했는데 수저까지 다 놨네, 엉가남 인정"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '엉가남'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '엉가남'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['엉가남', '엉덩이가가벼운남자']::text[])
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
  '감다살', '감다살', array['감 다 살았네', '감이 다 살았네']::text[],
  '''감이 다 살았네''의 줄임말로, 센스나 감각이 기대 이상으로 살아 있을 때 쓰는 칭찬', '''감이 다 살았네''를 줄인 말로, 누군가의 선택이나 결과물이 센스 있고 기대 이상일 때 칭찬하는 말이다. ''오늘 코디 감다살'', ''이 브랜드 광고 감다살''처럼 사람, 콘텐츠, 기업 SNS 등에 두루 쓴다. 반대로 감각이 떨어졌다는 뜻의 ''감다죽(감이 다 죽었다)''도 함께 쓰인다.', '2025년 무렵 온라인을 중심으로 퍼진 줄임말로, 2025년 언론의 Z세대 신조어 소개 기사에 실렸다.',
  '센스 있는 선택이나 결과물을 가볍게 칭찬할 때 쓴다.',
  '반대말 ''감다죽''은 상대의 감각을 깎아내리는 말이라 윗사람이나 공적인 자리에서는 피하는 편이 좋다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'active'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2025::integer, 'approximate', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"이번 생일 선물 고른 거 진짜 감다살이다"},{"situation":"SNS 댓글","text":"담당자 감다살 ㅋㅋ 이 타이밍에 이 밈을"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '감다살'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '감다살'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['감다살', '감다살았네', '감이다살았네']::text[])
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
  '퇴사할게여-챌린지', '퇴사할게여 챌린지', array['퇴사할게여']::text[],
  '아이들 소연의 솔로곡 ''퇴사할게여''에 맞춰 회사를 그만두는 상상을 연기와 춤으로 표현하는 직장인 공감 숏폼 챌린지', '그룹 아이들 멤버 소연(전소연)의 첫 솔로 정규 앨범 ''끝내주는 인생'' 타이틀곡 ''퇴사할게여''를 활용한 챌린지다. 기안84가 내레이션으로 참여한 곡으로, 직장인의 퇴사 욕구를 유쾌하게 담은 제목과 가사가 공감을 얻었다. 연기와 춤을 결합한 챌린지에 기안84, 리센느 미나미, 라이즈 소희, 선우용여 등이 참여했고, 일반 이용자들도 실제 퇴사 영상이나 출근길 영상에 곡을 붙이며 밈처럼 번졌다.', '2026년 9월 7일 발매된 소연의 정규 1집 ''끝내주는 인생'' 타이틀곡 ''퇴사할게여(Narr. 기안84)''에서 시작됐다.',
  '출근하기 싫은 날이나 퇴사 소식을 유쾌하게 알릴 때 쓴다.',
  '회사 공식 채널이나 상사에게 보내면 실제 퇴사 의사로 오해받을 수 있다.',
  'challenge'::public.meme_category,
  'video'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'exact', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"월요일 아침 9시, 마음속으로 퇴사할게여 🎵"},{"situation":"단톡방","text":"오늘 회의 끝나고 퇴사할게여 챌린지 찍고 싶었음"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '퇴사할게여-챌린지'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '퇴사할게여-챌린지'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['퇴사할게여챌린지', '퇴사할게여']::text[])
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
  '오살힘', '오살힘', array['오늘을 살아갈 힘', '오늘을 살아가는 힘']::text[],
  '''오늘을 살아갈 힘''의 줄임말로, 좋아하는 사람·사진·음식처럼 하루를 버티게 해 주는 작은 즐거움을 가리키는 말', '''오늘을 살아갈(살아가는) 힘''을 줄인 말이다. 좋아하는 아이돌의 사진이나 영상, 귀여운 동물, 퇴근길 간식처럼 하루를 버티게 해 주는 대상을 ''내 오살힘''이라고 부른다. 팬덤 게시물에서 최애를 향한 애정 표현으로 쓰이다 일상 표현으로 넓어졌고, 2026년 Z세대 줄임말로 여러 매체에 소개됐다. 예전의 ''소확행''과 비슷한 결의 말이다.', '팬덤 게시물에서 2025년 하반기부터 쓰인 것이 확인되며, 2026년 여름 Z세대 줄임말로 널리 소개됐다.',
  '하루를 버티게 해 주는 대상을 소개할 때 쓴다.',
  null,
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'rising'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2025::integer, 'approximate', null,
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"SNS 캡션","text":"퇴근길 붕어빵이 오늘의 오살힘"},{"situation":"팬 계정","text":"이 무대 영상이 내 오살힘이야"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '오살힘'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '오살힘'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['오살힘', '오늘을살아갈힘', '오늘을살아가는힘']::text[])
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
  '엔믹스하다', '엔믹스하다', array['엔믹스했다', '엔믹스해버렸다']::text[],
  '곡 안에서 장르를 확 바꾸는 걸그룹 엔믹스의 음악처럼, 대화·분위기·태도가 갑자기 정반대로 바뀌는 상황을 뜻하는 동사형 밈', '걸그룹 엔믹스(NMIXX)가 한 곡 안에서 서로 다른 장르를 갑자기 전환하는 ''MIXX POP'' 스타일과 ''Change Up'' 구호에서 나온 말이다. 기분이 갑자기 좋아지거나 나빠질 때, 날씨가 급변할 때, 대화 주제나 태도가 확 바뀔 때 ''엔믹스했다''라고 표현한다. 2026년 여름 X(옛 트위터)를 중심으로 동사처럼 쓰이며 퍼졌다.', '2026년 6월 말 X에서 쓰이기 시작해 7월 초 트렌드 뉴스레터 등에 소개됐다.',
  '분위기나 태도가 갑자기 바뀐 상황을 재치 있게 표현할 때 쓴다.',
  '엔믹스나 멤버를 조롱하는 말이 아니라 장르 전환이 많은 음악 스타일에서 나온 표현이다. 그룹을 깎아내리는 맥락으로는 쓰지 않는 편이 좋다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'green'::public.safety_level,
  'cooling'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2026::integer, 'year', null,
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '[{"situation":"단톡방","text":"아까까지 울더니 치킨 오니까 바로 엔믹스함"},{"situation":"SNS 캡션","text":"오전엔 비, 오후엔 쨍쨍. 날씨 엔믹스했다"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '엔믹스하다'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '엔믹스하다'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['엔믹스하다', '엔믹스했다', '엔믹스해버렸다']::text[])
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
  '톤망진창', '톤망진창', '{}'::text[],
  '''톤''과 ''엉망진창''을 합친 뷰티 신조어로, 피부 톤과 맞지 않는 화장 때문에 전체가 어색해진 상태', '''톤''과 ''엉망진창''을 합친 말로, 피부 톤에 맞지 않는 파운데이션 같은 베이스 메이크업이나 색조를 골라 전체적인 인상이 어색해진 상태를 뜻한다. 퍼스널 컬러 열풍과 함께 ''톤알못'', ''톤팡질팡'' 같은 뷰티 신조어와 나란히 소개됐다.', '2018년 무렵 뷰티 매체의 ''뷰티 신조어'' 소개 기사에 실리며 알려졌다.',
  '자기 화장이 실패했을 때 자조적으로 쓴다.',
  '다른 사람의 외모나 화장을 지적하는 데 쓰면 비하로 들릴 수 있다.',
  'phrase'::public.meme_category,
  'text'::public.media_type,
  'yellow'::public.safety_level,
  'cooling'::public.lifecycle_status,
  'pending'::public.moderation_status,
  2018::integer, 'approximate', null,
  '{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb,
  '[{"situation":"친구에게","text":"파운데이션 호수 잘못 사서 오늘 톤망진창이야"},{"situation":"SNS 캡션","text":"새로 산 쿠션 색이 안 맞아서 톤망진창… 내일 바로 교환"}]'::jsonb,
  'catalog', 'meme', 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = '톤망진창'
     or regexp_replace(lower(normalize(existing.slug, NFKC)), '[[:space:]]+', '', 'g') = '톤망진창'
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(array['톤망진창']::text[])
     )
)
on conflict (slug) do nothing;

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mk.co.kr/news/musics/12170044', '아일릿, ‘체포하겠어’ 챌린지 열풍 예고…강렬 ‘호루라기 사운드’', '스타투데이(매일경제)',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '체포하겠어-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mk.co.kr/news/musics/12170044'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.topstarnews.net/news/articleView.html?idxno=16259969', '아이유-아일릿 원희, ‘체포하겠어’ 챌린지 성사…‘좋은 날’ 커버 인연 재조명', '톱스타뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '체포하겠어-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.topstarnews.net/news/articleView.html?idxno=16259969'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.starnewskorea.com/star/2026/11/04/2026110418333529525', '아이브 레이, 아일릿 원희에 ''체포''당했다..깜찍한 투샷 챌린지', '스타뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '체포하겠어-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.starnewskorea.com/star/2026/11/04/2026110418333529525'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://sports.donga.com/ent/article/all/20261106/134971093/1', '‘교수님이 왜 거기서 나와?’…아이돌 챌린지의 ‘선넘는 콜라보’', '스포츠동아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '체포하겠어-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://sports.donga.com/ent/article/all/20261106/134971093/1'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.huffingtonpost.kr/article/261315', '아일릿 신곡 ''체포하겠어'' 무대, ''짧은 치마'' 여성 경찰 콘셉트 논란', '허프포스트코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '체포하겠어-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.huffingtonpost.kr/article/261315'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://maily.so/trendaword/posts/w6ovxlgmzk5', '[Trend A Word #638] 나 왜 이 출근이 영원할 것만 같지? 영원할 건가 보다…', 'Trend A Word',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '영원할-건가-보다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://maily.so/trendaword/posts/w6ovxlgmzk5'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://blog.hsad.co.kr/3798', '[월간 2026밈] 11월 편 - 나 왜 이 순간이 영원할 것 같지?', 'HSAD 공식 블로그',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '영원할-건가-보다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://blog.hsad.co.kr/3798'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://meme100.me/meme/475', '영원할 건가 보다 뜻·유래', '밈 백과사전',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '영원할-건가-보다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://meme100.me/meme/475'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20261104078900505', '[소셜＋] "애를 가져가?" 부모들 갸웃…초등생 휩쓴 ''L 챌린지''', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = 'l을-가져가'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20261104078900505'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://blog.hsad.co.kr/3798', '[월간 2026밈] 11월 편 - L을 가져가', 'HSAD 공식 블로그',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = 'l을-가져가'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://blog.hsad.co.kr/3798'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.ohmynews.com/NWS_Web/Event/FrogPress/Suwon/bbs_view.aspx?pBBS_CD=000001628128&pBOARD_CD=J0278', '요즘 초등학생들 사이에서 유행중인 춤, L을 가져가의 정체는?', '오마이뉴스 청개구리 기자단',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = 'l을-가져가'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.ohmynews.com/NWS_Web/Event/FrogPress/Suwon/bbs_view.aspx?pBBS_CD=000001628128&pBOARD_CD=J0278'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mt.co.kr/society/2026/11/10/2026111007574324321', '빼빼로 못 받으면 ''빼난지원금'' 수령?…아일릿 "우리도 받았었다"', '머니투데이',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '빼난지원금'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mt.co.kr/society/2026/11/10/2026111007574324321'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mk.co.kr/news/society/12205361', '“빼빼로 못 받으면 ‘빼난지원금’이라도”…초등학생이 만든 신조어, 뭐길래', '매일경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '빼난지원금'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mk.co.kr/news/society/12205361'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.fnnews.com/news/202611111620523928', '"오늘 빼빼로 못 받았다면?"… 초등생이 만든 웃픈 신조어 ''빼난지원금'' 화제', '파이낸셜뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '빼난지원금'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.fnnews.com/news/202611111620523928'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.diarypoint.com/news/articleView.html?idxno=7047', '빼난지원금 뜻은? 빼빼로 못 받은 친구에게 나눠주는 밈', '다이어리포인트',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '빼난지원금'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.diarypoint.com/news/articleView.html?idxno=7047'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.joongang.co.kr/article/25468058', '“꺅!” 아이돌인 줄…롯데월드 입장객 30% 늘린 ‘가로등 신사’ 정체', '중앙일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '가로등-신사'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.joongang.co.kr/article/25468058'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankyung.com/article/2026101546431', '가로등 신사·촛대 숙녀의 손짓…잊혀진 꿈에 불 밝히다', '한국경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '가로등-신사'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankyung.com/article/2026101546431'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://imnews.imbc.com/original/14f/6856097_29052.html', '[14F] 가로등이 잘생겼다고?... 인외 캐릭터 ‘가로등 신사’ 화제', 'MBC 14F',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '가로등-신사'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://imnews.imbc.com/original/14f/6856097_29052.html'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.insight.co.kr/news/578886', '“표정 없는 가로등 신사에 빠졌다”... 롯데월드 ‘인외’ 캐릭터 열풍', '인사이트',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '가로등-신사'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.insight.co.kr/news/578886'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'YouTube', 'https://www.youtube.com/watch?v=ut-_ihLdJ8Y', '느리구나... 이 영상을 누르는 것조차', '우정잉 (YouTube)',
  'unknown'::public.copyright_status, 'earliest_known', 'link_only'
from public.memes as meme
where meme.slug = '느리구나-oo하는-것조차'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.youtube.com/watch?v=ut-_ihLdJ8Y'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://gogumafarm.kr/%EB%82%B4%EA%B0%80-%EA%B3%A0%EA%B5%AC%EB%A7%88%ED%8C%9C%EC%9D%B4%EC%97%88%EC%9C%BC%EB%A9%B4-%EC%9D%B4-%EB%B0%88%EC%9D%80-%EA%BC%AD-%EC%86%8C%EA%B0%9C%ED%95%98%EA%B3%A0-%EC%8B%B6%EC%9D%8C-2026', '내가 고구마팜이었으면 이 밈은 꼭 소개하고 싶음 [2026년 9월 최신 밈 모음]', '고구마팜',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '느리구나-oo하는-것조차'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://gogumafarm.kr/%EB%82%B4%EA%B0%80-%EA%B3%A0%EA%B5%AC%EB%A7%88%ED%8C%9C%EC%9D%B4%EC%97%88%EC%9C%BC%EB%A9%B4-%EC%9D%B4-%EB%B0%88%EC%9D%80-%EA%BC%AD-%EC%86%8C%EA%B0%9C%ED%95%98%EA%B3%A0-%EC%8B%B6%EC%9D%8C-2026'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'YouTube', 'https://www.youtube.com/watch?v=Oxp9eFV4AxU', '느리구나, 대피하는 것 조차', '소방관 삼촌 (YouTube)',
  'unknown'::public.copyright_status, 'usage_example', 'link_only'
from public.memes as meme
where meme.slug = '느리구나-oo하는-것조차'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.youtube.com/watch?v=Oxp9eFV4AxU'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://jjalnews.com/archives/61774', '느리구나, OO하는 것조차 (블리치 뱌쿠야 대사 패러디)', '짤뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '느리구나-oo하는-것조차'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://jjalnews.com/archives/61774'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20260721114800011', '[샷!] "누가 이기든 내 알 바 아니라 너무 좋아"', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '책없쾌'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20260721114800011'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://weekly.khan.co.kr/article/202608010600021', '[꼬다리] ‘책없쾌’의 시대', '주간경향',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '책없쾌'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://weekly.khan.co.kr/article/202608010600021'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.careet.net/1945', '책없쾌, 오살힘, 사보필 뜻은? 요즘 Z세대 줄임말 모음', '캐릿',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '책없쾌'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.careet.net/1945'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'SOOP', 'https://vod.sooplive.com/player/185893997', '[클립]저라뎃 유행어 "줴줴이야"의 유래 / 구슬요 반응', 'SOOP VOD',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '줴줴이야'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://vod.sooplive.com/player/185893997'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.tpick.co.kr/post/10967', '''줴줴이야'' 무슨 뜻이야? 요즘 게임·SNS에서 자꾸 보이는 유행어 정체', '티픽',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '줴줴이야'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.tpick.co.kr/post/10967'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://hangeul-tool.com/blog/newword-2026-autumn', '요즘 신조어 2026 가을편: 책없쾌·젬민이·난리자베스·줴줴이야 뜻', '한글도구함',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '줴줴이야'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://hangeul-tool.com/blog/newword-2026-autumn'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.joongang.co.kr/article/25468384', '“뻔한 라면 그만”…검색량 110배 폭증, 한강 돗자리 휩쓴 이 음식 [비크닉]', '중앙일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '회크닉'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.joongang.co.kr/article/25468384'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://magazine.hankyung.com/business/article/202609304040b', '요즘 한강에선 다 이거 먹는다… MZ 빠진 회크닉', '한경비즈니스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '회크닉'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://magazine.hankyung.com/business/article/202609304040b'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sedaily.com/article/20099994', '“한강에서 치맥 대신 회 한접시”…2030 가을 ‘회크닉’ 열풍', '서울경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '회크닉'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sedaily.com/article/20099994'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sportschosun.com/entertainment/2025-10-24/202510240100149240019923', '곽튜브, ''예비 아빠'' 되더니 성격까지 달라졌다...전현무 "엉가남 됐네!"', '스포츠조선',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엉가남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sportschosun.com/entertainment/2025-10-24/202510240100149240019923'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://sports.donga.com/ent/article/all/20251024/132626552/1', '‘새신랑’ 곽튜브 “요즘 부지런해졌다”', '스포츠동아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엉가남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://sports.donga.com/ent/article/all/20251024/132626552/1'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.joynews24.com/view/2015155', '''나는솔로'' 34기 영호, 첫인상 싹쓸이⋯7누나 영수·상철 "집 하나 더"', '조이뉴스24',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엉가남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.joynews24.com/view/2015155'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'SBS', 'https://programs.sbs.co.kr/plus/iamsolo/clip/69611/22000637914', '나는 SOLO : 요즘 연애시장에서 제일 귀한 타입.. 엉가남 영호', 'SBS Plus',
  'unknown'::public.copyright_status, 'official_reupload', 'link_only'
from public.memes as meme
where meme.slug = '엉가남'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://programs.sbs.co.kr/plus/iamsolo/clip/69611/22000637914'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sedaily.com/article/14070510', '[신조어 사전] 감다살', '서울경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '감다살'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sedaily.com/article/14070510'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.newspim.com/news/view/20250905000852', 'Z세대 신조어, ''느좋''서 ''테토녀''까지 세대 간 언어 격차', '뉴스핌',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '감다살'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.newspim.com/news/view/20250905000852'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.news1.kr/videos/24893', '"관둬!" 리센느부터 선우용여까지…재미·감동 다 잡은 ''퇴사할게여'' 챌린지 화제', '뉴스1',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '퇴사할게여-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.news1.kr/videos/24893'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www3.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=04857686645579136', '소연, ‘퇴사할게여’로 통했다… 직장인 마음까지 저격', '이데일리',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '퇴사할게여-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www3.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=04857686645579136'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://tvdaily.co.kr/read.php3?aid=17889382191801595010', '"저도 퇴사할게요"…아이들 소연 신곡에 연예계·기업 ''유쾌한 대동단결''', '티브이데일리',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '퇴사할게여-챌린지'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://tvdaily.co.kr/read.php3?aid=17889382191801595010'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.arenakorea.com/news/articleView.html?idxno=71964', '신조어에 대하여', '아레나옴므플러스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '오살힘'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.arenakorea.com/news/articleView.html?idxno=71964'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.careet.net/1945', '책없쾌, 오살힘, 사보필 뜻은? 요즘 Z세대 줄임말 모음', '캐릿',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '오살힘'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.careet.net/1945'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://onmeme.com/osalhim', '오살힘(=오늘을 살아갈 힘) 뜻 · 유래', '온밈',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '오살힘'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://onmeme.com/osalhim'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://maily.so/trendaword/posts/knrj18g7rld', '[Trend A Word #575] 엔믹스해버렸다', 'Trend A Word',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엔믹스하다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://maily.so/trendaword/posts/knrj18g7rld'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://onmeme.com/nmixx-hada', '엔믹스하다(=엔믹스했다) 뜻 · 유래', '온밈',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엔믹스하다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://onmeme.com/nmixx-hada'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.haradaeigo.com/buzzword2026/w/nmixx-hada', '「엔믹스하다」の意味は？', '原田英語',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '엔믹스하다'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.haradaeigo.com/buzzword2026/w/nmixx-hada'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mhns.co.kr/news/articleView.html?idxno=148943', '[문화뉴스 울트라문화] 알.쓸.신.뷰 ‘Beauty Word’', '더쎈뉴스(The CEN News, 옛 문화뉴스)',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '톤망진창'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mhns.co.kr/news/articleView.html?idxno=148943'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.elle.co.kr/article/22341', '뷰티 ''인싸'' 되고 싶니?', '엘르 코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.slug = '톤망진창'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.elle.co.kr/article/22341'
  );
commit;
