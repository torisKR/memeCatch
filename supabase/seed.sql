-- 로컬 개발 전용 픽스처. `npx supabase db reset` 시 마이그레이션 뒤에 자동 적용된다(config.toml db.seed).
-- 실존 유명 밈을 소재로 삼되 본문은 전부 자체 작성 — 가사·대사 원문 재현 없음.
-- short_id는 gen_short_id() 기본값 대신 고정값(devseed01..12)을 명시해 재실행 시에도 동일한 URL을 보장한다.
-- 전부 moderation_status='approved'로 넣어 memes_public_read RLS(approved/limited 공개)를 그대로 통과한다.
-- category 6종 × 2건, lifecycle_status 4단계 × 3건, safety_level 4등급 × 3건으로 고르게 분배했다.

begin;

insert into memes (
  id, short_id, title, slug, aliases, summary, description, origin,
  usage_context, usage_note, caution,
  safety_level, lifecycle_status, moderation_status, category, media_type,
  difficulty, sentiment, origin_year, trend_score, published_at
) values
-- ── phrase ──────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000001', 'devseed01', '어쩔티비', '어쩔티비',
  array['안물티비','어쩔TV'],
  '물어본 사람 없다는 뜻으로 되받아치는 초등학생발 유행어',
  '질문이나 지적을 받았을 때 "어쩌라고, 그게 뭐 어쨌다는 건데"라는 뜻으로 즉흥적으로 되받아치는 초등학생 사이 유행어. 아무 단어 뒤에나 "티비"를 붙여 라임을 맞추는 형식이 특징이며, 놀이처럼 확장되어 파생 문구도 여럿 등장했다.',
  '2020년대 초 초등학생 온라인 커뮤니티·유튜브 댓글에서 자연발생',
  '{"work":"gray","friends":"green","family":"yellow","sns":"green"}'::jsonb,
  '또래 사이 장난으로는 재미있지만 손윗사람에게 쓰면 무례하게 들릴 수 있다', null,
  'yellow', 'active', 'approved', 'phrase', 'text', 'beginner', 'funny', 2022, 62.5, now()
),
(
  '00000000-0000-0000-0000-000000000002', 'devseed02', '킹받네', '킹받네',
  array['킹받아','킹받는다'],
  '너무 화나고 어이없을 때 쓰는 강조형 신조어',
  '"열받는다"를 강조하려고 접두어 "킹(king)"을 붙인 신조어. 원래는 화가 난다는 뜻이지만 실제로는 어이없이 웃긴 상황에서도 널리 쓰이며, "킹"을 다른 단어 앞에 붙여 강조 접두어로 재활용하는 조어법이 함께 유행했다.',
  '2021년 무렵 트위터·커뮤니티 밈 문화에서 확산',
  '{"work":"red","friends":"green","family":"yellow","sns":"green"}'::jsonb,
  '직장 등 격식 있는 자리에서는 피하는 게 좋다', null,
  'gray', 'cooling', 'approved', 'phrase', 'text', 'beginner', 'funny', 2021, 38.2, now()
),
-- ── dance ───────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000003', 'devseed03', '아무노래 챌린지', '아무노래-챌린지',
  array['Any Song Challenge','지코 챌린지'],
  '가수 지코가 시작한 15초 안무 따라추기 챌린지',
  '2020년 가수 지코가 신곡 발매와 함께 짧은 포인트 안무를 촬영해 올리며 시작된 릴레이 챌린지. 유명인들이 잇따라 참여 영상을 올리면서 짧은 영상 플랫폼에서 크게 유행했고, 이후 여러 신곡 홍보가 비슷한 "포인트 안무 챌린지" 형식을 따라 하게 만든 원조 격 사례로 꼽힌다.',
  '2020년 3월 가수 지코의 신곡 홍보 활동에서 시작',
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '짧고 쉬운 동작 위주라 남녀노소 참여 부담이 적다', null,
  'green', 'archived', 'approved', 'dance', 'video', 'beginner', 'wholesome', 2020, 15.0, now()
),
(
  '00000000-0000-0000-0000-000000000004', 'devseed04', '손하트', '손하트',
  array['핑거하트','finger heart'],
  '엄지와 검지를 겹쳐 작은 하트 모양을 만드는 인사 제스처',
  '엄지와 검지 끝을 살짝 겹쳐 작은 하트 모양을 만드는 손동작으로, 팬미팅이나 사진 촬영에서 애정 표현으로 널리 쓰인다. 두 손가락만으로 표현할 수 있어 배우기 쉽고, 이후 양손 버전이나 팔 전체로 크게 그리는 "풀하트" 변형도 등장했다.',
  '2010년대 중반 K-pop 팬 문화·브이로그 촬영에서 확산',
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  null, null,
  'green', 'rising', 'approved', 'dance', 'image', 'beginner', 'wholesome', 2015, 71.0, now()
),
-- ── song ────────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000005', 'devseed05', '강남스타일', '강남스타일',
  array['Gangnam Style','말춤'],
  '말 타는 동작을 형상화한 안무로 세계적 히트를 기록한 곡',
  '가수 싸이가 2012년 발표한 곡으로, 두 손을 교차해 채찍질하듯 흔들며 말 타는 자세를 흉내 내는 안무("말춤")가 함께 유행했다. 뮤직비디오가 폭발적인 조회수를 기록하며 한국 대중음악이 전 세계적으로 주목받는 계기가 된 대표 사례로 꼽힌다.',
  '2012년 7월 싸이 정규 6집 타이틀곡으로 발매',
  '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb,
  null, null,
  'green', 'archived', 'approved', 'song', 'video', 'normal', 'funny', 2012, 20.0, now()
),
(
  '00000000-0000-0000-0000-000000000006', 'devseed06', 'Never Gonna Give You Up (릭롤)', 'never-gonna-give-you-up',
  array['릭롤','Rickroll','Rick Astley'],
  '엉뚱한 링크인 척 클릭을 유도한 뒤 이 노래로 놀리는 인터넷 장난',
  '관심을 끌 만한 제목의 링크를 눌렀는데 실제로는 릭 애슬리의 1987년 곡 뮤직비디오로 연결되는 인터넷 장난. 예상치 못한 순간에 낚였다는 재미를 주는 형식이라 뉴스 기사, 공식 계정, 심지어 공적 발표 링크에까지 장난스럽게 삽입되며 20년 가까이 명맥을 이어오고 있다.',
  '2007년 인터넷 포럼에서 낚시 링크 장난으로 시작',
  '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb,
  '업무용 메신저나 공지에 몰래 넣으면 상대가 당황할 수 있으니 상황을 봐가며 쓰자', null,
  'yellow', 'active', 'approved', 'song', 'video', 'beginner', 'funny', 2007, 55.0, now()
),
-- ── image ───────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000007', 'devseed07', '무야호', '무야호',
  array['무야홍','무한도전 무야호'],
  '예능 출연자가 무한 반가움을 표현하며 외친 감탄사 장면',
  '예능 프로그램에 출연한 시골 어르신이 반가운 마음에 두 팔을 번쩍 들며 외친 감탄사 장면으로, 방송 당시보다 한참 뒤 온라인 커뮤니티에서 짤방으로 재발굴되며 폭발적으로 퍼졌다. 벅찬 반가움이나 기쁨을 과장되게 표현하고 싶을 때 캡션과 함께 쓰인다.',
  '2010년 예능 프로그램 방송분에서 유래, 2019년 커뮤니티에서 재유행',
  '{"work":"gray","friends":"green","family":"green","sns":"green"}'::jsonb,
  null, null,
  'gray', 'cooling', 'approved', 'image', 'image', 'beginner', 'funny', 2010, 33.0, now()
),
(
  '00000000-0000-0000-0000-000000000008', 'devseed08', '낚싯바늘 밈 (두리번 남친짤)', 'distracted-boyfriend',
  array['두리번 남친짤','고개 돌린 남자친구'],
  '여자친구 옆에서 지나가는 다른 사람을 돌아보는 스톡 사진 밈',
  '여자친구와 걷던 남성이 곁눈질로 지나가는 다른 사람을 쳐다보고, 여자친구는 어이없어하는 3인 구도의 스톡 사진. 인물 세 명에 각각 다른 라벨을 붙여 "기존에 하던 일"과 "새로 눈길 가는 대상"을 비교하는 상황을 풍자하는 만능 비교 템플릿으로 널리 쓰인다.',
  '2015년 촬영된 스톡 사진이 2017년경부터 밈 템플릿으로 확산',
  '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb,
  '비교 대상에 실제 지인을 넣으면 기분 상할 수 있어 주의가 필요하다',
  '특정인을 저격하는 합성에는 쓰지 않는 것이 좋다',
  'yellow', 'rising', 'approved', 'image', 'image', 'normal', 'ironic', 2017, 66.0, now()
),
-- ── comment ─────────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000009', 'devseed09', 'TMI 태그', 'tmi-태그',
  array['투머치인포메이션','TMI'],
  '묻지 않은 개인 정보를 굳이 덧붙일 때 붙이는 셀프 태그',
  '"Too Much Information"의 줄임말로, 굳이 몰라도 되는 사소한 개인 정보를 스스로 밝히면서 댓글이나 게시물 끝에 장난스럽게 붙이는 태그다. 자기소개나 일상 공유 게시물에서 겸연쩍은 디테일을 덧붙일 때 자주 쓰이며, 과한 공유를 스스로 인정하고 웃어넘기는 뉘앙스가 특징이다.',
  '2010년대 후반 SNS 자기소개·일상 공유 게시물 문화에서 확산',
  '{"work":"gray","friends":"green","family":"green","sns":"green"}'::jsonb,
  null, null,
  'gray', 'rising', 'approved', 'comment', 'text', 'beginner', 'funny', 2019, 58.0, now()
),
(
  '00000000-0000-0000-0000-000000000010', 'devseed10', '손민수', '손민수',
  array['민수한다','손민수하다'],
  '동경하는 사람의 스타일을 그대로 따라 한다는 뜻의 신조어',
  '웹툰 캐릭터 이름에서 유래해, 동경하는 사람의 옷차림이나 소지품, 말투까지 그대로 따라 하는 행동을 가리키는 동사로 쓰인다. 댓글창에서 "누가 누구를 손민수했다"는 식으로 특정인을 지목해 저격성으로 쓰이는 경우가 많아, 당사자가 불쾌해하거나 시비로 번지는 사례가 종종 발생한다.',
  '2016년 웹툰 캐릭터명에서 유래해 온라인 댓글 문화로 확산',
  '{"work":"red","friends":"gray","family":"red","sns":"gray"}'::jsonb,
  '동의 없이 실명·계정을 태그해 지목하면 다툼으로 번질 수 있다',
  '실존 인물을 저격하는 방식의 댓글에는 신고·삭제 대상이 될 수 있다',
  'red', 'cooling', 'approved', 'comment', 'text', 'deep', 'negative', 2016, 22.0, now()
),
-- ── challenge ───────────────────────────────────────────
(
  '00000000-0000-0000-0000-000000000011', 'devseed11', '아이스버킷 챌린지', '아이스버킷-챌린지',
  array['Ice Bucket Challenge','얼음물 챌린지'],
  '루게릭병 인식 개선을 위해 얼음물을 뒤집어쓰고 기부·지목을 잇는 챌린지',
  '얼음물이 담긴 양동이를 스스로에게 붓는 영상을 올린 뒤, 다음 참여자 세 명을 지목해 기부나 챌린지 참여를 잇게 하는 릴레이 캠페인. 유명 인사들의 참여 영상이 잇따라 화제가 되며 짧은 기간에 전 세계적으로 확산됐고, 루게릭병 관련 기부금이 크게 늘어난 성공적인 공익 캠페인 사례로 꼽힌다.',
  '2014년 여름 미국에서 루게릭병 협회 기부 캠페인으로 시작',
  '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb,
  '차가운 물을 갑자기 뒤집어쓰는 행위라 심장·호흡기 질환자는 참여를 피해야 한다',
  '실내·전자기기 근처에서 진행하면 안전사고 위험이 있다',
  'red', 'archived', 'approved', 'challenge', 'video', 'normal', 'wholesome', 2014, 12.0, now()
),
(
  '00000000-0000-0000-0000-000000000012', 'devseed12', '달고나 챌린지', '달고나-챌린지',
  array['달고나 뽑기 챌린지','dalgona challenge'],
  '설탕을 녹여 만든 달고나에서 모양을 깨지 않고 오려내는 챌린지',
  '설탕과 베이킹소다를 녹여 얇게 눌러 만든 달고나 위에 별, 우산 같은 모양을 찍고, 그 모양을 깨지 않도록 바늘로 조심스럽게 오려내는 챌린지. 실패하면 과자가 쉽게 부서지기 때문에 성공 영상과 실패 영상이 함께 화제가 되며 요리·챌린지 콘텐츠로 꾸준히 재유행하고 있다.',
  '2020년 온라인 요리 챌린지로 시작, 이후 여러 콘텐츠에서 재조명',
  '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb,
  '뜨거운 설탕물을 다루므로 화상에 주의해야 한다', null,
  'red', 'active', 'approved', 'challenge', 'video', 'normal', 'funny', 2020, 45.0, now()
);

