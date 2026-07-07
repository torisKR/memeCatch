-- 밈캐치 시드 배치 8 (73 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Love 119 챌린지', 'Love-119-챌린지', array['러브원원나인 챌린지','라이즈 러브119']::text[], '라이즈 ''사랑 응급상황''을 상황극으로 표현한 댄스 챌린지', '2024년 1월 발매된 라이즈의 ''Love 119''는 멤버 쇼타로·원빈이 만든 ''1-1-9'' 손동작과, 상대를 보고 놀라 쓰러지는 상황극 버전 챌린지가 함께 유행하며 틱톡 누적 조회수 5억 뷰에 가까운 인기를 끌었다.',
    '2024년 1월 라이즈 ''Love 119'' 발매 및 멤버 자체 안무 챌린지', '라이즈 팬덤 대화나 상황극 챌린지 사례로 사용', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('IZNA 챌린지', 'IZNA-챌린지', array['아이즈나 챌린지','izna 데뷔곡 챌린지']::text[], '아이랜드2 출신 걸그룹 izna 데뷔곡 포인트 안무 챌린지', '2024년 11월 데뷔한 izna의 타이틀곡 ''IZNA'' 챌린지는 중독적인 비트와 쉬운 포인트 안무 덕분에 제로베이스원, 아일릿, TWS 등 다수 아이돌이 참여하며 화제를 모았다.',
    '2024년 11월 25일 izna 데뷔 미니앨범 ''N/a'' 타이틀곡 발매', '신인 걸그룹 데뷔 화제성 언급 시 사용', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Armageddon 챌린지', 'Armageddon-챌린지', array['아마겟돈 챌린지','에스파 콘서트 챌린지']::text[], 'aespa 콘서트에서 촉발된 ''Armageddon'' 팬 댄스 챌린지', '2024년 6월 30일 aespa 단독 콘서트 ''SYNK : PARALLEL LINE''에서 예고 없이 시작된 댄스 챌린지 코너에 가수 청하와 혜리가 참여해 화제가 됐다. ''Armageddon''은 그해 ''Supernova'', ''Whiplash''와 함께 aespa 3연타 히트곡으로 꼽혔다.',
    '2024년 6월 30일 aespa 콘서트 현장 팬 챌린지', '콘서트 팬 챌린지 문화 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 반딧불 챌린지', '나는-반딧불-챌린지', array['반딧불 챌린지','황가람 반딧불']::text[], '황가람이 리메이크한 발라드를 어린이들이 커버하며 유행한 챌린지', '2024년 10월 황가람이 리메이크해 발매한 ''나는 반딧불''(원곡 중식이밴드)이 발라드 차트 1위에 오르며 역주행했다. 특히 초등학생들 사이에서 커버 영상이 유행해 누적 조회수 3500만 뷰를 넘기며 사회적 현상이 됐다.',
    '2024년 10월 황가람 리메이크 디지털 싱글 발매(원곡 중식이밴드 2020년)', '초등학생 유행·역주행곡 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%82%98%EB%8A%94%20%EB%B0%98%EB%94%A7%EB%B6%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('임영웅 온기 홈챌린지', '임영웅-온기-홈챌린지', array['임영웅 홈챌린지']::text[], '임영웅 신곡 안무를 집에서 따라 하는 중장년층 중심 홈챌린지', '2024년 임영웅의 신곡에 맞춘 ''홈챌린지'' 안무가 유튜브·틱톡에서 유행했다. 느린 동작 버전, 어르신도 따라 할 수 있는 ''80대 버전'' 등 다양한 파생 콘텐츠가 만들어지며 팬덤을 넘어 폭넓은 세대가 참여했다.',
    '2024년 임영웅 공식 SNS 홈챌린지 콘텐츠', '중장년 팬덤 문화나 트로트 챌린지 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Sticky 챌린지', 'Sticky-챌린지', array['스티키 챌린지','키스오브라이프 스티키']::text[], '키스오브라이프 ''Sticky'' 트월킹 포인트 안무 챌린지', '2024년 7월 발매된 키스오브라이프의 ''Sticky''는 서머송답게 청량한 무드와 트월킹이 포함된 포인트 안무로 챌린지 영상이 다수 제작됐다. 남자 아이돌들의 참여 버전을 두고 커뮤니티에서 논쟁이 일기도 했다.',
    '2024년 7월 1일 KISS OF LIFE ''Sticky'' 발매', '서머송 챌린지 트렌드 이야기할 때 언급', '트월킹 동작에 대한 성적 대상화 논쟁이 있어 맥락 주의',
    'yellow'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2024, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Mantra 챌린지', 'Mantra-챌린지', array['만트라 챌린지','제니 만트라']::text[], '제니 ''Mantra'' 속삭이는 후렴 파트를 따라하는 챌린지', '2024년 10월 발매된 제니의 두 번째 디지털 싱글 ''Mantra''는 발매 13시간 만에 41개국 아이튠즈 차트 1위에 오르며 세계적으로 흥행했다. 제니가 직접 만든 속삭이는 후렴 파트가 인상적이어서 이를 따라하는 챌린지 콘텐츠가 SNS에 다수 올라왔다.',
    '2024년 10월 11일 제니 ''Mantra'' 발매', '제니 솔로 활동이나 챌린지 트렌드 이야기할 때 언급', '구체적 챌린지 상세 내용은 확인이 제한적이므로 신중히 인용',
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Earth, Wind & Fire 챌린지', 'Earth,-Wind-&-Fire-챌린지', array['얼스윈드파이어 챌린지','보이넥스트도어 챌린지']::text[], '보이넥스트도어 신곡 스피드업 파트의 순간이동 같은 고난도 댄스 챌린지', '2024년 4월 발매된 보이넥스트도어의 ''Earth, Wind & Fire''는 스피드업 버전 후렴의 빠르고 정교한 동작 때문에 ''순간이동 춤''으로 불리며 고난도 챌린지로 화제를 모았다. 트와이스, 엔하이픈, (여자)아이들 등 다수 아이돌과 유명 댄서들이 참여했다.',
    '2024년 4월 13일 보이넥스트도어 공식 틱톡 챌린지 공개', '고난도 K팝 챌린지 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/Earth,%20Wind%20&%20Fire(BOYNEXTDOOR)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('ONE SPARK 챌린지', 'ONE-SPARK-챌린지', array['원스파크 챌린지','트와이스 원스파크']::text[], '트와이스 ''ONE SPARK'' 후렴 포인트 안무를 따라하는 챌린지', '2024년 2월 발매된 트와이스의 ''ONE SPARK''는 다현·쯔위 등 멤버들과 르세라핌 등 타 그룹까지 참여한 안무 챌린지로 SNS에서 크게 유행했다.',
    '2024년 2월 발매된 트와이스 ''ONE SPARK'' 및 라디오·SNS 챌린지', '트와이스 컴백이나 챌린지 유행 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Smoothie 챌린지', 'Smoothie-챌린지', array['스무디 챌린지','엔시티드림 스무디']::text[], 'NCT DREAM ''스무디'' 후루룩 소리 내는 킬링파트 챌린지', '2024년 3월 발매된 NCT DREAM의 ''Smoothie''는 스무디를 마시는 동작과 후루룩 소리를 내는 킬링파트 챌린지로 화제를 모았다. 유노윤호·효연·슬기 등 선배 가수부터 타 그룹 멤버까지 폭넓게 참여했다.',
    '2024년 3월 25일 NCT DREAM ''Smoothie'' 발매 및 공식 챌린지', '귀여운 콘셉트 챌린지 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('EASY 챌린지', 'EASY-챌린지', array['MakeItLookEasy 챌린지','르세라핌 이지 챌린지']::text[], '르세라핌 ''EASY'' 발매 기념 유튜브 쇼츠 글로벌 챌린지', '2024년 2월 르세라핌이 미니 3집 ''EASY'' 발매에 맞춰 ''#MakeItLookEasy'' 유튜브 쇼츠 챌린지를 진행했다. 신곡을 배경음악으로 챌린지 영상을 올리는 방식으로 세계 팬들이 참여했다.',
    '2024년 2월 19일 LE SSERAFIM ''EASY'' 발매 및 유튜브 공식 캠페인', '르세라핌 컴백이나 유튜브 챌린지 마케팅 사례로 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Sweet Venom 챌린지', 'Sweet-Venom-챌린지', array['스윗베놈 챌린지','엔하이픈 스윗베놈']::text[], '페이커가 참여해 화제 모은 엔하이픈 ''Sweet Venom'' 댄스 챌린지', '2024년 1월 리그오브레전드 선수 페이커가 삼성 갤럭시 S24 울트라 홍보 캠페인의 일환으로 엔하이픈과 ''Sweet Venom'' 댄스 챌린지에 참여해 화제가 됐다. 곡은 2023년 11월 발매됐지만 챌린지 유행은 2024년 초 절정을 이뤘다.',
    '2024년 1월 삼성·엔하이픈 공식 콜라보 챌린지(페이커 참여)', 'e스포츠·K팝 콜라보 사례로 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('POWER 챌린지', 'POWER-챌린지', array['지디 파워 챌린지','지드래곤 파워']::text[], '지드래곤 컴백곡 ''POWER'' 안무를 따라하는 세대 초월 챌린지', '2024년 11월 지드래곤이 디지털 싱글 ''POWER''의 안무 연습 영상을 공개하자 하루도 안 돼 조회수 100만을 돌파했고, 2세대 아이돌 팬은 물론 MZ세대까지 챌린지에 참여하며 신드롬을 일으켰다.',
    '2024년 11월 9일 지드래곤 ''POWER'' 안무 영상 공개', '지드래곤 컴백이나 세대 통합 밈 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('WORK 챌린지', 'WORK-챌린지', array['에이티즈 워크 챌린지']::text[], '에이티즈 ''워크'' 직장인 콘셉트 안무 챌린지', '2024년 5월 발매된 에이티즈의 ''WORK''는 ''돈 벌기 힘든 직장인''을 위트있게 표현한 안무로 챌린지가 유행했다. 뉴진스 하니·다니엘, 스트레이키즈 창빈, 제로베이스원 김규빈 등 다양한 아이돌이 참여했다.',
    '2024년 5월 31일 ATEEZ ''WORK'' 발매 및 SNS 챌린지', '직장인 공감 밈이나 에이티즈 챌린지 이야기할 때 언급', null,
    'green'::safety_level, 'cooling'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2024, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그건 절대 안 되는 일이얌', '그건-절대-안-되는-일이얌', array['절대 안되는 일이얌','라면집 밈']::text[], '라면집 손님의 과장된 거절 리액션이 퍼진 밈', '라면 가게에서 매운맛 대신 순한맛을 권하자 손님이 방방 뛰며 ''그건 절대 안 되는 일이얌''이라고 외친 유튜브 쇼츠 영상에서 시작됐다. 아모레퍼시픽 등 여러 브랜드가 직원이 같은 포즈로 점프하는 광고를 만들며 마케팅에도 폭넓게 활용됐다.',
    '유튜브 쇼츠에 올라온 라면집 손님의 과장된 리액션 영상', '절대 양보 못 하거나 꼭 지켜야 할 것을 강조할 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('개웃겨서 도티낳음', '개웃겨서-도티낳음', array['도티낳음','호잇짜']::text[], '웃겨서 ''도티를 낳았다''는 황당한 변형 유행어', '인스타그램에서 유튜버 도티를 추억하는 릴스 댓글에 달린 ''호잇짜!''가 여러 단계의 언어유희를 거쳐 ''개웃겨서 도티낳음''으로 변형됐다. ''개슬퍼서 도티유산함'' 등 파생 표현이 이어졌고, 도티 본인이 이 주제로 공모전을 열기도 했다.',
    '인스타그램 릴스 댓글에서 시작된 다단계 언어유희', '황당할 정도로 웃긴 상황을 과장해서 표현할 때 사용', '출산·유산 등 표현으로 파생되어 일부에게는 불쾌하게 들릴 수 있음',
    'yellow'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭주기니', '폭주기니', array['폭주 기니피그','레이 폭주기니']::text[], '아이브 레이의 ''애티튜드'' 안무 구간 별명', '아이브 ''ATTITUDE'' 후렴구 시간차 안무에서 멤버 레이가 해맑게 웃으며 격렬히 춤추는 모습이 ''폭주하는 귀여운 기니피그'' 같다고 하여 붙은 별명이다. 컴백 스포일러 영상이 틱톡에서 2650만 뷰를 넘기며 챌린지로 확산됐다.',
    '아이브 ''ATTITUDE''(2025.2) 안무 스포일러 영상 속 레이 파트', '신나서 통제가 안 되는 귀여운 몸짓을 표현할 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('바라밤 챌린지', '바라밤-챌린지', array['유우시 바라밤']::text[], 'NCT 위시 유우시가 만든 안무 챌린지', 'NCT 위시 멤버 유우시가 만든 짧은 안무를 ''바라밤'' 구호에 맞춰 추는 챌린지로 2025년 7~8월 공식 계정을 통해 공개된 뒤 보넥도, 프로미스나인 등 다른 아이돌들도 따라 췄다.',
    'NCT 위시 유우시가 자체 제작해 SNS에 공개한 챌린지', '짧고 귀여운 안무 챌린지 영상에 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대나무행주', '대나무행주', array['대나무행주 송']::text[], '홈쇼핑풍 광고 CM송이 중독성으로 밈이 된 사례', '''대나무행주 대나무행주 기름이 묻지 않아요 흡수력이 좋아요''라는 반복적이고 중독성 있는 광고 CM송이 2025년 6월부터 SNS에서 밈으로 확산됐다. 단순 반복 멜로디를 다른 상품 홍보에 빗대 패러디하는 형태로 쓰인다.',
    '생활용품 광고의 CM송 영상', '제품 장점을 반복 CM송 형식으로 홍보할 때 패러디로 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잔뇨야 안녕', '잔뇨야-안녕', array['잔오','대구코넬비뇨기과 밈']::text[], '비뇨기과 환자 영상 대사를 스트리머 후원 문구로 악용한 밈', '한 비뇨기과 환자가 등장하는 영상에서 ''잔뇨야 안녕''이라며 손을 흔드는 장면이 2025년 10월 중순부터 스트리밍 방송 후원(도네) 메시지로 폭발적으로 쓰였다. 병원명이 ''대구코넬비뇨기과''라 다양한 말장난으로 파생됐고, 도배 현상으로 일부 플랫폼에서 제한되기도 했다.',
    '비뇨기과 환자 대상 영상 클립이 스트리밍 커뮤니티에서 후원 문구로 변형', '스트리밍 커뮤니티 맥락을 아는 사람들끼리 제한적으로만 사용', '실존 환자의 사적인 의료 영상을 조롱조로 소비하는 것이라 인격권 침해 소지가 큼',
    'red'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2025, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('후메잌디스', '후메잌디스', array['Who made this','후 메이드 디스']::text[], '화내듯 극찬하는 해외 리액션이 국내 밈으로 정착', '해외 SNS에서 한 남성이 치킨을 먹으며 화내듯 ''누가 만들었냐''고 소리치는 영상이 원본으로, 제로베이스원 김규민이 이를 화내다 칭찬으로 풀리는 리액션으로 따라 하며 국내에 크게 퍼졌다. 음식뿐 아니라 인상적인 장면·디자인 전반에 두루 쓰인다.',
    '해외 SNS 리액션 영상과 제로베이스원 김규민의 패러디', '정말 잘 만들었다고 극찬하고 싶을 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짝사랑 성공하는 챌린지', '짝사랑-성공하는-챌린지', array['짝사랑성공법 챌린지']::text[], '짝사랑 상대에게 마음을 전하는 팁을 공유하는 챌린지', '틱톡에서 짝사랑 상대에게 마음을 전하거나 티내는 방법을 공유하는 챌린지가 2025년 유행했다. 자신감 있게 다가가는 법, 고백 타이밍을 잡는 법 등을 짧은 영상으로 공유하는 형태다.',
    '틱톡 커뮤니티에서 자연발생적으로 확산된 연애 조언 챌린지', '짝사랑 응원이나 연애 조언 콘텐츠에 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('공주의 규칙', '공주의-규칙', array['해봄 공주의 규칙']::text[], '유튜버 해봄이 만든 자존감 응원 노래 밈', '유튜버 해봄이 부르고 과나가 프로듀싱한 곡 ''공주의 규칙''이 2025년 3월 힘든 상황에서도 품위를 지키자는 메시지로 화제가 됐다. 후렴구가 자기 위로·응원 영상의 배경음악으로 널리 쓰였다.',
    '유튜버 해봄이 발표한 자체 제작곡', '힘든 순간 스스로를 다독이는 영상에 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('OO이가 MT 가면 보게 될 오빠들', 'OO이가-MT-가면-보게-될-오빠들', array['MT 가면 보게 될 오빠들']::text[], 'MT에서 마주칠 느끼한 오빠들을 나열하는 유머 영상 포맷', 'BTS ''상남자''를 배경음악으로 깔고 ''되고파 너의 오빠'' 가사에 맞춰 술 먹자는 오빠, 달빛 산책 가자는 오빠 등 느끼한 매력을 뽐내는 남자들이 줄줄이 등장하는 영상 포맷으로 2025년 3월 인스타그램 피드를 점령했다. MBC 라디오 등에서도 진행자 소개 코너에 패러디됐다.',
    '인스타그램 릴스에서 확산된 유머 영상 포맷', '오글거리지만 유쾌한 인물 소개·홍보 영상에 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('바람은 왱왱왱 마음은 잉잉잉', '바람은-왱왱왱-마음은-잉잉잉', array['폭싹속았수다 대사','광식이 대사']::text[], '넷플릭스 드라마 명대사가 감성 밈으로 확산', '넷플릭스 드라마 ''폭싹 속았수다''에서 박보검이 연기한 광식의 대사 ''바람은 왱왱왱 마음은 잉잉잉''이 2025년 봄 시청자들 사이에서 감성적이면서도 웃긴 표현으로 회자되며 SNS에 두루 인용됐다.',
    '넷플릭스 드라마 ''폭싹 속았수다''(2025) 대사', '봄바람에 설레거나 울적한 마음을 표현할 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유어 아이돌 챌린지', '유어-아이돌-챌린지', array['Your Idol 챌린지','사자보이즈 챌린지']::text[], '애니메이션 ''케이팝 데몬 헌터스'' 속 그룹 사자보이즈 노래 챌린지', '넷플릭스 애니메이션 ''케이팝 데몬 헌터스''(2025.6.20 공개)에 등장하는 가상 그룹 사자보이즈의 곡 ''유어 아이돌''에 맞춘 안무·직캠 스타일 챌린지가 2025년 7월부터 확산됐다. RM 등 실제 아이돌들도 위버스 라이브 등에서 따라 부르며 화제가 됐다.',
    '넷플릭스 애니메이션 ''케이팝 데몬 헌터스'' OST 수록곡 ''유어 아이돌''', '가상 아이돌 콘셉트의 신나는 댄스 챌린지 영상에 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이건 첫 번째 레슨', '이건-첫-번째-레슨', array['이건 첫번째 레슨~','첫 번째 레슨 밈']::text[], '유노윤호 노래 가사로 잔소리·훈계를 과장되게 표현하는 밈', '동방신기 유노윤호가 2021년 발표한 솔로곡 ''Thank U''의 가사 ''이건 첫 번째 레슨''이 2025년 유튜버 룩삼의 뮤직비디오 리뷰 영상을 통해 재조명됐다. 진지한 표정으로 인생 조언을 설파하는 듯한 가사 톤이 웃음 포인트가 되어, 사소한 결심이나 잔소리를 레슨 형식으로 과장해 말하는 밈으로 확산됐다.',
    '유노윤호의 2021년 곡 ''Thank U'' 가사가 2025년 7월 유튜버 룩삼의 영상으로 재조명되며 역주행', '사소한 결심이나 조언을 웃기게 강조하고 싶을 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잔말 말고 에어컨 파워냉방으로 틀어', '잔말-말고-에어컨-파워냉방으로-틀어', array['파워냉방 밈']::text[], '코미디빅리그 대사로 더위·인기를 동시에 표현하는 유행어', '코미디빅리그 ''나의 장사일지'' 코너에서 개그맨 김용명이 외친 대사가 2025년 여름 다시 화제가 됐다. 실제 무더위를 표현할 때는 물론, 비유적으로 누군가의 인기가 뜨겁다는 것을 강조할 때도 쓰인다.',
    'tvN 코미디빅리그 ''나의 장사일지'' 코너 개그맨 김용명의 대사', '여름 더위나 화제성이 뜨거운 대상을 과장해서 표현할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제가 닥터스트레인지가 아니라서 대답을 못 드리겠어요', '제가-닥터스트레인지가-아니라서-대답을-못-드리겠어요', array['닥터스트레인지 밈']::text[], '확답을 재치있게 회피할 때 쓰는 엑소 카이의 발언', '엑소 카이가 SM타운 콘서트 중 향후 활동을 묻는 즉석 질문에 마블 캐릭터 닥터스트레인지를 빗대 답변한 것이 밈이 됐다. 미래를 예측할 수 없다는 마블 설정을 활용해 확답을 피하는 재치있는 화법으로 인기를 끌었다.',
    '엑소 카이가 SM타운 콘서트 현장에서 즉석으로 한 발언', '확정되지 않은 미래 계획을 재치있게 얼버무릴 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('매끈매끈하다 매끈매끈한', '매끈매끈하다-매끈매끈한', array['매끈매끈하다 챌린지','수능 금지곡']::text[], '형용사를 리듬감 있게 반복하는 한국어 암기송 챌린지', '프랑스 출신 방송인 카니가 MBC 유튜브 웹예능 ''카니를 찾아서''에서 한국어 형용사를 외우기 위해 즉흥으로 만든 노래에서 시작됐다. ''매끈매끈하다 매끈매끈한'', ''울퉁불퉁하다 울퉁불퉁한'' 등 형용사 반복과 즉석 안무가 중독적이라는 반응을 얻으며 2025년 11월 대학수학능력시험을 앞두고 ''수능 금지곡''으로 불릴 만큼 크게 유행했다.',
    'MBC 유튜브 웹예능 ''카니를 찾아서''에서 프랑스 출신 방송인 카니가 한국어 학습 중 만든 즉흥 암기송', '형용사 자리에 원하는 단어를 넣어 패러디 콘텐츠를 만들 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('골반통신', '골반통신', array['골반이 안 멈추는데 어떡해','골반춤 밈']::text[], '어떤 상황에서도 골반춤이 멈추지 않는다는 콘셉트의 숏폼 시리즈', '크리에이터 퐁귀가 제작한 숏폼 상황극 시리즈로, 아이돌그룹 AOA의 2014년 곡 ''짧은 치마''를 배경음악으로 써서 ''골반이 멈추지 않는 병''에 걸린 상황을 연기한다. ''골반통신: 이상 감지'', ''가속 모드 진입'' 같은 자막과 함께 원곡이 음원 차트에서 역주행하는 결과로 이어졌다.',
    '크리에이터 퐁귀의 숏폼 상황극 시리즈, AOA ''짧은 치마''를 배경음악으로 사용', '긴장되거나 불안정한 상황을 웃기게 과장 표현할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('알고리즘에 나타나기로 마음먹음', '알고리즘에-나타나기로-마음먹음', array['쉐이칸샹 챌린지','谁敢想 챌린지']::text[], '짝사랑 상대 SNS 알고리즘에 뜨겠다며 추는 중국풍 댄스 챌린지', '중국 SNS 도우인에서 유행한 애니메이션 삽입곡 ''쉐이칸샹(谁敢想, 누가 상상이나 했겠어)''에 맞춰 추는 춤이 한국식으로 변형됐다. ''OO가 문자를 안 봐서 알고리즘에 나타나기로 마음먹음''이라는 절실한 사연 문구를 적고 춤을 춰 상대방 SNS에 뜨겠다는 의미로, 관공서 홍보 영상으로도 많이 활용됐다.',
    '중국 도우인에서 유행한 애니메이션 삽입곡 ''쉐이칸샹'' 댄스 챌린지가 한국식 사연 문구와 결합해 변형', '짝사랑 상대나 특정 대상에게 존재감을 알리고 싶은 상황을 홍보 영상 등에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('WOW 섹시푸드', 'WOW-섹시푸드', array['섹시푸드 밈']::text[], '너무 맛있어 보이는 음식 앞에서 감탄하는 표현', '엔믹스 해원이 예능 프로그램에서 비주얼이 강렬한 음식을 보고 한 표현에서 시작됐다. 성적인 의미는 전혀 없고 순수하게 ''군침 도는 비주얼''을 강조하는 감탄사로, 시각적 자극이 강한 먹방·음식 콘텐츠에서 널리 쓰인다.',
    '엔믹스 해원이 예능 프로그램에서 음식을 보고 한 발언에서 시작', '비주얼이 강한 음식 콘텐츠에서 순수한 감탄 표현으로 사용', '''섹시''라는 단어 때문에 성적인 뉘앙스로 오해될 수 있어 음식 한정 맥락임을 명확히 해야 함',
    'yellow'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('골든 챌린지', '골든-챌린지', array['Golden 챌린지','혼문 챌린지']::text[], '넷플릭스 ''케이팝 데몬 헌터스'' 삽입곡 골든 커버·댄스 챌린지', '2025년 6월 공개된 넷플릭스 애니메이션 ''케이팝 데몬 헌터스'' 속 걸그룹 헌트릭스의 노래 ''Golden''을 부르거나 안무를 따라 하는 챌린지가 여름 내내 SNS를 휩쓸었다. 아카펠라, 밴드 버전 등 다양한 형태로 확산됐으며, 완창에 성공하면 극중 설정을 빗대 ''혼문 완성''이라 부르는 유머도 함께 유행했다.',
    '넷플릭스 오리지널 애니메이션 ''케이팝 데몬 헌터스''(2025년 6월 공개) 삽입곡 ''Golden''', '노래 실력을 뽐내거나 완성도 높은 커버를 자랑할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('소다팝 챌린지', '소다팝-챌린지', array['Soda Pop 챌린지','사자보이즈 챌린지']::text[], '케이팝 데몬 헌터스 속 가상 보이그룹 사자보이즈 노래 안무 챌린지', '''케이팝 데몬 헌터스''에 등장하는 가상 그룹 ''사자보이즈''의 노래 ''Soda Pop'' 안무를 따라 하는 챌린지로, 2025년 7~8월 보이넥스트도어·라이즈·제로베이스원 등 실제 아이돌들이 잇달아 도전하며 확산됐다. 방탄소년단 RM이 라이브 방송에서 따라 부르기도 했고, 정부 부처 홍보 영상에도 활용됐다.',
    '넷플릭스 애니메이션 ''케이팝 데몬 헌터스'' 속 가상 그룹 ''사자보이즈''의 삽입곡 ''Soda Pop''', '아이돌 안무 챌린지 콘텐츠나 홍보 영상에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내가 그걸 모를까', '내가-그걸-모를까', array['내가그걸모를까']::text[], '당연한 잔소리에 퉁명스럽게 응수하는 버벌진트 노래 밈', '래퍼 버벌진트가 2021년 발매한 곡의 후렴구가 4년 만인 2025년 중순부터 릴스·쇼츠에서 역주행했다. 상대가 하는 뻔한 소리에 ''내가 그걸 모를까''라고 답하는 퉁명스럽고 자신감 있는 톤이 공감을 얻어 다양한 상황극 콘텐츠의 배경음으로 쓰였다.',
    '버벌진트가 2021년 발매한 곡이 2025년 중순 숏폼 플랫폼에서 갑자기 역주행', '당연한 지적이나 잔소리에 대한 억울함·체념을 표현할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나무 챌린지', '나무-챌린지', array['나무 댄스 챌린지']::text[], '잔잔한 발라드에 안 어울리게 팔다리를 흔드는 반전 댄스 챌린지', '카더가든이 2019년 발표한 발라드 ''나무''는 사랑하는 사람과의 소중한 순간을 나무에 비유한 잔잔한 곡이다. 2025년 릴스·쇼츠에서 이 곡에 맞춰 전혀 어울리지 않게 팔과 다리를 정신없이 흔드는 반전 춤을 추는 것이 ''나무 챌린지''로 유행했다.',
    '카더가든의 2019년 발라드 ''나무''에 안 어울리는 격렬한 춤을 붙인 반전 콘셉트 챌린지', '잔잔한 노래와 예상 밖의 격렬한 동작을 대비시키는 반전 콘텐츠에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('부엉이 춤 챌린지', '부엉이-춤-챌린지', array['새춤 부엉이 챌린지','AI 부엉이 챌린지']::text[], 'AI로 만든 부엉이 캐릭터와 함께 추는 새춤 챌린지', '2025년 11월경 틱톡을 중심으로 유행한 챌린지로, AI로 생성한 부엉이·새 캐릭터가 함께 춤을 추는 영상 포맷이다. 사용자가 직접 새춤 동작을 따라 추고 AI가 생성한 부엉이 캐릭터를 합성해 올리는 방식으로 확산됐다.',
    'AI 생성 캐릭터를 활용한 콘텐츠 유행 속에서 등장한 새춤·부엉이 테마 댄스 챌린지', 'AI 합성 영상 놀이나 귀여운 동물 테마 챌린지에 참여할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('힙사사돈 챌린지', '힙사사돈-챌린지', array['힙합보단 사랑 사랑보단 돈']::text[], '무명 래퍼 노아주다의 곡이 댄스 챌린지로 역주행한 밈', '래퍼 노아주다의 곡 ''힙합보단 사랑, 사랑보단 돈''(줄여서 힙사사돈)은 사랑·현실·돈에 대한 고민을 솔직하고 재치있게 담은 곡이다. 한림예술고등학교 학생 댄스팀 ''Moshpit''이 만든 안무 영상이 2025년 12월경 SNS에서 크게 유행하며 라이즈, 아일릿 등 아이돌들도 챌린지에 동참했다.',
    '노아주다의 곡에 한림예술고 학생 댄스팀 ''Moshpit''이 만든 안무 영상이 2025년 12월 유행 촉발', '중독성 있는 안무 챌린지 콘텐츠에 참여하고 싶을 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이라이라 챌린지', '이라이라-챌린지', array['이라이라 짜증 챌린지']::text[], '짜증난 표정을 귀엽게 연기하는 일본발 댄스 챌린지', '일본어 ''이라이라(짜증나다)''에서 이름을 딴 챌린지로, 일본 힙합 유닛 ''超☆ヤンキース''의 곡 ''ANGER MARK'' 중 ''이라이라~'' 파트에 맞춰 손가락으로 뿔 모양을 만들고 새침하게 짜증내는 표정을 짓는 안무다. 일본 학생들 사이에서 시작해 아이브 레이, 엔시티 위시 유우시 등 한국 아이돌들도 참여하며 확산됐다.',
    '일본 힙합 유닛 ''超☆ヤンキース''의 곡 ''ANGER MARK''에 맞춘 일본발 댄스 챌린지가 한국에 유입', '짜증나는 상황을 귀엽게 승화하는 챌린지 콘텐츠에 활용', '일본어 원곡 기반 밈으로 원출처를 밝히는 것이 좋음',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('화사-박정민 청룡영화상 무대 밈', '화사-박정민-청룡영화상-무대-밈', array['전남친 밈','굿 굿바이 무대 밈']::text[], '화사 신곡 무대에 박정민이 등장해 만든 멜로 케미 밈', '제46회 청룡영화상 시상식에서 화사가 신곡 ''굿 굿바이(Good Goodbye)'' 무대를 선보이던 중, 뮤직비디오에 출연했던 배우 박정민이 객석에서 걸어 나와 무대에 합류했다. 진짜 이별하는 연인 같은 눈빛 연기로 화제가 되며 ''전남친 밈''이 만들어졌고, 무대 영상은 유튜브에서 수백만 조회수를 기록했다.',
    '2025년 11월 제46회 청룡영화상 화사·박정민의 ''굿 굿바이'' 축하 무대', '연출된 무대 퍼포먼스임을 알고 재미로 언급하는 용도', '실제 열애설로 오인해 확산하지 않도록 무대 콘텐츠임을 명시해야 함',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('귀하게 자란 내가 이런 걸', '귀하게-자란-내가-이런-걸', array['귀하게 자란 내가 이런 걸 봐도 될까']::text[], '충격적이거나 대단한 콘텐츠를 본 뒤의 심경을 표현하는 밈', '개그 유튜브 채널 피식대학의 ''Sea of Love'' 패러디 영상과 원본을 비교한 게시물 댓글에서 한 유저가 ''귀하게 자란 내가 이런 걸 봐도 될까?''라고 쓴 것이 공감을 얻어 밈으로 퍼졌다. 멋지거나 흔치 않은 콘텐츠를 볼 땐 ''봐야지'', 황당한 콘텐츠를 봤을 땐 ''봐도 될까''로 변형해 쓴다.',
    '피식대학 ''Sea of Love'' 패러디 영상 비교 게시물의 댓글에서 시작', '인상적이거나 황당한 영상 콘텐츠에 대한 반응으로 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고무짜기 ASMR', '고무짜기-ASMR', array['고무나무 짜기']::text[], '고무나무 라텍스를 손으로 짜고 다듬는 촉각 자극 콘텐츠', '고무나무에서 채취한 라텍스를 손으로 잡아당기거나 짜내는 과정을 촬영한 ASMR 콘텐츠로, 마치 모차렐라 치즈처럼 늘어나는 질감이 팅글감을 준다는 반응을 얻으며 2025년 10월경 유행했다. 완전히 굳지 않은 상태를 좋아하는 취향과 잘 익어 단단한 상태를 좋아하는 취향으로 갈려 토론이 벌어지기도 했다.',
    '고무나무 라텍스 채취·가공 과정을 촬영한 촉각 ASMR 콘텐츠 유행', '촉각 자극형 ASMR 콘텐츠나 질감 소개 콘텐츠에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('딱지녀 밈', '딱지녀-밈', array['케이트 블란쳇 딱지우먼']::text[], '오징어게임 시즌3 결말의 깜짝 카메오가 만든 밈', '2025년 6월 공개된 ''오징어게임'' 시즌3 마지막화에서 할리우드 배우 케이트 블란쳇이 LA 뒷골목에서 딱지치기 참가자를 모집하는 ''딱지우먼''으로 깜짝 출연했다. 시즌1의 공유 카메오를 연상시키는 연출로, 등장 자체가 소셜미디어에서 큰 화제를 모으며 ''딱지녀 밈''으로 불렸다.',
    '넷플릭스 ''오징어게임'' 시즌3(2025년 6월 공개) 마지막화 케이트 블란쳇 카메오 장면', '의외의 인물이 예상치 못한 곳에 등장하는 상황을 언급할 때', '시즌3 결말 스포일러이므로 언급 시 주의',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뛰어(JUMP) 챌린지', '뛰어(JUMP)-챌린지', array['블랙핑크 뛰어 챌린지']::text[], '블랙핑크 신곡 안무를 따라 하는 댄스 챌린지', '2025년 발표된 블랙핑크의 신곡 ''뛰어(JUMP)''는 발매 당일 스포티파이 K팝 데뷔 최고 스트리밍 기록을 세우며 빌보드 글로벌 200 1위에 올랐다. 중독성 있는 후렴구와 함께 안무를 따라 하는 ''뛰어 챌린지''가 틱톡·릴스에서 크게 유행했다.',
    '블랙핑크의 2025년 신곡 ''뛰어(JUMP)'' 안무를 따라 하는 댄스 챌린지', '케이팝 안무 챌린지 콘텐츠에 참여할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('WICKED 챌린지', 'WICKED-챌린지', array['올데이 프로젝트 위켓 챌린지']::text[], '신인 그룹 올데이 프로젝트 데뷔곡 안무 챌린지', '2025년 6월 데뷔한 더블랙레이블 5인조 혼성 그룹 ALLDAY PROJECT의 더블 타이틀곡 ''WICKED'' 안무를 따라 하는 챌린지가 데뷔와 동시에 SNS에서 확산됐다. 실험적인 비트와 개성 강한 퍼포먼스가 화제를 모으며 신인답지 않은 인기를 얻는 데 기여했다.',
    'THEBLACKLABEL 신인 그룹 ALLDAY PROJECT의 2025년 6월 데뷔곡 ''WICKED'' 안무 챌린지', '신인 아이돌 데뷔곡 챌린지 콘텐츠에 참여할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('얼음 (성기훈 얼음 뮤지컬)', '얼음-(성기훈-얼음-뮤지컬)', array['긴장 말아요 얼음']::text[], '오징어게임2 대사를 뮤지컬풍으로 편집해 유행한 밈', '유튜버 제프프가 넷플릭스 ''오징어게임 시즌2'' 속 성기훈(이정재)이 다급하게 외친 ''얼음'' 관련 대사 장면을 뮤지컬 형식의 멜로디로 편집해 올린 것이 2025년 초 크게 유행했다. 급박한 상황의 대사에 경쾌한 멜로디를 입힌 반전 편집이 중독성 있다는 반응을 얻었다.',
    '유튜버 제프프가 넷플릭스 ''오징어게임 시즌2'' 대사 장면을 뮤지컬 형식으로 편집한 패러디 영상', '긴박한 상황을 경쾌하게 반전시켜 표현하고 싶을 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나니가 스키', '나니가-스키', array['나니가스키','愛♡スクリーム 챌린지']::text[], '애니메이션 러브라이브 곡의 질문-답변 파트 립싱크 챌린지', '애니메이션 ''러브라이브'' 유닛 AiScReam의 곡 ''愛♡スクリ〜ム!'' 중 ''나니가 스키(무엇을 좋아해)?''라는 질문에 ''아나타(바로 너)!''라고 답하는 파트가 립싱크·댄스 챌린지로 확산됐다. 성우들의 각기 다른 말투와 목소리 톤이 재미 포인트가 되어 일본은 물론 한국 틱톡에서도 유행했다.',
    '애니메이션 ''러브라이브'' 유닛 AiScReam의 곡 ''愛♡スクリ〜ム!''의 질문-답변 파트', '좋아하는 대상을 애정 어린 질문-답변 형식으로 표현할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('괜찮아 딩딩딩', '괜찮아-딩딩딩', array['딩딩딩 챌린지']::text[], '베트남 래퍼의 곡을 케이팝 아이돌들이 따라 하며 유행시킨 댄스 챌린지', '베트남 힙합 경연 프로그램 ''RAP VIET'' 출연곡인 7dnight의 ''Không Sao Cả(괜찮아)''가 인도네시아 스트리머의 방송 멘트와 결합해 밈이 되었다. 단순하고 따라 하기 쉬운 춤 동작 덕분에 에스파, 제로베이스원 등 케이팝 아이돌들의 챌린지 참여로 확산됐다.',
    '베트남 래퍼 7dnight의 곡 ''Không Sao Cả''가 인도네시아 스트리머 방송 멘트와 결합해 확산', '간단한 동작으로 따라 하기 쉬운 댄스 챌린지가 필요할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지드래곤 홈 스윗 홈 챌린지', '지드래곤-홈-스윗-홈-챌린지', array['무릎 깨져도 챌린지']::text[], '태양이 넘어진 순간을 안무로 재해석한 반전 댄스 챌린지', '지드래곤의 무대 ''HOME SWEET HOME'' 공연 중 태양이 춤을 추다 넘어진 장면을, 팬들이 ''이건 실수가 아니라 원래 안무였다''며 그대로 따라 추는 챌린지로 재탄생시켰다. 지드래곤 본인도 자신의 SNS에 챌린지 모음을 올리고 ''무릎 하나 깨진다고 생각하고 돌려라''라고 언급하며 함께 즐겼다.',
    '지드래곤 무대 ''HOME SWEET HOME'' 공연 중 태양이 넘어진 장면을 팬들이 안무처럼 재해석', '실수를 의도한 것처럼 재치있게 넘기는 콘텐츠에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('칠 가이 챌린지', '칠-가이-챌린지', array['Chill Guy 챌린지']::text[], '여유로운 태도의 캐릭터를 따라 하는 릴스 댄스 챌린지', '미국 X 사용자 필립 뱅크스가 만든 캐릭터 ''칠 가이''는 회색 스웨터와 청바지 차림으로 어떤 상황에도 무심하고 여유로운 태도를 유지하는 것이 특징이다. 지아 마가렛의 곡 ''Hinoki Wood''에 맞춘 릴스 댄스 챌린지로 세계적으로 확산됐고, 한국에서도 인플루언서들의 챌린지 영상이 수백만 조회수를 기록하며 크게 유행했다.',
    '미국 X 사용자 필립 뱅크스가 만든 캐릭터 ''칠 가이''가 릴스 댄스 챌린지로 세계적 확산', '어떤 상황에도 여유롭고 무던한 태도를 표현하고 싶을 때', '해외에서 만들어진 캐릭터로, 국내 원조 밈은 아님을 인지하고 사용',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('퉁퉁퉁 사후르', '퉁퉁퉁-사후르', array['Tung Tung Tung Sahur']::text[], 'AI로 생성된 이탈리안 브레인롯 캐릭터 시리즈 중 하나', '야구방망이를 든 나무 몸통 형태의 AI 생성 캐릭터로, ''세 번 불러도 쳐다보지 않으면 찾아온다''는 무의미한 설정의 짧은 AI 영상들이 이어지며 이른바 ''이탈리안 브레인롯'' 밈 시리즈를 이뤘다. 해외에서 시작됐지만 2025년 한국 10대들 사이에서도 크게 유행했다.',
    '해외에서 시작된 AI 생성 ''이탈리안 브레인롯'' 캐릭터 시리즈 중 하나로, 짧은 AI 영상 형태로 확산', '맥락 없는 유머 코드를 아는 또래 사이에서 농담으로 사용', '의미 없는 AI 생성 콘텐츠(브레인롯)로, 과도한 소비·확산은 콘텐츠 질 저하 논란의 대상이 될 수 있음',
    'yellow'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2025, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('첫눈이 내려와 챌린지', '첫눈이-내려와-챌린지', array['창밖에 첫눈이 내려와 챌린지']::text[], '첫눈 오는 날 노래에 맞춰 추는 겨울 댄스 챌린지', '다이나믹듀오·박정현의 노래 가사 ''창밖에 첫눈이 내려와''에 맞춰 추는 겨울 시즌 댄스 챌린지로, 2025년 11월경 첫눈이 내리는 시기에 맞춰 틱톡·릴스에서 유행했다. 설렘과 반가움을 담은 잔잔한 안무가 특징이다.',
    '다이나믹듀오·박정현의 노래 가사를 활용한 첫눈 테마 겨울 댄스 챌린지', '첫눈이 오는 겨울철 감성 콘텐츠에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2025, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('윤정아 윤정아 챌린지', '윤정아-윤정아-챌린지', array['뀨','왜요쌤 챌린지','윤정아 왜요쌤']::text[], '왜요쌤~ 하고 되받는 콜앤리스폰스 댄스 챌린지', '2026년 1월 5일 초등학생 김지윤·편다은이 개그우먼 정이랑의 유튜브 콩트 ''쇼팽피아노학원'' 속 서윤정 캐릭터를 오마주해 만든 챌린지. ''윤정아 윤정아/왜요쌤 왜요쌤/(행동) 하지 말랬지/죄송해요 쌤 뀨'' 구조로 이름과 상황만 바꾸면 누구나 응용 가능해 아이돌부터 일반인까지 폭넓게 퍼졌다.',
    '정이랑 유튜브 ''쇼팽피아노학원'' 서윤정 캐릭터를 본뜬 초등학생들의 인스타 릴스', '친구나 가족끼리 장난스러운 잔소리 상황극을 할 때 사용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('좋다 (쑥부르스)', '좋다-(쑥부르스)', array['좋🤙다👍','쑥부르스 손동작']::text[], '새끼손가락·엄지를 세워 만족감을 표현하는 손동작 밈', '개그맨 김해준의 유튜브 콘텐츠 ''낭만부부'' 성남 모란시장 편에서 한 일반인이 보여준 손동작에서 시작됐다. 새끼손가락으로 ''좋'', 엄지척으로 ''다''를 표현하며 소소한 만족이나 긍정을 나타낸다. 유튜브 코리아 공식 계정도 언급하며 화제가 됐다.',
    '김해준 유튜브 ''낭만부부'' 모란시장 편 등장 일반인의 손동작', '소소하게 만족스러운 상황에 가볍게 손동작과 함께 쓰기', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('난리자베스', '난리자베스', array['자베스','슬프자베스','행복자베스']::text[], '감정 뒤에 ''자베스''를 붙이면 완성되는 만능 감탄 표현', '인스타그램 크리에이터 오상추가 ''2026년 유행어 배포합니다''라며 올린 릴스(조회수 213만)에서 시작됐다. ''난리''와 ''엘리자베스''를 합친 언어유희로 [감정]+자베스 구조로 무한 응용되며 긍정·부정 상황 모두에 쓸 수 있다.',
    '인스타그램 크리에이터 오상추(@oh_sangchu)의 신년 유행어 선포 릴스', '감탄이나 호들갑 떠는 상황에 가볍게 붙여쓰기', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('냐냐냥', '냐냐냥', array['냐냐냥!!!']::text[], '다음 내용 궁금하면 댓글로 ''냐냐냥''을 입력하라는 궁금증 유발 밈', '2023년 카카오톡·커뮤니티 썰에서 다음 이야기가 궁금하면 ''냐냐냥!!!''을 입력하라던 대화가 원형이다. 2026년 3월 X와 인스타그램, 브랜드 계정에서 다시 살아나 댓글을 유도하는 마케팅 문구로도 널리 쓰였다.',
    '2023년 카카오톡 대화 캡처에서 시작, 2026년 3월 재유행', 'SNS 게시물이나 영상 캡션에서 다음 내용을 궁금하게 만들 때', '너무 남발하면 낚시성으로 비칠 수 있음',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('장항준적 사고', '장항준적-사고', array['항준적 사고']::text[], '남 시선 대신 내 행복을 우선하는 정신승리형 긍정 사고', '영화감독 장항준이 유튜브 콘텐츠에 출연해 ''아무리 부자라도 결국 늙어서 지팡이 짚는다, 그렇게 생각하면 기분이 나아진다''는 취지의 정신승리 화법을 보여주며 화제가 됐다. 장원영의 ''원영적 사고''를 뒤집은 반대급부 버전으로 2026년 2월 유행했다.',
    '장항준 감독의 유튜브 예능 출연 발언', '귀찮은 일을 합리화하거나 자기 위안할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('김동현 밈 (운동 많이 된다)', '김동현-밈-(운동-많이-된다)', array['운동 많이 된다','오늘 운동 많이 된다']::text[], '전 UFC 선수 김동현의 담백한 긍정 화법이 유행어가 된 밈', '전 UFC 파이터 김동현이 유튜브 콘텐츠에서 운동 영상이나 일상 영상에 ''운동 많이 된다'', ''오늘 자기 전에 생각 많이 날 거다'' 같은 툭 던지는 담백한 코멘트를 반복하면서 화제가 됐다. 과장 없는 유쾌한 긍정 마인드가 밈으로 확산됐다.',
    '김동현 유튜브 채널 콘텐츠 속 반복 코멘트', '운동이나 힘든 상황을 긍정적으로 포장할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('거제 야호', '거제-야호', array['야호 밈','거제야호']::text[], '일본어 인사 ''야호''에 지역명을 붙여 외치는 반전 리액션 밈', '리센느 멤버 미나미가 원이의 유튜브 여행 콘텐츠에서 거제도 방문 중 갑자기 ''거제 야호-!''를 외치자 원이가 황당해하는 리액션이 화제가 됐다. 이후 거제시 공식 SNS가 반응하고 멤버 전원이 거제시 홍보대사로 위촉되는 등 지역 마케팅으로도 이어졌다.',
    '리센느 원이의 유튜브 채널 거제도 여행 콘텐츠', '지역명이나 이름을 넣어 ''~야호''로 밝은 인사말 대신 쓰기', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('파라파라나 춰야겠다', '파라파라나-춰야겠다', array['파라파라 밈']::text[], '난감한 상황을 현실 회피하듯 웃어넘기는 리액션 문장', '리센느 미나미가 거제도 여행 영상에서 갸루 메이크업을 한 채 무반주로 일본식 레트로 댄스 ''파라파라''를 추기 시작하며 나온 대사. 곤란한 상황에서 ''모르겠고 파라파라나 춰야겠다''는 식으로 현실을 귀엽게 회피하는 정서가 공감을 얻어 밈이 됐다.',
    '리센느 원이 유튜브 채널의 거제도 여행 콘텐츠(미나미 갸루 코너)', '곤란하거나 하기 싫은 상황을 웃으며 회피할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=kuiRY7_LLqk', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'kuiRY7_LLqk', 'https://www.youtube.com/watch?v=kuiRY7_LLqk', true from memes where slug = '파라파라나-춰야겠다'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('모시모시 챌린지', '모시모시-챌린지', array['모시모시 키코에테루','전화전화 챌린지']::text[], '일본 노래 ''mosi mosi?''에 맞춘 귀여운 손동작 댄스 챌린지', '일본 음악 크리에이터 sasane의 미발매곡 ''mosi mosi?''를 배경음악으로 한 댄스 챌린지. 전화를 걸 때 인사인 ''모시모시''와 ''들리니?(키코에테루)''를 결합한 가사에 맞춰 귀여운 손동작과 표정을 강조한 춤으로 한중일 등 아시아권에서 확산됐다.',
    '일본 음악크리에이터 sasane의 미발매곡을 활용한 틱톡 댄스 챌린지', '귀여운 컨셉의 룩북·자기소개 영상에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('셋로그', '셋로그', array['SETLOG','화면분할 브이로그','N분할 브이로그']::text[], '친구들의 하루를 짧게 찍어 한 화면에 모으는 분할 브이로그 형식', '''세팅한다(Set)''와 ''기록한다(Log)'', 그리고 셋(3명)을 결합한 이름의 브이로그 앱·형식. 여러 사람이 각자 찍은 2초 안팎의 짧은 영상을 별도 편집 없이 한 화면에 자동 배치해 하루를 압축한다. 인스타그램식 전시 피로에 지친 Z세대 사이에서 2026년 봄 앱스토어 1위까지 오르며 확산됐다.',
    'N분할 브이로그·1초 브이로그 트렌드에서 발전한 앱 ''셋로그'' 유행', '친구들과 소소한 일상을 가볍게 기록하고 싶을 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('기도해드릴게요', '기도해드릴게요', array['기도 밈','김성재 목사 밈']::text[], '모두의교회 김성재 목사의 독특한 기도 말투가 유행어가 된 밈', '모두의교회 김성재 목사가 매일 오전 6시 ''prayer for you'' 형식의 기도 숏폼을 올리며, 반 배정이나 다이어트 같은 일상적 소망까지 진지하게 기도해주는 콘텐츠로 화제가 됐다. 특유의 ''기도해드릴게요'' 말투를 따라 하는 것이 하나의 밈이 되어 2026년 3월 전후로 확산됐다.',
    '모두의교회 김성재 목사의 유튜브·SNS 매일 기도 숏폼', '누군가를 위로하거나 축복하는 말을 장난스럽게 건넬 때', '종교적 맥락이라 과도하게 조롱하듯 쓰면 불쾌감을 줄 수 있음',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('조폭처럼 직업 소개 밈', '조폭처럼-직업-소개-밈', array['불법 조직처럼 직업 소개']::text[], '평범한 직업을 범죄 조직 소개하듯 과장해서 설명하는 밈', '승무원을 ''백여 명을 금속관에 가둔 뒤 수만 피트 상공에서 감시하는 사람''처럼, 피부관리사를 ''피부 겉면을 깎아내고 방치시키는 사람''처럼 표현하는 식으로 익숙한 직업을 범죄 조직 소개 영상처럼 과장하는 포맷. 2026년 6월 숏폼에서 크게 유행했다.',
    '직업을 과장되게 묘사하는 기존 유머가 ''불법 조직 소개'' 포맷으로 변형', '본인 직업을 유머러스하게 셀프 디스할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Green Green (그린그린 레드레드)', 'Green-Green-(그린그린-레드레드)', array['그린그린','레드레드','That''s red red']::text[], '긍정은 그린그린, 부정은 레드레드로 색깔에 빗대 평가하는 밈', 'K팝 그룹 코르티스(CORTIS)의 곡 ''RED RED''에서 파생된 표현 문법. 눈치 보거나 소극적인 행동엔 ''레드레드'', 적극적이고 도전적인 행동엔 ''그린그린''을 붙이며, ''샐러드 시키기 그린그린, 마라탕 마라탕 댓츠 레드레드''처럼 비교 콘텐츠에 두루 활용됐다. 2026년 5월 유행했다.',
    '코르티스 ''RED RED'' 가사에서 파생된 표현 밈', '비포&애프터, 선택 비교 콘텐츠에 붙여 쓰기 좋음', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('공룡만해 밈', '공룡만해-밈', array['공룡밈','널 좋아하는 마음이 공룡만해']::text[], '커진 감정을 ''공룡만 하다''에 비유해 표현하는 밈', '''널 좋아하는 마음이 커졌어, 진짜 커, 막 공룡만 해'' 같은 문장이 X에서 2.2만 회 이상 공유되며 확산됐다. 이후 인스타그램 ''공룡밈'' 계정이 공룡 사진으로 다양한 인터넷 밈을 패러디하며 자기 위로용 밈으로도 활용됐다. 2026년 4월 유행했다.',
    'X(트위터)의 감정 과장 트윗과 인스타그램 ''공룡밈'' 계정 릴스', '커진 애정이나 감정을 과장해서 귀엽게 표현할 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('위아원 처하자', '위아원-처하자', array['처하자 밈']::text[], '엑소 팬덤에서 시작된 ''함께하자''는 뜻의 신조어 밈', '한 팬이 챗GPT에 엑소 팬픽을 써달라 요청한 글에서 어색한 말투 ''위아원 처하자''가 탄생, 엑소의 공식 구호 ''WE ARE ONE''에 ''처하자''를 붙인 형태로 팬덤 내 유행어가 됐다. 예능 ''집대성''에서 카이가 이 밈을 접하고 당황하는 리액션이 나오며 2026년 1월 재확산됐다.',
    '엑소 팬덤 커뮤니티의 AI 팬픽 캡처에서 시작', '좋아하는 것을 같이 하자고 권할 때 팬덤 용어로 사용', '팬덤 맥락을 모르면 이해하기 어려운 인싸 용어',
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('젓가락 워킹', '젓가락-워킹', array['젓가락 워킹 챌린지','연필 워킹']::text[], '젓가락 두 짝이 시크하게 워킹하듯 움직이는 스톱모션 챌린지', '비트감 있는 음악에 맞춰 젓가락 두 짝을 다리처럼 움직여 마치 모델처럼 ''워킹''하게 만드는 스톱모션·핸드무빙 챌린지. 2026년 2월 중반부터 유튜브 쇼츠·틱톡 알고리즘을 타고 폭발적으로 확산됐으며, 연필 워킹 등 다른 사물로도 변형됐다.',
    '유튜브 쇼츠·틱톡에서 시작된 사물 의인화 스톱모션 챌린지', '짧고 리드미컬한 소품 활용 챌린지 영상 만들 때', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('홍명보 밈 (Fight, 싸워)', '홍명보-밈-(Fight,-싸워)', array['홍명보 싸워 밈']::text[], '선수들 무표정과 대비된 감독의 ''싸워'' 구호가 재조명된 밈', '홍명보 전 축구대표팀 감독이 과거 경기 전 미팅에서 선수들에게 ''싸워''를 외치던 영상이 감독 사퇴 이후 다시 화제가 됐다. 무표정한 선수들과 뻔한 구호의 대비가 웃음을 유발했고, 산림청 홍천국유림관리소 등 공공기관 콘텐츠에서도 패러디됐다. 2026년 6월 유행했다.',
    '홍명보 감독의 과거 대표팀 미팅 영상 재조명', '형식적인 응원 구호를 패러디할 때', '실존 인물과 실패한 성과를 다루므로 조롱조로 쓰지 않도록 주의',
    'yellow'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2026, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('간바레 챌린지', '간바레-챌린지', array['간바레 원본','頑張りたい人へ 챌린지']::text[], '3분할 화면에 안무·표정·가창을 담은 일본발 댄스 챌린지', '일본 음악크리에이터 오다마요네즈의 곡 ''頑張りたい人へ''(원래 버추얼 유튜버 영상에 쓰임)를 활용, 리듬·안무·표정·가창을 세 개로 분할한 화면에 담아 편집하는 챌린지. 걸그룹 CSR 유나가 만든 버전이 한 달 만에 약 900만 조회수를 기록하며 장원영 등 K팝 아이돌들의 참여로 확산됐다.',
    '일본 오다마요네즈 음원을 활용한 CSR 유나의 3분할 편집 영상', '노래·안무·리액션을 한 화면에 담는 자기소개 영상에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('베이비몬스터 춤(CHOOM) 챌린지', '베이비몬스터-춤(CHOOM)-챌린지', array['Let''s CHOOM 챌린지']::text[], '베이비몬스터 신곡 ''춤''의 파워풀한 포인트 안무 챌린지', '베이비몬스터의 미니 3집 타이틀곡 ''춤(CHOOM)'' 발매 이틀 반나절 만에 관련 챌린지 영상이 10만 개를 돌파했다. ''Let''s CHOOM'' 구호에 맞춘 팔 동작과 ''Watch out'' 가사의 손동작 반전 포인트 안무를 YG 양현석 총괄이 직접 참여해 만들었다. 2026년 5월 전 세계로 확산됐다.',
    '베이비몬스터 ''춤(CHOOM)'' 뮤직비디오 공식 안무', 'K팝 댄스 챌린지 참여, 커버 영상 제작에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이채연 NTOTD 댄스챌린지', '이채연-NTOTD-댄스챌린지', array['No Tears On The Dancefloor 챌린지','노티어스온더댄스플로어']::text[], '이채연 신곡 포인트 안무를 K팝 아티스트들이 릴레이로 추는 챌린지', '이채연의 미니 4집 타이틀곡 ''No Tears On The Dancefloor''(NTOTD)의 댄스 챌린지에 레드벨벳 슬기, (여자)아이들 전소연, 스트레이키즈 현진, 몬스타엑스 셔누 등 다수의 K팝 아티스트가 참여하며 화제가 됐다. 2026년 5월 틱톡·릴스·쇼츠에서 폭발적으로 확산됐다.',
    '이채연 미니 4집 ''Till I Die'' 타이틀곡 공식 챌린지', 'K팝 댄스 챌린지, 포인트 안무 커버 영상에 활용', null,
    'green'::safety_level, 'active'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2026, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;

commit;
