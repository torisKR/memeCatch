-- 2026-10-27 K-밈 입문 묶음 3 (로컬 우선 적용)
-- 주제: 외국인이 한국 콘텐츠에서 자주 만나는 말 + 일상 신조어
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter-3.sql
-- 선행: 20261027-k-meme-starter.sql (로컬 검토자 계정 생성)
-- 원칙: 나무위키·위키백과에서 뜻과 유래를 확인한 것만 넣는다. 첫 사용자가 불확실하면 단정하지 않는다.
-- supabase db query는 명령 하나만 받으므로 DO 블록 하나로 묶는다 (블록 전체가 한 트랜잭션).

do $migration$
begin

-- ── 1. 밈 ───────────────────────────────────────────────────────
insert into memes (
  title, slug, aliases, summary, description, origin,
  usage_note, caution, usage_context, usage_examples,
  safety_level, lifecycle_status, moderation_status, category, media_type,
  difficulty, sentiment, origin_year, korea_viral_year, year_precision, era_type,
  trend_score, published_at
)
select v.title, v.slug, v.aliases, v.summary, v.description, v.origin,
  v.usage_note, v.caution, v.usage_context::jsonb, v.usage_examples::jsonb,
  v.safety_level::safety_level, v.lifecycle_status::lifecycle_status,
  'approved'::moderation_status, v.category::meme_category, v.media_type::media_type,
  v.difficulty::meme_difficulty, v.sentiment::meme_sentiment,
  v.origin_year, v.korea_viral_year, v.year_precision, v.era_type,
  v.trend_score, now()
