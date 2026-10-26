-- 2026-10-27 K-밈 입문 묶음 4 (로컬 우선 적용)
-- 주제: 한국 대화에서 매일 듣는 말 (외국인·뒤처진 사용자 공통)
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter-4.sql
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
  '대박', '대박', array['대박 사건','대박이다','Daebak','daebak'],
  '아주 크게 잘됐거나 놀라울 때 쓰는 말',
  '무언가 크게 성공했거나 깜짝 놀랄 만큼 좋을 때 쓰는 말이다. "대박 났다", "대박 사건"처럼 쓰고, 그보다 조금 작으면 ''중박'', 크게 망하면 ''쪽박''이라고 한다. 도박에서 판돈보다 큰돈을 땄을 때 쓰던 말에서 왔다는 설이 유력하다. 영화가 크게 흥행했을 때 영화계에서 쓰던 말이 언론을 통해 퍼졌고, K-드라마와 예능 덕분에 외국 팬들도 ''daebak''으로 많이 안다.',
  '오래전부터 쓰이던 말로, 영화계와 언론을 거쳐 일상어가 되었고 K-드라마로 해외에도 알려짐',
  '좋은 소식이나 놀라운 일에 감탄할 때 쓴다. 어디서나 편하게 쓸 수 있다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 합격 소식을 전할 때","text":"대박! 진짜 축하해"},{"situation":"맛집에서","text":"여기 떡볶이 대박이다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', null, null, 'unknown', null, 46.0
),
(
  '헐', '헐', array['헐 대박','헐랭','헐?','Heol'],
  '놀라거나 어이없을 때 내는 짧은 감탄사',
  '믿기 어려운 말을 듣거나 어이없는 일을 봤을 때 "헐"이라고 한다. ''헉''보다 여운이 길어서 더 많이 쓰이게 됐다. 너무 흔해서 지금은 거의 모든 세대가 쓴다. 어디서 왔는지는 확실하지 않은데, 옛 무협 소설에서 놀랄 때 쓰던 말이라는 설이 그나마 유력하다. "헐 대박"처럼 다른 감탄사와 함께 쓰기도 한다.',
  '1990년대 이전부터 쓰였다는 기록이 있으나 유래는 확실하지 않으며, 2000년대 인터넷에서 크게 퍼짐',
  '놀라운 소식에 반응할 때 짧게 쓴다. 친구 사이 대화나 댓글에 잘 어울린다.',
  '윗사람의 말에 "헐"이라고 하면 무례하게 들릴 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"놀라운 소식을 듣고","text":"헐, 진짜? 언제 그랬어?"},{"situation":"어이없는 일을 보고","text":"헐… 이건 좀 아니다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', null, 2000, 'unknown', 'early_web', 36.0
),
(
  '아재개그', '아재개그', array['아재 개그','썰렁 개그','아저씨 개그','Ajae gag','Dad joke'],
  '썰렁하지만 피식 웃게 되는 말장난 농담',
  '''아재(아저씨)''들이 할 법한, 재미없지만 묘하게 웃긴 말장난 농담을 말한다. 예를 들어 "아재개그가 왜 아재개그냐면, ''아 쟤 개그 또 하네''라서"처럼 말장난을 한다. 1990년대에 유행한 ''썰렁 개그''를 이어받은 것으로 볼 수 있다. 지금은 나이와 상관없이 썰렁한 말장난이면 다 아재개그라고 부른다.',
  '1990년대 ''썰렁 개그''를 이어받아, 2010년대 중반 예능과 인터넷에서 ''아재개그''라는 이름으로 유행',
  '썰렁한 말장난을 하거나, 그런 농담을 한 사람을 장난스럽게 놀릴 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"팀장님 농담을 듣고","text":"팀장님 오늘도 아재개그 장전하셨네요"},{"situation":"내가 말장난을 하고","text":"방금 건 인정, 아재개그였다"}]',
  'green', 'active', 'comment', 'text', 'beginner', 'funny', 1990, 2015, 'decade', 'pre_internet', 35.0
),
(
  '짤', '짤', array['짤방','움짤','짤림 방지','Jjal','Jjalbang'],
  '인터넷에서 돌아다니는 웃긴 이미지, 짤방의 줄임말',
  '''짤림 방지용 사진''을 줄인 ''짤방''에서 더 줄어든 말이다. 원래 사진을 꼭 올려야 하는 커뮤니티(디시인사이드)에서 글이 지워지지 않게 붙이던 사진을 가리켰다. 지금은 웃긴 이미지나 밈 이미지를 모두 ''짤''이라고 부르고, 움직이는 이미지는 ''움짤''이라고 한다. 한국 인터넷에서 밈 이미지를 부르는 가장 기본 단어다.',
  '2000년대 디시인사이드에서 글 삭제를 막으려 붙이던 ''짤림 방지용 사진''에서 시작해 인터넷 전체로 확산',
  '웃긴 이미지를 주고받거나 찾을 때 쓴다. 메신저와 SNS 어디서나 쓰인다.',
  '남의 사진을 허락 없이 짤로 만들어 퍼뜨리면 초상권 침해가 될 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"단톡방에서","text":"이 상황에 딱 맞는 짤 있다"},{"situation":"친구에게 부탁할 때","text":"그 고양이 움짤 다시 보내 줘"}]',
  'green', 'active', 'image', 'image', 'beginner', 'funny', 2002, 2005, 'approximate', 'early_web', 40.0
),
(
  '혼밥', '혼밥', array['혼자 밥','혼술','혼영','Honbap'],
  '혼자 밥을 먹는 것',
  '''혼자 밥 먹기''의 줄임말이다. 다른 사람에게 맞추지 않고 원하는 음식을 원하는 속도로 먹고 싶어서 혼자 먹는 사람이 늘면서 널리 쓰이게 됐다. 혼자 술을 마시면 ''혼술'', 혼자 영화를 보면 ''혼영''처럼 ''혼○''이라는 말이 많이 생겼다. 1인 손님을 위한 식당 자리도 생길 만큼 하나의 생활 방식이 됐다.',
  '2010년대 중반 1인 가구가 늘면서 퍼졌고, ''혼술'', ''혼영'' 같은 ''혼○'' 줄임말로 이어짐',
  '혼자 식사한다고 말하거나, 혼자 가기 좋은 식당을 이야기할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"점심시간","text":"오늘은 혼밥하면서 좀 쉴래"},{"situation":"식당 추천","text":"거기 혼밥하기 좋은 자리 많아"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2015, 2016, 'approximate', 'social_media', 37.0
),
(
  '불금', '불금', array['불타는 금요일','불금이다','TGIF','Bulgeum'],
  '''불타는 금요일''의 줄임말, 신나게 노는 금요일 밤',
  '한 주의 마지막 일하는 날인 금요일 밤에 늦게까지 신나게 놀자는 말이다. 2004년 주 5일 근무가 시작되면서 금요일 밤이 주말의 시작이 되자 널리 퍼졌고, 2011년 무렵부터 언론에서도 흔히 쓰게 됐다. 영어의 ''TGIF''와 비슷하다. 반대로 월요일에 일하기 싫은 기분은 ''월요병''이라고 한다.',
  '2004년 주 5일 근무제 도입 뒤 퍼졌고 2011년 무렵부터 언론에서도 쓰이며 자리 잡음',
  '금요일 저녁 약속을 잡거나, 주말을 앞둔 기분을 말할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"금요일 퇴근 전","text":"오늘 불금인데 뭐 하지?"},{"situation":"친구에게","text":"불금이니까 맛있는 거 먹으러 가자"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2004, 2011, 'approximate', 'early_web', 36.0
),
(
  '썸', '썸', array['썸 타다','썸남','썸녀','Something','Sseom'],
  '사귀지는 않지만 서로 좋아하는 듯한 애매한 관계',
  '영어 ''something''을 줄인 말로, 흔히 ''친구 이상, 연인 미만''이라고 설명한다. 서로 호감이 있어 보이지만 아직 사귀자는 말을 하지 않은 상태다. 이런 관계를 ''썸 탄다''라고 하고, 상대를 ''썸남'', ''썸녀''라고 부른다. 대학 교수가 논문에서 "썸을 탄다"의 조건을 분석했을 만큼 널리 쓰이는 말이 됐다.',
  '영어 ''something''을 줄인 말로, 2010년대 초중반 젊은 층의 연애 대화에서 퍼져 일상어가 됨',
  '연애 이야기를 할 때, 애매한 관계를 설명할 때 쓴다.',
  '남의 관계를 함부로 "썸"이라고 소문내면 곤란해질 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"친구의 연애 이야기","text":"너 요즘 그 사람이랑 썸 타지?"},{"situation":"고민 상담","text":"썸인지 그냥 친절한 건지 모르겠어"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2012, 2014, 'approximate', 'social_media', 41.0
),
(
  '꼰대', '꼰대', array['꼰대짓','젊은 꼰대','Kkondae','kkondae'],
  '자기 생각만 옳다며 가르치려 드는 사람을 낮춰 부르는 말',
  '원래 학생들이 아버지나 선생님 같은 어른을 낮춰 부르던 은어다. 지금은 나이와 상관없이 권위적이고 자기 경험만 옳다며 남을 가르치려 드는 사람을 가리킨다. 그런 행동은 ''꼰대짓'', 젊은데도 그런 사람은 ''젊은 꼰대''라고 한다. 영국 BBC가 2019년 소셜미디어에서 ''오늘의 단어''로 소개하고 기사로도 다뤘을 만큼 한국 직장 문화를 보여 주는 말로 해외에도 알려졌다.',
  '학생들이 어른을 부르던 오래된 은어가 2010년대 권위적인 사람 전체를 가리키는 말로 넓어짐',
  '권위적인 행동을 비판하거나, 내가 그러지 않았는지 스스로 돌아볼 때 쓴다.',
  '사람을 낮춰 부르는 말이라, 당사자 앞이나 직장에서 쓰면 다툼이 생길 수 있다.',
  '{"sns":"yellow","work":"red","family":"yellow","friends":"green"}',
  '[{"situation":"스스로 돌아볼 때","text":"방금 내가 한 말, 좀 꼰대 같았나?"},{"situation":"친구와 회사 이야기","text":"그 선배 또 라떼 이야기 했어? 완전 꼰대네"}]',
  'yellow', 'active', 'phrase', 'text', 'beginner', 'negative', null, 2016, 'unknown', 'social_media', 39.0
),
(
  '현타', '현타', array['현실 자각 타임','현타 온다','현타 왔다','Hyeonta'],
  '''현실 자각 타임''의 줄임말, 갑자기 현실을 깨닫는 순간',
  '꿈이나 기대에 빠져 있다가 내가 처한 진짜 상황을 갑자기 깨닫는 순간을 말한다. 열심히 하던 일이 갑자기 허무하게 느껴지거나, 내가 한 행동이 부끄러워질 때도 쓴다. 예를 들어 밤새 게임을 하다 아침 해를 보고 "현타 온다"라고 한다. 웃음 섞인 자기 고백으로 많이 쓰인다.',
  '2010년대 인터넷 커뮤니티에서 ''현실 자각 타임''을 줄여 쓰기 시작해 일상어로 퍼짐',
  '갑자기 허무해지거나 현실을 깨달은 순간을 웃으며 말할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"밤새 놀고 아침에","text":"해 뜨는 거 보니까 현타 온다"},{"situation":"통장 잔액을 보고","text":"쇼핑하고 잔액 보니 현타 왔어"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'ironic', 2014, 2016, 'approximate', 'social_media', 38.0
),
(
  '멍때리기', '멍때리기', array['멍때리다','불멍','물멍','멍때리기 대회','Space out','Bulmeong'],
  '아무 생각 없이 멍하니 있는 것',
  '넋을 놓고 멍하니 한곳을 바라보며 쉬는 것을 말한다. 영어로는 ''space out''에 가깝다. 2014년부터 한국에서는 누가 가장 오래 멍하니 있는지 겨루는 ''멍때리기 대회''가 열리고 있고, 연예인이 참가해 우승하기도 했다. 2020년 무렵부터 캠핑 불을 보며 멍때리는 ''불멍'', 물을 보는 ''물멍'' 같은 말도 유행했다.',
  '2014년 시작된 ''멍때리기 대회''로 널리 알려졌고, 2020년 무렵 ''불멍''·''물멍''으로 이어짐',
  '잠깐 쉬고 싶을 때, 또는 캠핑이나 바다에서 편히 쉬는 모습을 말할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"캠핑장에서","text":"오늘 밤은 불멍하면서 쉬자"},{"situation":"수업 중 딴생각할 때","text":"미안, 잠깐 멍때렸어"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2014, 2014, 'year', 'social_media', 37.0
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
('대박', 'https://namu.wiki/w/%EB%8C%80%EB%B0%95', '대박', '나무위키'),
('헐', 'https://namu.wiki/w/%ED%97%90', '헐', '나무위키'),
('아재개그', 'https://namu.wiki/w/%EC%95%84%EC%9E%AC%EA%B0%9C%EA%B7%B8', '아재개그', '나무위키'),
('짤', 'https://namu.wiki/w/%EC%A7%A4%EB%B0%A9', '짤방', '나무위키'),
('혼밥', 'https://namu.wiki/w/%ED%98%BC%EB%B0%A5', '혼밥', '나무위키'),
('불금', 'https://namu.wiki/w/%EB%B6%88%ED%83%80%EB%8A%94%20%EA%B8%88%EC%9A%94%EC%9D%BC', '불타는 금요일', '나무위키'),
('썸', 'https://namu.wiki/w/%EC%8D%B8', '썸', '나무위키'),
('꼰대', 'https://namu.wiki/w/%EA%BC%B0%EB%8C%80', '꼰대', '나무위키'),
('꼰대', 'https://en.wikipedia.org/wiki/Kkondae', 'Kkondae', 'Wikipedia'),
('꼰대', 'https://www.bbc.com/worklife/article/20190726-the-condescending-old-people-of-south-koreas-workforce', 'The ''condescending old people'' of South Korea''s workforce', 'BBC Worklife'),
('현타', 'https://namu.wiki/w/%ED%98%84%ED%83%80', '현타', '나무위키'),
('멍때리기', 'https://namu.wiki/w/%EB%A9%8D%EB%95%8C%EB%A6%AC%EA%B8%B0', '멍때리기', '나무위키')
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
('대박', 'daebak', 'Daebak (대박): Awesome! / No Way!',
 'Said when something is a huge hit or amazing',
 'Used when something is a big success or surprisingly great: "daebak nasseo" (it was a hit). A smaller win is "jungbak", a flop is "jjokbak". It likely comes from gambling slang for winning big. The film industry and the press spread it, and K-dramas made it known to fans worldwide.',
 'An old word spread by the film industry and media, known abroad through K-dramas',
 'Use it to react to great news or something amazing.', null,
 array['Awesome','Jackpot'],
 '[{"situation":"A friend got accepted","text":"Daebak! Congrats!"}]'),
('헐', 'heol', 'Heol (헐): OMG / Whoa',
 'A short gasp of surprise or disbelief',
 'Koreans say "heol" when they hear something hard to believe or see something absurd. It lingers longer than "heok" (gasp), so it became more popular. Almost every generation uses it now. Its origin is unclear; one likely theory points to old martial-arts novels.',
 'Recorded before the 1990s with an unclear origin, widespread online in the 2000s',
 'Use it to react to surprising news among friends.', 'Saying "heol" to a senior can sound rude.',
 array['OMG','Whoa'],
 '[{"situation":"Hearing surprising news","text":"Heol, really? When?"}]'),
('아재개그', 'ajae-gag', 'Ajae Gag (아재개그): Dad Jokes',
 'Corny puns that make you groan and smile',
 'Jokes an "ajae" (middle-aged man) might tell: unfunny puns that still get a little laugh, much like English "dad jokes". It continues the "sseolleong" (chilly) jokes of the 1990s. Now any corny pun counts, whatever the speaker''s age.',
 'Follows 1990s "chilly jokes", named ajae gag on TV and online in the mid-2010s',
 'Use it when you make or hear a corny pun.', null,
 array['Dad joke','Corny joke'],
 '[{"situation":"After your own pun","text":"Okay, that was an ajae gag."}]'),
('짤', 'jjal', 'Jjal (짤): Meme Image',
 'Short for "jjalbang", any funny or meme image online',
 'From "jjalbang", short for "a photo to prevent deletion". On DC Inside, posts needed a photo or they were deleted, so people attached random pictures. Now "jjal" means any funny or meme image, and a GIF is "umjjal" (moving jjal).',
 'Started on DC Inside in the 2000s, now used across the Korean internet',
 'Use it when sharing or looking for meme images.', 'Turning someone''s photo into a meme without consent can violate portrait rights.',
 array['Meme image','umjjal'],
 '[{"situation":"In a group chat","text":"I have the perfect jjal for this."}]'),
('혼밥', 'honbap', 'Honbap (혼밥): Eating Alone',
 'Eating a meal by yourself',
 'Short for "honja bap" (eating alone). More people eat alone to choose their own food and pace, so the word spread. It started a pattern: "honsul" (drinking alone), "honyeong" (movies alone). Many restaurants now have seats for solo diners.',
 'Spread in the mid-2010s as single-person households grew',
 'Use it to say you are eating alone or to find solo-friendly places.', null,
 array['Solo dining','honsul'],
 '[{"situation":"At lunchtime","text":"I will do honbap today and rest a bit."}]'),
('불금', 'bulgeum', 'Bulgeum (불금): Fire Friday',
 'Short for "burning Friday", a fun Friday night out',
 'Friday night is for going out late and having fun. It spread after Korea adopted the five-day work week in 2004 and was common in the media by 2011. It is like English "TGIF". The opposite feeling is "wolyobyeong" (Monday blues).',
 'Spread after the 2004 five-day work week, common in media from 2011',
 'Use it to make Friday plans.', null,
 array['TGIF','Burning Friday'],
 '[{"situation":"Before leaving work on Friday","text":"It is bulgeum, what should we do?"}]'),
('썸', 'sseom', 'Sseom (썸): Something Going On',
 'A "more than friends, not yet dating" relationship',
 'From English "something". Two people seem to like each other but have not said they are dating. You "ride sseom" with someone, who is your "sseom-nam" (guy) or "sseom-nyeo" (girl). A Korean philosophy professor even wrote a paper on its conditions.',
 'From English "something", common in young people''s dating talk in the early-to-mid 2010s',
 'Use it when talking about crushes and unclear relationships.', 'Spreading rumors about someone''s sseom can cause trouble.',
 array['Situationship','Something'],
 '[{"situation":"Asking a friend","text":"Are you having a sseom with that person?"}]'),
('꼰대', 'kkondae', 'Kkondae (꼰대): Condescending Know-It-All',
 'A put-down for someone who lectures others',
 'Once students'' slang for fathers and teachers. Now it means anyone, of any age, who is authoritarian and insists their experience is the only right way. The behavior is "kkondae-jil", and young ones are "young kkondae". In 2019 the BBC featured it as a word of the day and in an article.',
 'Old student slang widened in the 2010s to mean any bossy person',
 'Use it to criticize bossy behavior or check yourself.', 'It is a put-down; using it at work can start fights.',
 array['Boomer','Know-it-all'],
 '[{"situation":"Checking yourself","text":"Did I just sound like a kkondae?"}]'),
('현타', 'hyeonta', 'Hyeon-ta (현타): Reality Check Moment',
 'Short for "reality-awareness time"',
 'The moment you suddenly see your real situation after being lost in a dream or hype. It also means feeling empty about something you were into, or embarrassed about what you did, like seeing sunrise after gaming all night.',
 'Shortened from "reality-awareness time" on Korean forums in the 2010s',
 'Use it to joke about a sudden reality check.', null,
 array['Reality check'],
 '[{"situation":"Checking your bank balance after shopping","text":"Saw my balance. Hyeon-ta hit."}]'),
('멍때리기', 'meongttaerigi', 'Meongttaerigi (멍때리기): Spacing Out',
 'Zoning out and thinking about nothing',
 'Resting while staring blankly, like "spacing out". Since 2014, Korea has held a "Space-Out Competition" to see who can zone out longest. Around 2020, "bulmeong" (staring at a campfire) and "mulmeong" (at water) became popular.',
 'Known through the space-out competition held since 2014, then bulmeong around 2020',
 'Use it when you want a break or describe relaxing by fire or water.', null,
 array['Space out','bulmeong'],
 '[{"situation":"At a campsite","text":"Tonight we do bulmeong and relax."}]')
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
where m.slug in ('대박','헐','아재개그','짤','혼밥','불금','썸','꼰대','현타','멍때리기')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
