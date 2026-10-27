-- 2026-10-27 K-밈 입문 묶음 (로컬 우선 적용)
-- 대상: ① 요즘 한국 밈을 놓친 한국 사용자 ② K-MEME을 찾는 외국 사용자
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter.sql
-- 원칙: 출처가 확실하지 않은 첫 사용자는 단정하지 않는다. 가짜 출처 URL은 넣지 않는다.
-- 재실행 안전: 같은 slug는 본문을 갱신하고, 번역은 최신 원문 기준으로 덮어쓴다.
-- supabase db query는 명령 하나만 받으므로 DO 블록 하나로 묶는다 (블록 전체가 한 트랜잭션).

do $migration$
begin

-- ── 1. 기존 시드의 틀린 사실 바로잡기 ─────────────────────────
update memes set
  summary = '신나거나 반가울 때 크게 외치는 감탄사',
  description = 'MBC 예능 ''무한도전'' 알래스카 편에서 현지 교민 할아버지가 멤버들을 반기며 ''무한~도전!'' 구호를 ''무야호~''처럼 외친 장면에서 나왔다. 방송 뒤 한참 지난 2021년에 이 장면이 커뮤니티와 유튜브에서 다시 퍼지며, 기쁜 일이 생겼을 때 외치는 감탄사로 자리 잡았다.',
  origin = '2010년 MBC 무한도전 알래스카 편 방송 장면, 2021년 온라인에서 재유행',
  korea_viral_year = 2021,
  year_precision = 'year',
  era_type = 'shortform'
where slug = '무야호';

update memes set
  title = '한눈파는 남친 짤 (Distracted Boyfriend)',
  aliases = array['두리번 남친짤','고개 돌린 남자친구','Distracted Boyfriend'],
  meme_first_seen_year = 2017,
  year_precision = 'year',
  era_type = 'social_media'
where slug = 'distracted-boyfriend';

update memes set
  summary = '달고나에 찍힌 모양을 깨지 않고 떼어내는 도전',
  description = '설탕과 베이킹소다를 녹여 얇게 편 달고나에 별, 우산 같은 모양을 찍고, 그 모양만 깨지 않게 떼어내는 놀이다. 예전부터 학교 앞 ''뽑기''로 즐기던 놀이인데, 2021년 넷플릭스 ''오징어 게임''에 나오면서 세계적인 챌린지가 됐다. 2020년에 유행한 ''달고나 커피''와는 다른 밈이다.',
  origin = '오래된 한국 길거리 뽑기 놀이, 2021년 넷플릭스 오징어 게임 이후 세계로 확산',
  origin_year = 2021,
  korea_viral_year = 2021,
  year_precision = 'year',
  era_type = 'shortform'
where slug = '달고나-챌린지';