-- ── meme_sources: 4건(카테고리 4종 분산)에 출처 2개씩 ──────
insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status) values
('00000000-0000-0000-0000-000000000001', 'YouTube', 'https://www.youtube.com/watch?v=devseed-eojjeol-01', '초등학생 신조어 총정리 영상', '밈캐치 리서치팀', 'embeddable'),
('00000000-0000-0000-0000-000000000001', 'Web', 'https://blog.example.com/devseed/eojjeoltibi', '요즘 초딩 용어 정리', '언어연구소', 'unknown'),
('00000000-0000-0000-0000-000000000003', 'TikTok', 'https://www.tiktok.com/@devseed/video/any-song-original', '챌린지 원본 안무 영상', '지코(참고용 표기)', 'permission_needed'),
('00000000-0000-0000-0000-000000000003', 'YouTube', 'https://www.youtube.com/watch?v=devseed-anysong-recap', '아무노래 챌린지 모음 하이라이트', '밈캐치 아카이브', 'embeddable'),
('00000000-0000-0000-0000-000000000006', 'YouTube', 'https://www.youtube.com/watch?v=devseed-rickroll-official', 'Never Gonna Give You Up (참고용 표기)', 'Rick Astley(참고용 표기)', 'permission_needed'),
('00000000-0000-0000-0000-000000000006', 'Web', 'https://en.wikipedia.org/wiki/Rickrolling_devseed', '릭롤 문화 정리 문서', '위키 편집자', 'unknown'),
('00000000-0000-0000-0000-000000000011', 'YouTube', 'https://www.youtube.com/watch?v=devseed-icebucket-recap', '아이스버킷 챌린지 모음 영상', '밈캐치 아카이브', 'embeddable'),
('00000000-0000-0000-0000-000000000011', 'Web', 'https://news.example.com/devseed/ice-bucket-challenge', '아이스버킷 챌린지, 기부 문화를 바꾸다', '예시 뉴스 편집국', 'unknown');

