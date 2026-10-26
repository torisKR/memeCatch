-- 2026-10-27 K-밈 입문 묶음 2 (로컬 우선 적용)
-- 대상: ① 요즘 한국 밈을 놓친 한국 사용자 ② K-MEME을 찾는 외국 사용자
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter-2.sql
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
  '얼죽아', '얼죽아', array['얼어 죽어도 아이스 아메리카노','아아','아아메','Iced Americano','Eol-jug-a','Eoljuga'],
  '''얼어 죽어도 아이스 아메리카노''의 줄임말',
  '한겨울에도 꼭 차가운 아이스 아메리카노만 마시는 사람이나 그런 취향을 말한다. 한국에서는 아이스 아메리카노가 카페에서 가장 많이 팔리는 메뉴이고, 줄여서 ''아아''라고도 부른다. 스타벅스 코리아 조사에서도 손님 10명 중 6명꼴이 겨울에도 아이스 음료를 찾았다고 한다. 해외 여행 중 아이스 아메리카노를 찾아 헤매는 한국인 이야기도 이 말과 함께 자주 나온다.',
  '2010년대 후반 한국 카페 문화에서 겨울에도 아이스 아메리카노를 고집하는 사람들을 부르며 퍼진 줄임말',
  '추운 날에도 아이스 음료를 고르는 나를 소개하거나, 그런 친구를 장난스럽게 부를 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"영하의 날 카페에서","text":"나는 얼죽아라서 오늘도 아아 한 잔"},{"situation":"해외 여행 중","text":"여기 아이스 아메리카노 파는 곳 없나? 얼죽아는 힘들다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2018, 2018, 'approximate', 'social_media', 45.0
),
(
  '별다줄', '별다줄', array['별걸 다 줄인다','별 걸 다 줄이네','Byeol-da-jul','Byeoldajul'],
  '''별걸 다 줄인다''의 줄임말',
  '아무 말이나 앞 글자만 따서 줄여 버리는 습관을 놀리는 말이다. "저메추(저녁 메뉴 추천)", "오저치고(오늘 저녁 치킨 고)"처럼 줄임말이 너무 많아지자, 그걸 비꼬려고 생긴 말인데 정작 이 말도 줄임말이다. 한국 인터넷에서 줄임말이 얼마나 흔한지 보여 주는 대표 단어라, 외국인이 한국 줄임말 문화를 이해할 때 출발점으로 좋다.',
  '2010년대 후반 줄임말을 많이 쓰는 인터넷 유행에 맞서 나온 말이 스스로 줄임말이 되며 굳어짐',
  '친구가 낯선 줄임말을 쓸 때 웃으며 되묻거나, 줄임말 문화를 소개할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 모르는 줄임말을 쓸 때","text":"그건 또 뭐야, 진짜 별다줄이다"},{"situation":"줄임말을 설명할 때","text":"별다줄이라는 말도 결국 줄임말이야"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'ironic', 2019, 2019, 'approximate', 'social_media', 37.0
),
(
  '저메추', '저메추', array['저녁 메뉴 추천','점메추','저메추 좀','Jeo-me-chu','Jeomechu'],
  '''저녁 메뉴 추천''의 줄임말',
  '"저녁 뭐 먹지?"라는 고민을 남에게 맡길 때 쓰는 말이다. 커뮤니티나 단톡방에 "저메추"라고만 올리면 사람들이 메뉴를 하나씩 추천해 준다. 점심이면 ''점메추'', 야식이면 ''야메추''처럼 바꿔 쓴다. 대표적인 ''별다줄'' 단어 가운데 하나다. 메뉴를 정하지 못해 고민하는 사람이 많아서, 저메추 글에는 금세 댓글이 여러 개 달린다.',
  '2010년대 후반 온라인 커뮤니티 게시판에서 메뉴 추천을 부탁하는 글 제목으로 쓰이며 퍼짐',
  '친구나 동료에게 오늘 먹을 메뉴를 추천해 달라고 가볍게 부탁할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"단톡방에서","text":"저메추 받습니다, 국물 있는 걸로"},{"situation":"점심시간 직전","text":"오늘 점메추 해 줄 사람?"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2019, 2019, 'approximate', 'social_media', 40.0
),
(
  '오운완', '오운완', array['오늘 운동 완료','#오운완','어운완','O-un-wan','Ounwan','Ohunwan'],
  '''오늘 운동 완료''의 줄임말, 운동 인증 태그',
  '오늘 정한 운동을 끝내고 SNS나 운동 커뮤니티에 사진을 올리며 붙이는 태그다. 하루 늦게 올리면 ''어운완(어제 운동 완료)''이라고 쓰기도 한다. 꾸준히 운동하는 사람들의 습관을 보여 주는 말이지만, 몸 사진을 자랑하려고 올리는 게시물을 놀릴 때도 쓴다. 매일 오운완을 올리며 운동 습관을 기록하는 사람도 많다.',
  '2020년대 초 인스타그램 등 SNS에서 운동 인증 사진에 #오운완 태그를 붙이는 문화로 확산',
  '운동을 마친 뒤 인증하거나, 운동을 꾸준히 하는 친구를 응원할 때 쓴다.',
  '남의 몸 사진에 외모 평가 댓글을 다는 건 피하자.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"헬스장을 나서며","text":"하체 끝, 오운완!"},{"situation":"친구 인증글 댓글","text":"매일 오운완 대단하다, 나도 내일부터 간다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2021, 2021, 'approximate', 'shortform', 43.0
),
(
  '내돈내산', '내돈내산', array['내 돈 주고 내가 산','#내돈내산','Nae-don-nae-san','Naedonnaesan'],
  '''내 돈 주고 내가 산'' 물건이라는 뜻, 협찬 아님을 밝히는 말',
  '광고나 협찬 없이 자기 돈으로 산 물건을 리뷰할 때 붙이는 말이다. 인플루언서가 돈이나 제품을 받고 칭찬만 하는 리뷰가 늘자, 솔직한 리뷰라는 걸 보여 주려고 이 태그를 쓰기 시작했다. 영수증을 함께 보여 주기도 한다. 다만 태그만 붙이고 실제로는 광고비를 받는 경우도 있어 무조건 믿을 수는 없다.',
  '2015년경 유튜버의 리뷰 영상에서 쓰이기 시작해, 협찬 리뷰에 대한 불신이 커진 2020년 무렵 널리 퍼짐',
  '내가 직접 사서 써 본 물건을 소개할 때 쓴다. 리뷰를 볼 때 협찬인지 확인하는 기준으로도 쓴다.',
  '실제로 광고를 받았다면 이 말을 쓰면 안 된다. 광고 표시를 숨기면 법에 걸릴 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"리뷰를 올릴 때","text":"내돈내산 후기라 솔직하게 씁니다"},{"situation":"친구에게 추천할 때","text":"이 이어폰 내돈내산인데 진짜 좋아"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2015, 2020, 'approximate', 'social_media', 41.0
),
(
  '갑분싸', '갑분싸', array['갑자기 분위기 싸해짐','갑분싸하다','Gap-bun-ssa','Gapbunssa'],
  '''갑자기 분위기 싸해짐''의 줄임말',
  '누군가의 말이나 행동 때문에 즐겁던 분위기가 갑자기 차갑고 어색해질 때 쓴다. 농담이 안 통했을 때 스스로 "갑분싸네"라고 말해 어색함을 웃음으로 넘기기도 한다. ''갑분'' 뒤에 다른 말을 붙여 ''갑분○○''처럼 바꿔 쓰는 말장난도 많이 생겼다.',
  '2017년 무렵 인터넷 커뮤니티의 댓글 드립에서 시작해, 인터넷 방송 채팅을 거쳐 일상어로 퍼짐',
  '어색한 순간을 가볍게 넘기거나, 내 농담이 안 통했을 때 스스로 놀릴 때 쓴다.',
  '특정 사람을 콕 집어 "너 때문에 갑분싸"라고 하면 상처가 될 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"농담이 안 통했을 때","text":"아… 갑분싸 죄송합니다"},{"situation":"모임 중 정적이 흐를 때","text":"왜 갑분싸야, 노래나 한 곡 틀자"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2017, 2018, 'approximate', 'social_media', 35.0
),
(
  '꾸안꾸', '꾸안꾸', array['꾸민 듯 안 꾸민 듯','꾸안꾸 룩','Kku-an-kku','Kkuankku'],
  '''꾸민 듯 안 꾸민 듯''의 줄임말',
  '너무 힘주지 않았는데도 센스 있어 보이는 자연스러운 옷차림이나 화장을 말한다. 화려한 옷보다 단순한 옷으로 신경 쓴 듯한 느낌을 내는 것이 핵심이다. 처음에는 쇼핑몰과 잡지가 상품을 소개하려고 많이 쓴 말이었지만, 지금은 일상어가 됐다. 반대로 한껏 꾸민 모습은 ''꾸꾸꾸''라고 부른다.',
  '2019년 후반부터 패션 쇼핑몰과 잡지, SNS에서 자연스러운 스타일을 부르는 말로 쓰이기 시작함',
  '자연스럽게 멋 낸 옷차림을 칭찬하거나, 오늘 스타일을 소개할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구 옷을 칭찬할 때","text":"오늘 완전 꾸안꾸 느낌 좋다"},{"situation":"약속 전 옷 고를 때","text":"너무 차려입지 말고 꾸안꾸로 가자"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2019, 2019, 'approximate', 'social_media', 39.0
),
(
  '소확행', '소확행', array['소소하지만 확실한 행복','小確幸','So-hwak-haeng','Sohwakhaeng'],
  '''소소하지만 확실한 행복''의 줄임말',
  '갓 구운 빵, 잘 정리된 서랍처럼 일상 속 작지만 확실한 즐거움을 말한다. 원래 일본 소설가 무라카미 하루키가 1986년 에세이에서 쓴 표현이다. 한국에서는 2018년 소비 트렌드 키워드로 소개되고, 한 설문에서 그해 유행어 1위로 꼽히며 크게 퍼졌다. 큰 성공보다 오늘의 작은 행복을 챙기자는 분위기를 보여 준다.',
  '무라카미 하루키의 1986년 에세이 표현이 2018년 한국 소비 트렌드 키워드로 소개되며 유행',
  '작은 즐거움을 이야기하거나, 나를 위한 작은 선물을 소개할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"퇴근길 편의점에서","text":"새로 나온 아이스크림 하나, 이게 내 소확행"},{"situation":"주말 아침","text":"늦잠 자고 커피 한 잔, 완벽한 소확행"}]',
  'green', 'archived', 'phrase', 'text', 'beginner', 'wholesome', 2018, 2018, 'year', 'social_media', 30.0
),
(
  '사바사', '사바사', array['사람 바이 사람','케바케','회바회','Sa-ba-sa','Sabasa','Case by case'],
  '''사람 by 사람''의 줄임말, 사람마다 다르다는 뜻',
  '영어 ''case by case''를 줄인 ''케바케(경우마다 다름)''에서 나온 말로, 사람마다 다르다는 뜻이다. 같은 방식으로 회사마다 다르면 ''회바회'', 지점마다 다르면 ''점바점''처럼 바꿔 쓴다. 다만 이 말을 모르는 사람도 있으니, 처음 만난 사람에게는 "사람마다 달라요"라고 풀어서 말하는 게 좋다.',
  '영어 ''case by case''를 줄인 ''케바케''가 2010년대 인터넷 커뮤니티에서 ''사바사'', ''회바회'' 등으로 갈라져 퍼짐',
  '어떤 일이 사람마다 다르게 느껴진다고 말할 때 쓴다. 친구 사이 대화에 잘 어울린다.',
  null,
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"매운 음식 이야기","text":"그 집 맵기는 사바사라 직접 먹어 봐야 해"},{"situation":"회사 문화 이야기","text":"재택근무는 회바회야"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2015, 2015, 'approximate', 'social_media', 34.0
),
(
  '오히려 좋아', '오히려-좋아', array['오히려 좋아~','오히려 좋다','Ohiryeo joa','Even better'],
  '안 좋은 상황을 일부러 좋다고 받아들이는 말',
  '일이 꼬이거나 불리해졌을 때 "오히려 좋아"라고 말하며 웃어넘기는 표현이다. 인터넷 방송인들이 게임이 불리해져도 능청스럽게 외치던 말이 밈이 됐다. 침착맨의 유행어로 아는 사람이 많지만, 그보다 먼저 인터넷 방송에서 쓰였다고 알려져 있다. ''럭키비키''와 비슷하지만 더 장난스럽고 허세 섞인 느낌이다.',
  '2010년대 중반 인터넷 게임 방송에서 불리한 상황을 능청스럽게 넘기던 말이 2020년 무렵 밈으로 널리 퍼짐',
  '작은 실수나 계획이 틀어진 상황을 웃으며 넘길 때 쓴다.',
  '상대가 진짜로 속상해할 때 쓰면 놀리는 것처럼 들릴 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"비가 와서 야외 약속이 취소됐을 때","text":"오히려 좋아, 집에서 영화 보자"},{"situation":"게임에서 지고 있을 때","text":"이 정도 불리함? 오히려 좋아"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2016, 2020, 'approximate', 'shortform', 42.0
),
(
  '슬릭백 챌린지', '슬릭백-챌린지', array['슬릭백','SlickBack','Slickback','주비 슬라이드','Jubi Slide'],
  '공중에 뜬 듯 옆으로 미끄러지는 춤 챌린지',
  '제자리에서 발을 빠르게 움직여 옆으로 미끄러지듯 걷는 춤이다. 2022년 미국 틱톡커 jubi2fye가 시작했고, 해외에서는 ''주비 슬라이드''라고도 부른다. 한국에서는 2023년 틱톡커 이효철이 공중에 뜬 것처럼 보이는 영상을 올리며 크게 유행했다. 이름은 춤 동작이 아니라 배경음악 제목 ''A Pimp Named SlickBack''에서 왔다.',
  '2022년 미국 틱톡커 jubi2fye가 시작한 챌린지가 2023년 이효철의 영상으로 한국에서 크게 유행',
  '춤 영상을 찍거나, 미끄러지듯 빠르게 움직이는 모습을 보고 장난스럽게 쓴다.',
  '좁거나 미끄러운 곳에서 따라 하면 넘어질 수 있으니 조심하자.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"쉬는 시간 교실에서","text":"너 슬릭백 할 줄 알아? 한번 보여 줘"},{"situation":"친구가 빨리 걸어올 때","text":"뭐야, 슬릭백 하면서 오는 줄"}]',
  'green', 'cooling', 'dance', 'video', 'beginner', 'funny', 2022, 2023, 'year', 'shortform', 46.0
),
(
  '아파트 게임', '아파트-게임', array['아파트 아파트','APT.','로제 아파트','아파트 술게임','Apartment game','Apateu'],
  '손을 쌓으며 숫자를 세는 한국 술자리 게임, 로제의 노래로 세계적 유행',
  '여러 사람이 손을 번갈아 쌓으며 "아파트, 아파트"를 외치다가, 정한 숫자에 걸린 사람이 벌칙을 받는 한국 술자리 게임이다. 2024년 블랙핑크 로제가 브루노 마스와 함께 이 게임의 구호를 후렴으로 쓴 노래 ''APT.''를 내면서 세계적으로 알려졌다. 해외 팬들이 게임 규칙을 찾아보고 따라 하는 영상도 많이 올라왔다.',
  '오래된 한국 술자리 게임이 2024년 10월 로제와 브루노 마스의 노래 ''APT.'' 발표 뒤 세계적으로 유행',
  '친구들과 모였을 때 게임을 제안하거나, 노래 ''APT.'' 이야기를 할 때 쓴다.',
  '술자리 게임이라 벌칙으로 술을 강요하지 말자. 음료나 다른 벌칙으로 바꿔도 된다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"모임에서","text":"우리 아파트 게임 한 판 하자, 숫자는 7!"},{"situation":"노래를 들으며","text":"로제 노래 덕분에 외국 친구도 아파트 게임 알더라"}]',
  'green', 'active', 'song', 'video', 'beginner', 'funny', 2024, 2024, 'year', 'shortform', 58.0
),
(
  '푸바오', '푸바오', array['푸공주','용인 푸씨','Fu Bao','Fubao'],
  '한국에서 처음 자연 번식으로 태어난 인기 판다',
  '2020년 7월 용인 에버랜드에서 태어난 자이언트 판다로, 한국에서 자연 번식으로 태어난 첫 판다다. 이름은 ''행복을 주는 보물''이라는 뜻이다. 사육사 강철원(강바오)과 함께한 영상들이 큰 사랑을 받았고, 팬들은 ''푸공주''라고 불렀다. 2024년 4월 중국으로 떠날 때 많은 사람이 공항과 온라인에서 작별 인사를 하며 화제가 됐다.',
  '2020년 에버랜드에서 태어난 뒤 사육사 영상으로 인기를 얻었고, 2024년 4월 중국 반환 때 전국적 화제가 됨',
  '귀여운 동물이나 판다 이야기를 할 때, 또는 푸바오 영상을 공유할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"판다 영상을 보며","text":"푸바오 대나무 먹는 거 또 봐도 귀엽다"},{"situation":"에버랜드 가기 전","text":"푸바오는 없지만 동생 판다들 보러 가자"}]',
  'green', 'cooling', 'image', 'image', 'beginner', 'wholesome', 2020, 2023, 'year', 'shortform', 49.0
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
('얼죽아', 'https://namu.wiki/w/%EC%95%84%EB%A9%94%EB%A6%AC%EC%B9%B4%EB%85%B8', '아메리카노 (얼죽아)', '나무위키'),
('별다줄', 'https://namu.wiki/w/%EB%B3%84%EB%8B%A4%EC%A4%84', '별다줄', '나무위키'),
('저메추', 'https://namu.wiki/w/%EB%B3%84%EB%8B%A4%EC%A4%84', '별다줄 (파생어: 저메추)', '나무위키'),
('오운완', 'https://namu.wiki/w/%EC%98%A4%EC%9A%B4%EC%99%84', '오운완', '나무위키'),
('내돈내산', 'https://namu.wiki/w/%EB%82%B4%EB%8F%88%EB%82%B4%EC%82%B0', '내돈내산', '나무위키'),
('갑분싸', 'https://namu.wiki/w/%EA%B0%91%EB%B6%84%EC%8B%B8', '갑분싸', '나무위키'),
('꾸안꾸', 'https://namu.wiki/w/%EA%BE%B8%EC%95%88%EA%BE%B8', '꾸안꾸', '나무위키'),
('소확행', 'https://namu.wiki/w/%EC%86%8C%ED%99%95%ED%96%89', '소확행', '나무위키'),
('사바사', 'https://namu.wiki/w/Case%20by%20case', 'Case by case (사바사)', '나무위키'),
('오히려-좋아', 'https://namu.wiki/w/%EC%98%A4%ED%9E%88%EB%A0%A4%20%EC%A2%8B%EC%95%84', '오히려 좋아', '나무위키'),
('슬릭백-챌린지', 'https://namu.wiki/w/%EC%8A%AC%EB%A6%AD%EB%B0%B1', '슬릭백', '나무위키'),
('아파트-게임', 'https://en.wikipedia.org/wiki/APT._(song)', 'APT. (song)', 'Wikipedia'),
('푸바오', 'https://ko.wikipedia.org/wiki/%ED%91%B8%EB%B0%94%EC%98%A4', '푸바오', '위키백과')
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
('얼죽아', 'eoljuga-iced-americano', 'Eol-jug-a (얼죽아): Iced Americano Even If I Freeze',
 'Short for "iced Americano, even if I freeze to death"',
 'People who drink iced Americano even in the middle of winter. Iced Americano is the top-selling café drink in Korea, often shortened to "a-a". A Starbucks Korea survey found about 6 in 10 customers order iced drinks even in winter.',
 'Spread in Korean café culture in the late 2010s',
 'Use it to describe yourself or a friend who always orders iced drinks.', null,
 array['a-a','Iced Americano lover'],
 '[{"situation":"At a café on a freezing day","text":"I am eol-jug-a, so iced Americano again."}]'),
('별다줄', 'byeoldajul', 'Byeol-da-jul (별다줄): You Shorten Everything',
 'Short for "you even shorten that?"',
 'A teasing word for the habit of cutting any phrase down to its first syllables, like "jeo-me-chu" (dinner menu recommendation). The joke is that the word itself is an abbreviation. It is a good starting point for understanding Korean internet abbreviations.',
 'Late 2010s, a reaction to heavy abbreviation online that became an abbreviation itself',
 'Use it when a friend uses a strange new abbreviation.', null,
 array['Shortening everything'],
 '[{"situation":"A friend uses an unknown abbreviation","text":"What is that now? Total byeol-da-jul."}]'),
('저메추', 'jeomechu', 'Jeo-me-chu (저메추): Dinner Menu Suggestions?',
 'Short for "recommend me a dinner menu"',
 'Posted alone in a group chat or forum, it asks people to suggest what to eat tonight. For lunch it becomes "jeom-me-chu", for late-night snacks "ya-me-chu". A classic example of byeol-da-jul.',
 'Late 2010s, from post titles on Korean online forums asking for menu ideas',
 'Use it to ask friends what to eat.', null,
 array['Dinner recs','jeom-me-chu'],
 '[{"situation":"In a group chat","text":"Jeo-me-chu please, something with soup."}]'),
('오운완', 'oh-un-wan', 'O-un-wan (오운완): Today''s Workout Done',
 'Short for "today''s workout, complete", a workout hashtag',
 'A tag people add when they post a photo after finishing their workout. If posted a day late, it becomes "eo-un-wan" (yesterday''s workout done). It is also used to tease posts that are mainly about showing off.',
 'Spread on Instagram and Korean social media in the early 2020s',
 'Use it after a workout or to cheer a friend who trains often.', 'Avoid commenting on other people''s bodies.',
 array['#ohunwan','Workout done'],
 '[{"situation":"Leaving the gym","text":"Leg day done. O-un-wan!"}]'),
('내돈내산', 'nae-don-nae-san', 'Nae-don-nae-san (내돈내산): Bought With My Own Money',
 'Means "I paid for it myself", a not-sponsored review tag',
 'A tag for reviews of things you bought yourself, with no ad deal. As paid influencer reviews grew, creators started using it to show honest reviews, sometimes with receipts. Still, some use the tag while being paid, so it is not proof.',
 'First used by a YouTuber around 2015, widespread by about 2020',
 'Use it when reviewing something you bought.', 'Do not use it if you were paid. Hiding ads can break the law.',
 array['Not sponsored','Self-paid review'],
 '[{"situation":"Posting a review","text":"Nae-don-nae-san, so this is my honest review."}]'),
('갑분싸', 'gap-bun-ssa', 'Gap-bun-ssa (갑분싸): The Mood Suddenly Went Cold',
 'Short for "the mood suddenly went awkward"',
 'Used when a comment or action suddenly makes a fun mood cold and awkward. People often say it about their own failed joke to laugh it off.',
 'Around 2017, from Korean forum comment jokes, then streaming chats',
 'Use it to laugh off an awkward moment.', 'Blaming one person for the gap-bun-ssa can hurt.',
 array['Awkward silence'],
 '[{"situation":"A joke falls flat","text":"Oops, gap-bun-ssa. Sorry."}]'),
('꾸안꾸', 'kku-an-kku', 'Kku-an-kku (꾸안꾸): Effortlessly Styled',
 'Short for "styled, but like you did not try"',
 'A natural outfit or makeup that looks stylish without too much effort. Simple clothes with a careful touch are the key. It started as shopping-mall and magazine wording and became everyday talk. The opposite, fully dressed up, is "kku-kku-kku".',
 'From late 2019 in Korean fashion shops, magazines and social media',
 'Use it to praise a natural, stylish look.', null,
 array['Effortless chic'],
 '[{"situation":"Complimenting a friend","text":"Your outfit is so kku-an-kku today."}]'),
('소확행', 'so-hwak-haeng', 'So-hwak-haeng (소확행): Small but Certain Happiness',
 'Short for "small but certain happiness"',
 'Small, sure joys in daily life, like fresh bread or a tidy drawer. The phrase comes from a 1986 essay by Japanese novelist Haruki Murakami. In Korea it became a 2018 consumer trend keyword and was voted top buzzword of that year in one survey.',
 'A 1986 Haruki Murakami phrase that became a 2018 Korean trend word',
 'Use it to talk about small daily pleasures.', null,
 array['Small happiness'],
 '[{"situation":"A new ice cream on the way home","text":"This is my so-hwak-haeng."}]'),
('사바사', 'sa-ba-sa', 'Sa-ba-sa (사바사): Depends on the Person',
 'Short for "person by person"',
 'From "ke-ba-ke" (case by case), it means it depends on the person. The pattern spreads: "hoe-ba-hoe" for company by company, "jeom-ba-jeom" for branch by branch. Some people do not know it, so say it plainly with strangers.',
 'From the English "case by case", reshaped on Korean forums in the 2010s',
 'Use it in casual talk when experiences differ.', null,
 array['Case by case','ke-ba-ke'],
 '[{"situation":"Talking about spicy food","text":"How spicy it feels is sa-ba-sa."}]'),
('오히려-좋아', 'even-better', 'Ohiryeo Joa (오히려 좋아): Even Better',
 'Calling a bad turn of events good on purpose',
 'When things go wrong, you say "even better!" and laugh it off. It became a meme from game streamers who said it smugly when losing. Many link it to streamer Chimchakman, but it was used earlier. It is cheekier than "Lucky Vicky".',
 'Mid-2010s Korean game streams, a widespread meme by about 2020',
 'Use it to laugh off small mistakes or changed plans.', 'It can sound like teasing if someone is really upset.',
 array['Even better','All according to plan'],
 '[{"situation":"Rain cancels outdoor plans","text":"Ohiryeo joa. Movie night at home."}]'),
('슬릭백-챌린지', 'slickback-challenge', 'Slickback Challenge (슬릭백)',
 'A dance where you seem to glide sideways in the air',
 'Fast foot moves make you look like you are sliding sideways. US TikToker jubi2fye started it in 2022 (also called the "Jubi Slide"). In Korea it boomed in 2023 when TikToker Lee Hyo-cheol posted clips that looked like floating. The name comes from the song "A Pimp Named SlickBack".',
 'Started by jubi2fye in the US in 2022, huge in Korea in 2023',
 'Use it with dance videos or when someone moves super fast.', 'Do not try it on slippery or narrow floors.',
 array['Jubi Slide','SlickBack'],
 '[{"situation":"Break time at school","text":"Can you do the slickback? Show me."}]'),
('아파트-게임', 'apateu-game', 'Apateu Game (아파트 게임): The APT. Drinking Game',
 'A Korean hand-stacking party game made famous by Rosé''s "APT."',
 'Players stack hands in turn while chanting "apateu, apateu" (apartment), and whoever lands on the chosen number takes the penalty. In October 2024, BLACKPINK''s Rosé and Bruno Mars built their song "APT." around this chant, and fans worldwide looked up the rules.',
 'An old Korean party game, global after the October 2024 song "APT."',
 'Use it to suggest the game or talk about the song.', 'Do not force anyone to drink. Use other penalties.',
 array['APT.','Apartment game'],
 '[{"situation":"At a party","text":"Let us play the apateu game. Number seven!"}]'),
('푸바오', 'fu-bao', 'Fu Bao (푸바오): Korea''s Beloved Panda',
 'The first giant panda born naturally in Korea',
 'Born in July 2020 at Everland in Yongin, Fu Bao was the first panda bred naturally in Korea. The name means "treasure that gives happiness". Videos with keeper Kang Cheol-won ("Kang Bao") made her hugely popular, and fans called her "Princess Fu". Her move to China in April 2024 drew big farewells.',
 'Born at Everland in 2020, a national sensation through her April 2024 return to China',
 'Use it when sharing panda videos or talking about Fu Bao.', null,
 array['Princess Fu','Fubao'],
 '[{"situation":"Watching a panda video","text":"Fu Bao eating bamboo never gets old."}]')
) as t(slug, lslug, title, summary, description, origin, usage_note, caution, aliases, usage_examples)
join memes m on m.slug = t.slug
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, usage_note = excluded.usage_note,
  caution = excluded.caution, aliases = excluded.aliases, usage_examples = excluded.usage_examples,
  status = 'reviewed', source_updated_at = excluded.source_updated_at,
  reviewed_at = excluded.reviewed_at, reviewed_by = excluded.reviewed_by;

-- ── 4. 출신 국가 = 한국 (슬릭백은 미국, 소확행은 일본 표현이라 제외) ──────────────
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select m.id, 'KR', 'ko-KR', 'origin', m.title, 'reviewed', now(), '00000000-0000-0000-0000-00000000e0e0'
from memes m
where m.slug in ('얼죽아','별다줄','저메추','오운완','내돈내산','갑분싸','꾸안꾸','사바사',
  '오히려-좋아','아파트-게임','푸바오')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
