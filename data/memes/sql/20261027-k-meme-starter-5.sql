-- 2026-10-27 K-밈 입문 묶음 5 (로컬 우선 적용)
-- 주제: 팬 문화·방송·인터넷에서 나온 말
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter-5.sql
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
  '덕질', '덕질', array['덕후','덕밍아웃','입덕','탈덕','Deokjil'],
  '좋아하는 것에 깊이 빠져 파고드는 활동',
  '일본어 ''오타쿠''가 ''오덕후'', ''덕후'', ''덕''으로 줄어든 말에 행동을 뜻하는 ''질''을 붙인 말이다. 아이돌, 애니메이션, 게임처럼 좋아하는 대상을 열심히 찾아보고 모으고 응원하는 것을 말한다. 2010년대부터는 우표, 카드, 레코드판 수집까지 덕질이라고 부른다. 팬이 되면 ''입덕'', 그만두면 ''탈덕''이라고 한다.',
  '일본어 ''오타쿠''에서 온 ''덕후''에 ''질''이 붙어 2000년대 팬 문화에서 쓰이기 시작했고 2010년대 일상어로 확산',
  '좋아하는 아이돌이나 취미를 이야기할 때 쓴다. 스스로 "덕질 중"이라고 소개하기도 한다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"요즘 근황을 물을 때","text":"요즘 그 그룹 덕질하느라 바빠"},{"situation":"새 취미가 생겼을 때","text":"나 이번에 캠핑 입덕했어"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2005, 2012, 'approximate', 'early_web', 44.0
),
(
  '직관', '직관', array['직접 관람','집관','직관러','Jikgwan'],
  '경기나 공연을 현장에 가서 직접 보는 것',
  '''직접 관람''의 줄임말로, 야구나 축구 경기, 콘서트를 경기장이나 공연장에 직접 가서 보는 것을 말한다. 반대로 집에서 TV나 휴대폰으로 보는 것은 ''집관''이라고 한다. 한국 프로야구 응원 문화가 유명해지면서 외국인 관광객도 ''직관''을 하러 야구장에 많이 간다. 경기장에서 다 같이 응원가를 부르는 재미 때문에 집관보다 직관을 더 좋아하는 팬이 많다.',
  '스포츠와 공연 팬 사이에서 ''직접 관람''을 줄여 쓰며 퍼진 말로, 정확한 유래는 알려져 있지 않음',
  '경기나 공연을 보러 간다고 말할 때 쓴다. 야구, 축구, 콘서트 이야기에 잘 어울린다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"주말 계획","text":"토요일에 야구 직관 갈래?"},{"situation":"표를 못 구했을 때","text":"이번엔 집관으로 만족해야겠다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', null, 2015, 'unknown', 'social_media', 39.0
),
(
  '깜놀', '깜놀', array['깜짝 놀라다','깜놀했다','Kkamnol'],
  '''깜짝 놀라다''의 줄임말',
  '갑자기 놀랐을 때 짧게 쓰는 말이다. "깜놀했잖아"처럼 쓰고, 공포 영화에서 갑자기 무언가 튀어나오는 장면도 ''깜놀 장면''이라고 한다. 그룹 S의 신혜성, 이지훈, 강타가 만든 유행어로 알려져 있으며, 같은 멤버들이 만든 말로 ''갑툭튀(갑자기 툭 튀어나옴)''도 있다. 지금은 세대를 가리지 않고 흔히 쓴다.',
  '그룹 S의 신혜성·이지훈·강타가 만든 유행어로 알려졌고 2000년대 후반 방송과 인터넷으로 퍼짐',
  '갑자기 놀란 일을 가볍게 이야기할 때 쓴다. 친구 사이 대화나 메신저에 잘 어울린다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 뒤에서 불렀을 때","text":"아 깜놀했잖아!"},{"situation":"택배가 빨리 왔을 때","text":"벌써 왔어? 깜놀이다"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', null, 2008, 'approximate', 'early_web', 33.0
),
(
  '빵꾸똥꾸', '빵꾸똥꾸', array['야 이 빵꾸똥꾸야','빵꾸똥꾸야','Ppangkkuttongkku'],
  '시트콤 ''지붕뚫고 하이킥''의 정해리가 외친 유행어',
  '2009년부터 2010년까지 방송된 MBC 시트콤 ''지붕뚫고 하이킥''에서 정해리(배우 진지희)가 마음에 안 드는 사람에게 "야! 이 빵꾸똥꾸야!"라고 외친 말이다. 극 중에서 해리가 어릴 때 가족의 말다툼을 듣고 처음 배운 말이라는 사연이 나온다. 귀엽지만 버릇없는 아이를 떠올리게 하는 말로, 지금도 그 시절을 기억하는 사람들이 장난처럼 쓴다.',
  '2009~2010년 방송된 MBC 시트콤 ''지붕뚫고 하이킥''의 정해리 대사에서 시작',
  '친한 사이에서 장난스럽게 투정 부릴 때 쓴다. 옛날 시트콤 이야기를 할 때도 쓴다.',
  '아이 말투의 놀림이라 진지한 자리에서 남에게 쓰면 무례할 수 있다.',
  '{"sns":"green","work":"gray","family":"green","friends":"green"}',
  '[{"situation":"동생이 내 간식을 먹었을 때","text":"야 이 빵꾸똥꾸야, 내 과자 어디 갔어!"},{"situation":"추억 이야기","text":"빵꾸똥꾸 해리 기억나? 그때 하이킥 진짜 재밌었는데"}]',
  'green', 'archived', 'phrase', 'video', 'beginner', 'funny', 2009, 2009, 'year', 'social_media', 30.0
),
(
  '너나 잘하세요', '너나-잘하세요', array['너나 잘해','너나잘하세요','Mind your own business'],
  '영화 ''친절한 금자씨''의 명대사, 참견하지 말라는 뜻',
  '2005년 박찬욱 감독의 영화 ''친절한 금자씨''에서 이영애가 연기한 금자가 차갑게 내뱉은 대사다. 남이 나에게 훈계하거나 참견할 때 "너나 잘하세요"라고 맞받아치는 말로 유행했다. 높임말 ''-세요''를 쓰면서도 내용은 날카로워서 더 웃기게 들린다. 지금도 남의 일에 지나치게 간섭하는 사람에게 장난처럼 쓴다.',
  '2005년 개봉한 박찬욱 감독의 영화 ''친절한 금자씨''에서 주인공 금자의 대사로 유행',
  '친구가 장난으로 잔소리할 때 웃으며 받아칠 때 쓴다.',
  '진짜로 조언하는 사람에게 쓰면 무례하게 들린다. 윗사람에게는 쓰지 말자.',
  '{"sns":"green","work":"red","family":"yellow","friends":"green"}',
  '[{"situation":"친구가 내 식단을 지적할 때","text":"야, 너나 잘하세요~"},{"situation":"영화 이야기","text":"금자씨가 너나 잘하세요 하던 장면 명장면이지"}]',
  'yellow', 'archived', 'phrase', 'video', 'beginner', 'ironic', 2005, 2005, 'year', 'early_web', 31.0
),
(
  '레게노', '레게노', array['LEGENO','ㄹㄱㄴ','레전드','Legeno'],
  '''레전드(LEGEND)''를 일부러 잘못 읽은 말장난',
  '''LEGEND''의 마지막 D를 O로 바꿔 ''LEGENO(레게노)''라고 부르는 말이다. 인터넷 방송인 우왁굳의 방송에서 그의 아내가 건물에 적힌 ''레전드''를 ''레제노''로 잘못 읽은 일에서 시작됐다고 알려져 있다. 그 뒤 유튜브 댓글에서 ''LEGENO''가 크게 유행했고, 비슷한 철자의 단어를 일부러 바꿔 쓰는 놀이로 이어졌다. 2020년에는 이 이름을 딴 치킨 메뉴까지 나왔지만, 그해 중반부터 유행이 식었다.',
  '인터넷 방송인 우왁굳의 마인크래프트 방송 중 ''레전드''를 잘못 읽은 일에서 시작해 유튜브 댓글로 확산',
  '아주 웃기거나 대단한 장면을 보고 감탄할 때 쓴다. 댓글에서 많이 쓴다.',
  null,
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"웃긴 영상 댓글","text":"이 장면 진짜 레게노다"},{"situation":"친구의 활약을 보고","text":"오늘 경기 너 완전 레게노였어"}]',
  'green', 'archived', 'comment', 'text', 'normal', 'funny', 2019, 2020, 'approximate', 'shortform', 36.0
),
(
  '띵곡', '띵곡', array['명곡','띵작','띵언','Ttinggok'],
  '''명곡''을 글자 모양으로 비튼 말, 아주 좋은 노래',
  '''명''을 모양이 비슷한 ''띵''으로 바꿔 쓴 말로, 아주 좋은 노래를 뜻한다. 이렇게 글자 모양을 비트는 놀이를 ''야민정음''이라고 하는데, ''댕댕이''와 같은 방식이다. 같은 방식으로 좋은 작품은 ''띵작'', 좋은 말은 ''띵언''이라고 부른다. 음악 플랫폼 댓글이나 플레이리스트 제목에 자주 보인다.',
  '2010년대 후반 인터넷 커뮤니티의 글자 비틀기 놀이(야민정음)에서 ''명곡''을 바꿔 쓰며 퍼짐',
  '좋은 노래를 추천하거나 감탄할 때 쓴다. 플레이리스트나 댓글에 잘 어울린다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"노래를 추천할 때","text":"이 노래 들어 봐, 완전 띵곡이야"},{"situation":"드라마를 다 보고","text":"이 드라마 띵작이다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2017, 2018, 'approximate', 'social_media', 37.0
),
(
  '막내', '막내', array['황금막내','막내 온 탑','Maknae','maknae'],
  '집이나 그룹에서 가장 어린 사람',
  '가족에서 가장 어린 자식, 또는 어떤 무리에서 나이가 가장 어린 사람을 뜻하는 순우리말이다. K-팝 그룹에서도 가장 어린 멤버를 막내라고 부르기 때문에 외국 팬들에게 ''maknae''로 널리 알려졌다. 노래, 춤, 운동을 다 잘하는 막내는 ''황금막내''라고 부른다. 막내는 몇 살이 되어도 가족에게 아기 취급을 받는다는 농담도 많다.',
  '오래된 순우리말로, 2010년대 K-팝 팬 문화를 통해 ''maknae''라는 말이 세계에 알려짐',
  '그룹이나 가족에서 가장 어린 사람을 부를 때 쓴다. 아이돌 이야기에 자주 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"아이돌 이야기","text":"그 그룹 막내가 춤 제일 잘 춰"},{"situation":"회사에서","text":"우리 팀 막내 들어왔어요"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', null, 2012, 'unknown', 'social_media', 38.0
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
('덕질', 'https://namu.wiki/w/%EB%8D%95%EC%A7%88', '덕질', '나무위키'),
('직관', 'https://namu.wiki/w/%EC%A7%81%EA%B4%80', '직관 (현장 관람)', '나무위키'),
('깜놀', 'https://namu.wiki/w/%EA%B9%9C%EB%86%80', '깜놀', '나무위키'),
('빵꾸똥꾸', 'https://namu.wiki/w/%EB%B9%B5%EA%BE%B8%EB%98%A5%EA%BE%B8', '빵꾸똥꾸', '나무위키'),
('너나-잘하세요', 'https://namu.wiki/w/%EC%B9%9C%EC%A0%88%ED%95%9C%20%EA%B8%88%EC%9E%90%EC%94%A8', '친절한 금자씨', '나무위키'),
('레게노', 'https://namu.wiki/w/LEGENO', 'LEGENO (레게노)', '나무위키'),
('띵곡', 'https://namu.wiki/w/%EB%AA%85%EA%B3%A1', '명곡 (띵곡)', '나무위키'),
('막내', 'https://namu.wiki/w/%EB%A7%89%EB%82%B4', '막내', '나무위키')
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
('덕질', 'deokjil', 'Deokjil (덕질): Fangirling / Fanboying',
 'Diving deep into something you love',
 'From "deokhu" (a Korean take on Japanese "otaku") plus "-jil" (doing). It means following, collecting and supporting what you love, like idols, anime or games. Becoming a fan is "ipdeok", quitting is "taldeok".',
 'From otaku-derived "deokhu" in 2000s fan culture, everyday slang by the 2010s',
 'Use it to talk about your fandom or hobby.', null,
 array['Fangirling','Stanning'],
 '[{"situation":"Catching up","text":"I am busy with deokjil for that group lately."}]'),
('직관', 'jikgwan', 'Jikgwan (직관): Watching It Live',
 'Going to see a game or show in person',
 'Short for "watching directly": going to the stadium or concert hall. Watching at home is "jipgwan". As Korean baseball cheering got famous, many tourists go for jikgwan.',
 'Shortened by sports and concert fans; exact origin unknown',
 'Use it when you go to a game or concert.', null,
 array['Watching live','jipgwan'],
 '[{"situation":"Weekend plans","text":"Want to do baseball jikgwan on Saturday?"}]'),
('깜놀', 'kkamnol', 'Kkamnol (깜놀): Startled',
 'Short for "kkamjjak nollada" (to be startled)',
 'A quick way to say you got startled: "kkamnol haetjana!" (you scared me!). A jump scare in a horror film is a "kkamnol scene". It is said to have been coined by members of the group S (Shin Hye-sung, Lee Ji-hoon, Kangta), who also made "gaptuktwi" (popping out of nowhere).',
 'Said to be coined by members of the group S, spread in the late 2000s',
 'Use it when something surprises you.', null,
 array['Startled','Jump scare'],
 '[{"situation":"A friend calls from behind","text":"Ah, kkamnol!"}]'),
('빵꾸똥꾸', 'ppangkku-ttongkku', 'Ppangkku Ttongkku (빵꾸똥꾸): The Sitcom Insult',
 'A childish insult from the sitcom "High Kick Through the Roof"',
 'In the 2009-2010 MBC sitcom "High Kick Through the Roof", the bratty girl Jung Hae-ri (actor Jin Ji-hee) yells "Ya! Ppangkku ttongkku!" (roughly "you fart-butt!") at people she dislikes. People who grew up with the show still use it jokingly.',
 'From the 2009-2010 MBC sitcom "High Kick Through the Roof"',
 'Use it playfully with close friends or siblings.', 'It is a childish insult, so avoid it in serious settings.',
 array['High Kick'],
 '[{"situation":"Your sibling ate your snack","text":"Ya, ppangkku ttongkku! Where is my snack?"}]'),
('너나-잘하세요', 'mind-your-own-business', 'Neona Jalhaseyo (너나 잘하세요): Mind Your Own Business',
 'A famous line from "Lady Vengeance": worry about yourself',
 'A cold line said by Geum-ja (Lee Young-ae) in Park Chan-wook''s 2005 film "Sympathy for Lady Vengeance". It caught on as a comeback when someone lectures you. It uses polite "-seyo" while being sharp, which makes it funnier.',
 'From Park Chan-wook''s 2005 film "Sympathy for Lady Vengeance"',
 'Use it as a playful comeback to a friend''s nagging.', 'It sounds rude to someone giving real advice or to seniors.',
 array['Mind your own business','Lady Vengeance'],
 '[{"situation":"A friend judges your diet","text":"Neona jalhaseyo~"}]'),
('레게노', 'legeno', 'Legeno (레게노): Legendary, Misspelled',
 'A playful misreading of "LEGEND"',
 'Swapping the final D in "LEGEND" for O gives "LEGENO". It reportedly began when streamer Woowakgood''s wife misread "legend" on a Minecraft build during his stream. It exploded in YouTube comments around 2020, even inspiring a fried chicken menu, before fading by mid-2020.',
 'From a misreading on streamer Woowakgood''s Minecraft stream, spread via YouTube comments',
 'Use it in comments for amazing or hilarious moments.', null,
 array['Legend','LEGENO'],
 '[{"situation":"Commenting on a funny clip","text":"This scene is legeno."}]'),
('띵곡', 'ttinggok', 'Ttinggok (띵곡): A Banger',
 'A twisted spelling of "myeonggok" (masterpiece song)',
 'The letter "myeong" (명) is swapped for the look-alike "tting" (띵), meaning a great song. This letter-twisting game is "yamin jeongeum", like "daengdaengi". Great works are "ttingjak", great quotes "ttingeon". Common in music comments and playlist titles.',
 'Late 2010s letter-twisting wordplay on Korean forums',
 'Use it to recommend or praise a song.', null,
 array['Banger','ttingjak'],
 '[{"situation":"Recommending a song","text":"Listen to this, total ttinggok."}]'),
('막내', 'maknae', 'Maknae (막내): The Youngest',
 'The youngest person in a family or group',
 'A native Korean word for the youngest child, or the youngest member of any group. K-pop groups call their youngest member the maknae, so global fans know it well. A maknae who is great at everything is the "golden maknae". Jokes say the maknae is treated like a baby forever.',
 'An old Korean word made global through 2010s K-pop fandom',
 'Use it for the youngest member of a group or family.', null,
 array['Golden maknae','Youngest'],
 '[{"situation":"Talking about an idol group","text":"The maknae is the best dancer."}]')
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
where m.slug in ('덕질','직관','깜놀','빵꾸똥꾸','너나-잘하세요','레게노','띵곡','막내')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