from (values
(
  '먹방', '먹방', array['먹는 방송','Mukbang','mukbang'],
  '''먹는 방송''의 줄임말, 음식을 먹는 모습을 보여 주는 영상',
  '방송인이 음식을 먹으며 시청자와 이야기하는 영상이나 방송을 말한다. 한국 인터넷 방송 아프리카TV(지금의 SOOP)에서 시작해 2010년대 초 한국에서 인기를 얻었고, 2010년대 중반부터 세계로 퍼졌다. 지금은 영어 사전에도 ''mukbang''으로 실릴 만큼 한국에서 나온 대표적인 인터넷 문화가 됐다. 혼자 밥 먹는 사람이 친구처럼 함께 먹는 느낌을 얻으려고 보기도 한다.',
  '아프리카TV 초기 인터넷 방송에서 시작해 2010년대 초 한국에서 유행했고, 2010년대 중반부터 세계로 확산',
  '음식 영상이나 많이 먹는 모습을 이야기할 때 쓴다. 맛있게 먹는 친구를 칭찬할 때도 쓴다.',
  '과식을 부추기는 영상은 건강에 좋지 않을 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"저녁 메뉴를 고르며","text":"어제 먹방 보다가 갑자기 떡볶이 당겼어"},{"situation":"친구가 맛있게 먹을 때","text":"너 먹방 찍어도 되겠다"}]',
  'green', 'active', 'image', 'video', 'beginner', 'wholesome', 2010, 2013, 'approximate', 'social_media', 52.0
),
(
  '치맥', '치맥', array['치킨과 맥주','Chimaek','chimaek','맥치'],
  '치킨과 맥주를 함께 먹는 한국 문화',
  '프라이드치킨과 맥주의 앞 글자를 딴 말이다. 둘 다 원래 한국 음식은 아니지만, 함께 즐기는 문화는 한국을 대표하는 것으로 여겨진다. 2002년 월드컵 때 응원하며 치맥을 많이 먹으면서 더 유명해졌다. 드라마 ''별에서 온 그대''의 치맥 장면 덕분에 중국어권에서도 크게 유행했다. 지금은 영어 위키백과에도 ''Chimaek''이라는 항목이 있다.',
  '1990년대 호프집 안주 문화에서 자리 잡아, 2002년 월드컵과 드라마 ''별에서 온 그대''를 거치며 해외까지 확산',
  '친구와 저녁 약속을 잡거나, 스포츠 경기를 함께 볼 때 쓴다.',
  '술이 들어가는 문화라 미성년자나 술을 못 마시는 사람에게 강요하지 말자.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"축구 경기가 있는 날","text":"오늘 경기 보면서 치맥 어때?"},{"situation":"퇴근길","text":"이번 주 고생했으니 치맥 한잔하자"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2000, 2002, 'decade', 'early_web', 47.0
),
(
  '인싸', '인싸', array['인사이더','인싸템','아싸','Inssa'],
  '''인사이더''의 줄임말, 사람들과 잘 어울리는 사람',
  '무리 안에서 적극적으로 어울리며 존재감이 있는 사람을 말한다. 반대말은 ''아싸(아웃사이더)''다. 2004년 무렵 만들어진 말이지만 2017년부터 크게 알려졌다. 유행하는 물건을 ''인싸템'', 유행하는 행동을 ''인싸력''처럼 붙여 쓰기도 한다. 영어 ''insider''와는 뜻이 달라서 한국식 영어(콩글리시)에 가깝다.',
  '2004년 무렵 쓰이기 시작했고 2017년부터 SNS와 커뮤니티에서 크게 유행',
  '사교적인 친구를 칭찬하거나, 유행하는 물건을 이야기할 때 쓴다.',
  '''아싸''를 남에게 붙이면 따돌리는 말처럼 들릴 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 모임마다 인기 많을 때","text":"역시 너는 인싸야"},{"situation":"유행템을 샀을 때","text":"이게 요즘 인싸템이래"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2004, 2017, 'approximate', 'social_media', 38.0
),
(
  '손절', '손절', array['손절하다','손절각','손절매','Sonjeol'],
  '사람과의 관계를 끊는다는 뜻으로 쓰는 말',
  '원래는 주식에서 손해를 보더라도 팔아 버리는 ''손절매''의 줄임말이다. 그런데 ''손''을 손(hand)으로 오해해 ''손을 끊는다'', 곧 관계를 끊는다는 뜻으로 퍼졌다. 연예 기사에서 문제를 일으킨 모델과 광고를 끊는 상황에 이 말을 쓰면서 널리 알려졌다. 지금은 맞지 않는 친구나 사람과 연락을 끊을 때 흔히 쓴다.',
  '주식 용어 ''손절매''가 2010년대 중후반 연예 기사와 인터넷에서 ''관계를 끊다''라는 뜻으로 바뀌며 확산',
  '맞지 않는 관계를 정리했다고 말할 때 쓴다. 농담으로 "손절각"이라고도 한다.',
  '실제 사람을 지목해 "손절하자"고 하면 따돌림처럼 보일 수 있다.',
  '{"sns":"yellow","work":"yellow","family":"yellow","friends":"green"}',
  '[{"situation":"계속 약속을 어기는 친구 이야기","text":"그 정도면 손절해도 될 것 같아"},{"situation":"농담으로","text":"내 아이스크림 먹으면 바로 손절이다"}]',
  'yellow', 'active', 'phrase', 'text', 'beginner', 'negative', 2016, 2018, 'approximate', 'social_media', 37.0
),
(
  '할많하않', '할많하않', array['할 말은 많지만 하지 않겠다','Hal-man-ha-an','Halmanhaan'],
  '''할 말은 많지만 하지 않겠다''의 줄임말',
  '하고 싶은 말은 많지만 참고 넘어가겠다는 뜻이다. 대화가 안 통하는 상대와 더 말하고 싶지 않을 때, 길게 설명하는 대신 불편한 마음을 짧게 보여 줄 때 쓴다. 너무 어이없는 일을 보고 할 말을 잃었을 때도 쓴다. 스포일러를 피하려고 말을 아낄 때 쓰기도 한다. 말싸움에서 밀릴 때 슬쩍 빠져나가는 말로 쓰여 놀림을 받기도 한다.',
  '2015년 후반 인터넷에서 생긴 신조어로 추정되며, 이후 SNS 댓글로 널리 퍼짐',
  '어이없는 상황을 짧게 표현하거나, 말싸움을 끝내고 싶을 때 쓴다.',
  '윗사람이나 진지한 대화에서 쓰면 비꼬는 말로 들릴 수 있다.',
  '{"sns":"green","work":"gray","family":"yellow","friends":"green"}',
  '[{"situation":"황당한 일을 겪고 나서","text":"오늘 회의… 할많하않"},{"situation":"드라마 결말을 묻는 친구에게","text":"스포일러라서 할많하않"}]',
  'yellow', 'cooling', 'phrase', 'text', 'beginner', 'ironic', 2015, 2016, 'approximate', 'social_media', 33.0
),
(
  '댕댕이', '댕댕이', array['멍멍이','댕댕','댕청미','Daengdaengi','Doggo'],
  '강아지를 귀엽게 부르는 말',
  '''멍멍이''의 ''멍''을 모양이 비슷한 글자 ''댕''으로 바꿔 쓴 말이다. 이렇게 글자 모양을 비틀어 쓰는 놀이를 ''야민정음''이라고 부른다. 원래 인터넷 게시판에서 시작했지만 발음이 쉽고 귀여워서 TV 예능, 광고, 애견카페 이름까지 널리 쓰이게 됐다. 지금은 반려견을 부르는 가장 흔한 귀여운 말 가운데 하나다.',
  '2010년대 후반 인터넷 커뮤니티의 글자 비틀기 놀이(야민정음)에서 시작해 방송과 광고로 확산',
  '강아지 사진을 보거나 반려견 이야기를 할 때 편하게 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"산책하는 강아지를 보고","text":"저 댕댕이 너무 귀엽다"},{"situation":"반려견 자랑","text":"우리 집 댕댕이 오늘 미용했어"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2017, 2018, 'approximate', 'social_media', 44.0
),
(
  '최애', '최애', array['최애캐','최애 멤버','차애','Choeae','Bias'],
  '가장 좋아하는 사람이나 캐릭터',
  '''가장 사랑함''을 뜻하는 원래 있던 말이지만, 2010년대에 팬 문화에서 ''가장 좋아하는 멤버나 캐릭터''라는 뜻으로 널리 쓰이게 됐다. 일본 애니메이션 팬덤의 ''최애캐''라는 말이 한국 아이돌 팬덤으로 넘어오며 퍼졌다. 두 번째로 좋아하는 사람은 ''차애''라고 부른다. 지금은 음식, 노래 등 무엇이든 가장 좋아하는 것에 붙인다.',
  '2010년대 애니메이션 팬덤의 ''최애캐''가 아이돌 팬덤으로 넘어와 줄임말 ''최애''로 확산',
  '좋아하는 멤버나 음식, 노래를 소개할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"아이돌 이야기","text":"이 그룹에서 내 최애는 막내야"},{"situation":"메뉴를 고를 때","text":"떡볶이는 내 최애 간식이지"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2015, 2016, 'approximate', 'social_media', 45.0
),
(
  '엄근진', '엄근진', array['엄격 근엄 진지','엄격 진지','Eom-geun-jin','Eomgeunjin'],
  '''엄격, 근엄, 진지''의 줄임말',
  '별것 아닌 일에 지나치게 진지하고 엄격하게 구는 모습을 장난스럽게 말할 때 쓴다. 인터넷 커뮤니티의 만화에서 사소한 일로 벌점을 주는 엄숙한 인물들이 나온 장면에서 퍼졌다. 처음에는 과하게 따지는 사람을 놀리는 말이었지만, 지금은 "엄근진 모드"처럼 스스로 진지해질 때도 쓴다.',
  '2014년 인터넷 커뮤니티의 ''엄격 진지'' 밈에 2015년 연재 만화에서 ''근엄''이 붙으며 완성되어 확산',
  '농담 분위기에서 진지해진 사람을 가볍게 놀리거나, 나 스스로 진지해질 때 쓴다.',
  '상대의 진지한 고민에 쓰면 무시하는 말로 들릴 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"친구가 게임 규칙을 너무 따질 때","text":"왜 이렇게 엄근진이야"},{"situation":"시험 공부 시작할 때","text":"지금부터 엄근진 모드 들어간다"}]',
  'yellow', 'cooling', 'phrase', 'text', 'normal', 'ironic', 2014, 2015, 'year', 'social_media', 32.0
),
(
  '파이팅', '파이팅', array['화이팅','Fighting','Hwaiting','아자 파이팅'],
  '''힘내!''라는 뜻의 한국식 응원 구호',
  '영어 ''fighting''에서 왔지만, 한국에서는 "힘내", "잘해 보자"라는 뜻으로 쓰는 응원 구호다. 영어권에서는 ''싸움''이라는 뜻이라서 한국어를 모르는 사람은 이 뜻으로 알아듣지 못한다. 한국 드라마, 예능, K-팝 영상에 자주 나와서 외국 팬들도 많이 따라 한다. 주먹을 쥐고 팔을 들며 외치는 동작이 함께 쓰인다.',
  '영어 ''fighting''이 한국에서 응원 구호로 바뀐 한국식 영어로, 스포츠 응원과 방송을 통해 널리 쓰임',
  '시험, 경기, 발표를 앞둔 사람을 응원할 때 쓴다. 외국인 친구에게는 "힘내"라는 뜻이라고 함께 알려 주자.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"시험 보러 가는 친구에게","text":"오늘 시험 파이팅!"},{"situation":"팀 회의를 마치며","text":"이번 프로젝트 다 같이 파이팅"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', null, null, 'unknown', null, 40.0
),
(
  '애교', '애교', array['Aegyo','aegyo','애교 부리기'],
  '귀여운 목소리나 몸짓으로 사랑스러움을 표현하는 것',
  '귀여운 목소리, 말투, 표정, 손동작으로 사랑스럽게 구는 행동을 말한다. K-팝 아이돌이 예능이나 팬 사인회에서 애교를 보여 주는 장면이 많아 해외 팬들에게도 ''aegyo''로 알려졌다. 손으로 볼을 감싸거나 혀 짧은 소리를 내는 것이 대표적이다. 다만 특히 어린 여성에게 애교를 강요하는 문화에는 비판도 있다.',
  '오래된 한국어 표현이 2010년대 K-팝 아이돌 예능과 팬 문화를 통해 세계에 ''aegyo''로 알려짐',
  '친한 사이에서 장난스럽게 귀여운 척할 때, 또는 아이돌 영상 이야기를 할 때 쓴다.',
  '누군가에게 "애교 좀 해 봐"라고 시키는 건 실례가 될 수 있다. 특히 성별에 따라 강요하지 말자.',
  '{"sns":"green","work":"gray","family":"green","friends":"green"}',
  '[{"situation":"아이돌 예능을 보며","text":"저 멤버 애교 진짜 자연스럽다"},{"situation":"친구가 부탁할 때","text":"애교 부려도 숙제는 안 보여 줘"}]',
  'yellow', 'active', 'phrase', 'video', 'beginner', 'wholesome', 2010, 2012, 'approximate', 'social_media', 39.0
),
(
  '눈치', '눈치', array['Nunchi','nunchi','눈치 보다','눈치 챙겨'],
  '말하지 않아도 분위기와 마음을 알아채는 감각',
  '다른 사람의 기분이나 그 자리의 분위기를 빠르게 알아채는 능력을 말한다. 한국 사람 사이의 관계에서 아주 중요하게 여겨지며, "눈치가 빠르다", "눈치 좀 챙겨"처럼 쓴다. 영어에는 딱 맞는 단어가 없어 감성 지능에 가깝다고 설명하고, 영어 위키백과에도 ''Nunchi''로 실려 있다. 한국 드라마와 직장 문화를 이해하는 데 꼭 필요한 말이다.',
  '17세기 기록에도 나오는 오래된 한국어로, 2010년대 이후 해외에서 ''nunchi''라는 한국 문화 개념으로 소개됨',
  '분위기를 잘 읽는 사람을 칭찬하거나, 눈치 없이 군 일을 농담으로 말할 때 쓴다.',
  '"눈치 없다"는 말은 상대를 깎아내리는 말이 될 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 분위기를 잘 맞췄을 때","text":"역시 눈치 빠르다"},{"situation":"둘만 있고 싶은 친구들을 보고","text":"눈치 챙겨서 먼저 갈게"}]',
  'green', 'active', 'phrase', 'text', 'normal', 'wholesome', null, null, 'unknown', null, 41.0
)
) as v(title, slug, aliases, summary, description, origin,
  usage_note, caution, usage_context, usage_examples,
  safety_level, lifecycle_status, category, media_type,
  difficulty, sentiment, origin_year, korea_viral_year, year_precision, era_type, trend_score)