-- ── 2. 새 밈 추가 ──────────────────────────────────────────────
-- 상세·영문 페이지 공개 기준(lib/content-depth.ts: 산문 250자 이상, 점수 5 이상)을 넘도록 쓴다.
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
  '럭키비키', '럭키비키', array['럭키비키잖아','완전 럭키비키','Lucky Vicky'],
  '안 좋은 일도 결국 잘된 일이라고 웃어넘기는 말',
  '나쁜 일이 생겨도 "오히려 좋아, 완전 럭키비키잖아"처럼 행운으로 바꿔 말하는 표현이다. 아이브 장원영이 곤란한 일도 좋게 받아들이는 말버릇을 보이면서 팬들 사이에서 먼저 퍼졌다. 그 뒤 일반 사람들도 버스를 놓치거나 줄이 길 때처럼 작은 불운을 웃으며 넘길 때 쓰게 됐다. 이 말투 전체를 가리키는 ''원영적 사고''라는 말도 함께 생겼다. 억지 긍정이라는 놀림과 진짜 긍정이라는 칭찬이 섞여 쓰인다.',
  '아이브 장원영의 긍정 화법에서 시작해, 2024년 3월 팬 계정의 패러디 글이 SNS에 퍼지며 4월 무렵부터 일상어로 확산',
  '작은 실수나 불운을 가볍게 넘길 때, 또는 친구의 긍정적인 반응을 놀리듯 칭찬할 때 쓴다.',
  '상대가 크게 힘든 일을 겪고 있을 때 쓰면 고민을 가볍게 여기는 말로 들릴 수 있다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"버스를 놓쳤을 때","text":"덕분에 산책했네, 완전 럭키비키잖아"},{"situation":"비 와서 약속이 취소됐을 때","text":"집에서 쉴 수 있으니 오히려 럭키비키"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'wholesome', 2024, 2024, 'year', 'shortform', 55.0
),
(
  '원영적 사고', '원영적-사고', array['원영적사고','장원영식 사고','Wonyoung thinking','Wonyoungism'],
  '무슨 일이든 좋은 쪽으로 해석하는 긍정 사고방식',
  '아이브 장원영처럼 나쁜 상황도 좋은 쪽으로 돌려 생각하는 태도를 부르는 말이다. 예를 들어 빵이 하나 남았을 때 "마지막 하나가 남다니 운이 좋아"라고 말하는 식이다. "럭키비키"라는 말과 함께 퍼졌고, 사람들은 이 방식으로 일상의 짜증 나는 일을 바꿔 말하는 놀이를 했다. 지금은 긍정 마인드를 가진 사람을 장난스럽게 칭찬할 때 주로 쓴다.',
  '2022년 장원영의 생일 방송 발언이 시작점으로 꼽히며, 2024년 3월 팬 계정의 패러디 글이 SNS에 퍼지면서 대중적으로 유행',
  '긍정적으로 상황을 넘기는 친구를 칭찬하거나, 내가 일부러 좋게 생각해 보자고 할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 시험을 망치고도 웃을 때","text":"다음엔 오를 일만 남았다고? 완전 원영적 사고네"},{"situation":"줄이 길 때","text":"원영적 사고로 가자, 기다리는 동안 메뉴 고를 시간 생겼다"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'wholesome', 2024, 2024, 'year', 'shortform', 48.0
),
(
  '중꺾마', '중꺾마', array['중요한 건 꺾이지 않는 마음','중꺾그마','Jung-kkeok-ma','Jungkkeokma','Unbroken will'],
  '''중요한 건 꺾이지 않는 마음''의 줄임말',
  '결과가 안 좋아도 포기하지 않는 마음이 더 중요하다는 뜻이다. 2022년 리그 오브 레전드 월드 챔피언십(롤드컵)에서 DRX가 경기에 진 뒤, 쿠키뉴스가 데프트 선수 인터뷰 영상에 붙인 제목에서 나왔다. 데프트가 직접 한 말이 아니라 기자가 인터뷰 내용을 줄여 지은 문장이다. DRX는 낮은 기대 속에서 결국 우승했고, 이 말은 그 과정을 상징하게 됐다. 같은 해 카타르 월드컵에서 한국 축구 대표팀이 16강에 오른 뒤 선수들이 이 문구가 적힌 태극기를 들면서 전 국민 유행어가 됐다.',
  '2022년 롤드컵 조별 경기 뒤 쿠키뉴스가 DRX 데프트 인터뷰 영상에 붙인 제목에서 시작해, 같은 해 카타르 월드컵 16강 진출 때 태극기 문구로 전국에 확산',
  '시험, 경기, 새로운 도전을 앞둔 사람을 응원하거나, 힘들 때 스스로 다짐할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"시험 전날 친구 응원","text":"점수보다 중꺾마, 끝까지 가보자"},{"situation":"응원하는 팀이 지고 있을 때","text":"아직 안 끝났어, 중꺾마!"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'wholesome', 2022, 2022, 'year', 'shortform', 50.0
),
(
  '너 T야?', '너-t야', array['T야?','티야?','너 티야','Are you a T','Neo T-ya'],
  '공감 없이 사실만 말하는 사람에게 장난으로 묻는 말',
  'MBTI 성격 유형에서 T(사고형)는 감정보다 논리를 먼저 본다고 알려져 있다. 그래서 위로를 바랐는데 해결책이나 팩트만 돌아올 때 "너 T야?"라고 되묻는다. 반대로 공감을 잘하는 사람은 F(감정형)라고 부른다. 노래 가사와 예능 장면에도 자주 쓰이며 크게 유행했다. MBTI가 실제로 사람을 정확히 나누는 것은 아니어서, 진지한 평가보다 장난으로 쓰는 말이다.',
  '2020년대 초 한국에서 MBTI 성격 유형 이야기가 크게 유행하면서 퍼졌고, 노래 가사와 예능 장면에 쓰이며 2023년 무렵 일상 유행어가 됨',
  '친한 사이에서 서운함을 장난스럽게 표현할 때 쓴다. 웃으면서 말해야 다툼으로 번지지 않는다.',
  '욕처럼 들리는 변형 표현은 피하는 게 좋다. 성격을 단정하는 말로 들리지 않게 조심하자.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"속상하다고 했더니 해결책만 줄 때","text":"아니 위로해 달라고… 너 T야?"},{"situation":"친구가 영화 보고 하나도 안 울었을 때","text":"이걸 보고 안 울어? 진짜 T 맞네"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2023, 2023, 'approximate', 'shortform', 52.0
),
(
  '알잘딱깔센', '알잘딱깔센', array['알아서 잘 딱 깔끔하고 센스있게','알잘딱','Al-jal-ttak-kkal-sen','Aljalttakkkalsen'],
  '''알아서 잘 딱 깔끔하고 센스 있게''의 줄임말',
  '일일이 말하지 않아도 눈치껏 깔끔하게 해 달라는 뜻이다. 앞 글자만 따서 줄였기 때문에 처음 들으면 무슨 말인지 알기 어렵다. 친구에게 부탁할 때 "알잘딱깔센으로 해 줘"라고 하거나, 일을 센스 있게 끝낸 사람에게 "완전 알잘딱깔센이네"라고 칭찬할 때 쓴다. 회사에서는 지시가 너무 모호하다는 뜻으로 비꼬아 쓰기도 한다.',
  '2020년대 초 인터넷 방송 채팅과 온라인 커뮤니티에서 줄임말 놀이로 퍼졌으며, 처음 쓴 사람은 확실하게 알려져 있지 않음',
  '친구나 또래 동료에게 가볍게 부탁하거나, 센스 있게 일을 끝낸 사람을 칭찬할 때 쓴다.',
  '윗사람에게 지시하듯 쓰면 무례할 수 있다. 중요한 일은 줄임말 대신 구체적으로 부탁하자.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"발표 자료 부탁","text":"디자인은 알잘딱깔센으로 부탁해"},{"situation":"친구가 선물을 딱 맞게 골랐을 때","text":"역시 알잘딱깔센, 내 취향 그대로야"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2021, 2021, 'approximate', 'shortform', 40.0
),
(
  '갓생', '갓생', array['갓생 살기','갓생러','God-saeng','Godsaeng','God life'],
  '부지런하고 알차게 사는 하루나 삶',
  '''갓(God)''과 ''인생''을 합친 말로, 일찍 일어나고 운동하고 공부하는 등 모범적으로 사는 삶을 뜻한다. 하루 계획표, 운동 기록, 공부 인증 사진을 SNS에 올리며 "오늘도 갓생"이라고 쓰는 문화가 함께 퍼졌다. 스스로 다짐할 때도, 열심히 사는 사람을 칭찬할 때도 쓴다. 너무 애쓰는 삶에 지친 사람들이 나중에는 ''아보하'' 같은 반대 흐름을 만들기도 했다.',
  '2020년대 초 기상·운동·공부 인증 사진을 올리는 SNS 문화와 하루 일과 브이로그가 유행하면서 함께 퍼짐',
  '새 계획이나 자기 다짐을 밝힐 때, 또는 부지런히 사는 친구를 칭찬할 때 편하게 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"새해 다짐","text":"올해는 아침 6시 기상, 진짜 갓생 산다"},{"situation":"친구가 새벽 운동 인증을 올렸을 때","text":"벌써 운동 끝? 너 완전 갓생러다"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2021, 2021, 'approximate', 'shortform', 46.0
),
(
  '추구미', '추구미', array['추구하는 미','내 추구미','Chugu-mi','Chugumi'],
  '내가 되고 싶은 분위기나 스타일',
  '''추구하는 미(아름다움)''의 줄임말로, 따라 하고 싶은 외모, 패션, 분위기를 말한다. 연예인이나 캐릭터 사진을 보여 주며 "이게 내 추구미야"처럼 쓴다. 실제 내 모습과 되고 싶은 모습이 다를 때 "추구미는 이건데 현실은 이거"라며 두 사진을 비교하는 놀이도 유행했다. 외모뿐 아니라 방 꾸미기, 말투, 생활 방식에도 쓴다.',
  '2023년 무렵 인스타그램과 숏폼의 패션·뷰티 콘텐츠에서 쓰이기 시작해, 2024년 Z세대 대표 유행어로 꼽힘',
  '내 취향이나 닮고 싶은 스타일을 말할 때 편하게 쓴다. 사진과 함께 쓰면 뜻이 잘 전해진다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"사진을 보여 주며","text":"이 무드가 딱 내 추구미야"},{"situation":"현실과 비교할 때","text":"추구미는 청순인데 현실은 잠옷 차림"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'wholesome', 2024, 2024, 'approximate', 'shortform', 44.0
),
(
  '마라탕후루', '마라탕후루', array['마라탕후루 챌린지','마라탕 탕후루','Malatanghulu'],
  '마라탕과 탕후루를 노래한 초등학생 인기 챌린지 곡',
  '유튜버 서이브가 부른 노래 ''마라탕후루''다. 당시 10대에게 인기였던 매운 마라탕과 과일 사탕 탕후루를 반복하는 가사, 따라 하기 쉬운 춤이 특징이다. 초등학생 사이에서 크게 유행해 학교와 학원에서 따라 부르는 아이들이 많았고, 숏폼 챌린지 영상도 쏟아졌다. 어른들이 요즘 아이들의 유행을 알게 된 계기가 되기도 했다.',
  '2024년 유튜버 서이브가 노래를 발표한 뒤 초등학생 사이 따라 부르기와 숏폼 춤 챌린지로 빠르게 확산',
  '아이들 사이 유행을 이야기하거나, 마라탕과 탕후루를 함께 먹을 때 장난스럽게 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"조카가 계속 부를 때","text":"요즘 초등학생은 다 마라탕후루 부르더라"},{"situation":"간식 메뉴 고를 때","text":"오늘은 마라탕 먹고 탕후루, 완전 마라탕후루 코스"}]',
  'green', 'cooling', 'song', 'video', 'beginner', 'funny', 2024, 2024, 'year', 'shortform', 47.0
),
(
  '삐끼삐끼 챌린지', '삐끼삐끼-챌린지', array['삐끼삐끼','Pikki Pikki','기아 삐끼삐끼'],
  '야구 응원단 치어리더의 삼진 응원 춤 챌린지',
  'KIA 타이거즈 응원단이 상대 타자가 삼진을 당하면 추는 짧은 응원 춤이다. 엄지를 세운 두 손을 번갈아 위아래로 흔드는 단순한 동작이 특징이다. 응원 자체는 2022년부터 했지만, 치어리더 이주은이 무표정하게 춤추는 영상이 2024년 틱톡과 유튜브 쇼츠에서 해외까지 퍼지며, 한국 야구 응원 문화가 세계에 알려지는 계기가 됐다. 여러 나라 사람들이 따라 추는 챌린지 영상을 올렸다.',
  '2022년부터 KIA 타이거즈 응원으로 쓰였고, 2024년 6월 유튜브에 올라온 치어리더 영상이 틱톡과 인스타그램으로 국내외 확산',
  '신나는 일이 생겼을 때 춤과 함께 쓰거나, 한국 야구 응원 문화를 소개할 때 쓴다.',
  '실존 인물이 나오는 영상을 쓸 때는 초상권을 존중하고, 외모 평가 댓글은 피하자.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"친구가 내기에서 졌을 때","text":"삼진 아웃~ 삐끼삐끼 추자"},{"situation":"야구장 가기 전","text":"오늘 직관 가면 삐끼삐끼 꼭 실제로 보자"}]',
  'green', 'cooling', 'dance', 'video', 'beginner', 'funny', 2022, 2024, 'year', 'shortform', 53.0
),
(
  '케데헌', '케데헌', array['케이팝 데몬 헌터스','KPop Demon Hunters','골든','Golden','KDH','Kedeheon'],
  '넷플릭스 애니메이션 ''케이팝 데몬 헌터스''의 줄임말',
  '케이팝 걸그룹이 노래로 악귀를 물리친다는 내용의 넷플릭스 애니메이션이다. 2025년 공개 뒤 OST ''Golden''이 세계 음악 차트에서 크게 인기를 얻었고, 노래 따라 부르기와 춤 챌린지가 유행했다. 한국에서는 제목을 줄여 ''케데헌''이라고 부른다. 서울 거리, 한식, 전통 문화가 작품에 많이 나와 해외 팬이 한국 문화를 알게 되는 입구가 되기도 했다.',
  '2025년 넷플릭스에서 애니메이션이 공개된 뒤 OST ''Golden''의 차트 인기와 노래·춤 챌린지로 세계적으로 확산',
  '작품과 노래 이야기를 할 때 쓴다. 해외 친구와 대화할 때는 원래 제목을 함께 말하면 좋다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"노래방에서","text":"케데헌 골든 고음 도전해 볼 사람?"},{"situation":"주말 계획","text":"이번 주말엔 케데헌 한 번 더 보자"}]',
  'green', 'active', 'song', 'video', 'beginner', 'wholesome', 2025, 2025, 'year', 'shortform', 60.0
),
(
  '스불재', '스불재', array['스스로 불러온 재앙','Seu-bul-jae','Seubuljae','Self-made disaster'],
  '''스스로 불러온 재앙''의 줄임말',
  '내가 한 선택 때문에 내가 고생하게 된 상황을 웃프게 말할 때 쓴다. 과제를 미루다 밤을 새우거나, 약속을 너무 많이 잡아 주말이 사라지거나, 밤늦게 야식을 먹고 다음 날 후회할 때가 대표적이다. 남 탓을 하지 않고 스스로를 놀리는 말이라 분위기를 가볍게 만든다. 원래는 록 밴드 넥스트(N.EX.T)의 노래 가사 "스스로 불러온 재앙에 짓눌려"에서 왔다.',
  '1997년 넥스트 노래 ''Lazenca, Save Us'' 가사가 노래방 화면 짤과 함께 커뮤니티에 퍼졌고, 줄임말 ''스불재''로 정착',
  '내가 만든 고생을 스스로 놀릴 때 쓰기 좋다. 친구의 하소연에 같이 웃어 줄 때도 쓴다.',
  '남의 진짜 불행에 쓰면 비꼬는 말로 들릴 수 있다. 상대가 웃을 수 있는 일에만 쓰자.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"과제를 미루다 밤샐 때","text":"이건 완벽한 스불재다…"},{"situation":"약속을 세 개 잡은 주말","text":"토요일 약속 세 개, 스불재 확정"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'ironic', 2021, 2021, 'approximate', 'shortform', 38.0
),
(
  '국룰', '국룰', array['국민 룰','국룰이지','Guk-rul','Gukrul','National rule'],
  '다들 당연하게 따르는 방식이나 규칙',
  '''국민 룰''의 줄임말로, 누가 정한 건 아니지만 모두가 그렇게 하는 방식을 말한다. "치킨엔 콜라가 국룰", "비 오는 날엔 파전이 국룰"처럼 음식 조합에 특히 많이 쓴다. 게임, 여행, 모임에서 흔히 하는 순서나 방식에도 붙는다. 정말 정해진 규칙은 아니어서 "그건 국룰 아니지"라며 서로 다투는 놀이도 함께 생겼다.',
  '2000년대 말 온라인 게임 이용자 사이에서 쓰이기 시작했고, 2019년 무렵 인터넷 방송과 커뮤니티를 거쳐 일상어로 확산',
  '모두가 아는 습관이나 음식 조합을 말할 때 쓴다. 가족, 친구, 직장 어디서나 편하게 쓸 수 있다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"메뉴 고를 때","text":"비 오는 날엔 파전에 막걸리가 국룰이지"},{"situation":"여행 첫날","text":"휴게소에선 호두과자 사는 게 국룰"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 2019, 2019, 'approximate', 'social_media', 42.0
),
(
  '아보하', '아보하', array['아주 보통의 하루','Aboha'],
  '''아주 보통의 하루''의 줄임말, 평범한 하루의 소중함',
  '특별한 일 없이 무사히 지나간 평범한 하루를 좋게 보는 말이다. 소비 트렌드를 정리하는 책 ''트렌드 코리아 2025''가 올해의 키워드로 꼽으며 널리 알려졌다. ''갓생''처럼 매일 애쓰기보다, 크게 기쁘지도 슬프지도 않은 편안한 일상을 바라는 흐름을 보여 준다. 일기나 SNS에 조용한 하루 사진을 올리며 "오늘도 아보하"라고 쓴다.',
  '2024년 말 출간된 소비 트렌드 책 ''트렌드 코리아 2025''가 올해의 키워드로 소개하면서 언론과 SNS로 확산',
  '편안하고 무사한 일상을 이야기할 때 쓴다. 일기나 하루 기록에 붙이기 좋다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"퇴근 후 일기","text":"별일 없이 지나간 오늘, 완벽한 아보하"},{"situation":"주말 계획을 묻는 친구에게","text":"이번 주말은 아무것도 안 하는 아보하 예정"}]',
  'green', 'active', 'phrase', 'text', 'normal', 'wholesome', 2025, 2025, 'year', 'shortform', 41.0
),
(
  '뇌절', '뇌절', array['뇌절하다','1절 2절 뇌절','Noe-jeol','Noejeol'],
  '같은 농담을 너무 반복해 분위기를 깨는 것',
  '"1절만 해라"는 말에서 이어진 표현이다. 1절, 2절을 넘어 지나치게 같은 드립이나 행동을 이어 가 사람들을 지치게 하는 것을 뜻한다. 만화 ''나루토''에 나오는 기술 이름 ''뇌절''과 소리가 같아 붙은 말장난이다. 처음엔 재밌던 농담도 계속하면 뇌절이 된다는 식으로 쓰고, 유행어를 억지로 계속 쓰는 사람에게도 쓴다.',
  '2019년 무렵 온라인 커뮤니티에서 ''1절, 2절, 3절''을 만화 나루토의 기술 이름 ''뇌절''로 비튼 말장난으로 퍼짐',
  '친구의 과한 드립을 웃으며 멈추게 할 때 쓴다. 나 스스로 "이건 뇌절인가?"라고 돌아볼 때도 쓴다.',
  '상대를 깎아내리는 말로 들릴 수 있다. 친한 사이에서만, 웃는 분위기에서 쓰자.',
  '{"sns":"green","work":"gray","family":"yellow","friends":"green"}',
  '[{"situation":"같은 개그를 다섯 번째 할 때","text":"그만해, 이제 뇌절이야"},{"situation":"내가 드립을 또 치기 전에","text":"한 번 더 하면 뇌절이겠지?"}]',
  'yellow', 'cooling', 'phrase', 'text', 'normal', 'ironic', 2019, 2019, 'approximate', 'social_media', 36.0
),
(
  '폼 미쳤다', '폼-미쳤다', array['폼 미쳤네','폼 지렸다','Form is crazy','Pom michyeotda'],
  '실력이나 상태가 아주 좋을 때 하는 칭찬',
  '운동선수의 컨디션을 뜻하는 ''폼(form)''에서 온 말이다. 스포츠 중계와 팬 커뮤니티에서 잘하는 선수에게 쓰던 말이 일상으로 넘어왔다. 이제는 누군가 요즘 유난히 공부를 잘하거나, 멋지게 꾸몄거나, 일을 척척 해낼 때 "폼 미쳤다"라고 감탄한다. 사람뿐 아니라 맛집, 노래, 사진처럼 무엇이든 아주 좋을 때 쓴다.',
  '스포츠 팬들이 손흥민 등 선수 영상에 달던 "폼 미쳤다" 댓글이 2023년 무렵 다른 영상과 일상 대화로 퍼짐',
  '친구나 좋아하는 대상을 크게 칭찬할 때 쓴다. 사진이나 결과물에 댓글로 달기 좋다.',
  '''미쳤다''라는 말이 들어가 격식 있는 자리나 윗사람 앞에서는 피하는 게 좋다.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"친구가 3연승 했을 때","text":"요즘 너 폼 미쳤다"},{"situation":"맛집 사진에 댓글","text":"여기 비주얼 폼 미쳤네"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2023, 2023, 'approximate', 'shortform', 39.0
),
(
  '내 마음속에 저장', '내-마음속에-저장', array['저장','내마음속에저장','윙크 저장','Saved in my heart'],
  '너무 좋아서 마음에 담아 두겠다는 귀여운 표현',
  '2017년 Mnet 오디션 예능 ''프로듀스 101 시즌2''에서 박지훈이 카메라를 보며 윙크하고 한 말로 유명해졌다. 이 장면이 크게 화제가 되면서 그는 ''윙크 남신''이라는 별명을 얻었다. 그 뒤 사람들은 마음에 드는 사진이나 순간을 보고 "내 마음속에 저장"이라고 쓰기 시작했다. 지금은 조금 옛날 유행어지만 귀엽게 좋아하는 마음을 표현할 때 여전히 쓴다.',
  '2017년 Mnet 오디션 예능 프로듀스 101 시즌2에서 박지훈이 윙크하며 말한 방송 장면에서 시작',
  '좋아하는 사진이나 순간을 보고 장난스럽게 쓴다. 윙크 이모티콘과 함께 쓰면 잘 어울린다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"귀여운 강아지 사진을 보고","text":"이건 내 마음속에 저장"},{"situation":"친구가 잘 나온 사진을 보냈을 때","text":"이 사진 내 마음속에 저장했어"}]',
  'green', 'archived', 'phrase', 'video', 'beginner', 'wholesome', 2017, 2017, 'year', 'social_media', 30.0
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

-- ── 2b. 확인한 출처 (2026-10-27 존재 확인, 위키는 맥락 확인용 보조 출처) ──
insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis)
select m.id, v.platform, v.url, v.title, v.publisher, 'unknown'::copyright_status, 'secondary_reference', 'link_only'
from (values
('럭키비키', 'Web', 'https://namu.wiki/w/%EC%9B%90%EC%98%81%EC%A0%81%20%EC%82%AC%EA%B3%A0', '원영적 사고', '나무위키'),
('원영적-사고', 'Web', 'https://namu.wiki/w/%EC%9B%90%EC%98%81%EC%A0%81%20%EC%82%AC%EA%B3%A0', '원영적 사고', '나무위키'),
('중꺾마', 'Web', 'https://namu.wiki/w/%EC%A4%91%EC%9A%94%ED%95%9C%20%EA%B2%83%EC%9D%80%20%EA%BA%BE%EC%9D%B4%EC%A7%80%20%EC%95%8A%EB%8A%94%20%EB%A7%88%EC%9D%8C', '중요한 것은 꺾이지 않는 마음', '나무위키'),
('너-t야', 'Web', 'https://namu.wiki/w/%EB%84%88%20T%EC%95%BC%3F', '너 T야?', '나무위키'),
('너-t야', 'Web', 'https://ko.wikipedia.org/wiki/MBTI', 'MBTI', '위키백과'),
('알잘딱깔센', 'Web', 'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98_%EC%9D%B8%ED%84%B0%EB%84%B7_%EC%8B%A0%EC%A1%B0%EC%96%B4_%EB%AA%A9%EB%A1%9D', '대한민국의 인터넷 신조어 목록', '위키백과'),
('갓생', 'Web', 'https://namu.wiki/w/%EA%B0%93%EC%83%9D', '갓생', '나무위키'),
('추구미', 'Web', 'https://weekly.donga.com/culture/article/all/11/5380534/1', '''추구미·도달가능미''… 2024 Z세대 유행어', '주간동아'),
('마라탕후루', 'Web', 'https://ko.wikipedia.org/wiki/%EB%A7%88%EB%9D%BC%ED%83%95%ED%9B%84%EB%A3%A8', '마라탕후루', '위키백과'),
('삐끼삐끼-챌린지', 'Web', 'https://en.wikipedia.org/wiki/Pikki_Pikki_dance', 'Pikki Pikki dance', 'Wikipedia'),
('삐끼삐끼-챌린지', 'Web', 'https://ko.wikipedia.org/wiki/%EC%82%90%EB%81%BC%EC%82%90%EB%81%BC_%EC%B6%A4', '삐끼삐끼 춤', '위키백과'),
('케데헌', 'Web', 'https://en.wikipedia.org/wiki/KPop_Demon_Hunters', 'KPop Demon Hunters', 'Wikipedia'),
('케데헌', 'Web', 'https://ko.wikipedia.org/wiki/%EC%BC%80%EC%9D%B4%ED%8C%9D_%EB%8D%B0%EB%AA%AC_%ED%97%8C%ED%84%B0%EC%8A%A4', '케이팝 데몬 헌터스', '위키백과'),
('스불재', 'Web', 'https://namu.wiki/w/Lazenca%2C%20Save%20Us', 'Lazenca, Save Us (스불재 밈)', '나무위키'),
('국룰', 'Web', 'https://namu.wiki/w/%EA%B5%AD%EB%A3%B0', '국룰', '나무위키'),
('아보하', 'Web', 'https://issuefeed.dcinside.com/content/1316134', '내년 트렌드는 ''아보하''? 연예계에서 찾아본 ''아주 보통의 하루''', '마이데일리'),
('뇌절', 'Web', 'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%EC%9D%98_%EC%9D%B8%ED%84%B0%EB%84%B7_%EC%8B%A0%EC%A1%B0%EC%96%B4_%EB%AA%A9%EB%A1%9D', '대한민국의 인터넷 신조어 목록', '위키백과'),
('내-마음속에-저장', 'Web', 'https://ko.wikipedia.org/wiki/PRODUCE_101_%EC%8B%9C%EC%A6%8C_2', 'PRODUCE 101 시즌 2', '위키백과'),
('무야호', 'Web', 'https://ko.wikipedia.org/wiki/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84', '무한도전', '위키백과'),
('달고나-챌린지', 'Web', 'https://ko.wikipedia.org/wiki/%EC%98%A4%EC%A7%95%EC%96%B4_%EA%B2%8C%EC%9E%84', '오징어 게임', '위키백과'),
('distracted-boyfriend', 'Web', 'https://en.wikipedia.org/wiki/Distracted_boyfriend', 'Distracted boyfriend', 'Wikipedia')
) as v(slug, platform, url, title, publisher)
join memes m on m.slug = v.slug
where not exists (
  select 1 from meme_sources s where s.meme_id = m.id and s.source_url = v.url
);