-- ── usage_examples: 위와 같은 4건에 대화 예문 부여 ─────────
update memes set usage_examples = '[
  {"situation":"친구가 놀릴 때","text":"야 너 그거 틀렸잖아 ㅋㅋ"},
  {"situation":"장난스러운 되받아치기","text":"어쩔티비 저쩔티비~"}
]'::jsonb where id = '00000000-0000-0000-0000-000000000001';

update memes set usage_examples = '[
  {"situation":"친구랑 놀 때","text":"이거 완전 쉬운데 우리도 같이 찍어볼까?"},
  {"situation":"장기자랑 준비","text":"이번 학교 축제 장기자랑에서 아무노래 챌린지 추면 딱이겠다"}
]'::jsonb where id = '00000000-0000-0000-0000-000000000003';

update memes set usage_examples = '[
  {"situation":"친구에게 링크 보낼 때","text":"이거 대박 특종이야, 꼭 눌러봐 ㅋㅋ"},
  {"situation":"단체 채팅방","text":"공지 링크인 줄 알고 눌렀는데 또 릭롤당했다"}
]'::jsonb where id = '00000000-0000-0000-0000-000000000006';

update memes set usage_examples = '[
  {"situation":"기부 캠페인 소개","text":"이번 주말에 동아리에서 아이스버킷 챌린지 이어가기로 했어, 다음 지목은 너야"},
  {"situation":"안전 안내 멘트","text":"물 뒤집어쓰기 전에 전자기기부터 치우자, 다치지 않게 조심하고"}
]'::jsonb where id = '00000000-0000-0000-0000-000000000011';

commit;