on conflict (slug) do update set
  title = excluded.title, aliases = excluded.aliases, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin,
  usage_note = excluded.usage_note, caution = excluded.caution,
  usage_context = excluded.usage_context, usage_examples = excluded.usage_examples,
  origin_year = excluded.origin_year, korea_viral_year = excluded.korea_viral_year,
  year_precision = excluded.year_precision, era_type = excluded.era_type;

-- ── 2. 확인한 출처 (2026-10-27 존재 확인) ────────────────────────
insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis)
select m.id, 'Web', v.url, v.title, v.publisher, 'unknown'::copyright_status, 'secondary_reference', 'link_only'
from (values
('먹방', 'https://namu.wiki/w/%EB%A8%B9%EB%B0%A9', '먹방', '나무위키'),
('먹방', 'https://en.wikipedia.org/wiki/Mukbang', 'Mukbang', 'Wikipedia'),
('치맥', 'https://namu.wiki/w/%EC%B9%98%EB%A7%A5', '치맥', '나무위키'),
('치맥', 'https://en.wikipedia.org/wiki/Chimaek', 'Chimaek', 'Wikipedia'),
('인싸', 'https://namu.wiki/w/%EC%9D%B8%EC%8B%B8', '인싸', '나무위키'),
('손절', 'https://namu.wiki/w/%EC%86%90%EC%A0%88', '손절', '나무위키'),
('할많하않', 'https://namu.wiki/w/%ED%95%A0%EB%A7%8E%ED%95%98%EC%95%8A', '할많하않', '나무위키'),
('댕댕이', 'https://namu.wiki/w/%EB%8C%95%EB%8C%95%EC%9D%B4', '댕댕이', '나무위키'),
('최애', 'https://namu.wiki/w/%EC%B5%9C%EC%95%A0', '최애', '나무위키'),
('엄근진', 'https://namu.wiki/w/%EC%97%84%EA%B7%BC%EC%A7%84', '엄근진', '나무위키'),
('파이팅', 'https://namu.wiki/w/%ED%8C%8C%EC%9D%B4%ED%8C%85', '파이팅', '나무위키'),
('애교', 'https://en.wikipedia.org/wiki/Aegyo', 'Aegyo', 'Wikipedia'),
('눈치', 'https://en.wikipedia.org/wiki/Nunchi', 'Nunchi', 'Wikipedia')
) as v(slug, url, title, publisher)
join memes m on m.slug = v.slug
where not exists (
  select 1 from meme_sources s where s.meme_id = m.id and s.source_url = v.url
);