-- ── 3. 영어 번역 (외국 사용자용) ──────────────────────────────
-- 공개 조건: status='reviewed' + 검토자 + 원문 updated_at 일치.
-- 로컬 전용 검토자 계정을 만든다. 운영에는 실제 운영자 계정으로 바꿔야 한다.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000e0e0', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'local-editor@memecatch.local',
  '{"nickname":"로컬편집자"}'::jsonb, now(), now())
on conflict (id) do nothing;
update profiles set role = 'operator' where id = '00000000-0000-0000-0000-00000000e0e0';

insert into meme_translations (
  meme_id, locale, localized_slug, title, summary, description, origin,
  usage_note, caution, aliases, usage_examples,
  status, source_updated_at, provider, model, prompt_version, reviewed_at, reviewed_by
)
select m.id, 'en', t.lslug, t.title, t.summary, t.description, t.origin,
  t.usage_note, t.caution, t.aliases, t.usage_examples::jsonb,
  'reviewed', m.updated_at, 'editorial', 'human', 1, now(), '00000000-0000-0000-0000-00000000e0e0'
from (values
('럭키비키', 'lucky-vicky', 'Lucky Vicky (럭키비키)',
 'Calling a bad thing secretly lucky, with a smile',
 'When something goes wrong, you flip it: "Actually this is great, totally Lucky Vicky!" It spread from IVE member Jang Won-young and her famously positive way of talking.',
 'From Jang Won-young''s positive way of talking, popularized by a fan parody post in March 2024',
 'Use it to laugh off small bad luck.', 'Do not use it when a friend is going through something serious.',
 array['Lucky Vicky','Wonyoung thinking'],
 '[{"situation":"Missed the bus","text":"Guess I get a nice walk. Total Lucky Vicky."}]'),
('원영적-사고', 'wonyoung-thinking', 'Wonyoung Thinking (원영적 사고)',
 'Seeing the bright side of everything, Jang Won-young style',
 'A playful name for an always-positive mindset, after IVE member Jang Won-young. It goes hand in hand with "Lucky Vicky".',
 'Traced to a 2022 birthday livestream, popular after a fan parody post in March 2024',
 'Use it to praise someone who stays positive.', null,
 array['Wonyoungism','Lucky Vicky mindset'],
 '[{"situation":"A friend jokes after a bad test","text":"Only up from here? That is pure Wonyoung thinking."}]'),
('중꺾마', 'unbroken-will', 'Jung-kkeok-ma (중꺾마): What Matters Is an Unbroken Will',
 'Short for "what matters is a heart that does not break"',
 'It means not giving up matters more than the result. It started as the title a news outlet gave to an interview video with pro gamer Deft (DRX) after a loss at the 2022 League of Legends World Championship. Deft did not say the exact words himself. Weeks later, Korean footballers held a flag with the phrase after reaching the 2022 World Cup round of 16.',
 '2022 LoL Worlds interview with Deft, then the 2022 Qatar World Cup',
 'Use it to cheer someone on.', null,
 array['Unbroken will','Never give up'],
 '[{"situation":"Night before an exam","text":"Score aside, jung-kkeok-ma. We push to the end."}]'),
('너-t야', 'are-you-a-t', 'Are You a T? (너 T야?)',
 'A joking question for someone who answers feelings with facts',
 'In MBTI, "T" (Thinking) types are said to lead with logic over feelings. When you want comfort but get a fix-it list, you ask "Are you a T?". It is a joke, not a real personality test.',
 'Grew with the MBTI boom in Korea, a daily phrase by around 2023',
 'Use it with close friends.', 'Variants that sound like swear words are best avoided.',
 array['T?','MBTI T'],
 '[{"situation":"You vent and get only solutions","text":"I wanted a hug... are you a T?"}]'),
('알잘딱깔센', 'al-jal-ttak-kkal-sen', 'Al-jal-ttak-kkal-sen (알잘딱깔센)',
 'Short for "do it well, neatly, and with good sense, on your own"',
 'You say it when you want someone to handle a task smartly without step-by-step instructions, or to praise someone who did.',
 'Spread through Korean streaming and online communities in the early 2020s (first user unclear)',
 'Use it for casual requests among friends or peers.', 'Can sound bossy toward seniors.',
 array['Do it smart'],
 '[{"situation":"Asking for slides","text":"Design? Just al-jal-ttak-kkal-sen it."}]'),
('갓생', 'god-saeng', 'God-saeng (갓생): Living Like a God',
 'A busy, productive, well-planned life',
 '"God" plus "saeng" (from "insaeng", life). It means waking early, working out, studying, and living a model life. People say it as a goal or as praise.',
 'Spread through Korean social media and vlog culture in the early 2020s',
 'Use it for goals or praise.', null,
 array['God life','Productive life'],
 '[{"situation":"New Year goal","text":"Up at 6 a.m. every day. Full god-saeng this year."}]'),
('추구미', 'chugu-mi', 'Chugu-mi (추구미): My Aesthetic Goal',
 'The look or vibe you want to have',
 'Short for "the beauty I pursue". It is the style, fashion, or mood you aim for. People share a celeb or character photo and say "This is my chugu-mi".',
 'Started on Korean fashion and beauty social media around 2023, a top Gen Z word in 2024',
 'Use it to talk about taste.', null,
 array['My aesthetic','Goal vibe'],
 '[{"situation":"Showing a photo","text":"This mood is exactly my chugu-mi."}]'),
('마라탕후루', 'malatanghulu', 'Malatanghulu (마라탕후루)',
 'A catchy kids song about malatang and tanghulu',
 'A song by YouTuber Seo Eve that repeats two snacks trending in Korea at the time: spicy malatang and candied fruit tanghulu. Its easy dance became a huge challenge among Korean elementary school kids.',
 'Released by YouTuber Seo Eve in 2024, spread as a short-form challenge',
 'Use it when talking about kid trends.', null,
 array['Malatang tanghulu song'],
 '[{"situation":"Your niece sings it nonstop","text":"Every kid is singing Malatanghulu now."}]'),
('삐끼삐끼-챌린지', 'pikki-pikki-challenge', 'Pikki Pikki Challenge (삐끼삐끼)',
 'A baseball cheer dance that went viral worldwide',
 'KIA Tigers cheerleaders do this short thumbs-up dance when their pitcher strikes out a batter. The cheer started in 2022. A June 2024 clip of cheerleader Lee Ju-eun dancing with a deadpan face spread on TikTok and Instagram and became a global challenge.',
 'KIA Tigers cheer since 2022, viral worldwide from a June 2024 clip',
 'Use it with the dance when something good happens.', 'Respect the portrait rights of real people in clips.',
 array['Pikki Pikki','Strikeout dance'],
 '[{"situation":"A friend loses a bet","text":"Strike out! Pikki pikki time."}]'),
('케데헌', 'kpop-demon-hunters', 'KDH (케데헌): KPop Demon Hunters',
 'Korean short name for the Netflix film KPop Demon Hunters',
 'An animated Netflix film about a K-pop girl group that fights demons with songs. After its 2025 release, the song "Golden" topped charts worldwide and sing-along and dance challenges took off. Koreans shorten the title to "Ke-de-heon".',
 'Released on Netflix in 2025, spread worldwide with its soundtrack',
 'Use it when talking about the film or songs.', null,
 array['KPop Demon Hunters','Golden','Huntrix'],
 '[{"situation":"At karaoke","text":"Who wants to try the high notes in Golden?"}]'),
('스불재', 'self-made-disaster', 'Seu-bul-jae (스불재): Self-Made Disaster',
 'Short for "a disaster I brought on myself"',
 'A wry way to say your own choice got you into trouble, like a delayed assignment, too many plans, or a late-night snack. It comes from a line in the 1997 rock song "Lazenca, Save Us" by N.EX.T.',
 'A 1997 N.EX.T song lyric that spread as a karaoke-screen meme, then shortened to seu-bul-jae',
 'Best for joking about yourself.', 'Can sound sarcastic about other people''s trouble.',
 array['Self-inflicted disaster'],
 '[{"situation":"Pulling an all-nighter","text":"This is a perfect seu-bul-jae."}]'),
('국룰', 'gukrul', 'Guk-rul (국룰): The National Rule',
 'The way everyone just does it',
 'Short for "national rule". No one made it official, but everyone follows it. For example: "Chicken with cola is guk-rul."',
 'Used by online gamers in the late 2000s, everyday slang by around 2019',
 'Fine to use anywhere.', null,
 array['National rule','Unwritten rule'],
 '[{"situation":"Picking food on a rainy day","text":"Rainy day means pajeon and makgeolli. Guk-rul."}]'),
('아보하', 'aboha', 'Aboha (아보하): A Very Ordinary Day',
 'Short for "a very ordinary day", valuing a calm normal day',
 'It praises a plain day where nothing bad happened. The book "Trend Korea 2025" named it a key trend. It shows a shift from pushing hard (god-saeng) to wanting a calm daily life.',
 'Introduced as a "Trend Korea 2025" keyword in late 2024',
 'Use it when talking about a calm daily life.', null,
 array['Ordinary day'],
 '[{"situation":"Evening journal","text":"Nothing happened today. A perfect aboha."}]'),
('뇌절', 'noejeol', 'Noe-jeol (뇌절): Overdoing a Joke',
 'Repeating the same joke until it kills the mood',
 'From the Korean saying "only sing the first verse": past verse 1 and 2, you keep going too far. It sounds like a move name in the manga "Naruto", which made it a pun.',
 'Spread in Korean online communities around 2019 as wordplay',
 'Use it to stop a friend''s overused joke.', 'Can sound like a put-down. Keep it for close friends.',
 array['Overdoing it'],
 '[{"situation":"The fifth time the same joke","text":"Stop, that is noe-jeol now."}]'),
('폼-미쳤다', 'form-is-crazy', 'Form Is Crazy (폼 미쳤다)',
 'Praise for someone in amazing shape or skill lately',
 'From the sports word "form", meaning an athlete''s condition. When someone is doing great lately, you say their form is crazy.',
 'Sports fans'' comments on athlete videos, spread into daily talk around 2023',
 'Use it to praise friends.', 'Contains "crazy", so skip it in formal settings.',
 array['On fire'],
 '[{"situation":"A friend wins three in a row","text":"Your form is crazy lately."}]'),
('내-마음속에-저장', 'saved-in-my-heart', 'Saved in My Heart (내 마음속에 저장)',
 'A cute way to say "I am keeping this in my heart"',
 'Made famous in 2017 by Park Ji-hoon, who said it with a wink on the Mnet show "Produce 101 Season 2". People say it when they see a photo or moment they love.',
 '2017 scene from Mnet Produce 101 Season 2',
 'Use it playfully for things you love.', null,
 array['Wink save'],
 '[{"situation":"Seeing a cute puppy photo","text":"Saved in my heart."}]')
) as t(slug, lslug, title, summary, description, origin, usage_note, caution, aliases, usage_examples)
join memes m on m.slug = t.slug
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, usage_note = excluded.usage_note,
  caution = excluded.caution, aliases = excluded.aliases, usage_examples = excluded.usage_examples,
  status = 'reviewed', source_updated_at = excluded.source_updated_at,
  reviewed_at = excluded.reviewed_at, reviewed_by = excluded.reviewed_by;

-- ── 4. 출신 국가 = 한국 (영문 홈은 KR 출신 밈만 보여 준다: lib/meme-translations.ts koreanOriginOnly) ──
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select m.id, 'KR', 'ko-KR', 'origin', m.title, 'reviewed', now(), '00000000-0000-0000-0000-00000000e0e0'
from memes m
where m.slug in ('럭키비키','원영적-사고','중꺾마','너-t야','알잘딱깔센','갓생','추구미','마라탕후루',
  '삐끼삐끼-챌린지','케데헌','스불재','국룰','아보하','뇌절','폼-미쳤다','내-마음속에-저장','무야호','달고나-챌린지')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
