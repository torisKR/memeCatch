-- 밈캐치 시드 배치 3 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무물보', '무물보', array['무엇이든 물어보세요']::text[], '무엇이든 물어보라는 뜻의 줄임말', '''무엇이든 물어보세요''를 줄인 말로 SNS에서 팔로워들의 질문을 받을 때 흔히 쓰는 해시태그성 표현이다.',
    'SNS 청소년 사용자들 사이에서 질문 이벤트 태그로 확산', 'SNS에서 자유 질문을 받을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼코노', '혼코노', array['혼자 코인노래방']::text[], '혼자 코인노래방에 가는 문화를 뜻함', '''혼자''와 ''코인노래방''을 합친 말로 혼밥·혼술과 같은 맥락에서 혼자 즐기는 문화 트렌드를 가리킨다.',
    '혼밥·혼술 트렌드 확산과 함께 파생된 표현', '혼자만의 시간을 즐기는 문화를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마상', '마상', array['마음의 상처']::text[], '마음의 상처를 뜻하는 줄임말', '''마음의 상처''를 줄인 청소년 신조어로 속상하거나 서운한 감정을 가볍게 표현할 때 쓰인다.',
    '청소년 온라인 은어 목록으로 언론에 소개되며 확산', '서운하거나 속상한 감정을 가볍게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무야호', '무야호', array['무한도전 무야호']::text[], '과거 방송 클립에서 재발굴된 신남·흥분 표현', 'MBC ''무한도전''의 과거 영상 속 정형돈의 감탄사가 2019년 유튜브 알고리즘을 타고 재발굴되며 폭발적인 밈으로 재유행했다.',
    'MBC ''무한도전'' 과거 방영분 클립이 2019년 유튜브에서 재조명', '신나고 흥분되는 순간에 감탄사처럼 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('졌잘싸', '졌잘싸', array['졌지만 잘 싸웠다']::text[], '졌지만 최선을 다해 잘 싸웠다는 뜻', 'e스포츠 등에서 아깝게 패배한 팀·선수를 위로할 때 쓰던 말로 2018년 전후 다양한 분야로 확산됐다.',
    'e스포츠 팬덤에서 패배한 팀을 위로하는 표현으로 등장', '아쉽게 졌지만 노력을 인정하고 위로할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('하삼체(~하삼)', '하삼체(~하삼)', array['하삼체','~하셈','PC통신체']::text[], '어미에 "~하삼"을 붙이는 PC통신식 반말체', '동사 끝에 "-하삼", "-하셈" 등을 붙여 장난스럽게 말하는 화법으로 PC통신 채팅방과 게시판에서 유행했다. 권위적이지 않은 친근한 어투를 연출하는 데 쓰였다.',
    '1990년대 후반 PC통신 채팅 문화', '복고 드립이나 옛날 통신체 패러디에 사용', '과하게 쓰면 옛날 말투로 어색하게 들림',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('글쿤', '글쿤', array['그렇군','글쿤여']::text[], '"그렇군"을 줄인 PC통신식 축약 어미', '상대 말에 짧게 동조할 때 쓰던 축약형 표현으로 PC통신 대화창에서 타이핑을 줄이기 위해 널리 쓰였다.',
    '1990년대 PC통신 채팅 축약어 문화', '복고체 드립에 사용', '지금은 거의 사어',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('눈팅', '눈팅', array['눈팅족','뉴팅']::text[], '글은 안 쓰고 구경만 하는 행위', '게시판이나 채팅방에서 글을 쓰지 않고 읽기만 하는 이용자·행위를 가리키는 말로 PC통신 시절부터 지금까지 쓰이는 대표적 인터넷 용어다.',
    '1990년대 PC통신 게시판 이용자 문화', '커뮤니티에서 활동 유형을 설명할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('강퇴', '강퇴', array['강제퇴장','강퇴각']::text[], '채팅방·모임에서 강제로 내쫓기는 것', '운영자가 문제를 일으킨 이용자를 채팅방이나 동호회에서 강제로 퇴장시키는 것을 뜻하며 PC통신 채팅 문화에서 비롯돼 지금도 쓰인다.',
    '1990년대 PC통신·채팅방 운영 문화', '지금도 온라인 커뮤니티에서 일상적으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('도배', '도배', array['게시판 도배']::text[], '같은 글이나 댓글을 반복해서 올리는 행위', '게시판에 동일하거나 의미 없는 글을 연속으로 올려 화면을 채우는 행위를 가리키며, 벽지를 바르듯 화면을 채운다는 뜻에서 유래했다.',
    '1990년대 PC통신·초기 웹 게시판 문화', '스팸성 반복 게시물을 지적할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잠수타다', '잠수타다', array['잠수','잠수탐']::text[], '온라인에서 연락 없이 조용히 사라지는 것', '채팅이나 모임에서 갑자기 대답이 없어지거나 활동을 멈추는 상태를 물속에 잠수한 것에 비유한 표현으로 PC통신 시절부터 널리 쓰였다.',
    '1990년대 PC통신 채팅 문화', '연락 두절 상태를 가볍게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('번개(번개모임)', '번개(번개모임)', array['번개팅','정모번개']::text[], '즉흥적으로 잡힌 온라인 동호회 오프라인 모임', 'PC통신 동호회 회원들이 갑작스럽게 제안해 성사시키는 오프라인 모임을 번개가 치듯 빠르다는 뜻에서 번개라 불렀다. 이후 정모와 함께 통신 동호회 문화의 상징이 됐다.',
    '1990년대 PC통신 동호회 오프라인 모임 문화', '즉흥 모임을 제안할 때 지금도 쓰이는 표현', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정모', '정모', array['정기모임']::text[], '온라인 동호회의 정기적인 오프라인 모임', 'PC통신 동호회들이 정기적으로 여는 오프라인 모임을 줄여 부른 말로, 회원 간 친목을 다지는 핵심 행사였다.',
    '1990년대 PC통신 동호회 문화', '동호회·모임 문화를 설명할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폐인(스타크래프트 폐인)', '폐인(스타크래프트-폐인)', array['스타 폐인','겜폐인']::text[], '게임에 과몰입해 일상을 놓은 사람을 자조적으로 부르는 말', '1998년 스타크래프트 출시 이후 PC방에서 밤새 게임만 하는 사람들을 가리키던 말에서 시작해 이후 특정 취미에 극단적으로 몰입한 사람을 가리키는 유행어로 확장됐다.',
    '1990년대 말 스타크래프트 PC방 문화', '스스로를 자조적으로 표현할 때 무난', '타인에게 쓰면 게임중독 낙인처럼 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1999, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('버로우(타다)', '버로우(타다)', array['버로우']::text[], '숨거나 몸을 사린다는 뜻의 스타크래프트 유래 은어', '스타크래프트의 저글링 매복 능력 "버로우(burrow)"에서 따와, 사람이 나서지 않고 조용히 숨어 있는 상황을 가리키는 은어로 퍼졌다.',
    '1998년 스타크래프트 게임 용어에서 파생된 온라인 은어', '몸을 사리는 상황을 가볍게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('GG(지지치다)', 'GG(지지치다)', array['지지','굿게임']::text[], '게임에서 패배를 인정할 때 치는 인사말', '"Good Game"의 약자로 스타크래프트를 통해 한국에 대중화됐으며, 이후 승부가 끝났거나 포기 상황을 가리키는 표현으로 일상어에도 스며들었다.',
    '1998년 스타크래프트 게임 매너 문화', '승부가 끝났음을 인정할 때 지금도 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마시마로(엽기토끼)', '마시마로(엽기토끼)', array['엽기토끼','마시마로 숲 이야기']::text[], '2000년 유행한 엉뚱하고 잔인한 토끼 플래시 캐릭터', '김재인 작가가 만든 플래시 애니메이션 "마시마로 숲 이야기"의 주인공으로, 순진한 외모와 달리 엽기적인 행동을 하는 반전 매력으로 폭발적 인기를 끌었다. 한국 캐릭터 최초로 해외 상품화에 성공했다.',
    '2000년 김재인 작가의 플래시 애니메이션', '2000년대 초 엽기 열풍 캐릭터로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%A7%88%EC%8B%9C%EB%A7%88%EB%A1%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기(엽기트렌드)', '엽기(엽기트렌드)', array['엽기적이다','엽기코드']::text[], '기괴하고 황당한 것을 가리키는 2000년대 초 최대 유행어', '원래 범죄 관련 용어였던 "엽기"가 마시마로 등 캐릭터의 인기와 맞물려 "황당하고 재미있다"는 뜻의 긍정적 유행어로 의미가 바뀌어 대유행했다.',
    '2000년 마시마로 등 캐릭터 유행과 함께 확산', '2000년대 초 인터넷 유행을 설명할 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('몸짱', '몸짱', array['몸짱신드롬','몸짱아줌마']::text[], '탄탄한 몸매를 가꾼 사람을 가리키는 신조어', '2003년 딴지일보에 다이어트 체험기를 연재해 화제가 된 정다연이 "몸짱아줌마"로 불리며 2004년 전국적 "몸짱 신드롬"을 일으켰고, 이때 몸짱이라는 말이 신조어로 자리잡았다.',
    '2003~2004년 정다연의 다이어트 체험기 화제', '2000년대 초 다이어트 신드롬 이야기할 때 인용', '외모지상주의 관련 민감할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2004, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A0%95%EB%8B%A4%EC%97%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고마해라 마이 묵었다 아이가', '고마해라-마이-묵었다-아이가', array['고마해라']::text[], '영화 <친구>(2001)의 대표 대사', '조폭 간 다툼 장면에서 나온 사투리 대사로, 특유의 리듬감 있는 어조 때문에 개그 패러디물에서 자주 쓰였다.',
    '2001년 영화 <친구>', '패러디·성대모사 소재로 지금도 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('느그 아부지 뭐하시노', '느그-아부지-뭐하시노', array['뭐하시노']::text[], '영화 <친구>(2001)의 대표 대사', '학창 시절 회상 장면에서 나온 대사로, 이후 아버지 직업을 묻는 상황의 클리셰 패러디 대사로 굳어졌다.',
    '2001년 영화 <친구>', '패러디 대사로 지금도 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여러분 부자되세요', '여러분-부자되세요', array['부자되세요']::text[], '2001년 BC카드 광고의 인사말 카피', '배우 김정은이 출연한 BC카드 광고에서 설원을 돌며 외친 인사말로, IMF 이후 분위기와 맞물려 새해 인사말처럼 널리 쓰였다.',
    '2001년 BC카드 TV광고', '연말연시 인사말로 지금도 쓰이는 카피', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.hankyung.com/news/article/2002022563491', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('산소 같은 여자', '산소-같은-여자', '{}', '마몽드 화장품 광고의 카피 문구', '배우 이영애가 출연한 마몽드 화장품 광고에서 쓰인 카피로, 청순한 이미지를 표현하는 관용구처럼 오래 회자됐다.',
    '2000년경 마몽드(태평양) TV광고', '청순한 이미지를 비유할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미니홈피', '미니홈피', array['미니홈']::text[], '싸이월드의 개인 홈페이지 서비스', '2001년 싸이월드가 선보인 개인형 홈페이지 서비스로, 미니미·미니룸과 함께 2000년대 초중반 한국 SNS 문화를 대표했다.',
    '2001년 싸이월드', 'SNS 원조 격 서비스로 회상할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/%EC%8B%B8%EC%9D%B4%EC%9B%94%EB%93%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아이러브스쿨 신드롬', '아이러브스쿨-신드롬', array['아이러브스쿨']::text[], '1999년 동창찾기 열풍을 일으킨 서비스', '1999년 등장한 동창 찾기 사이트로, 잊고 지낸 초중고 동창을 찾는 열풍을 일으키며 초기 한국 인터넷 커뮤니티의 대표 신드롬이 됐다.',
    '1999년 동창찾기 서비스 아이러브스쿨', '초기 한국 인터넷 서비스 붐을 이야기할 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허걱', '허걱', array['헉']::text[], '놀랐을 때 내는 감탄사 유행어', '놀라거나 당황했을 때 내뱉는 의성어로, PC통신·초기 채팅 문화에서 감정 표현을 과장하는 말투로 유행했다.',
    '1990년대 말 PC통신·채팅 감탄사 문화', '복고풍 감탄사로 인용 가능', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허무개그', '허무개그', '{}', '맥없이 끝나는 반전 없는 개그 유형', '그럴듯하게 시작했다가 아무 의미 없이 끝나버리는 개그 형식으로, 1990년대 말 TV 코미디와 유머 게시판에서 하나의 장르로 유행했다.',
    '1990년대 말 TV 코미디·유머 게시판 문화', '허탈한 유머 형식을 설명할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('썰렁개그', '썰렁개그', array['썰렁유머']::text[], '재미없어서 오히려 분위기가 썰렁해지는 개그', '너무 시시하거나 오래된 말장난이라 듣는 사람을 썰렁하게 만드는 유머를 가리키며, PC통신 유머 게시판을 통해 굳어진 표현이다.',
    '1990년대 PC통신 유머 게시판 문화', '일부러 재미없는 드립을 던질 때 자기소개용으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼행시 짓기', '삼행시-짓기', array['삼행시','N행시']::text[], '이름이나 단어로 즉석 삼행시를 짓는 놀이', '상대가 제시한 단어의 각 글자로 시작하는 문장을 즉석에서 지어 웃음을 유발하는 게시판·채팅 놀이로, PC통신 시절부터 지금까지 이어지는 참여형 콘텐츠다.',
    '1990년대 PC통신 게시판 놀이문화', '지금도 이벤트·아이스브레이킹 놀이로 널리 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('TTL세대', 'TTL세대', array['지금 나는 나로 살고 있는가']::text[], 'SK텔레콤 TTL 브랜드의 신세대 마케팅 카피', '1999년 SK텔레콤이 20대 전용 브랜드 TTL을 내놓으며 배우 임은경을 앞세워 "지금 나는 나로 살고 있는가"라는 카피로 신세대 감성 마케팅 붐을 일으켰다.',
    '1999년 SK텔레콤 TTL 브랜드 광고', '1990년대 말 신세대 마케팅 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기적인 그녀(원작 연재소설)', '엽기적인-그녀(원작-연재소설)', array['엽기적인 그녀 원작']::text[], '훗날 영화화된 PC통신·인터넷 연재소설', '작가 김호식이 자신의 연애 경험을 바탕으로 PC통신·인터넷 게시판에 연재한 소설로, 2001년 동명 영화로 만들어지며 원작 연재물도 재조명받았다.',
    '1990년대 말 PC통신·인터넷 게시판 연재소설', '인터넷 연재소설 붐 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당', '봉숭아학당', '{}', '개그콘서트의 오랜 인기 옴니버스 코너', '1999년 개그콘서트 출범과 함께 시작된 옴니버스 코너로, 다양한 캐릭터 콩트가 이어지며 수많은 유행어를 배출한 한국 코미디의 상징적 코너다.',
    '1999년 KBS 개그콘서트', '개그콘서트 초창기 역사를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('행운의 편지', '행운의-편지', array['행운의 이메일']::text[], '돌리지 않으면 불행이 온다는 연쇄 편지', '정해진 사람 수에게 편지를 옮기지 않으면 불운이 닥친다는 내용의 연쇄 메시지로, PC통신 쪽지와 초기 이메일을 통해 크게 유행했다.',
    '1990년대 PC통신·이메일 연쇄 메시지 문화', '옛 인터넷 문화의 사례로 회상할 때 인용', '협박성 문구가 불안감을 줄 수 있어 진지하게 받아들이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 1997, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무개념', '무개념', array['개념없다']::text[], '상식이나 배려가 없는 행동을 가리키는 은어', '상황에 맞지 않게 눈치 없거나 배려 없는 언행을 한 사람을 가리켜 "개념이 없다"고 비판하던 데서 나온 말로, 2000년대 초 온라인 커뮤니티에서 대중화됐다.',
    '2000년대 초 온라인 커뮤니티 비판 문화', '무례한 행동을 지적할 때 사용', '특정인을 향해 쓰면 인신공격으로 번질 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2003, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지대', '지대', array['지대 멋지다']::text[], '"매우, 완전"이라는 뜻의 1990년대 학생 은어', '"정말, 매우"라는 뜻으로 쓰인 청소년 은어로, "지대 멋지다", "지대 웃기다"처럼 형용사를 강조할 때 쓰였다.',
    '1990년대 후반 청소년 은어', '복고 말투 드립으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('캡짱', '캡짱', array['캡','짱']::text[], '최고라는 뜻의 1990년대 학생 은어', '"캡"과 "짱"을 합쳐 무언가 아주 뛰어나다는 뜻으로 쓰인 학생 유행어로, 1990년대 후반 교실과 PC통신에서 널리 쓰였다.',
    '1990년대 청소년 유행어', '복고 말투로 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('초딩', '초딩', array['초등학생']::text[], '초등학생을 가리키는 줄임말이자 미숙함을 비꼬는 표현', '초등학생의 줄임말로 시작했지만, 온라인 커뮤니티에서 미숙하거나 유치한 행동을 하는 사람을 낮잡아 부르는 말로도 함께 쓰였다.',
    '2000년대 초 온라인 커뮤니티 은어', '나이대를 가리킬 때는 무난하나 비하 의도 주의', '상대를 낮잡아 부르는 의도로 쓰면 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'negative'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뻘짓', '뻘짓', array['뻘글','뻘쭘']::text[], '쓸데없거나 엉뚱한 행동을 가리키는 은어', '갯벌의 "뻘"에서 따온 말로 추정되며, 의미 없거나 헛된 행동·글을 가리키는 표현으로 2000년대 초 온라인 게시판에서 유행했다.',
    '2000년대 초 온라인 게시판 은어', '자신의 엉뚱한 행동을 가볍게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('퇴마록 신드롬', '퇴마록-신드롬', array['퇴마록']::text[], 'PC통신 연재로 시작해 밀리언셀러가 된 판타지 소설 열풍', '작가 이우혁이 PC통신에 연재한 판타지 소설 <퇴마록>이 1990년대 중반 책으로 출간되며 한국 판타지 소설 붐을 이끈 대표 사례가 됐다.',
    '1993~1994년 PC통신 연재 후 1995년경 출간 열풍', 'PC통신 연재소설 붐 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왕따', '왕따', array['집단따돌림']::text[], '집단에서 따돌림당하는 사람이나 현상을 가리키는 신조어', '1990년대 중후반 학교 폭력·집단 따돌림이 사회 문제로 떠오르며 널리 퍼진 말로, 이후 방송·신문에서도 공식 용어처럼 쓰이게 됐다.',
    '1990년대 중후반 학교 폭력 사회문제 보도', '사회현상을 설명하는 용어로만 신중히 사용', '사람을 낙인찍거나 놀리는 말로 쓰면 실제 괴롭힘을 조장할 수 있어 사용 자제',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'negative'::meme_sentiment, 1997, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오렌지족', '오렌지족', '{}', '1990년대 강남 부유층 자제의 소비문화를 가리키던 말', '부모의 돈으로 외제차를 몰고 다니며 유흥을 즐기던 부유층 자제를 가리키던 말로, 1990년대 중반 언론을 통해 사회 현상어로 크게 회자됐다.',
    '1990년대 중반 언론 보도로 확산된 세대·계층 은어', '1990년대 소비문화 현상을 설명할 때 인용', '특정 세대·계층을 싸잡아 비하하는 뉘앙스가 있어 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 1995, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야타족', '야타족', '{}', '외제차로 헌팅하던 1990년대 유흥 문화를 가리키던 말', '"타" 하며 차에 태워 데이트 상대를 꾀던 데서 이름 붙은 말로, 오렌지족과 함께 1990년대 중반 부유층 유흥 문화를 상징하는 신조어로 언론에 자주 등장했다.',
    '1990년대 중반 언론 보도로 확산된 세대·계층 은어', '1990년대 사회현상을 설명할 때 인용', '특정 집단을 희화화하는 뉘앙스가 있어 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 1995, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('노스트라다무스 종말론 소동', '노스트라다무스-종말론-소동', array['1999년 종말론','지구멸망설']::text[], '1999년 지구가 멸망한다던 예언 소동', '프랑스 예언가 노스트라다무스가 예언했다는 "1999년 7월 지구 멸망설"이 언론과 방송을 통해 확산되며 한국에서도 큰 화제와 패러디를 낳았다.',
    '1999년 노스트라다무스 예언을 둘러싼 언론 보도', '세기말 해프닝을 회상할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Y2K 밀레니엄버그 소동', 'Y2K-밀레니엄버그-소동', array['Y2K','밀레니엄버그','2000년 문제']::text[], '2000년이 되면 컴퓨터가 오작동한다던 세기말 소동', '컴퓨터 날짜 표기 오류로 2000년 1월 1일 전산망이 마비될 수 있다는 우려가 확산돼 전 세계적으로 대규모 대비가 이뤄진 사건으로, 한국에서도 세기말 불안 심리와 맞물려 크게 회자됐다.',
    '1999년 말 전 세계적 Y2K 대비 열풍', '세기말 해프닝을 회상할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('따봉', '따봉', array['따봉!','델몬트 따봉']::text[], '델몬트 주스 광고에서 나온 ''최고야'' 뜻의 감탄사', '1989~1990년 델몬트 오렌지주스 TV광고에서 브라질 농장 인부가 좋은 오렌지를 발견할 때마다 엄지를 치켜세우며 포르투갈어 ''따봉(Tá bom, 좋다)''을 외치는 장면이 방영되며 전국적 유행어가 됐다. 시험 합격, 서류 통과, 맛있는 음식 등 온갖 상황의 감탄사로 쓰였고 경찰 음주단속 통과 표현으로도 쓰일 만큼 파급력이 컸다.',
    '델몬트 오렌지주스 TV 광고(1989~1990, 롯데칠성)', '복고 감성으로 무언가 최고라고 칭찬할 때 엄지를 세우며 사용', '지금 세대에는 낯설어 설명이 필요할 수 있음',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1990, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=xiSn7k0yXE0', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'xiSn7k0yXE0', 'https://www.youtube.com/watch?v=xiSn7k0yXE0', true from memes where slug = '따봉'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('몰래카메라', '몰래카메라', array['이경규 몰카']::text[], '이경규가 진행한 일밤의 깜짝 몰래카메라 예능 코너', '1991년 4월 MBC ''일요일 일요일 밤에''의 코너로 시작해 유명인을 놀라게 하는 몰래카메라 포맷 자체를 국민적 유행어로 만들었다. 이경규의 능청스러운 진행과 공개 멘트는 이후 각종 예능에서 재생산되는 상징적 문구가 됐다.',
    'MBC ''일요일 일요일 밤에'' 코너(1991.4~1992.11), 진행 이경규', '깜짝 이벤트를 공개할 때 관용구처럼 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1991, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AA%B0%EB%9E%98%EC%B9%B4%EB%A9%94%EB%9D%BC(%EC%9D%BC%EB%B0%A4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그래, 결심했어!', '그래,-결심했어!', array['TV 인생극장','이휘재 인생극장']::text[], '선택의 순간마다 외치던 인생극장의 대표 유행어', '1993년부터 MBC ''일요일 일요일 밤에''의 코너 ''TV 인생극장''에서 이휘재가 두 갈래 선택지 앞에 서서 정면을 보고 외친 대사. 도덕적 선택은 해피엔딩, 비도덕적 선택은 파국으로 그려지는 포맷과 함께 지금도 결정의 순간마다 패러디로 인용된다.',
    'MBC ''일요일 일요일 밤에-TV 인생극장''(1993~1995), 이휘재', '중요한 결정을 내리는 순간 장난스럽게 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/TV%EC%9D%B8%EC%83%9D%EA%B7%B9%EC%9E%A5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('난 알아요 & 회오리춤', '난-알아요-&-회오리춤', array['서태지와 아이들 데뷔 무대','회오리 춤']::text[], '서태지와 아이들의 데뷔곡과 파격적인 춤이 일으킨 문화 충격', '1992년 4월 데뷔 무대에서 서태지와 아이들이 선보인 ''난 알아요''와 회오리춤은 방송 직후 가요계를 뒤집어놓은 파격적 사건으로 회자된다. 이후 학생들 장기자랑의 단골 소재가 됐고, 지금도 90년대 세대교체를 상징하는 문화 아이콘으로 유튜브에서 자주 소환된다.',
    '서태지와 아이들 1집 타이틀곡, MBC 특종 TV연예 데뷔(1992.4.11)', '90년대 문화 충격·세대교체를 설명할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1992, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%84%9C%ED%83%9C%EC%A7%80%EC%99%80%20%EC%95%84%EC%9D%B4%EB%93%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('서태지와 아이들 은퇴 선언', '서태지와-아이들-은퇴-선언', array['서태지 은퇴','평범한 청년으로 돌아가겠다']::text[], '최정상 그룹의 전격 은퇴 기자회견이 일으킨 사회적 충격', '1996년 1월 서태지와 아이들이 기자회견을 열고 돌연 은퇴를 선언한 사건으로, 지상파 뉴스에도 비중 있게 다뤄질 만큼 큰 파장을 일으켰다. 팬들의 충격적 반응 보도까지 이어지며 90년대 최대의 연예계 뉴스 중 하나로 꼽힌다.',
    '서태지와 아이들 공식 은퇴 기자회견(1996.1)', '충격적 은퇴·해체 뉴스를 설명할 때 역사적 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'controversial'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대발이 아버지', '대발이-아버지', array['사랑이 뭐길래 이순재']::text[], '드라마 ''사랑이 뭐길래''에서 이순재가 맡은 가부장적 아버지 캐릭터의 별칭', '1991~1992년 방영된 MBC 주말극 ''사랑이 뭐길래''에서 이순재가 연기한 이병호 역이 폭발적 인기를 끌며 ''대발이 아버지''라는 별칭으로 불렸다. 완고하지만 정 많은 아버지상으로 당시 최고 시청률을 견인했다.',
    'MBC 주말연속극 ''사랑이 뭐길래'', 이순재 분(1991~1992)', '완고한 가부장 캐릭터를 유머러스하게 지칭할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1991, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미달이', '미달이', array['박미달','순풍산부인과 미달이']::text[], '시트콤 ''순풍산부인과''의 말괄량이 딸 캐릭터', '1998년 SBS 시트콤 ''순풍산부인과''에서 아역배우 김성은이 연기한 딸 ''미달이''는 당돌하고 엉뚱한 캐릭터로 전 국민적 인기를 끌었다. 억울함을 호소하며 오열하는 장면들이 훗날 인터넷에서 반응짤로 폭발적으로 재소비됐다.',
    'SBS 시트콤 ''순풍산부인과''(1998~2000), 김성은 분', '억울하거나 과장된 감정을 표현할 때 리액션 짤로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%88%9C%ED%92%8D%EC%82%B0%EB%B6%80%EC%9D%B8%EA%B3%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야, 타!', '야,-타!', array['야타족']::text[], '부모 차로 길거리 헌팅을 하던 90년대 초 청년 문화를 부르던 말', '부모가 사준 고급 승용차를 몰고 다니며 여성에게 "야, 타!"라고 말을 걸던 1990년대 초 청년들의 행태를 가리키는 말로, 당시 뉴스와 다큐멘터리에 자주 등장했다. 오렌지족과 함께 90년대 소비문화 풍자의 대표 사례로 꼽힌다.',
    '1990년대 초 사회현상, 방송 뉴스·다큐 보도', '90년대 과시적 소비문화를 풍자할 때 인용', '특정 계층을 조롱하는 뉘앙스가 있어 대상에 따라 불쾌할 수 있다',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 1992, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('꿍따리 샤바라', '꿍따리-샤바라', array['쿵따리 샤바라','클론 꿍따리샤바라']::text[], '클론을 스타덤에 올린 후렴구 중독성 강한 댄스곡', '1996년 발매된 클론 1집 ''Are You Ready?''의 타이틀곡으로 ''꿍따리 샤바라''가 정식 표기이나 ''쿵따리 샤바라''로 더 널리 불린다. 신인이던 클론을 그해 SBS 가요대상 등에서 수상하게 만든 곡으로, 특유의 후렴구와 안무가 지금도 회식·레트로 콘텐츠 단골 소재다.',
    '클론 1집 ''Are You Ready?'' 타이틀곡(1996.5)', '흥겨운 후렴구나 중독성 있는 후크송을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%BF%8D%EB%94%B0%EB%A6%AC%20%EC%83%A4%EB%B0%94%EB%9D%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('3!4!', '3!4!', array['룰라 3!4!','하나 둘 셋 넷']::text[], '룰라의 재기 히트곡, 카운트다운 구호가 유행', '1996년 9월 발매된 룰라 4집 수록곡으로, 노래 시작 전 외치는 ''하나 둘 셋 넷'' 구호가 공연 전 카운트다운 관용구처럼 널리 쓰이게 됐다. 이 곡으로 룰라는 그해 TV가요 20에서 3주 연속 1위를 차지하며 다시 정상급 인기 그룹으로 발돋움했다.',
    '룰라 4집 수록곡(1996.9)', '무언가 시작하기 전 흥겨운 카운트다운으로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/3!4!', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('말하지 않아도 알아요', '말하지-않아도-알아요', array['초코파이 정 CM송']::text[], '초코파이 정을 상징하는 국민 CM송', '1989년 제작돼 1990년대 내내 초코파이 광고에 쓰인 CM송으로, 정(情)이라는 정서를 노래한 짧은 후렴구가 세대를 넘어 각인됐다. 이후 다양한 버전으로 편곡되며 지금까지도 브랜드 징글로 쓰인다.',
    '오리온 초코파이 정 TV 광고 CM송(1989~1990년대)', '정(情)이나 따뜻한 마음을 표현할 때 흥얼거리듯 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1990, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('2% 부족할 때', '2%-부족할-때', array['2%부족할때','사랑은 언제나 목마르다']::text[], '1999년 출시된 음료 광고의 대표 카피', '롯데칠성음료가 1999년 출시한 음료 ''2% 부족할때''의 광고 시리즈는 남녀 간의 애틋한 감정을 음료에 빗댄 영화 같은 광고로 큰 화제를 모았다. 이후 2000년대까지 이어지는 장기 시리즈로 발전하며 국민 카피로 자리잡았다.',
    '롯데칠성음료 ''2% 부족할때'' TV 광고(1999~)', '아쉬운 듯 애틋한 감정을 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오박사네 사람들', '오박사네-사람들', array['한국 최초 시트콤']::text[], '한국 방송 최초로 시트콤이라는 장르를 유행시킨 프로그램', '1993년 2월부터 10월까지 SBS에서 방영된 ''오박사네 사람들''은 국내 최초의 시트콤으로, 최고 시청률 36.6%를 기록하며 이후 ''LA 아리랑'', ''순풍산부인과'' 등 90년대 시트콤 붐을 여는 계기가 됐다.',
    'SBS 시트콤 ''오박사네 사람들''(1993.2~10)', '한국 시트콤 역사를 소개할 때 원조 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%98%A4%EB%B0%95%EC%82%AC%EB%84%A4%20%EC%82%AC%EB%9E%8C%EB%93%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('H.O.T. 데뷔 신드롬', 'H.O.T.-데뷔-신드롬', array['클럽 에쵸티','흰 풍선']::text[], '국내 최초 기획형 아이돌 H.O.T.의 데뷔가 만든 팬덤 문화의 시작', '1996년 9월 SM엔터테인먼트가 데뷔시킨 H.O.T.는 흰색 풍선을 든 팬클럽 ''클럽 에쵸티''와 함께 1세대 아이돌 팬덤 문화를 만들어냈다. 이후 젝스키스와의 라이벌 구도는 90년대 후반 가요계를 상징하는 현상이 됐다.',
    'SM엔터테인먼트 H.O.T. 데뷔(1996.9)', '1세대 아이돌 팬덤 문화의 시작을 설명할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('젝스키스 데뷔', '젝스키스-데뷔', array['옐로우키스']::text[], 'H.O.T.의 라이벌로 데뷔한 젝스키스와 팬덤 대립의 시작', '1997년 4월 대성기획(현 DSP미디어)이 데뷔시킨 젝스키스는 노란 풍선을 든 팬클럽 ''옐로우키스''와 함께 H.O.T.와 양대 산맥을 이루며 90년대 후반 아이돌 팬덤 문화를 상징하는 그룹이 됐다.',
    '대성기획 젝스키스 데뷔(1997.4)', '1세대 아이돌 라이벌 구도를 설명할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어머님께', '어머님께', array['god 어머님께']::text[], 'IMF 시기 대중의 마음을 울린 god의 데뷔곡', '1999년 데뷔한 god가 부른 ''어머님께''는 연습생 시절의 궁핍한 일화를 담은 가사와 IMF 경제위기라는 시대적 배경이 맞물려 큰 공감을 얻었다. 지금도 효(孝)를 이야기할 때 자주 소환되는 90년대 말 대표곡이다.',
    'god 1집 타이틀곡(1999)', '부모님께 감사를 전하거나 IMF 시절 향수를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('김국진 여보세요~', '김국진-여보세요~', array['오마이갓','나 소화 다 됐어요']::text[], '1990년대 중후반 최고 인기 개그맨 김국진의 대표 유행어들', '1991년 KBS 공채 개그맨으로 데뷔한 김국진은 특유의 혀 짧은 발음을 살린 "여보세요", "오마이갓", "나 소화 다 됐어요~" 등의 유행어를 남기며 1996년, 1998년 MBC 코미디대상을 수상했다.',
    '김국진(코미디언), 1990년대 KBS·MBC 코미디 프로그램', '어리숙하고 엉뚱한 리액션을 흉내낼 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B9%80%EA%B5%AD%EC%A7%84/%ED%99%9C%EB%8F%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('양심냉장고', '양심냉장고', array['숨은 양심을 찾아서','정지선 지키기']::text[], '새벽 정지선 지킨 시민에게 냉장고를 준 감동 예능', '1996년 MBC ''이경규가 간다-숨은 양심을 찾아서''에서 인적 드문 새벽에도 정지선을 지킨 장애인 운전자에게 냉장고를 선물한 회차가 전국적 화제가 되며 방송사상 이례적으로 이튿날 재방영됐다. 시민의식과 정직을 상징하는 밈으로 지금도 회자된다.',
    'MBC ''일요일 일요일 밤에-이경규가 간다''(1996)', '정직·시민의식을 이야기할 때 비유로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%96%91%EC%8B%AC%EB%83%89%EC%9E%A5%EA%B3%A0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나 지금 떨고 있니', '나-지금-떨고-있니', array['모래시계 명대사','떨고 있니']::text[], '드라마 모래시계 사형장 장면의 최민수 대사', '1995년 SBS 드라마 ''모래시계'' 마지막회에서 사형을 앞둔 박태수(최민수)가 친구인 검사에게 남긴 대사 ''나…떨고 있냐? 그게 겁나''가 널리 ''나 지금 떨고 있니?''로 회자되며 명대사이자 밈으로 굳어졌다. 당시 순간 시청률 74.4%를 기록한 전설적 장면이다.',
    'SBS 드라마 ''모래시계'' 24화(1995)', '긴장되는 상황을 과장해서 표현할 때 패러디로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AA%A8%EB%9E%98%EC%8B%9C%EA%B3%84(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내가 아직도 네 친구로 보이니?', '내가-아직도-네-친구로-보이니?', array['여고괴담 대사','여고괴담 점프컷']::text[], '공포영화 ''여고괴담''이 남긴 대표 대사이자 점프컷 연출', '1998년 개봉한 한국 대표 학원공포영화 ''여고괴담''에서 귀신이 된 진주가 은영에게 건네는 대사로, 영화 홍보 문구로도 쓰이며 개봉 당시 학생들 사이에서 유행어처럼 번졌다. 영화 말미의 점프컷 연출도 이후 한국 영화·방송 공포 연출의 대명사로 자주 패러디됐다.',
    '영화 ''여고괴담''(1998)', '관계 단절이나 서늘한 반전을 장난스럽게 표현할 때 인용', '친구 관계를 위협적으로 언급하는 대사라 진지한 갈등 상황에서는 쓰지 않는 것이 좋다',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1998, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%97%AC%EA%B3%A0%EA%B4%B4%EB%8B%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('줄을 서시오', '줄을-서시오', array['허준 임현식']::text[], '드라마 ''허준''에서 임현식이 남긴 애드리브 명대사', '1999년 방영을 시작한 MBC 사극 ''허준''에서 임오근 역의 임현식이 몰려드는 환자들을 정리하며 외친 애드리브 대사로, 최고 시청률 60%대를 기록한 국민 드라마의 명장면으로 지금도 패러디에 쓰인다.',
    'MBC 드라마 ''허준''(1999~2000), 임현식 분', '순서나 대기를 재촉하는 상황을 사극 톤으로 패러디할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%97%88%EC%A4%80(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('DJ DOC 여름이야기', 'DJ-DOC-여름이야기', array['여름이야기']::text[], '매년 여름마다 소환되는 DJ DOC의 1996년 시즌송', '전작 ''겨울 이야기''(1996.1)의 성공에 이어 1996년 발표된 DJ DOC의 시즌송으로, 친숙한 후렴구와 신나는 멜로디로 오랫동안 여름 국민가요로 자리잡았다.',
    'DJ DOC 시즌송(1996)', '여름철 추억 소환 콘텐츠에 배경음악으로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%97%AC%EB%A6%84%EC%9D%B4%EC%95%BC%EA%B8%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짜장면 시키신 분', '짜장면-시키신-분', array['김국진 이창명 광고']::text[], '어디서든 짜장면을 배달해주는 이동통신 광고의 유행어', '1997년 신세기통신 017 광고에서 김국진이 마라도·비행기 등 어디서든 짜장면을 시키면 이창명이 배달원으로 나타나 "짜장면 시키신 분~"을 외치는 장면이 큰 화제를 모았다. 실제로 마라도에 중국집이 생기는 계기가 되기도 했다.',
    '신세기통신 017 이동전화 TV 광고, 김국진·이창명(1997)', '어디서든 원하는 게 뚝딱 나타나는 상황을 장난스럽게 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=09VUoE_RoME', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', '09VUoE_RoME', 'https://www.youtube.com/watch?v=09VUoE_RoME', true from memes where slug = '짜장면-시키신-분'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('물맛이 좋아야 맥주맛도 좋다', '물맛이-좋아야-맥주맛도-좋다', array['하이트맥주 광고카피']::text[], '하이트맥주를 업계 1위로 올려놓은 90년대 광고 카피', '1993년 출시된 하이트맥주가 천연암반수를 앞세워 ''맥주의 90%는 물''이라는 콘셉트로 내세운 광고 카피로, 논쟁적 마케팅과 함께 1996년 오비맥주를 제치고 시장 점유율 1위에 오르는 성과로 이어졌다.',
    '하이트맥주(舊 조선맥주) TV 광고(1993~1994)', '90년대 광고 카피전을 소개할 때 사례로 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1993, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%95%98%EC%9D%B4%ED%8A%B8%EB%A7%A5%EC%A3%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('도전 골든벨', '도전-골든벨', array['마지막 문제','골든벨을 울려라']::text[], '고등학생들의 마지막 문제 도전을 다룬 KBS 장수 퀴즈 코너', '1999년 1월 ''접속! 신세대''의 코너로 시작한 도전 골든벨은 고교생들이 문제를 풀며 탈락해가다 마지막 한 명이 골든벨 문제에 도전하는 형식으로, 이후 독립 프로그램이 되어 장수 콘텐츠로 자리잡았다. ''마지막 문제''라는 표현 자체가 결정적 순간을 뜻하는 밈으로 쓰인다.',
    'KBS ''접속! 신세대'' 코너로 시작, 이후 ''도전 골든벨''로 독립(1999)', '결정적인 마지막 순간이나 최종 관문을 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고요 속의 외침', '고요-속의-외침', array['가족오락관 이어말하기','고속외침']::text[], '헤드폰 낀 채 문장을 전달하다 엉뚱하게 틀리는 게임', '1995년부터 KBS ''가족오락관''에서 시작된 게임 코너로, 시끄러운 음악이 나오는 헤드폰을 쓴 채 입모양만으로 문장을 전달하다 보면 전혀 다른 말로 와전되는 모습이 웃음 포인트였다. 지금도 유튜브 편집 영상으로 꾸준히 재소비된다.',
    'KBS ''가족오락관'' 게임 코너(1995~2009)', '말이 잘못 전달되는 상황을 가리킬 때 비유로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%80%EC%A1%B1%EC%98%A4%EB%9D%BD%EA%B4%80/%EC%97%AD%EB%8C%80%20%EA%B2%8C%EC%9E%84/%EA%B3%A0%EC%9A%94%20%EC%86%8D%EC%9D%98%20%EC%99%B8%EC%B9%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우정의 무대 그리운 어머니', '우정의-무대-그리운-어머니', array['그리운 어머니','엄마가 보고플 때']::text[], '군부대 위문공연에서 어머니와 아들이 상봉하는 눈물 코너', '1990년 7월부터 KBS ''우정의 무대''의 마지막 순서로 삽입곡 ''그리운 어머니''가 흐르며 그리운 이름의 어머니가 무대로 걸어나와 아들과 극적으로 상봉하는 장면이 방송될 때마다 시청자들을 울렸다. 지금도 ''엄마가 보고플 때'' 도입부는 추억의 상징으로 클립화돼 재생된다.',
    'KBS ''우정의 무대'' 코너(1990~1990년대)', '감동적인 재회 장면을 이야기할 때 비유로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1990, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9A%B0%EC%A0%95%EC%9D%98%20%EB%AC%B4%EB%8C%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맹구', '맹구', array['봉숭아학당(1991)','이맹구','이창훈 맹구']::text[], '저요 저요를 외치며 사랑받은 바보 캐릭터 맹구', '1991년 KBS ''한바탕 웃음으로''의 코너 ''봉숭아 학당''에서 배우 이창훈이 연기한 순박한 바보 학생 캐릭터. 선생님이 질문할 때마다 손을 들며 ''저요 저요'' 소란을 피우다 결국 엉뚱한 답을 내놓는 개그로 큰 인기를 끌었다.',
    'KBS ''한바탕 웃음으로-봉숭아 학당''(1991~1993), 이창훈', '순진하고 우스꽝스러운 반응을 가리킬 때 인용', '지적장애 희화화 설정 논란 소지가 있어 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1991, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A7%B9%EA%B5%AC(%EB%B4%89%EC%88%AD%EC%95%84%20%ED%95%99%EB%8B%B9)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('개그콘서트 첫 방송', '개그콘서트-첫-방송', array['개콘 1회','봉숭아학당(개콘)']::text[], '1999년 시작한 공개 코미디쇼, 한국 개그의 새 시대', '1999년 9월 4일 KBS2에서 정규 편성된 ''개그콘서트''는 관객 앞 스탠딩 코미디 형식을 국내 최초로 정착시키며 이후 15년 넘게 이어지는 장수 프로그램의 시작이 됐다. 초기 코너와 출연진 영상은 지금도 유튜브 ''옛날 개그'' 콘텐츠로 꾸준히 소환된다.',
    'KBS2 ''개그콘서트'' 정규 방송(1999.9.4 첫방, 파일럿 1999.7.18)', '레트로 코미디 콘텐츠를 소개할 때 기준점으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('호랑나비', '호랑나비', array['김흥국 호랑나비 춤']::text[], '김흥국의 히트곡, 팔을 휘젓는 호랑나비 춤이 상징', '1993년 발표된 김흥국의 대표곡으로, 양팔을 크게 휘젓는 독특한 안무 ''호랑나비 춤''이 크게 유행했다. 지금도 예능·행사에서 흥을 돋우는 만능 댄스로 패러디되며 재소비된다.',
    '김흥국 정규 앨범 타이틀곡(1993)', '흥겨운 분위기를 낼 때 만능 댄스로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('회상(터보)', '회상(터보)', array['터보 회상','December']::text[], '터보의 겨울 히트곡, 절절한 가사와 안무가 인기', '1997년 발매된 터보 3집 ''Born Again''의 후속곡 ''회상(December)''은 애절한 멜로디와 무대 퍼포먼스로 큰 인기를 얻었다. 겨울철이면 방송·거리에서 반복 재생되던 90년대 대표 발라드 댄스곡 중 하나다.',
    '터보 3집 ''Born Again'' 후속곡(1997.10)', '연말·겨울 감성을 이야기할 때 레트로 곡으로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%9A%8C%EC%83%81%20(December)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('말해줘', '말해줘', array['지누션 말해줘','와이퍼 춤']::text[], '지누션 데뷔곡, 와이퍼 춤으로 힙합 유행을 이끔', '1997년 발매된 지누션 1집 타이틀곡으로 팔을 좌우로 흔드는 ''와이퍼 춤'' 안무가 크게 유행하며 국내 힙합 대중화의 신호탄이 됐다. 엄정화가 피처링에 참여한 것으로도 화제였다.',
    '지누션 1집 타이틀곡(1997.3)', '복고 힙합 안무를 소개할 때 대표 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A7%90%ED%95%B4%EC%A4%98(%EC%A7%80%EB%88%84%EC%85%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Poison', 'Poison', array['엄정화 포이즌']::text[], '엄정화를 톱 여가수로 올린 고난도 군무 히트곡', '1997년 엄정화 3집 ''Invitation'' 수록곡으로, 독무로 시작해 후렴부 화려한 군무로 이어지는 고난도 안무가 화제가 됐다. 이 곡을 계기로 엄정화는 90년대를 대표하는 댄스 가수로 자리잡았다.',
    '엄정화 3집 ''Invitation'' 수록곡(1997)', '화려한 군무를 이야기할 때 90년대 대표 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Poison(%EC%97%84%EC%A0%95%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('와(이정현)', '와(이정현)', array['이정현 와','부채춤 새끼손가락 마이크']::text[], '빨간 부채와 새끼손가락 마이크가 상징인 히트곡', '1999년 10월 발매된 이정현 1집 타이틀곡으로, 데뷔 무대에서 선보인 접고 펴는 부채 퍼포먼스와 새끼손가락에 낀 마이크가 강렬한 인상을 남기며 발매 한 달 만에 각종 가요 순위를 휩쓸었다. 국악과 테크노를 결합한 파격적 구성으로도 화제였다.',
    '이정현 1집 ''Let''s Go To My Star'' 타이틀곡(1999.10.20)', '강렬하고 독특한 퍼포먼스를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%99%80(%EC%9D%B4%EC%A0%95%ED%98%84)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('남자셋 여자셋', '남자셋-여자셋', array['남자셋여자셋 시트콤']::text[], '90년대 청춘 시트콤의 원조, 지금도 짤로 재소비', '1996년부터 1999년까지 방영된 MBC 시트콤으로, 세 남녀의 동거 코미디를 그리며 90년대 트렌디 시트콤 붐을 이끌었다. 등장인물들의 표정과 상황극이 지금도 유튜브 클립·짤로 꾸준히 재소비되는 초기 한국 시트콤 밈의 원형이다.',
    'MBC 시트콤(1996~1999)', '90년대 청춘 시트콤 감성을 소환할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박세리 맨발 투혼', '박세리-맨발-투혼', array['맨발의 투혼','박세리 US오픈']::text[], '1998년 US오픈 연장전, 맨발로 물에 들어간 투혼 장면', '1998년 7월 US여자오픈 연장 18번홀에서 박세리가 양말을 벗고 맨발로 워터해저드에 들어가 샷을 성공시킨 장면이 IMF 외환위기로 지친 국민들에게 큰 감동과 희망을 준 순간으로 남았다. 이 장면은 애국가 배경화면으로도 쓰일 만큼 상징적 영상이 됐다.',
    '제53회 US여자오픈 연장전(1998.7.7, 블랙울프런 골프장)', '위기 속 투혼·희망을 이야기할 때 상징적으로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.munhwa.com/article/11190206', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('금 모으기 운동', '금-모으기-운동', array['금모으기','IMF 금모으기']::text[], 'IMF 외환위기 극복 위해 전국민이 금을 모은 캠페인', '1998년 1월부터 4월까지 국가 부도 위기 속에서 약 351만 명의 국민이 자발적으로 금붙이를 내놓아 227톤, 약 18억 달러어치를 모은 전국민적 캠페인이다. 외국 언론에 ''불가사의한 한국인의 힘''으로 소개되며 지금도 IMF 시대를 상징하는 영상 자료로 재소비된다.',
    '전국민 자발적 캠페인(1998.1~4)', '국민적 단결·위기 극복 사례로 진지하게 인용', 'IMF 트라우마를 겪은 세대에게는 무겁게 느껴질 수 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://ko.wikipedia.org/wiki/%EA%B8%88%EB%AA%A8%EC%9C%BC%EA%B8%B0_%EC%9A%B4%EB%8F%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정주영 소떼 방북', '정주영-소떼-방북', array['소떼 방북','왕회장 소떼']::text[], '정주영 회장이 소 1001마리를 몰고 판문점을 넘은 사건', '1998년 6월과 10월 두 차례에 걸쳐 현대그룹 정주영 명예회장이 소 1,001마리를 이끌고 판문점을 통과해 방북한 사건으로, CNN 등 해외에도 생중계된 상징적 장면이다. 실향민이었던 정 회장의 개인사와 맞물려 지금도 남북 교류사의 명장면으로 회자된다.',
    '현대그룹 정주영 명예회장 방북(1998.6.16, 10월)', '통 큰 결단이나 파격적 이벤트를 비유할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://www.busan.com/view/busan/view.php?code=20050613000156', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('날개 잃은 천사', '날개-잃은-천사', array['룰라 날개 잃은 천사']::text[], '룰라를 스타덤에 올린 2집 타이틀곡이자 안무 히트곡', '1995년 발매된 룰라 2집 타이틀곡으로, 전년도 혜성같이 등장한 룰라를 명실상부한 인기 그룹으로 굳힌 곡이다. 경쾌한 리듬과 군무가 당시 댄스가요 붐을 이끈 대표 사례로 꼽힌다.',
    '룰라 2집 타이틀곡(1995.3.28)', '90년대 댄스가요 붐을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%A0%EA%B0%9C%20%EC%9E%83%EC%9D%80%20%EC%B2%9C%EC%82%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나를 돌아봐', '나를-돌아봐', array['듀스 나를 돌아봐']::text[], '듀스의 데뷔곡, 세련된 뉴잭스윙 사운드로 주목받음', '1993년 4월 발매된 듀스의 데뷔곡이자 1집 타이틀곡으로, 이현도가 작사·작곡·편곡을 도맡았다. 당시로선 파격적인 뉴잭스윙 리듬과 스타일로 이후 한국 댄스음악의 세련된 흐름을 이끈 곡으로 평가받는다.',
    '듀스 1집 타이틀곡(1993.4)', '세련된 90년대 초 댄스음악을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%98%EB%A5%BC%20%EB%8F%8C%EC%95%84%EB%B4%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핑계', '핑계', array['김건모 핑계 춤']::text[], '국내 첫 레게 히트곡, 김건모의 흐느적 춤이 유행', '1993년 발매된 김건모 2집 타이틀곡으로, 당시 생소했던 레게 리듬에 맞춘 자유분방한 춤이 크게 히트했다. 김건모를 단숨에 ''국민가수'' 반열에 올린 곡으로, 지금도 뉴트로 콘텐츠에서 안무가 자주 소환된다.',
    '김건모 2집 타이틀곡(1993)', '핑계 대는 상황을 장난스럽게 노래로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=_UC9gpiOZE0', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', '_UC9gpiOZE0', 'https://www.youtube.com/watch?v=_UC9gpiOZE0', true from memes where slug = '핑계'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('차인표 짤', '차인표-짤', array['차인표 손가락','사랑을 그대 품안에']::text[], '차인표의 과장된 손가락 포즈·표정이 짤로 재소비', '1994년 MBC 드라마 ''사랑을 그대 품안에''에서 차인표가 화가 나거나 격정적인 장면마다 검지를 흔들며 짓던 표정 연기가 훗날 인터넷에서 ''발연기''/''명연기'' 논쟁과 함께 짤로 널리 재유행했다. 본인도 이 포즈를 ''벼락스타로 만들어준 시그널''이라 언급한 바 있다.',
    'MBC 미니시리즈 ''사랑을 그대 품안에''(1994.6~7)', '과장된 감정 표현을 웃음 포인트로 인용할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1994, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%AC%EB%9E%91%EC%9D%84%20%EA%B7%B8%EB%8C%80%20%ED%92%88%EC%95%88%EC%97%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('난 알아요', '난-알아요', array['서태지와 아이들 1집','난알아요']::text[], '서태지와 아이들 데뷔곡, 심사위원 혹평 속 대중문화 대혁명의 시작', '1992년 3월 발매된 서태지와 아이들의 데뷔곡으로, MBC <특종 TV연예> 첫 방송 신인 무대에서 심사위원단으로부터 평균 7.8점, 역대 최저점을 받았으나 이후 청소년층에서 폭발적 반향을 일으키며 한국 대중음악 판도를 바꾼 상징적 사건이 되었다. ''혹평 속 대박''의 원조격 밈으로 지금도 오디션 프로그램 등에서 회자된다.',
    '1992년 3월 서태지와 아이들 1집 발매, 4월 11일 MBC <특종 TV연예> 데뷔 무대', '혹평받았지만 결과적으로 성공한 사례를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1992, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('컴백홈', '컴백홈', array['서태지와 아이들 4집','Come Back Home']::text[], '1995년 서태지와 아이들 컴백 무대, 힙합 패션 유행을 만든 사건', '1995년 10월 서태지와 아이들 4집 발표 특집 방송에서 선보인 스노보드복, 힙합 바지, 반삭발 스타일이 전국적 패션 유행으로 번졌다. 국내 최초로 ''팬클럽'' 개념이 자리잡은 계기로도 꼽히며, 이후 수많은 패러디와 회고 콘텐츠의 소재가 되었다.',
    '1995년 10월 6일 MBC <컴백홈 서태지와 아이들> 특별 방송', '90년대 패션·아이돌 문화를 회고할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잘못된 만남', '잘못된-만남', array['김건모 잘못된만남']::text[], '김건모 1995년 히트곡, 친구에게 애인을 빼앗긴 사연을 담은 곡', '1995년 발매된 김건모 3집 타이틀곡으로, 친구에게 애인을 빼앗긴 사연을 경쾌한 유로댄스 비트에 담아 그해 최고 히트곡 중 하나가 되었다. 지금도 삼각관계 배신 상황을 이야기할 때 자주 언급된다.',
    '1995년 김건모 3집 타이틀곡', '배신·삼각관계 상황을 유머러스하게 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('굿바이 예스터데이', '굿바이-예스터데이', array['터보 굿바이예스터데이']::text[], '터보의 1997년 대표곡, 강렬한 비트로 큰 인기를 끈 댄스곡', '김정남·김종국 듀오 터보가 1997년 발표한 댄스곡으로, 파워풀한 퍼포먼스와 후렴구로 90년대 후반 댄스가요 붐을 이끌었다.',
    '1997년 터보 2집 타이틀곡', '90년대 후반 댄스가요 회고에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('회상', '회상', array['터보 회상','December']::text[], '터보의 1997년 곡, 멤버 김종국이 애정하는 곡으로 유명', '터보 2집 ''Born Again'' 수록곡으로 발매 당시부터 꾸준한 사랑을 받았으며, 멤버 김종국이 훗날 개인적으로 가장 아끼는 곡으로 꼽으며 다시 회자되었다.',
    '1997년 터보 2집 ''Born Again'' 수록곡', '레트로 감성 플레이리스트에 자주 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여름이야', '여름이야', array['DJ DOC 여름이야']::text[], 'DJ DOC의 1996년 여름 댄스 히트곡', 'DJ DOC가 1996년 발표한 곡으로 특유의 흥겨운 랩과 안무로 여름철 국민 히트곡이 되었으며, 이후 여름 시즌마다 소환되는 레퍼토리로 자리잡았다.',
    '1996년 DJ DOC 3집 수록곡', '여름 시즌 예능·행사에서 단골로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('머피의 법칙', '머피의-법칙', array['DJ DOC 머피의법칙']::text[], 'DJ DOC의 1997년 곡, 일이 안 풀리는 하루를 코믹하게 그린 노래', '1997년 발표된 DJ DOC의 곡으로, 하는 일마다 꼬이는 하루를 코믹한 랩으로 풀어내 큰 공감을 얻었다. ''머피의 법칙''이라는 표현을 일상어로 굳히는 데 크게 기여했다.',
    '1997년 DJ DOC 앨범 수록곡', '일이 안 풀리는 날을 유머러스하게 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('전사의 후예', '전사의-후예', array['HOT 데뷔곡','H.O.T 전사의후예']::text[], 'H.O.T의 1996년 데뷔곡, 1세대 아이돌 시대를 연 곡', '1996년 9월 데뷔한 H.O.T의 타이틀곡으로 학교 폭력을 소재로 한 강렬한 메시지와 퍼포먼스로 화제를 모았다. 이후 1세대 아이돌 팬덤 문화가 본격화되는 계기가 되었다.',
    '1996년 H.O.T 1집 데뷔 타이틀곡', '1세대 아이돌 문화를 회고할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('캔디', '캔디', array['HOT 캔디']::text[], 'H.O.T의 사탕상자 안무로 유명한 1996년 히트곡', 'H.O.T 1집 수록곡으로, 멤버들이 사탕 상자 소품을 들고 추는 깜찍한 안무가 특징이다. 이후 수많은 후배 가수들이 오마주·패러디한 대표적인 90년대 아이돌 안무로 남아있다.',
    '1996년 H.O.T 1집 수록곡', '레트로 아이돌 안무 챌린지·오마주에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1996, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('학원별곡', '학원별곡', array['젝스키스 학원별곡']::text[], '젝스키스의 1997년 데뷔곡, 입시 스트레스를 다룬 곡', '1997년 데뷔한 젝스키스의 타이틀곡으로 한국 교육 현실을 소재로 한 가사와 파워풀한 퍼포먼스로 H.O.T와 함께 1세대 아이돌 라이벌 구도를 형성했다.',
    '1997년 젝스키스 1집 데뷔 타이틀곡', '1세대 아이돌·입시 스트레스 소재 회고에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('I''m Your Girl', 'Im-Your-Girl', array['SES 아이엠유어걸']::text[], 'S.E.S의 1997년 데뷔곡, 1세대 걸그룹 시대를 연 곡', '1997년 데뷔한 S.E.S의 타이틀곡으로 청순한 콘셉트와 세련된 퍼포먼스로 걸그룹 붐을 견인했으며, 핑클과 함께 1세대 걸그룹 라이벌 구도의 상징이 되었다.',
    '1997년 S.E.S 1집 데뷔 타이틀곡', '1세대 걸그룹 문화를 회고할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('블루 레인', '블루-레인', array['핑클 블루레인']::text[], '핑클의 1998년 데뷔곡', '1998년 데뷔한 핑클의 타이틀곡으로, S.E.S와 함께 90년대 후반 걸그룹 전성시대를 이끈 대표곡이다.',
    '1998년 핑클 1집 데뷔 타이틀곡', '1세대 걸그룹 회고 콘텐츠에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오 마이 러브', '오-마이-러브', array['컨츄리꼬꼬 오마이러브']::text[], '컨츄리꼬꼬의 1999년 히트곡', '1999년 발표된 컨츄리꼬꼬의 곡으로 90년대 말 댄스가요 씬에서 큰 인기를 끌었다.',
    '1999년 컨츄리꼬꼬 1집 수록곡', '90년대 말 댄스가요 회고에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가위', '가위', array['유승준 가위']::text[], '유승준의 1997년 히트곡, 파워풀한 힙합 댄스로 유명', '1997년 데뷔한 유승준의 대표곡으로 화려한 힙합 댄스 퍼포먼스로 10대 사이에서 큰 인기를 끌었다. 이후 2002년 병역 기피 논란으로 인해 곡 자체 언급도 조심스러워진 배경이 있다.',
    '1997년 유승준 2집 타이틀곡', '90년대 댄스가요로 언급하되 인물 논란과는 분리해서 다룰 것', '가수 본인의 병역 기피 논란(2002년 이후)으로 언급 시 맥락 주의 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 1997, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('To Heaven', 'To-Heaven', array['조성모 투헤븐']::text[], '조성모의 1998년 데뷔곡, 국내 최초 드라마타이즈 뮤직비디오', '1998년 발매된 조성모의 데뷔곡으로, 이병헌·김하늘 등 톱스타가 출연한 미니드라마 형식의 뮤직비디오로 화제를 모았다. 이후 발라드 가수들의 ''스토리형 뮤직비디오'' 제작 트렌드를 만든 원조로 꼽힌다.',
    '1998년 조성모 1집 데뷔 타이틀곡', '90년대 말 발라드·뮤직비디오 트렌드를 회고할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('순정', '순정', array['코요태 순정']::text[], '코요태의 1998년 데뷔곡', '1998년 데뷔한 혼성그룹 코요태의 타이틀곡으로, 이후 오랜 활동을 이어가는 코요태의 시작을 알린 곡이다.',
    '1998년 코요태 1집 데뷔 타이틀곡', '90년대 말 혼성그룹 회고에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('와(Wa)', '와(Wa)', array['이정현 와','테크노 전사']::text[], '이정현의 1999년 데뷔곡, 국악풍 의상과 테크노 사운드로 충격을 준 곡', '1999년 데뷔한 이정현의 타이틀곡으로, 무당 의상을 연상시키는 전통 콘셉트 의상과 강렬한 테크노 비트, 칼군무로 발라드·댄스팝 중심이던 가요계에 신선한 충격을 주었다. 지금도 ''테크노의 전설''로 회자되는 무대다.',
    '1999년 이정현 1집 데뷔 타이틀곡', '독특한 콘셉트·파격 무대를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('바다', '바다', array['NRG 바다']::text[], 'NRG의 1998년 발라드풍 댄스 히트곡', '1998년 발표된 NRG의 곡으로 시원한 여름 감성과 함께 큰 사랑을 받은 90년대 말 대표 댄스곡 중 하나다.',
    '1998년 NRG 2집 수록곡', '여름 시즌 90년대 가요 플레이리스트에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여름 안에서', '여름-안에서', array['듀스 여름안에서','김성재']::text[], '듀스의 1993년 히트곡, 90년대 초 댄스뮤직의 전환점', '김성재·이현도로 구성된 듀오 듀스가 1993년 발표한 곡으로, 세련된 뉴잭스윙 사운드로 90년대 초 한국 댄스음악의 수준을 한 단계 끌어올렸다는 평가를 받는다. 멤버 김성재의 1995년 요절로 더욱 애틋하게 회자되는 곡이다.',
    '1993년 듀스 2집 수록곡', '90년대 초 댄스음악의 전환점을 이야기할 때 인용', '멤버 김성재의 요절은 민감한 소재이므로 조심스럽게 언급',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그리운 어머니', '그리운-어머니', array['우정의 무대','어머니 상봉 코너']::text[], '우정의 무대의 눈물 코너, 장병과 어머니의 깜짝 상봉', '1989~1997년 방영된 MBC <우정의 무대>에서 진행자 이상용이 무대 뒤 목소리만으로 자신의 어머니를 알아맞히게 한 뒤 실제 상봉시키는 코너로, 1990년 7월부터 사용된 배경음악 ''그리운 어머니''와 함께 전 국민을 눈물짓게 한 상징적 장면이다.',
    '1990년 7월 23일 방영분부터 코너 배경음악으로 정착, MBC <우정의 무대>', '감동적인 가족 상봉 장면을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1990, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('침대는 과학이다', '침대는-과학이다', array['에이스침대 광고']::text[], '1993년 에이스침대 광고 카피, ''침대는 가구가 아니라 과학''', '1993년 탤런트 박상원이 출연한 에이스침대 광고의 카피 ''침대는 가구가 아닙니다, 침대는 과학입니다''가 크게 유행하며 초등학생들이 시험에서 ''가구가 아닌 것''을 묻는 문제에 ''침대''를 답으로 고르는 해프닝까지 낳았다.',
    '1993년 에이스침대 TV 광고', '논리적 비약이나 재치있는 정당화를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여보, 아버님 댁에 보일러 놓아드려야겠어요', '여보,-아버님-댁에-보일러-놓아드려야겠어요', array['경동보일러 광고']::text[], '1991년 경동보일러 광고 카피, 효심 마케팅의 대명사', '1991년 방영된 경동보일러(現 경동나비엔) 광고에서 며느리가 남편에게 건네는 대사로, 시골 부모님을 향한 한국적 효심 정서를 자극해 재고가 동날 만큼 큰 반향을 일으켰다.',
    '1991년 경동보일러 TV 광고', '효심·가족애를 표현하는 상황에서 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1991, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('한국지형에 강하다', '한국지형에-강하다', array['애니콜 광고']::text[], '1994년 삼성 애니콜 광고 슬로건, 모토로라 아성을 무너뜨린 카피', '1994년 10월 삼성전자가 애니콜 브랜드를 처음 사용하며 내세운 슬로건으로, 산이 많은 한국 지형에서 통화 품질이 좋다는 점을 내세워 모토로라가 장악하던 국내 휴대폰 시장의 판도를 바꾸는 계기가 되었다.',
    '1994년 10월 삼성전자 애니콜(SH-770) TV 광고', '국산 제품의 자부심이나 토종 경쟁력을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우리 것은 소중한 것이여', '우리-것은-소중한-것이여', array['박동진 명창 광고','제비몰러나간다']::text[], '판소리 명창 박동진의 90년대 초 한약 광고 유행어', '판소리 명창 박동진이 흥보가의 한 대목 ''제비 몰러 나간다''로 시작해 ''우리의 것은 소중한 것이여''로 끝맺는 솔표 우황청심원 광고로, 90년대 초 국악과 전통에 대한 관심을 환기시킨 상징적 카피가 되었다.',
    '1990년대 초반 솔표(조선무약) 우황청심원 TV 광고', '전통과 국산의 가치를 강조할 때 인용', '정확한 최초 방영 연도는 자료마다 다소 차이가 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1991, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신토불이', '신토불이', array['농협 신토불이']::text[], '우리 농산물 애용 캠페인 구호, 90년대 초 국민 슬로건', '''몸과 땅은 하나''라는 뜻의 신토불이는 농협의 우리 농산물 애용 캠페인을 통해 1990년대 초 전 국민적 구호로 자리잡았으며, 이후에도 국산품 애용을 강조할 때 관용구처럼 쓰이고 있다.',
    '1989~1990년 농협 우리 농산물 캠페인송·광고', '국산품, 우리 것을 강조할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1990, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('몬주익의 영웅', '몬주익의-영웅', array['황영조','몬주익 언덕']::text[], '1992년 바르셀로나 올림픽 마라톤에서 황영조가 얻은 별명', '1992년 바르셀로나 올림픽 마라톤에서 손기정 이후 56년 만에 금메달을 딴 황영조가 결승선 앞 급경사 ''몬주익 언덕''에서 역전, 마지막 스퍼트를 펼치고 쓰러진 장면에서 유래한 별명이다. 지금도 극적인 마지막 뒤집기 상황을 표현할 때 인용된다.',
    '1992년 8월 9일 바르셀로나 올림픽 마라톤 중계 방송', '막판 대역전극이나 투혼을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1992, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('코리안특급', '코리안특급', array['박찬호 별명']::text[], '1994년 박찬호 메이저리그 데뷔 후 얻은 별명', '1994년 한국인 최초로 LA 다저스에서 메이저리그에 데뷔한 박찬호가 강속구 투수 놀란 라이언의 별명 ''Ryan Express''에서 착안해 얻은 별명으로, 이후 한국 스포츠 스타를 부르는 관용적 수식어로 널리 쓰이게 되었다.',
    '1994년 박찬호 LA 다저스 메이저리그 데뷔 관련 보도', '한국 스포츠 스타의 해외 진출 성공을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맨발의 투혼', '맨발의-투혼', array['박세리 맨발','1998 US오픈']::text[], '1998년 박세리가 US오픈 연장전에서 보여준 명장면', 'IMF 외환위기로 실의에 빠져있던 1998년, 박세리가 US여자오픈 연장 플레이오프에서 양말을 벗고 물에 들어가 샷을 시도한 장면이 생중계되며 국민들에게 큰 위로를 준 명장면으로, ''맨발의 투혼''이라는 표현으로 지금까지 회자된다.',
    '1998년 US여자오픈 골프대회 중계 방송', '역경을 이겨내는 투혼을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대발이 아빠', '대발이-아빠', array['사랑이 뭐길래','이순재']::text[], '1991년 드라마 속 가부장적 아버지의 대명사가 된 캐릭터', '1991~1992년 방영된 MBC 주말극 <사랑이 뭐길래>에서 이순재가 연기한 가부장적인 아버지 캐릭터로, 시청률 65%를 기록하며 큰 화제를 모았다. 오늘날 ''대발이 아빠 같다''는 표현은 고압적이고 가부장적인 남편·아버지를 가리키는 관용구로 쓰인다.',
    '1991년 11월 MBC 주말드라마 <사랑이 뭐길래>', '구시대적 가부장 캐릭터를 풍자할 때 인용', '가부장제를 미화하지 않도록 풍자·비판적 맥락으로 사용 권장',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 1991, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우비소년', '우비소년', array['으쌰으쌰 우비소년','내 친구 우비소년']::text[], '성인 취향 개그 플래시 애니메이션, 2001년 인츠닷컴 대히트작', '로이비쥬얼과 인츠닷컴이 2001년 제작한 플래시 애니메이션으로, 원래 이카드용 캐릭터였던 우비소년을 활용했다. 비속어·섹드립 등 파격 개그로 일일 방문자 6만 명을 넘기며 ''2001 대한민국 캐릭터 베스트10''에 선정됐다. 이후 순화된 아동용 TV 시리즈 ''내 친구 우비소년''으로도 제작됐다.',
    '로이비쥬얼×인츠닷컴 공동 제작, 인츠닷컴 실장 김정영 기획', '성인 대상 레트로 콘텐츠에서만 언급, 저속한 원작 톤 주의', '원작에 성적 농담·비속어가 많아 아동판과 혼동하지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('니들이 게맛을 알어', '니들이-게맛을-알어', array['게맛을 알어','롯데리아 크랩버거 광고']::text[], '2002년 롯데리아 크랩버거 CF의 국민 유행어', '2002년 배우 신구가 출연한 롯데리아 크랩버거 광고 카피. 헤밍웨이 ''노인과 바다''를 패러디한 광고에서 신구의 애드리브 대사가 그대로 채택돼 국민적 유행어가 됐다.',
    '롯데리아 크랩버거 TV광고(대홍기획 제작, 배우 신구 출연), 2002.07.24 방영', '추억의 CF 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대~한민국 짝짝짝짝짝', '대~한민국-짝짝짝짝짝', array['대한민국 박수 응원','짝짝짝 짝짝']::text[], '2002 월드컵 붉은악마의 국민 박수 응원 구호', '수원 삼성 서포터의 ''수~원삼성'' 구호를 변형해 만든 응원 방식으로, 1998년 처음 쓰였으나 2002 한일월드컵 거리응원과 함께 전 국민이 따라하는 응원 구호로 대유행했다. ''대~한민국'' 뒤에 다섯 번 박수를 치는 리듬이 특징이다.',
    '붉은악마 응원단, 수원 서포터 구호 변형', '스포츠 응원·국뽕 콘텐츠에서 자연스럽게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오 필승 코리아', '오-필승-코리아', array['필승코리아','오필승코리아']::text[], '윤도현밴드가 부른 2002 월드컵 공식 응원가', '1990년대 중후반 K리그 부천 SK 서포터가 만든 멜로디를 붉은악마가 1998년 개사했고, 2002 월드컵에서 윤도현밴드(YB) 버전이 붉은악마 공식 응원가로 채택되며 거리응원 열풍의 상징이 됐다.',
    '붉은악마 응원단 개사, 윤도현밴드(YB) 편곡·공연', '월드컵·스포츠 응원 회고 콘텐츠에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Be the Reds', 'Be-the-Reds', array['비더레즈','붉은악마 티셔츠']::text[], '2002 월드컵 붉은 티셔츠 신드롬, 전 국민 ''레드'' 물결', '2002년 5월 출시된 붉은악마 응원 티셔츠 문구로 ''Be the Reds(붉은악마가 되자)''라는 뜻이다. 출시 한 달도 안 돼 정품만 30만 장 이상 팔리며 전 국민이 빨간 옷을 입고 거리응원에 나서는 신드롬을 만들었다.',
    '붉은악마 이벤트 대행사 토피안 기획 상품', '월드컵 패션·응원 문화 이야기에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안정환 반지 세레모니', '안정환-반지-세레모니', array['반지의 제왕 세레모니','안정환 골든골']::text[], '2002 월드컵 이탈리아전 골든골 후 반지 키스 세리머니', '2002년 6월 18일 대전에서 열린 16강전, 안정환이 이탈리아를 상대로 연장 골든골을 넣은 뒤 결혼반지에 입맞추는 세리머니를 펼쳤다. 이 장면으로 그는 ''반지의 제왕''이라는 별명을 얻었고 이후 방송·패러디에서 반복 인용되는 상징적 장면이 됐다.',
    '2002 한일월드컵 16강 한국-이탈리아전 생중계 장면', '월드컵 명장면 회고, 세리머니 패러디에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오노 사건(Oh~No)', '오노-사건(Oh~No)', array['안톤 오노 판정 논란','솔트레이크의 진실']::text[], '2002 솔트레이크 쇼트트랙 편파판정 논란, ''오노''가 반칙 대명사로', '2002년 동계올림픽 쇼트트랙 1500m 결승에서 1위로 결승선을 통과한 김동성이 심판 판정으로 실격당하고, 뒤따르던 미국의 아폴로 안톤 오노가 금메달을 가져간 사건. 오노의 ''헐리우드 액션''과 이름의 발음(Oh, No)을 이용한 언어유희가 겹쳐 ''오노''라는 이름 자체가 얌체 반칙의 대명사가 됐다.',
    '2002 솔트레이크 동계올림픽 쇼트트랙 남자 1500m 결승 방송 중계', '스포츠 편파판정 비유로 제한적 사용, 특정 인물 조롱 목적 자제', '특정 외국인 선수 개인에 대한 조롱·혐오로 번질 수 있어 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('히딩크 "나는 아직 배가 고프다"', '히딩크-"나는-아직-배가-고프다"', array['아직 배고프다','히딩크 어록']::text[], '2002 월드컵 16강 진출 후 히딩크 감독의 겸손 어록', '2002년 한일월드컵에서 사상 첫 16강 진출에 만족하려는 선수단에게 거스 히딩크 감독이 남긴 말. 더 큰 목표를 향해 자만하지 말자는 메시지로, 이후 각종 분야에서 ''만족하지 않고 더 나아가자''는 뜻의 인용구로 널리 쓰였다.',
    '2002 한일월드컵 국가대표팀 감독 거스 히딩크 인터뷰 발언', '목표 달성 후 겸손·정진을 강조할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유승준 병역기피 사건', '유승준-병역기피-사건', array['유승준 사태','스티브 유']::text[], '2002년 미국시민권 취득 후 입국금지, 이름 자체가 불신의 대명사', '가수 유승준이 2002년 1월 병역 판정 후 미국 시민권을 취득해 한국 국적을 상실하자, 법무부가 즉시 입국금지 조치를 내린 사건. 이후 20년 넘게 입국이 거부되며 그의 이름은 대중과의 약속을 저버린 인물의 대명사로 굳어졌다.',
    '언론 보도 및 실제 입국거부 사건(2002.02.01 입국금지, 02.02 공항 대기)', '신뢰 위반 사례를 설명하는 시사·역사 맥락에서만 사용', '특정 개인에 대한 낙인·인신공격으로 소비될 위험이 커 신중히 다룰 것',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2002, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('임요환 "테란의 황제"', '임요환-"테란의-황제"', array['황제','BoxeR']::text[], '스타크래프트 프로게이머 임요환의 별명, 2001년 e스포츠 스타 탄생', '아이디 ''SlayerS_BoxeR''로 활동한 임요환은 당시 최약체 종족이던 테란으로 2001·2002년 WCG를 2연패하며 ''테란의 황제''라는 별명을 얻었다. 한국 e스포츠 초창기 최고 스타로 대중적 신드롬을 일으켰다.',
    '스타크래프트 프로게이머 임요환의 대회 성적과 팬덤에서 파생된 별명', 'e스포츠 초창기 역사·스타크래프트 회고 콘텐츠에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('갈갈이 삼형제 유행어', '갈갈이-삼형제-유행어', array['리비리비','끼남이']::text[], '개그콘서트 인기 코너의 유치 개그 유행어, 2000년대 초 대유행', '박준형·김병만 등이 활동한 개그콘서트 코너 ''갈갈이 삼형제''에서 나온 ''리비리비~'', ''얘들아 나야 끼남이~'' 같은 유행어가 2000년대 초반 큰 인기를 끌었다. 당시 개그콘서트 특유의 ''유치 개그'' 전성기를 대표한다.',
    'KBS 개그콘서트 코너 ''갈갈이 삼형제''', '2000년대 초 개그 유행어 회고 콘텐츠에 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우비 삼남매', '우비-삼남매', array['우리는 우비 삼남매']::text[], '개그콘서트 봉숭아학당 코너 유행어, 2003년 인기', '지상렬 등이 선보인 캐릭터에서 재구성된 봉숭아학당의 ''우비 삼남매'' 코너는 2003년 캐릭터 개그 전성기를 이끌며 ''우리는 우비 삼남매, 우와'' 같은 유행어를 남겼다.',
    'KBS 개그콘서트 ''봉숭아학당'' 코너', '2000년대 초 개그콘서트 캐릭터 개그 회고에 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('옥동자', '옥동자', array['정종철 옥동자']::text[], '개그콘서트 봉숭아학당의 외모 콘셉트 캐릭터, 2002년 국민 캐릭터', '2002년 6월 등장한 정종철의 캐릭터로, 독특한 외모를 코미디 소재로 삼아 폭발적 인기를 끌며 2003년 봉숭아학당의 에이스로 자리잡았다(평균 시청률 28.9%). 이후 외모 비하 코미디 논쟁의 대표 사례로도 언급된다.',
    'KBS 개그콘서트 ''봉숭아학당'' 코너, 정종철 연기', '2000년대 코미디 트렌드 설명 시 언급, 외모 비하 소재임을 함께 짚기', '외모를 웃음거리로 삼는 콘셉트라 현재 기준으로는 비하성 코미디로 재평가됨',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('도리도리 춤', '도리도리-춤', array['도리도리 안무']::text[], '고개를 좌우로 흔드는 테크노풍 댄스, 2000년대 초 아이돌 안무로 재유행', '1990년대 유로테크노 댄스에서 파생돼 이정현이 대중화한 ''도리도리 춤''은 2000년대 초반까지도 테크노·유로댄스 계열 가수들의 안무에 자주 활용됐다. 2001년 유채영의 ''Shake'' 뮤직비디오 안무로도 쓰이며 세대를 넘나든 유행 댄스로 남았다.',
    '1990년대 테크노 댄스에서 파생, 이정현이 대중화', '2000년대 초 댄스가요 회고 콘텐츠에 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('DDR 오락실 열풍', 'DDR-오락실-열풍', array['댄스댄스레볼루션','DDR 붐']::text[], '코나미 리듬게임 DDR이 이끈 2000년대 초 오락실 댄스 게임 붐', '일본 코나미의 리듬게임 DDR은 한국 오락실에 상륙해 국산 리듬게임들과 함께 2000년대 초 전국적인 리듬게임 붐을 일으켰다. 학생들이 오락실에 몰려 발판 게임을 즐기고 실력을 겨루는 문화가 전국적으로 확산됐다.',
    '코나미 ''Dance Dance Revolution'' 한국 오락실 유입', '2000년대 오락실 문화 회고에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펌프 잇 업 프리스타일', '펌프-잇-업-프리스타일', array['펌프','안다미로 펌프']::text[], '한국산 리듬게임 펌프 잇 업이 이끈 ''프리스타일 퍼포먼스'' 유행', '안다미로가 만든 국산 리듬게임 ''펌프 잇 업''은 1999년 말 출시 이후 2000년대 초 오락실 리듬게임 붐의 선봉이 됐다. 정해진 스텝 대신 화려한 안무를 짜서 추는 ''프리스타일 플레이''가 전국적으로 유행하며 펌프 대회와 관련 상품까지 등장했다.',
    '안다미로 개발 국산 아케이드 리듬게임', '2000년대 오락실 리듬게임 문화 회고에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('EZ2DJ', 'EZ2DJ', array['이지투디제이','이지방']::text[], '국산 리듬게임 EZ2DJ, 펌프와 함께 오락실 리듬게임 붐 견인', '1999년 등장한 국산 아케이드 리듬게임으로, 펌프 잇 업과 함께 오락실 리듬게임 붐을 이끌었다. EZ2DJ만 모아놓은 전문 오락실 ''이지방''이 생길 정도로 마니아층이 두터웠다.',
    '국내 개발사의 아케이드 리듬게임', '리듬게임 마니아 문화, 오락실 회고 콘텐츠에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기적인 그녀 "너 죽을래"', '엽기적인-그녀-"너-죽을래"', array['죽을래','견우야 죽을래']::text[], '영화 엽기적인 그녀의 대표 협박성 대사, 2001년 유행어화', '2001년 개봉한 영화 ''엽기적인 그녀''에서 전지현이 연기한 ''그녀''가 견우를 협박할 때 반복적으로 쓰는 대사. 영화의 대흥행과 함께 연인 사이 애교 섞인 협박 표현으로 일상에서도 널리 인용됐다.',
    '영화 ''엽기적인 그녀''(2001, 곽재용 감독) 대사', '2000년대 초 로맨스 코미디 영화 회고에 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기적인 그녀 "견우야 미안해"', '엽기적인-그녀-"견우야-미안해"', array['미안해 나도 어쩔 수 없는 여자인가봐']::text[], '영화 엽기적인 그녀 명장면 대사, 2001년 큰 화제', '영화 속 두 주인공이 각각 다른 산봉우리에서 재회하는 장면에서 그녀가 외치는 대사. 반전 있는 순애보 전개의 상징적 명대사로 당시 방송·유행어에 자주 인용됐다.',
    '영화 ''엽기적인 그녀''(2001) 명장면 대사', '2000년대 초 영화 명대사 회고 콘텐츠에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마시마로', '마시마로', array['엽기토끼','마시마로 숲 이야기']::text[], '2000년 등장해 엽기 열풍을 이끈 못된 표정의 토끼 플래시 애니메이션 캐릭터', '김재인이 만든 7편짜리 플래시 애니메이션 ''마시마로 숲 이야기'' 속 주인공으로, 귀엽지 않고 심술궂은 표정과 엽기적인 행동으로 기존 캐릭터 문법을 깼다. 인터넷을 통해 폭발적으로 퍼지며 2001년 정식 캐릭터 상품화까지 이어졌다.',
    '김재인이 기획했다가 회사에서 거절당한 캐릭터를 인터넷 만화 사이트 ''엔포''를 통해 직접 공개하며 시작됐다.', '2000년대 초 인터넷 문화·엽기 코드를 이야기할 때 대표 사례로 언급', '현재 세대에는 생소할 수 있어 설명이 필요함',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%A7%88%EC%8B%9C%EB%A7%88%EB%A1%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('니들이 게맛을 알아', '니들이-게맛을-알아', array['니들이 게맛을 알어']::text[], '신구가 애드리브로 남긴 2002년 롯데리아 CF 유행어', '헤밍웨이 ''노인과 바다''를 패러디해 대게를 낚은 노인이 만족스러운 표정으로 던진 대사로, 원래 대본에는 없던 신구의 애드리브가 채택돼 방영됐다. 방영 이후 수많은 성대모사와 패러디를 낳으며 당대 최고의 CF 유행어가 됐다.',
    '2002년 롯데리아 TV광고에서 배우 신구의 애드리브 대사로 탄생했다.', '성대모사나 광고 회고 콘텐츠에서 인용하기 좋음', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8B%88%EB%93%A4%EC%9D%B4%20%EA%B2%8C%EB%A7%9B%EC%9D%84%20%EC%95%8C%EC%96%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('얼마면 돼, 얼마면 되는데', '얼마면-돼,-얼마면-되는데', array['얼마면 돼']::text[], '2000년 드라마 ''가을동화''에서 원빈이 남긴 명대사', 'KBS 드라마 ''가을동화''에서 원빈이 연기한 캐릭터가 던진 대사로, 사랑을 돈으로 재단하는 태도를 상징하는 문장이 되어 이후 20년 넘게 각종 패러디와 인용에 쓰이고 있다.',
    '2000년 KBS 드라마 ''가을동화'' 방영 중 등장한 대사.', '속물적인 태도를 풍자할 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('홍시맛이 나서 홍시라 생각했는데', '홍시맛이-나서-홍시라-생각했는데', array['홍시맛이 나서 홍시라 생각한 것이온데']::text[], '2003년 드라마 ''대장금'' 어린 장금이의 말장난식 대답 유행어', 'MBC 드라마 ''대장금''에서 어린 장금이가 고기의 맛을 홍시맛이라 표현하며 이유를 되묻는 정상궁에게 순환논법으로 답한 장면이 화제가 되어, TV를 켜면 어디서든 패러디가 나올 정도로 유행했다.',
    '2003년 9월 29일 MBC ''대장금'' 5회 방영분에서 나온 대사.', '논리적으로 앞뒤가 안 맞는 답을 장난스럽게 지적할 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('갈갈이 삼형제 - 무를 주세요', '갈갈이-삼형제---무를-주세요', array['무를 주세요','박준형 갈갈이']::text[], '박준형이 이끈 개그콘서트 ''갈갈이 삼형제'' 코너의 대표 유행어', '박준형, 심현섭 등이 출연한 ''갈갈이 삼형제'' 코너에서 나온 대사로, 코너가 큰 인기를 끌며 박준형을 개그콘서트의 새로운 에이스로 만든 계기가 됐다.',
    '2001~2002년 개그콘서트 ''갈갈이 삼형제'' 코너.', '2000년대 초 개그콘서트 추억 소재로 언급', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%88%EA%B0%88%EC%9D%B4%20%EC%82%BC%ED%98%95%EC%A0%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('리비리비~', '리비리비~', array['최홍림 리비리비','유후 리비리비']::text[], '최홍림(이승환)이 개그콘서트에서 유행시킨 의미 없는 추임새', '''갈갈이 삼형제'' 등에 출연한 최홍림(당시 활동명 이승환)이 특유의 능청스러운 캐릭터로 반복한 추임새 유행어로, 뜻보다는 리듬감 있는 말맛으로 인기를 끌었다.',
    '2001~2002년 개그콘서트 코너에서 최홍림이 사용.', '뜻 없이 흥을 돋우는 추임새로 패러디할 때 사용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('느끼남 - 얘들아 나야 끼남이', '느끼남---얘들아-나야-끼남이', array['느끼남','끼남']::text[], '최홍림이 느끼한 캐릭터로 유행시킨 자기소개형 유행어', '''얘들아 나야 끼남이, 느끼남~''이라는 대사로 능글맞고 느끼한 콘셉트의 캐릭터를 완성해 개그콘서트에서 인기를 끌었다.',
    '2002년경 개그콘서트에서 최홍림이 선보인 캐릭터 대사.', '과하게 느끼한 자기소개를 놀릴 때 패러디', '오글거리는 톤이라 맥락 없이 쓰면 어색할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박준형의 생활사투리', '박준형의-생활사투리', array['생활사투리']::text[], '팔도 사투리를 노래·성대모사로 풀어낸 개그콘서트 인기 코너', '박준형이 사투리 교사로 등장해 김시덕, 이재훈이 각각 동남·서남 방언을 유행가에 얹어 표현하고 정종철이 효과음을 넣는 형식으로, 2000년대 초 지역 사투리를 유쾌하게 소비하는 문화를 만들었다.',
    '2002년 10월 13일부터 2004년 2월 15일까지 방영된 개그콘서트 코너.', '지역색을 유쾌하게 다룰 때 참고 사례로 언급', '사투리 희화화가 지역 비하로 읽힐 수 있어 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B0%95%EC%A4%80%ED%98%95%EC%9D%98%20%EC%83%9D%ED%99%9C%EC%82%AC%ED%88%AC%EB%A6%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스타자판기', '스타자판기', '{}', '자판기에 들어가면 연예인으로 빙의된다는 설정의 개그콘서트 코너', '출연자가 자판기 안에 들어갔다 나오면 유명 연예인의 말투와 특징으로 변신하는 콩트 코너로, 박성호·심현섭·김지선 등이 다양한 성대모사를 선보이며 화제를 모았다.',
    '2000년 11월부터 2001년 초까지 방영된 개그콘서트 코너.', '2000년대 초 개그콘서트 성대모사 코너 예시로 언급', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무사(개그콘서트)', '무사(개그콘서트)', array['무사 코너']::text[], '어벙한 무사들의 활극을 그린 2000년대 초 개그콘서트 콩트', '이병진, 이태식, 조경훈, 김상태가 출연해 이태식이 어벙한 주인공 무사로 등장, 적군 무사들과 우스꽝스러운 대결을 벌이는 형식의 코너였다.',
    '2000년 10월 21일부터 2001년 8월 26일까지 방영된 개그콘서트 코너.', '초기 개그콘서트 콩트 형식을 설명할 때 예시로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('환장하겠네', '환장하겠네', array['아이구야']::text[], '강성범·김준호 콤비가 만든 개그콘서트 만담 유행어', '동화와 영화의 허와 실을 짚어주는 만담 코너에서 강성범과 김준호가 반복한 ''~하니 이거 환장하겠네~!'', ''아이구야~!''라는 대사가 크게 유행했다.',
    '2001년 8월 19일부터 2002년 1월 27일까지 방영된 개그콘서트 코너.', '황당한 상황에 대한 감탄사로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대희 널 사랑한다', '대희-널-사랑한다', array['스승님 스승님']::text[], '개그콘서트 ''스승님 스승님'' 코너의 대표 유행어', '김미화, 백재현, 김대희, 김영철, 김준호가 출연한 사제 관계 콩트 코너에서 나온 유행어로, 초창기 개그콘서트의 인기 코너 중 하나였다.',
    '1999년 10월 23일부터 2000년 6월 24일까지 방영된 개그콘서트 코너.', '초창기 개그콘서트 역사 이야기할 때 인용', '현재는 거의 기억되지 않는 옛 유행어',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미끄러우니까', '미끄러우니까', array['리마리오']::text[], '웃찾사 ''비둘기 합창단'' 코너 리마리오 캐릭터의 유행어', '웃찾사에서 활동한 리마리오가 ''미끄러우니까'', ''본능에 충실해'' 등의 대사로 인기를 끌었다. 이후 개그콘서트의 ''느낌 아니까''(2013)와 종종 혼동되지만 서로 다른 방송, 다른 시기의 유행어다.',
    '2004년부터 2005년까지 SBS 웃찾사 ''비둘기 합창단'' 코너에서 활동.', '2000년대 중반 공채 코미디 회고 콘텐츠에 인용', '''느낌 아니까''(2013년 개그콘서트)와 혼동하지 않도록 주의',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A6%AC%EB%A7%88%EB%A6%AC%EC%98%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('꿈은 이루어진다', '꿈은-이루어진다', array['꿈★은 이루어진다']::text[], '2002년 한일 월드컵 4강 신화를 상징하는 국민 슬로건', '2002년 한일 월드컵에서 한국 대표팀이 폴란드, 포르투갈, 이탈리아, 스페인을 연파하며 아시아 최초로 4강에 오르는 과정에서 응원 구호로 자리잡은 문구로, 이후 축구를 넘어 사회 전반에서 희망을 뜻하는 말로 인용됐다.',
    '2002년 한일 월드컵 응원 현장과 방송 중계에서 확산된 구호.', '희망적인 메시지를 전할 때 인용하기 좋음', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 아직도 배가 고프다', '나는-아직도-배가-고프다', array['히딩크 어록']::text[], '거스 히딩크 감독이 2002년 월드컵 4강 이후 남긴 명언', '2002년 월드컵에서 한국을 4강으로 이끈 거스 히딩크 감독이 대회 후 만족하지 않고 더 큰 목표를 향한다는 의미로 남긴 말로, 이후 스포츠뿐 아니라 각계에서 ''겸손한 성취욕''을 표현하는 관용구로 인용됐다.',
    '2002년 한일 월드컵 종료 후 히딩크 감독의 인터뷰 발언.', '성취 이후에도 더 노력하겠다는 의지를 표현할 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오노 세러머니 패러디', '오노-세러머니-패러디', array['할리우드 액션','안톤 오노 흉내']::text[], '2002 솔트레이크 쇼트트랙 판정 논란 이후 선수들이 따라 한 오노 흉내 세러머니', '2002년 솔트레이크시티 동계올림픽 쇼트트랙 1500m에서 미국의 안톤 오노가 놀란 척 양팔을 드는 동작으로 김동성의 실격을 유도했다는 논란이 일자, 같은 해 한일 월드컵에서 안정환·이천수 등이 골 세러머니로 오노의 동작을 풍자해 화제가 됐다.',
    '2002년 2월 솔트레이크 올림픽 판정 논란이 같은 해 월드컵 골 세러머니로 이어졌다.', '부당한 판정에 대한 통쾌한 풍자 사례로 언급', '반미 감정과 얽힌 역사적 맥락이 있어 국가 간 비하로 흐르지 않게 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%84%ED%8F%B4%EB%A1%9C%20%EC%95%88%ED%86%A4%20%EC%98%A4%EB%85%B8', 'embeddable'::copyright_status from ins where true;

commit;