-- ── 3. 영어 번역 (외국 사용자용, 로컬 검토자 계정) ─────────────────
insert into meme_translations (
  meme_id, locale, localized_slug, title, summary, description, origin,
  usage_note, caution, aliases, usage_examples,
  status, source_updated_at, provider, model, prompt_version, reviewed_at, reviewed_by
)
select m.id, 'en', t.lslug, t.title, t.summary, t.description, t.origin,
  t.usage_note, t.caution, t.aliases, t.usage_examples::jsonb,
  'reviewed', m.updated_at, 'editorial', 'human', 1, now(), '00000000-0000-0000-0000-00000000e0e0'
from (values
('먹방', 'mukbang', 'Mukbang (먹방): Eating Broadcast',
 'Short for "eating broadcast", videos of people eating',
 'A video or live stream where a host eats while talking with viewers. It began on the Korean streaming site AfreecaTV (now SOOP), became popular in Korea in the early 2010s and spread worldwide from the mid-2010s. "Mukbang" is now in English dictionaries.',
 'Early AfreecaTV streams, popular in Korea in the early 2010s, global from the mid-2010s',
 'Use it when talking about food videos or someone eating with gusto.', 'Videos that push overeating may not be healthy.',
 array['Eating show'],
 '[{"situation":"Choosing dinner","text":"I watched a mukbang and now I want tteokbokki."}]'),
('치맥', 'chimaek', 'Chimaek (치맥): Fried Chicken and Beer',
 'Fried chicken and beer, a classic Korean pairing',
 'From "chikin" (fried chicken) and "maekju" (beer). Neither is Korean food, but enjoying them together is seen as Korean culture. It grew during the 2002 World Cup, and the drama "My Love from the Star" made it a craze in Chinese-speaking regions.',
 'Korean pub culture in the 1990s, boosted by the 2002 World Cup and K-dramas',
 'Use it when making evening plans or watching sports.', 'Do not pressure minors or non-drinkers to drink.',
 array['Chicken and beer'],
 '[{"situation":"On game day","text":"Chimaek while we watch the match?"}]'),
('인싸', 'inssa', 'Inssa (인싸): The Social Insider',
 'Short for "insider", someone who fits in and is popular',
 'A person who mixes well and stands out in a group. The opposite is "assa" (outsider). Coined around 2004, it took off in 2017. Trendy items are "inssa-tem". It is Konglish: the meaning differs from English "insider".',
 'Used from around 2004, big on Korean social media from 2017',
 'Use it to praise a sociable friend or talk about trendy items.', 'Calling someone "assa" can sound like exclusion.',
 array['Insider','inssa-tem'],
 '[{"situation":"A friend is popular at every party","text":"You are such an inssa."}]'),
('손절', 'sonjeol', 'Sonjeol (손절): Cutting Someone Off',
 'Ending a relationship with someone',
 'Originally stock slang for selling at a loss to cut losses. People misread "son" as "hand", as in "cutting hands", so it came to mean cutting ties with a person. Entertainment news used it for brands dropping scandal-hit models.',
 'Stock-market slang that took on a "cut ties" meaning in the mid-to-late 2010s',
 'Use it to say you ended a bad relationship.', 'Telling others to cut off a real person can look like bullying.',
 array['Cut off','Cut ties'],
 '[{"situation":"A friend keeps breaking promises","text":"At this point, sonjeol is fine."}]'),
('할많하않', 'halmanhaan', 'Hal-man-ha-an (할많하않): Much to Say, Not Saying It',
 'Short for "I have a lot to say, but I won''t"',
 'You hold back the many things you want to say. Used when a talk is going nowhere, to show annoyance briefly, or when something is too absurd for words. Also used to avoid spoilers.',
 'Thought to have appeared online in late 2015, spread via social media comments',
 'Use it to react briefly to absurd things.', 'Can sound sarcastic in serious talks or with seniors.',
 array['No comment'],
 '[{"situation":"After a messy meeting","text":"Today''s meeting... hal-man-ha-an."}]'),
('댕댕이', 'daengdaengi', 'Daengdaengi (댕댕이): Doggo',
 'A cute word for a dog',
 'It swaps "meong" in "meongmeongi" (doggy) for the similar-looking letter "daeng". This letter-twisting game is called "yamin jeongeum". It started on forums but is now used on TV, ads and even pet café names.',
 'Late 2010s letter-twisting wordplay on Korean forums, then TV and ads',
 'Use it for any cute dog.', null,
 array['Doggo','Puppy'],
 '[{"situation":"Seeing a dog on a walk","text":"That daengdaengi is so cute."}]'),
('최애', 'choeae', 'Choeae (최애): My Bias',
 'Your favorite person, member or character',
 'An old word for "most loved" that fan culture revived in the 2010s to mean your favorite member or character, like "bias" in English-speaking K-pop fandom. Your second favorite is "chaae". Now used for any favorite thing.',
 'Anime fandom''s "choeae-kae" moved into K-pop fandom in the 2010s',
 'Use it to name your favorite member, food or song.', null,
 array['Bias','Favorite'],
 '[{"situation":"Talking about a K-pop group","text":"My choeae in this group is the youngest."}]'),
('엄근진', 'eom-geun-jin', 'Eom-geun-jin (엄근진): Strict, Stern, Serious',
 'Short for "strict, stern, serious"',
 'A playful way to call out someone being way too serious about small things. It spread from a Korean forum comic where stern characters hand out penalty stickers for trivial things. Now people also say "eom-geun-jin mode" about themselves.',
 'A 2014 forum meme completed by a 2015 web comic',
 'Use it to tease someone who got too serious, or yourself.', 'Do not use it on someone''s real worries.',
 array['Too serious'],
 '[{"situation":"A friend obsesses over game rules","text":"Why so eom-geun-jin?"}]'),
('파이팅', 'fighting', 'Hwaiting / Fighting (파이팅): You Can Do It!',
 'A Korean cheer meaning "go for it!"',
 'From English "fighting", but in Korea it means "cheer up" or "let''s do this". English speakers hear "fighting" as combat, so it confuses people who do not know Korean. It appears often in K-dramas and K-pop videos, usually with a raised fist.',
 'Konglish cheer used in Korean sports and TV',
 'Use it to cheer someone before a test, game or talk.', null,
 array['Hwaiting','Fighting'],
 '[{"situation":"A friend heads to an exam","text":"Exam today? Hwaiting!"}]'),
('애교', 'aegyo', 'Aegyo (애교): Acting Cute',
 'Showing affection with a cute voice, face or gestures',
 'Acting cute with a baby-like voice, expressions or hand gestures. K-pop idols often do it on variety shows and at fan meetings, so global fans know it as "aegyo". There is also criticism of expecting it, especially from young women.',
 'An old Korean word made global through 2010s K-pop variety shows',
 'Use it playfully among close friends or when talking about idols.', 'Asking someone to "do aegyo" can be rude, especially based on gender.',
 array['Acting cute'],
 '[{"situation":"Watching an idol show","text":"That member''s aegyo looks so natural."}]'),
('눈치', 'nunchi', 'Nunchi (눈치): Reading the Room',
 'The sense of reading moods without being told',
 'The ability to quickly sense other people''s feelings and the mood of a room. It matters a lot in Korean relationships, as in "fast nunchi" or "get some nunchi". English has no exact word, so it is often compared to emotional intelligence.',
 'An old Korean word, introduced abroad as a cultural concept from the 2010s',
 'Use it to praise someone who reads the room well.', 'Saying someone "has no nunchi" can be a put-down.',
 array['Reading the room'],
 '[{"situation":"Leaving two friends alone","text":"Using my nunchi, I will head out first."}]')
) as t(slug, lslug, title, summary, description, origin, usage_note, caution, aliases, usage_examples)
join memes m on m.slug = t.slug
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, usage_note = excluded.usage_note,
  caution = excluded.caution, aliases = excluded.aliases, usage_examples = excluded.usage_examples,
  status = 'reviewed', source_updated_at = excluded.source_updated_at,
  reviewed_at = excluded.reviewed_at, reviewed_by = excluded.reviewed_by;

-- ── 4. 출신 국가 = 한국 ─────────────────────────────────────────
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select m.id, 'KR', 'ko-KR', 'origin', m.title, 'reviewed', now(), '00000000-0000-0000-0000-00000000e0e0'
from memes m
where m.slug in ('먹방','치맥','인싸','손절','할많하않','댕댕이','최애','엄근진','파이팅','애교','눈치')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
