-- 밈캐치 시드 배치 6 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('렛츠 기릿', '렛츠-기릿', array['Let''s Get It','박재범 유행어']::text[], '쇼미더머니6에서 박재범이 비트 시작마다 외친 유행어', '2017년 Mnet ''쇼미더머니6''에서 박재범이 참가자 랩 시작 전 특유의 발음으로 외친 ''Let''s Get It''이 시즌 대표 유행어가 되었다. 시즌3 ''턴업'', 시즌4 ''어차피 우승은 송민호'', 시즌5 ''짬에서 나오는 바이브''를 잇는 쇼미더머니 시리즈 유행어 계보로 꼽힌다.',
    'Mnet ''쇼미더머니6''(2017) 박재범 진행 멘트', '국힙 서바이벌 프로그램 유행어를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/SHOW ME THE MONEY 6', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('TT 눈물 포즈', 'TT-눈물-포즈', array['TT포즈','트와이스 TT춤']::text[], '트와이스 ''TT'' 후렴구에서 손으로 TT자를 만드는 눈물 안무', '트와이스 ''TT''의 후렴구 안무에서 멤버들이 두 손으로 알파벳 T를 만들어 우는 표정을 짓는 동작이 이모티콘 ''ㅜㅜ(TT)''를 형상화했다는 해석과 함께 큰 화제를 모았다. 일본 등 해외 방송에서도 유행 댄스 순위에 오르며 K팝 팬덤을 넘어 널리 패러디됐다.',
    'TWICE ''TT''(2016.10) 안무', '''너무 슬프다''는 반응을 코믹하게 표현할 때 TT포즈 짤이나 동작을 인용', '곡 발매 자체는 2016년이지만 밈으로서 확산과 해외 유행은 2017년까지 이어졌음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/TT(노래)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('코인노래방 열풍', '코인노래방-열풍', array['코노','코인노래방']::text[], '동전만 넣고 한두 곡 부르는 소규모 노래방이 폭발적으로 확산된 현상', '2017년 무렵 ''혼자 놀기'' 문화 확산과 맞물려 대학가·번화가에 코인노래방이 급증했다. 곡당 500~800원 정도로 부담 없이 들를 수 있어 교복 차림 학생부터 직장인까지 짧게 즐기는 코너형 노래방 문화가 자리잡았다.',
    '노래반주기 업체들의 코인 부스 보급 확산, 2017년 전후 대학가 중심으로 확산', '그 시절 놀이문화를 회상할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왓이즈러브 영화 패러디', '왓이즈러브-영화-패러디', array['What is Love MV','트와이스 영화 패러디 뮤비']::text[], '트와이스 뮤비가 유명 영화 명장면을 줄줄이 패러디해 화제가 된 사건', '2018년 발매된 트와이스 ''What is Love?'' 뮤직비디오가 ''프린세스 다이어리'', ''라라랜드'', ''레옹'', ''펄프픽션'', ''러브레터'' 등 명작 영화 장면을 오마주해 화제를 모았다. ''프린세스 다이어리'' 원작자 멕 캐봇이 직접 극찬하며 해외에서도 큰 반향을 일으켰다.',
    'TWICE ''What is Love?'' MV (2018.4, JYP엔터테인먼트)', 'K팝 뮤비의 영화 오마주·레퍼런스를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('키키 챌린지', '키키-챌린지', array['인마이필링스 챌린지','In My Feelings Challenge']::text[], '드레이크 ''In My Feelings''에 맞춰 달리는 차 옆에서 춤추는 챌린지', '2018년 여름 드레이크의 ''In My Feelings'' 속 ''키키, 두 유 러브 미'' 가사에 맞춰 춤추는 ''키키 챌린지''가 전 세계적으로 유행했다. 한국에서는 방탄소년단 제이홉이 참여해 실제로 드레이크의 뮤직비디오에 잠깐 삽입되기도 했으며, 소녀시대 윤아·효연, 트와이스 모모·채영 등도 동참했다.',
    'Drake ''In My Feelings''(2018), 캐나다 코미디언 최초 게시 후 확산', '2018년 글로벌 SNS 챌린지 열풍을 이야기할 때 인용', '달리는 차에서 내려 춤추는 방식으로 여러 나라에서 사고가 발생해 실제 재현 시 위험함',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('페이크러브 삼불원 안무', '페이크러브-삼불원-안무', array['FAKE LOVE 안무','BTS 견원불청 안무']::text[], '방탄소년단 ''FAKE LOVE'' 후렴에서 눈·귀·입을 가리는 삼불원 포인트 안무', '2018년 방탄소년단 ''FAKE LOVE'' 후렴구에서 멤버들이 순서대로 눈, 귀, 입을 가리는 동작이 ''보지 않고 듣지 않고 말하지 않는'' 삼불원(三不猿)을 형상화했다는 해석과 함께 화제가 되며 커버댄스 영상에서 자주 재현되는 포인트 안무가 됐다.',
    'BTS ''FAKE LOVE''(2018.5) 안무', 'K팝 포인트 안무 해석 콘텐츠에서 자주 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/FAKE LOVE', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뿜뿜 학예회 국민율동', '뿜뿜-학예회-국민율동', array['모모랜드 뿜뿜 장기자랑','BBoom BBoom 학예회']::text[], '모모랜드 ''뿜뿜''이 전국 학교 장기자랑의 단골곡이 된 현상', '2018년 발매된 모모랜드 ''뿜뿜''은 그해 초중고 장기자랑에서 빠지지 않는 곡으로 자리잡았고, SM 연습생 90% 이상이 자체 평가 무대에서 이 곡을 선택했다는 일화가 방송에 소개될 정도로 신드롬을 일으켰다. 전국노래자랑에서도 커버되며 연말 결산 대상을 수상했다.',
    'MOMOLAND ''뿜뿜(BBoom BBoom)''(2018.1, MLD엔터테인먼트)', '학창시절 장기자랑 추억을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/GREAT!', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아기상어 챌린지', '아기상어-챌린지', array['베이비샤크 댄스 챌린지','Baby Shark Challenge']::text[], '핑크퐁 ''상어가족'' 댄스를 따라 추고 SNS에 올리는 챌린지', '2018년 여름 핑크퐁의 ''상어가족(Baby Shark)'' 댄스 버전이 미국·유럽에서 폭발적으로 확산되며 유명인들까지 참여하는 댄스 챌린지로 번졌다. 엘렌 드제너러스, 제임스 코든 등 해외 스타들이 동참했고, 국내에서도 아이뿐 아니라 어른들 사이에서 중독성 있는 후크로 화제를 모았다.',
    'SmartStudy(핑크퐁) ''Baby Shark Dance'' 영상(2016년 최초 게시, 2018년 챌린지로 확산)', 'K콘텐츠의 글로벌 흥행 사례로 언급할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/상어 가족', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('랜덤플레이댄스', '랜덤플레이댄스', array['랜플댄','홍대 랜덤플레이댄스']::text[], '무작위로 트는 K팝 곡에 맞춰 관객이 즉석 군무를 추는 거리 이벤트', 'Mnet ''주간아이돌''의 코너 미션에서 유래한 랜덤플레이댄스가 홍대 걷고싶은거리 등 번화가 버스킹 이벤트로 확산되며 2017~2019년 K팝 팬덤의 대표적 오프라인 커버댄스 문화로 자리잡았다. 주말마다 팬들이 모여 무작위로 나오는 곡의 안무를 정확히 따라 추는 모습이 명물이 되었다.',
    'Mnet ''주간아이돌'' 코너 미션(2013)에서 유래, 이후 홍대 등 거리에서 팬 주도 버스킹 문화로 확산', 'K팝 커버댄스 문화, 홍대 버스킹을 이야기할 때 인용', 'TV 코너 자체의 유래는 2013년이지만 거리 버스킹 문화로 대중화된 시점은 2017년 전후',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/랜덤 플레이 댄스', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('병뚜껑 챌린지', '병뚜껑-챌린지', array['바틀캡 챌린지','Bottle Cap Challenge']::text[], '돌려차기로 느슨하게 닫은 병뚜껑을 발로 차서 여는 챌린지', '2019년 여름 해외 스타들 사이에서 시작된 병뚜껑 챌린지가 국내에도 상륙해 엑소 세훈·백현·찬열, 박재범, 유병재, 걸스데이 지연 등이 도전 영상을 SNS에 올리며 화제를 모았다.',
    '제이슨 스타뎀 등 해외 스타 SNS 게시 영상에서 시작(2019.7)', '2019년 SNS 챌린지 붐을 이야기할 때 인용', '발차기 과정에서 부상 위험이 있어 실제로 따라할 때 주의 필요',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('송가인 신드롬', '송가인-신드롬', array['미스트롯 송가인','트로트 신드롬']::text[], '미스트롯 우승자 송가인이 촉발한 2019년 트로트 열풍', '2019년 상반기 TV조선 ''내일은 미스트롯''에서 우승한 송가인을 중심으로 전국적인 트로트 신드롬이 일었다. 프로그램은 최고 시청률 18.1%를 기록했고, 이후 송가인이 출연하는 방송마다 시청률이 오르는 등 트로트 장르 자체의 대중적 재유행을 이끌었다.',
    'TV조선 ''내일은 미스트롯''(2019 상반기) 우승자 송가인', '2019~2020년대 트로트 부흥의 시발점으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/송가인', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('김생민의 영수증', '김생민의-영수증', array['그뤠잇','스튜핏','통장요정']::text[], '소비 습관에 따라 "그뤠잇"/"스튜핏"을 외치던 2017년 최고 유행어', 'KBS 라디오와 tvN 예능 "김생민의 영수증"에서 시청자가 보낸 영수증을 보고 알뜰한 소비엔 "그뤠잇", 과소비엔 "스튜핏"을 외치던 코너가 폭발적 인기를 끌며 2017년 올해의 유행어로 꼽혔다.',
    'KBS쿨FM/tvN 김생민의 영수증 (2017)', '소비를 잘했다/못했다 재밌게 평가할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B9%80%EC%83%9D%EB%AF%BC%EC%9D%98%20%EC%98%81%EC%88%98%EC%A6%9D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유시민 설명충', '유시민-설명충', array['설명충','유시민 밈']::text[], '아는 척 설명하다 틀린 정보로 놀림받는 밈의 대표 사례', '2017년 tvN 알쓸신잡2 제작발표회에서 나영석 PD가 유시민이 방송 중 언급한 역사 이야기 중 틀린 내용이 많다고 밝히며 화제가 됐고, 이후 유시민의 확신에 찬 설명 스타일이 "설명충" 밈으로 소비됐다.',
    'tvN 알쓸신잡 제작발표회 발언 (2017.10)', '자신만만하게 설명했는데 틀렸을 때 자조적으로', '실존 인물을 겨냥한 조롱이 될 수 있어 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.segye.com/newsView/20171026004875', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('범죄도시 "니 내 누군지 아니?"', '범죄도시-"니-내-누군지-아니?"', array['니 내 누군지 아니','장첸 대사']::text[], '영화 범죄도시 속 조폭 장첸의 대표 협박 대사 패러디', '2017년 개봉한 영화 "범죄도시"에서 인물들이 서로 위협할 때 쓰는 "니 내 누군지 아니?"라는 대사가 큰 인기를 끌며 다양한 상황에 갖다붙이는 패러디 밈이 됐다.',
    '영화 범죄도시 (2017)', '허세 부리듯 위협하거나 장난칠 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%8B%88%20%EB%82%B4%20%EB%88%84%EA%B5%B0%EC%A7%80%20%EC%95%84%EB%8B%88%3F', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('산타벌스(우원재)', '산타벌스(우원재)', array['산타는 없거든','산타 라인']::text[], '쇼미더머니6서 나온 "산타는 없거든" 디스랩 가사 밈', '2017년 Show Me The Money6 팀 배틀에서 우원재가 초등학생 참가자 조우찬에게 "사실 산타는 없거든"이라는 위트있는 디스 가사를 던져 큰 화제가 됐고, 매년 크리스마스 시즌마다 소환되는 밈이 됐다.',
    'Mnet Show Me The Money6 (2017)', '크리스마스 시즌 장난스러운 팩폭 드립으로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.etnews.com/20170812000032', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('니가 왜 거기서 나와', '니가-왜-거기서-나와', array['형이 왜 거기서 나와 패러디']::text[], '트로트 가수 영탁의 2018년 노래 제목이자 황당한 상황 밈', '2018년 발매된 영탁의 싱글 "니가 왜 거기서 나와"는 본인의 실화를 바탕으로 한 가사와 제목으로, 예상 못한 사람이 예상 못한 곳에 등장했을 때 쓰는 표현으로 자리잡았다.',
    '영탁 싱글 앨범 (2018.10.21 발매)', '뜻밖의 장소에서 아는 사람이나 물건을 발견했을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('밴쯔-이영자 "영혼이 가출했다"', '밴쯔-이영자-"영혼이-가출했다"', array['영혼 가출','밴쯔 먹방 반응']::text[], '먹방 유튜버 밴쯔의 폭식에 이영자가 보인 리액션 밈', '2018년 JTBC "랜선라이프"에서 먹방 크리에이터 밴쯔의 대식 먹방을 보던 이영자가 "영혼이 가출했다", "여자가 남탕 간 느낌" 등 리액션을 보이며 화제가 됐다.',
    'JTBC 랜선라이프 (2018)', '압도적인 광경을 보고 넋이 나갔을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.hankookilbo.com/News/Read/201808021918054421', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뚜두뚜두 챌린지(블랙핑크)', '뚜두뚜두-챌린지(블랙핑크)', array['DDU-DU DDU-DU 챌린지','총 쏘는 안무']::text[], '블랙핑크 뚜두뚜두 양손 총 쏘는 포인트 안무 챌린지', '2018년 발매된 블랙핑크의 "뚜두뚜두" 안무 중 양손으로 총을 쏘는 듯한 포인트 동작이 SNS 커버 챌린지로 세계적으로 유행했다.',
    'YG엔터테인먼트 블랙핑크 뚜두뚜두 MV·안무 영상 (2018.6)', '커버댄스나 안무 챌린지 콘텐츠에', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%9A%9C%EB%91%90%EB%9A%9C%EB%91%90%20(DDU-DU%20DDU-DU)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('하트시그널 "내게와영주"', '하트시그널-"내게와영주"', array['내게 와 영주','귀 만지는 신호']::text[], '하트시그널2 이규빈의 배려 신호가 낳은 지명 홍보 밈', '2018년 채널A "하트시그널 시즌2"에서 이규빈이 오영주에게 고춧가루 낀 걸 티 안 나게 알려주려 귀를 만지는 신호를 보내는 장면이 화제가 됐고, "내게와영주"라는 말장난 밈이 영주시 홍보에도 쓰였다.',
    '채널A 하트시그널 시즌2 (2018)', '다정한 배려나 은근한 신호를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%95%98%ED%8A%B8%EC%8B%9C%EA%B7%B8%EB%84%902', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('보이루(보겸)', '보이루(보겸)', array['보겸+하이루']::text[], 'BJ 보겸의 인사말 신조어, 초등학생 사이 대유행', '아프리카TV BJ 보겸이 자신의 이름과 인사말 "하이루"를 합쳐 만든 인사말로, 2018년 초 보겸 유튜브 구독자 100만을 넘기며 초등학생들 사이에서 폭발적으로 퍼졌다.',
    '아프리카TV/유튜브 BJ 보겸 방송', 'BJ 문화에 익숙한 또래끼리 인사말로', '한때 여성혐오 은어라는 허위 논란에 휘말린 적 있어 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%B3%B4%EC%9D%B4%EB%A3%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('영미(컬링)', '영미(컬링)', array['영미!!','컬링 영미']::text[], '2018 평창올림픽 여자컬링 스킵이 외친 이름이 응원구호로 등극', '2018 평창동계올림픽 여자 컬링 경기 중계에서 스킵 김은정이 리드 김영미를 계속 부르는 소리("영미! 영미!")가 전국적 유행어가 됐다.',
    '2018 평창동계올림픽 여자 컬링 중계 방송', '누군가의 이름을 반복해서 부르며 애정표현이나 응원을 할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.khan.co.kr/article/201802191549001', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마미손 소년점프', '마미손-소년점프', array['소년점프','핑크 복면 래퍼']::text[], '쇼미더머니7서 광탈한 복면래퍼 마미손의 역주행 히트곡', '2018년 Show Me The Money7에서 분홍 복면을 쓴 신인 래퍼 마미손이 1차 예선에서 광속 탈락했지만, 당일 공개한 뮤직비디오 "소년점프"가 오히려 대박을 터뜨리며 방송 화제성을 독식했다.',
    'Mnet Show Me The Money7 (2018)', '실패담을 오히려 웃음으로 승화할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%86%8C%EB%85%84%EC%A0%90%ED%94%84(%EB%A7%88%EB%AF%B8%EC%86%90)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('조혜련 태보의 저주', '조혜련-태보의-저주', array['태보는 지금','조혜련 짤','조혜련의 태보 다이어트']::text[], '옛 다이어트 비디오가 자막 참여형 밈으로 재유행', '2000년대 개그우먼 조혜련이 찍은 태보 다이어트 운동 비디오가 2018년 디시인사이드 등에서 재발굴돼, 유튜브 자막 기능으로 유저들이 드립을 다는 참여형 밈으로 유행했다.',
    '조혜련 태보 다이어트 비디오(2000년대) 재유행, 2018년 온라인 커뮤니티', '옛날 영상 재발굴 놀이 콘텐츠에', '실존 인물의 옛 영상을 조리돌리는 형태라 대상자 입장에서 불쾌할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A1%B0%ED%98%9C%EB%A0%A8%EA%B3%BC%20%ED%83%9C%EB%B3%B4%EC%9D%98%20%EC%A0%80%EC%A3%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사랑을 했다 개사 패러디', '사랑을-했다-개사-패러디', array['싸랑을 했다 잘했다']::text[], '2018년 최대 히트곡 "사랑을 했다"의 개사 패러디 유행', 'iKON의 2018년 히트곡 "사랑을 했다"는 쉬운 멜로디로 아이들까지 따라 부르며 일부 학교에서 금지곡이 될 정도였고, 코미디언 김용명이 "싸랑을 했다 잘했다"로 개사한 버전이 밈으로 인기를 끌었다.',
    'iKON 사랑을 했다(2018) 및 방송 개사 패러디', '유행가 개사 드립으로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%AC%EB%9E%91%EC%9D%84%20%ED%96%88%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 예쁘지 않습니다(동영상)', '나는-예쁘지-않습니다(동영상)', array['탈코르셋 영상']::text[], '탈코르셋 메시지를 담은 뷰티 유튜버의 화장 지우기 영상', '2018년 6월 유튜버 배리나가 화장을 하다가 지우며 외모지상주의를 비판하는 메시지를 전하는 영상을 올려 화제가 됐으나, 해외 원본 영상과 유사하다는 표절 논란도 함께 일었다.',
    '유튜버 배리나 (2018.6.4)', '탈코르셋·외모지상주의 논의 맥락에서 인용', '표절 논란과 젠더 이슈가 얽혀 있어 언급 시 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%82%98%EB%8A%94%20%EC%98%88%EC%81%98%EC%A7%80%20%EC%95%8A%EC%8A%B5%EB%8B%88%EB%8B%A4(%EB%8F%99%EC%98%81%EC%83%81)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('전국 handclap 자랑', '전국-handclap-자랑', array['전국노래자랑 매시업']::text[], '송해의 "전국노래자랑" 육성과 팝송 HandClap을 합친 매시업이 역주행', '2016년 요한 일렉트릭 바흐가 만든 매시업 "전국 handclap 자랑"이 2018년 초 한국에서 뜬금없이 역주행해 음원차트 10위권까지 오르며 밈이 됐다.',
    '요한 일렉트릭 바흐 매시업 영상(2016), 2018년 국내 역주행', '흥겨운 반전 매시업을 소개할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%A0%84%EA%B5%AD%20handclap%20%EC%9E%90%EB%9E%91', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('백종원의 골목식당 "조보아씨"', '백종원의-골목식당-"조보아씨"', array['조보아 밈','누구세요 조보아씨']::text[], '맛없는 음식이 나올 때마다 소환되는 배우 조보아 이름 드립', '2018년 SBS "백종원의 골목식당"에서 백종원이 맛없는 음식을 먹을 때마다 배우 조보아를 언급하며 먹이려던 장면에서 파생돼, 맛없는 음식 리뷰에 조보아씨를 소환하는 밈이 됐다.',
    'SBS 백종원의 골목식당 (2018)', '맛없는 음식 리뷰 드립에', '실존 인물 이름을 반복 소환하는 형태라 다소 부담될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B0%B1%EC%A2%85%EC%9B%90%EC%9D%98%20%EA%B3%A8%EB%AA%A9%EC%8B%9D%EB%8B%B9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('카잔의 기적', '카잔의-기적', array['대한민국 2:0 독일']::text[], '2018 러시아 월드컵서 한국이 독일을 꺾은 이변의 애칭', '2018년 6월 27일 러시아 카잔에서 열린 조별리그 최종전에서 한국이 디펜딩 챔피언 독일을 2대0으로 꺾은 이변을 "카잔의 기적"이라 부르며, 이후 예상 밖 승리·반전 상황에 비유하는 밈이 됐다.',
    '2018 FIFA 월드컵 러시아 한국 대 독일전 중계 (2018.6.27)', '약자의 극적인 반전 승리를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.fifa.com/ko/articles/100-great-world-cup-moments-kazan-calamity-for-holders-germany-96-ko', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('백종원 "나여 백종원"', '백종원-"나여-백종원"', array['나여 백종원 밈']::text[], '골목식당서 자금난 사장 부부를 안심시킨 백종원 어록 밈', '백종원의 골목식당에서 연돈 점포 이전 자금난을 걱정하는 사장 부부에게 "괜찮으니 나만 믿으라"며 호언장담하던 장면이 "나여 백종원"이라는 밈으로 소비됐다.',
    'SBS 백종원의 골목식당(2019)', '든든하게 책임지겠다는 다짐을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B0%B1%EC%A2%85%EC%9B%90/%EB%B3%84%EB%AA%85%20%EB%B0%8F%20%EB%B0%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펭수 "펭하"', '펭수-"펭하"', array['펭하','자이언트 펭TV']::text[], 'EBS 캐릭터 펭수의 인사말이자 2019년 최고 유행어', 'EBS 유튜브 채널 "자이언트 펭TV"의 캐릭터 펭수가 2019년 하반기 "EBS 육상대회" 영상으로 큰 인기를 끌며, 인사말 "펭하"와 "눈치 챙겨" 등이 성인층까지 폭넓게 퍼졌다.',
    'EBS 유튜브 채널 자이언트 펭TV (2019)', '친근한 인사말이나 위로 멘트로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%ED%8E%AD%EC%88%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('SKY캐슬 "전적으로 믿으셔야 합니다"', 'SKY캐슬-"전적으로-믿으셔야-합니다"', array['쓰앵님','김주영 명대사']::text[], '입시코디 김주영의 카리스마 대사가 낳은 국민 패러디', '2018-2019년 방영된 JTBC "SKY 캐슬"에서 배우 김서형이 연기한 입시 코디네이터 김주영의 "어머니, 저를 전적으로 믿으셔야 합니다"라는 대사가 다양한 상황에 응용되는 패러디 밈이 됐다.',
    'JTBC SKY 캐슬 (2018.11-2019.2)', '근거 없는 자신감으로 장담할 때 패러디로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/SKY%20%EC%BA%90%EC%8A%AC/%EB%AA%85%EB%8C%80%EC%82%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국프(국민 프로듀서)', '국프(국민-프로듀서)', array['국민 프로듀서','프로듀스X101 투표조작']::text[], '프로듀스 시리즈 시청자를 부르는 말이자 투표조작 사건의 상징어', 'Mnet 서바이벌 오디션 "프로듀스" 시리즈에서 투표하는 시청자를 "국민 프로듀서(국프)"라 불렀는데, 2019년 프로듀스X101 최종 순위 득표수가 반복되는 등 조작 정황이 드러나며 국프라는 말 자체가 사건을 상징하게 됐다.',
    'Mnet 프로듀스X101 투표 조작 사건(2019)', '서바이벌 투표 조작 이슈를 언급할 때', '실제 사기·연습생 착취 사건과 연결돼 가볍게 다루면 안 됨',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%94%84%EB%A1%9C%EB%93%80%EC%8A%A4%20101%20%EC%8B%9C%EB%A6%AC%EC%A6%88%20%ED%88%AC%ED%91%9C%20%EC%A1%B0%EC%9E%91%20%EC%82%AC%EA%B1%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유산슬(유재석 부캐)', '유산슬(유재석-부캐)', array['유산슬','부캐 신드롬']::text[], '유재석이 만든 트로트 가수 부캐, 2019년 부캐 신드롬의 시작', 'MBC "놀면 뭐하니?"에서 유재석이 트로트 신인가수 "유산슬"로 데뷔해 실제 음반 활동까지 하며, 2019년 예능계 "부캐(부캐릭터)" 신드롬을 일으켰다.',
    'MBC 놀면 뭐하니? (2019)', '새로운 정체성이나 역할극 콘셉트를 소개할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9C%A0%EC%82%B0%EC%8A%AC(%EA%B0%80%EC%88%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사딸라', '사딸라', array['김두한 사딸라','버거킹 사딸라']::text[], '2002년 드라마 야인시대 대사가 2019년 광고로 부활한 밈', '드라마 "야인시대"(2002-2003) 속 김두한이 미군과 협상하며 반복한 "사딸라"라는 대사가 2019년 버거킹 광고에 배우 김영철이 재등장하며 다시 폭발적으로 유행했다.',
    'SBS 야인시대(2002) 대사, 2019년 버거킹 광고로 재유행', '억지 협상이나 우기기 상황을 유머러스하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ohfun.net/?ac=article_view&entry_id=20200', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('동백꽃 필 무렵 "좋아해유"', '동백꽃-필-무렵-"좋아해유"', array['황용식','좋아허니께 좋아해유']::text[], '순박남 황용식의 직진 고백 대사가 낳은 로맨스 밈', '2019년 KBS2 드라마 "동백꽃 필 무렵"에서 강하늘이 연기한 황용식의 우직하고 직진하는 고백 대사들이 인터넷에서 널리 패러디됐다.',
    'KBS2 동백꽃 필 무렵 (2019)', '순수하고 직진하는 애정표현 패러디로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8F%99%EB%B0%B1%EA%BD%83%20%ED%95%84%20%EB%AC%B4%EB%A0%A5/%EB%AA%85%EB%8C%80%EC%82%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('자전차왕 엄복동(UBD)', '자전차왕-엄복동(UBD)', array['UBD','엄복동']::text[], '역대급 흥행 참패 영화가 만든 관객수 단위 밈', '2019년 개봉한 영화 "자전차왕 엄복동"이 최종 관객 17만여 명이라는 극심한 흥행 실패를 기록하자, 누리꾼들이 이를 조롱하며 "UBD"(엄복동 이니셜)를 흥행 참패의 단위처럼 쓰는 밈을 만들었다.',
    '영화 자전차왕 엄복동 (2019.2.27 개봉)', '흥행 참패나 실패 규모를 비유할 때', '실제 제작진·배우에 대한 조롱으로 번질 수 있어 대상에 유의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%9E%90%EC%A0%84%EC%B0%A8%EC%99%95%20%EC%97%84%EB%B3%B5%EB%8F%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('날강두', '날강두', array['날강도+호날두']::text[], '방한 경기 무출전 논란으로 붙은 호날두의 멸칭', '2019년 7월 유벤투스 소속으로 방한한 크리스티아누 호날두가 K리그 올스타전에 끝내 출전하지 않자 관중들이 야유했고, "날강도"와 "호날두"를 합친 "날강두"라는 멸칭이 생겨 이후 실망스러운 노쇼·불성실 상황의 대명사가 됐다.',
    '2019 K리그 올스타 vs 유벤투스 친선경기(2019.7.26) 중계', '약속을 안 지키거나 성의 없는 태도를 비꼴 때', '실존 인물을 향한 조롱성 멸칭이라 맥락 없이 쓰면 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%81%AC%EB%A6%AC%EC%8A%A4%ED%8B%B0%EC%95%84%EB%88%84%20%ED%98%B8%EB%82%A0%EB%91%90/%EB%85%BC%EB%9E%80%20%EB%B0%8F%20%EC%82%AC%EA%B1%B4%20%EC%82%AC%EA%B3%A0/2019%EB%85%84%20%EB%B0%A9%ED%95%9C%20%EA%B4%80%EB%A0%A8%20%EB%85%BC%EB%9E%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('곽철용(타짜)', '곽철용(타짜)', array['묻고 더블로 가','나도 순정이 있다']::text[], '2006년 영화 타짜 속 조연이 13년 만에 부활한 광고 단골 밈', '2006년 영화 "타짜"의 조연 곽철용(김응수)이 2019년 후속작 "타짜: 원 아이드 잭" 개봉과 함께 재발굴돼, "묻고 더블로 가" 등 대사와 짤이 각종 광고·패러디에 쓰이는 신드롬을 일으켰다.',
    '영화 타짜(2006) 속 곽철용 캐릭터, 2019년 재유행', '허세 있는 자신감 표현이나 도박성 결정을 유머로 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EA%B3%BD%EC%B2%A0%EC%9A%A9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짜파구리', '짜파구리', array['기생충 짜파구리','채끝살 짜파구리']::text[], '영화 기생충에 등장한 라면 조합이 세계적 화제를 모은 요리 밈', '2019년 봉준호 감독의 영화 "기생충"에서 채끝살을 넣은 짜파구리(짜파게티+너구리)가 비중있게 등장해, 영화의 세계적 흥행과 함께 실제로 따라 만들어보는 레시피 밈으로 확산됐다.',
    '영화 기생충(2019) 속 요리 장면', '두 라면을 섞어 먹는 레시피 소개나 영화 인용에', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%A7%9C%ED%8C%8C%EA%B5%AC%EB%A6%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안녕하살법', '안녕하살법', array['안녕하살법 받아치기']::text[], '일본 애니 대사에서 온 2019년 인싸 인사법', '일본 애니메이션 "카구야는 고백받고 싶어" 8화 속 인사 장면이 2019년 3월 침착맨, 아이즈원 멤버 등 한국 스트리머·아이돌들의 리액션으로 확산되며, 신학기 인사법 밈으로 유행했다.',
    '일본 애니메이션 카구야는 고백받고 싶어 8화(2019.3), 국내 스트리머 확산', '새 학기나 모임에서 장난스러운 인사법으로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%95%88%EB%85%95%ED%95%98%EC%82%B4%EB%B2%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이상민 68억 빚', '이상민-68억-빚', array['이상민 빚','미운우리새끼 이상민']::text[], '사업 실패로 진 거액의 빚을 갚아가는 사연이 밈이 된 사례', '룰라 출신 이상민이 2005년 사업 실패로 진 수십억 원의 빚을 SBS "미운우리새끼" 등 방송에서 꾸준히 언급하며, "이상민 68억"이 거액의 빚을 상징하는 밈으로 자리잡았다.',
    'SBS 미운우리새끼 등 방송 노출(2010년대 후반)', '거액의 빚이나 재정난을 과장해서 말할 때', '실존 인물의 실제 빚 문제라 가볍게 놀리는 투는 주의',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.news1.kr/entertain/broadcast-tv/5376656', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이이잉 앗살라말라이쿰', '이이잉-앗살라말라이쿰', array['과로사 유행어']::text[], 'BJ 과로사의 안경 효과음과 아랍어 인사가 합쳐진 유행어', '인터넷 방송인 과로사가 안경을 고쳐쓸 때 내는 효과음 "이이잉"에 아랍어 인사말 "앗살라무 알라이쿰"을 흉내낸 발음을 붙인 유행어가 2019년 8월 남성 시청자층 사이에서 크게 유행했다.',
    '인터넷 방송인 과로사 방송 (2019.8)', '또래 인터넷 방송 시청자끼리 장난스러운 인사말로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%95%97%EC%82%B4%EB%9D%BC%EB%AC%B4%20%EC%95%8C%EB%9D%BC%EC%9D%B4%EC%BF%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아마존 익스프레스(에버랜드)', '아마존-익스프레스(에버랜드)', array['아마존 환영 세레모니']::text[], '에버랜드 놀이기구 직원들의 흥겨운 환영 댄스가 뒤늦게 밈으로 등극', '2006년부터 이어져온 에버랜드 "아마존 익스프레스" 탑승 전 직원들의 열정적인 환영 댄스 세레모니 영상이 2019년 뒤늦게 온라인에서 재조명되며 큰 화제를 모았다.',
    '에버랜드 아마존 익스프레스 탑승전 세레모니(2006년부터), 2019년 온라인 재조명', '신나고 열정적인 환영이나 응원 장면을 소개할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%95%84%EB%A7%88%EC%A1%B4%20%EC%9D%B5%EC%8A%A4%ED%94%84%EB%A0%88%EC%8A%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('단또단또', '단또단또', array['Tanto Tanto']::text[], '새끼 고양이를 아코디언처럼 당기며 부르는 외국 영상 밈', '한 남성이 새끼 고양이의 앞다리와 뒷다리를 잡고 아코디언처럼 당겼다 놓았다 하며 "단또 단또(Tanto, tanto)"라 노래하는 영상이 2019년 디시인사이드 등 국내 커뮤니티에서 크게 유행했다.',
    '해외 SNS 영상, 2019년 디시인사이드 등 국내 커뮤니티 확산', '반복적이고 우스꽝스러운 영상 드립으로', '동물을 다소 거칠게 다루는 원본 영상이라 동물학대 논란 소지 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%8B%A8%EB%98%90%EB%8B%A8%EB%98%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('존버는 승리한다', '존버는-승리한다', array['존버좌','존버는 반드시 승리한다']::text[], '2018년 비트코인 투자자 인터뷰 어록이 2020년 재조명된 밈', '2018년 방송 인터뷰에서 한 비트코인 투자자가 말한 ''존버는 반드시 승리합니다''가, 2020년 말 비트코인이 급등하며 예언처럼 재조명되어 다시 유행했다.',
    '2018년 2월 SBS CNBC ''경제와이드 이슈&'' 비트코인 투자자 인터뷰', '버티면 결국 이긴다는 뜻으로 응원할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A1%B4%EB%B2%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('임영웅 미스터트롯 신드롬', '임영웅-미스터트롯-신드롬', array['영웅시대','미스터트롯 진']::text[], '미스터트롯 초대 진 임영웅이 일으킨 전 세대 팬덤 신드롬', '2020년 TV조선 ''미스터트롯''에서 진(眞)으로 선발된 임영웅은 중장년층까지 아우르는 폭발적 팬덤을 만들며 광고·음반 시장을 휩쓸었다. 트로트 신드롬의 상징적 존재가 됐다.',
    '2020년 TV조선 ''내일은 미스터트롯'' 오디션 우승', '트로트·중장년 팬덤 열풍을 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9E%84%EC%98%81%EC%9B%85', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나훈아 테스형', '나훈아-테스형', array['테스형!','나레디 훈큐리']::text[], '나훈아의 비대면 콘서트 신곡이 만든 철학자 밈', '2020년 9월 KBS 추석 비대면 콘서트에서 나훈아가 신곡 ''테스형!''을 열창하며 소크라테스를 부르는 가사가 화제를 모았다. ''플라톤형'', ''나레디 훈큐리'' 등 각종 패러디가 쏟아졌다.',
    '2020년 9월 30일 KBS ''2020 한가위 대기획 대한민국 어게인 나훈아'' 비대면 콘서트', '세상 답답함을 한탄하듯 외칠 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%85%8C%EC%8A%A4%ED%98%95!', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('다비이모', '다비이모', array['김신영 부캐']::text[], '개그우먼 김신영의 놀면 뭐하니 부캐 캐릭터', 'MBC ''놀면 뭐하니?''에서 김신영이 만든 부캐 ''다비이모''가 특유의 입담으로 인기를 얻으며 2020년 부캐 신드롬의 한 축이 됐다.',
    'MBC 놀면 뭐하니? 부캐 프로젝트, 2020년', '부캐·능청스러운 이모 캐릭터 드립으로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('라섹', '라섹', array['유재석 라섹 부캐']::text[], '유재석이 선보인 또 다른 놀면 뭐하니 부캐', 'MBC ''놀면 뭐하니?''에서 유고스타·유산슬에 이어 유재석이 선보인 계열의 부캐로, 2021년 초 공개되며 화제를 모았다.',
    'MBC 놀면 뭐하니? 부캐 프로젝트, 2021년', '부캐 릴레이 얘기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.etoday.co.kr/news/view/1846706', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제로투 챌린지', '제로투-챌린지', array['제로투 댄스']::text[], '베트남 곡에 맞춘 중독성 있는 막춤 챌린지', '베트남 가수 빠오의 곡 리믹스에 맞춘 독특한 막춤 ''제로투 댄스''가 2020년 말 틱톡에서 시작돼, 2021년 국내 BJ·스트리머들 사이에서 크게 유행했다.',
    '2020년 11월 틱톡에서 베트남 곡 리믹스 배경음악으로 확산, 2021년 국내 유행', '웃기고 과장된 막춤 소재로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/%EC%A0%9C%EB%A1%9C%ED%88%AC%20%EB%8C%84%EC%8A%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 SOLO 테이프 깔까', '나는-SOLO-테이프-깔까', array['광수 테이프','나는솔로 어록']::text[], '연애 리얼리티 나는 SOLO 속 유행어 ''테이프 깔까''', '연애 리얼리티 ''나는 SOLO'' 출연자 광수의 발언 ''테이프 깔까?''가 프로그램의 대표 밈으로 자리잡았다.',
    '2021년 첫 방영된 연애 리얼리티 프로그램 ''나는 SOLO''', '연애 리얼리티 유행어 패러디로', '실제 출연자를 조롱하는 방향으로 쓰이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%98%EB%8A%94%20SOLO', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('환승연애 내일 봬요 누나', '환승연애-내일-봬요-누나', array['환승연애 어록']::text[], '연애 예능 환승연애에서 나온 직진 대사 유행어', '티빙 연애 리얼리티 ''환승연애''에서 한 출연자가 직진하며 남긴 ''내일 봬요 누나'' 등의 대사가 형식을 바꿔 대입하는 유행어 밈으로 확산됐다.',
    '2021년 티빙 오리지널 연애 리얼리티 ''환승연애''', '직진 멘트·연애 예능 드립으로', '실제 출연자를 조롱하는 방향으로 쓰이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%ED%99%98%EC%8A%B9%EC%97%B0%EC%95%A0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오징어게임 깐부', '오징어게임-깐부', array['깐부치킨','우린 깐부잖아']::text[], '오징어게임에서 친구·동지를 뜻하는 말로 화제가 된 은어', '''오징어 게임''에서 오일남이 구슬치기를 하며 기훈에게 건넨 ''우리 깐부잖아'' 대사를 계기로, 원래 딱지치기·구슬치기 놀이 짝을 뜻하던 은어 ''깐부''가 전 세계적으로 화제가 됐다.',
    '2021년 넷플릭스 ''오징어 게임'' 구슬치기 에피소드', '친한 사이·한편임을 강조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://www.allurekorea.com/2021/10/05/%EB%84%B7%ED%94%8C%EB%A0%89%EC%8A%A4-%ED%8A%B8%EC%9C%84%ED%84%B0%EA%B0%80-%EC%98%A4%EC%A7%95%EC%96%B4-%EA%B2%8C%EC%9E%84%EC%9C%BC%EB%A1%9C-%EA%B9%90%EB%B6%80-%EB%A7%BA%EC%9D%80-%EB%82%A0/', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이태원 클라쓰 명대사', '이태원-클라쓰-명대사', array['박새로이 어록','실수는 없어']::text[], '드라마 이태원 클라쓰의 신념 어린 명대사들이 만든 밈', '2020년 JTBC 드라마 ''이태원 클라쓰''에서 주인공 박새로이 등의 대사가 인터넷 커뮤니티와 SNS에서 명언 밈으로 꾸준히 소비됐다.',
    '2020년 1~3월 방영 JTBC 드라마 ''이태원 클라쓰''', '신념·소신을 강조하는 짤로 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%B4%ED%83%9C%EC%9B%90%20%ED%81%B4%EB%9D%BC%EC%93%B0(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쇼미더머니9 샤라웃', '쇼미더머니9-샤라웃', array['샤라웃']::text[], '쇼미더머니9 출연진이 자주 쓴 감탄사 겸 인사말', '2020년 Mnet ''쇼미더머니9''에서 참가자들이 즐겨 쓴 영어 표현 ''샤라웃(shout out)''이 방송 밖에서도 유행어처럼 쓰였다.',
    '2020년 Mnet 힙합 서바이벌 ''쇼미더머니9''', '누군가를 응원·소개할 때 가볍게', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/SHOW%20ME%20THE%20MONEY%209', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('블랙핑크 How You Like That 챌린지', '블랙핑크-How-You-Like-That-챌린지', array['하우유라이크댓 챌린지']::text[], '블랙핑크의 곡에 맞춘 안무 챌린지, K팝 최다 조회 기록', '2020년 6월 발매된 블랙핑크의 ''How You Like That'' 안무 버전 영상은 유튜브에서 K팝 최초로 10억 뷰를 넘기며 각종 커버댄스·챌린지를 양산했다.',
    '2020년 6월 블랙핑크 ''How You Like That'' 안무 버전 뮤직비디오 공개', '파워풀한 K팝 안무 챌린지 얘기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=ioNng23DkIM', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'ioNng23DkIM', 'https://www.youtube.com/watch?v=ioNng23DkIM', true from memes where slug = '블랙핑크-How-You-Like-That-챌린지'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미스트롯2 양지은 신드롬', '미스트롯2-양지은-신드롬', array['미스트롯2 진','양지은 신데렐라']::text[], '미스트롯2 우승자 양지은의 극적인 우승 스토리 신드롬', '2021년 TV조선 ''미스트롯2''에서 탈락 위기의 대체 출연자였던 양지은이 최종 진(眞)에 오르며 ''신데렐라 스토리''로 화제를 모았다.',
    '2021년 TV조선 ''내일은 미스트롯2'' 오디션', '극적인 역전·성공 스토리를 얘기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%96%91%EC%A7%80%EC%9D%80/%EB%82%B4%EC%9D%BC%EC%9D%80%20%EB%AF%B8%EC%8A%A4%ED%8A%B8%EB%A1%AF2', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('온라인개학 서버다운 밈', '온라인개학-서버다운-밈', array['EBS온라인클래스 접속불가','F5 눌러 서버 터뜨리기']::text[], '코로나 온라인개학 첫날 학습 사이트가 먹통 된 사건 밈', '2020년 4월 코로나19로 인한 온라인 개학 첫날, EBS 온라인클래스 등 학습 사이트가 접속 폭주로 서버 오류를 일으켰다. 학생들이 ''F5로 서버를 터뜨리자''는 농담을 주고받으며 밈이 됐다.',
    '2020년 4월 9일 온라인 개학 첫날 EBS 온라인클래스 서버 오류 사건', '비대면 수업 초기 혼란을 회상하며 웃을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EC%98%A8%EB%9D%BC%EC%9D%B8%20%EA%B0%9C%ED%95%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('에스파 블랙맘바 세계관 밈', '에스파-블랙맘바-세계관-밈', array['aespa는 나야','광야 이해불가']::text[], '에스파의 복잡한 아바타 세계관이 이해 안 된다는 자조적 밈', '2020년 데뷔한 에스파의 ''Black Mamba'' 뮤직비디오 속 아바타·광야 세계관이 지나치게 복잡하다는 반응이 나오며, ''aespa는 나야'' 등 가사를 인용한 자조적 밈이 유행했다.',
    '2020년 11월 에스파 데뷔곡 ''Black Mamba'' 뮤직비디오', '복잡하고 이해하기 어려운 설정을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/Black%20Mamba', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('돈쭐내다', '돈쭐내다', array['돈쭐','선한 영향력 가게']::text[], '선행을 베푼 가게에 주문을 몰아줘 매출로 혼쭐낸다는 신조어', '2020년 초 한 치킨집 사장이 형편이 어려운 형제에게 무료로 치킨과 이발을 챙겨준 사연이 2021년 알려지며, ''돈으로 혼쭐내주자''는 뜻의 ''돈쭐내다''가 전국적 미담·소비운동으로 확산됐다.',
    '2020년 초 서울 홍대 인근 치킨집의 선행, 2021년 2월 SNS로 알려짐', '선행을 베푼 가게를 응원할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EB%8F%88%EC%AD%90%EB%82%B4%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나락송', '나락송', array['나락! 나락!','감스트 나락']::text[], '스트리머 감스트의 리액션에서 나온 놀림조 편집 밈', '2021년 스트리머 감스트가 특정 이슈에 반응하며 ''나락! 나락!''이라고 외친 억양이 찰지다는 반응을 얻어, 다른 사람이나 상황을 놀리는 편집 영상 ''나락송''으로 확산됐다.',
    '2021년 5월 스트리머 감스트의 방송 리액션 클립', '누군가 나락 가는 상황을 과장해서 놀릴 때', '실제 인물을 조롱하는 방향으로 쓰이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%82%98%EB%9D%BD%EC%86%A1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('머니게임', '머니게임', array['스튜디오 룰루랄라 머니게임']::text[], '8인이 상금을 걸고 극한 생존을 벌인 웹예능이 만든 밈', '2020년 JTBC 스튜디오 룰루랄라가 제작한 웹예능 ''머니게임''은 참가자들이 상금 4억여 원을 걸고 극단적인 상황에서 버티는 내용으로, 방영 중 연출·처우 논란이 일며 ''머니게임''이란 말 자체가 극한 상황을 뜻하는 밈이 됐다.',
    '2020년 5월 JTBC 스튜디오 룰루랄라 웹예능 ''머니게임'' 공개', '극단적이고 비인간적인 상황을 비유할 때', '실제 참가자 인권 논란이 있었던 콘텐츠이니 가볍게만 소비하지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%A8%B8%EB%8B%88%EA%B2%8C%EC%9E%84(%EC%9B%B9%EC%98%88%EB%8A%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼각함수송', '삼각함수송', array['삼각함수의 노래','사인 코사인 탄젠트 노래']::text[], '2002년 만들어진 수학 암기송이 2020년 뒤늦게 폭발적으로 유행한 밈', '한 수학 교사가 삼각함수 공식을 외우기 쉽게 만든 플래시 노래 영상이 2002~2003년 제작됐으나, 기괴하고 중독성 있는 멜로디로 2020년 말 유튜브 알고리즘을 타고 뒤늦게 폭발적인 인기를 얻으며 밈이 됐다.',
    '2002~2003년 제작된 수학 암기용 플래시 노래, 2020년 유튜브에서 재조명', '옛날 콘텐츠의 뒤늦은 역주행 사례로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%82%BC%EA%B0%81%ED%95%A8%EC%88%98%EC%9D%98%20%EB%85%B8%EB%9E%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어몽어스 스트리밍 붐', '어몽어스-스트리밍-붐', array['Among Us 붐','어몽어스 유행']::text[], '코로나 집콕 시기 스트리머들이 함께 즐긴 온라인 게임 방송 붐', '2018년 출시된 게임 ''어몽어스''가 코로나19로 실내 활동이 늘어난 2020년, 트위치·유튜브 스트리머들의 합동 방송을 통해 전 세계적으로 재발견되며 국내에서도 스트리밍 붐을 일으켰다.',
    '2018년 출시 게임, 2020년 코로나 시기 해외 스트리머 방송을 계기로 재유행', '여럿이 온라인으로 함께 노는 콘텐츠 얘기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('동학개미운동', '동학개미운동', array['동학개미','서학개미']::text[], '코로나 폭락장에서 개인투자자들이 주식을 사들인 현상', '2020년 코로나19로 인한 증시 폭락 이후, 청년·개인 투자자들이 외국인·기관의 매도 물량을 받아내며 국내 증시를 떠받친 현상을 언론에서 ''동학개미운동''이라 불렀다. 관련 뉴스·유튜브 경제 콘텐츠가 쏟아지며 신조어로 자리잡았다.',
    '2020년 코로나19發 증시 폭락 이후 개인투자자 매수세를 다룬 언론 보도', '개인 투자자들의 뚝심을 얘기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아무노래 챌린지', '아무노래-챌린지', array['Any Song Challenge','지코 아무노래 챌린지']::text[], '지코 ''아무노래''에 맞춰 팔을 흔들며 추는 쉬운 안무 챌린지', '2020년 1월 지코가 신곡 ''아무노래'' 발매와 함께 화사와 촬영한 챌린지 영상을 올리며 시작됐다. 어깨를 들썩이고 팔을 흔드는 쉬운 동작으로 남녀노소 누구나 따라 할 수 있어 급속도로 퍼졌다. 수많은 연예인과 인플루언서가 참여하며 K팝 챌린지 문화의 시초로 평가받는다.',
    '지코가 2020년 1월 13일 ''아무노래'' 발매 직전 화사와 함께 촬영해 SNS에 올린 영상에서 시작', '챌린지 문화를 얘기할 때 쉬운 챌린지의 대명사로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/%EC%95%84%EB%AC%B4%EB%85%B8%EB%9E%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('롤린 챌린지', '롤린-챌린지', array['Rollin'' Challenge','브레이브걸스 역주행']::text[], '브레이브걸스 ''롤린''이 4년 만에 역주행하며 퍼진 틱톡 댄스 챌린지', '2017년 발매곡 ''롤린''의 댓글 모음 영상이 화제가 되며 2021년 2월 음원차트를 역주행했고, 유정·은지·유나 등 멤버들이 틱톡에 챌린지 영상을 올리며 확산됐다. 역주행 신화의 상징으로 K팝 차트 역사에 남았다.',
    '2021년 2~3월 브레이브걸스 멤버들이 틱톡에 올린 챌린지 영상과 팬 커뮤니티의 댓글모음 영상 확산에서 시작', '역주행·재발견 스토리를 얘기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/%EB%A1%A4%EB%A6%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마리아 챌린지', '마리아-챌린지', array['화사 마리아 챌린지','Maria Challenge']::text[], '마마무 화사 ''마리아'' 후렴 표정·안무를 따라 하는 틱톡 챌린지', '2020년 6월 발매된 화사의 솔로곡 ''마리아''가 한국은 물론 중국 등지에서 틱톡 챌린지 음원으로 폭발적 인기를 끌었다. 해시태그 조회수가 수억 뷰를 기록하며 그해 여름 대표 챌린지로 자리잡았다.',
    '2020년 화사의 ''마리아'' 발매 후 틱톡에서 자연발생적으로 확산된 안무 챌린지', '여름 시즌 K팝 챌린지 예시로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('관짝소년단', '관짝소년단', array['코핀댄스','관짝춤','Coffin Dance']::text[], '가나 장례식 관짝 댄서 영상을 사고 장면에 합성해 웃기는 밈', '가나의 장례 풍습인 코핀댄스 영상과 ''Astronomia'' 음악을 사고 영상에 합성한 것이 2020년 2월 틱톡에 처음 올라오며 세계적으로 퍼졌다. 한국에서는 방탄소년단을 패러디해 ''관짝소년단''이라는 별칭이 붙었고, 아찔한 사고·실수 장면마다 합성되는 국룰 밈이 됐다.',
    '2020년 2월 26일 틱톡에 올라온 가나 장례식 코핀댄스 합성 영상에서 시작, 한국에서는 커뮤니티를 통해 ''관짝소년단''으로 명명', '누군가 사고 치기 직전 아찔한 상황에 드립으로 사용', '실제 사망사고 등 민감한 사건에는 합성하지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/Coffin%20Dance', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('범내려온다 (Feel the Rhythm of Korea)', '범내려온다-(Feel-the-Rhythm-of-Korea)', array['이날치','앰비규어스댄스컴퍼니','1일1범']::text[], '이날치X앰비규어스댄스컴퍼니의 판소리+힙한 춤에 홀린 홍보 영상', '국악 밴드 이날치의 ''범 내려온다''에 앰비규어스댄스컴퍼니의 기괴하고 흥겨운 춤이 더해진 한국관광공사 홍보영상. 2020년 유튜브 공개 후 두 달 만에 조회수 2억뷰를 넘기며 ''K흥'' 신드롬을 일으켰고 ''1일1범''이라는 말이 나올 정도로 중독성 있게 소비됐다.',
    '2020년 한국관광공사 ''Feel the Rhythm of Korea'' 캠페인 영상으로 공개', '신나는 국뽕 콘텐츠, 흥 넘치는 상황을 묘사할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=B_X7n0AaLqA', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'B_X7n0AaLqA', 'https://www.youtube.com/watch?v=B_X7n0AaLqA', true from memes where slug = '범내려온다-(Feel-the-Rhythm-of-Korea)'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유산슬·카놀라유 부캐 신드롬', '유산슬·카놀라유-부캐-신드롬', array['부캐','유산슬','카놀라유','놀면 뭐하니 부캐']::text[], '유재석이 만든 트로트 가수 ''유산슬'' 등 여러 부캐가 만든 유행', 'MBC ''놀면 뭐하니?''에서 유재석이 트로트 신인 ''유산슬'', 하피스트 등 다양한 부캐를 연기하며 예능 최대 화두가 됐다. 이후 ''카놀라유'' 등 새 부캐가 이어지며 ''부캐''라는 단어 자체가 2020년을 대표하는 유행어로 자리잡았다.',
    '2019년 말 MBC ''놀면 뭐하니?''의 뽕포유 프로젝트에서 유산슬 데뷔, 2020년 전국적 신드롬으로 확산', '여러 정체성·역할극을 가리킬 때 ''부캐''라는 표현으로 활용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9C%A0%EC%82%B0%EC%8A%AC(%EA%B0%80%EC%88%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잔망루피', '잔망루피', array['잔망루피짤','군침이 싹 도노']::text[], '뽀로로 속 루피의 사악한 표정을 합성해 감정을 대신 표현하는 밈', '''뽀롱뽀롱 뽀로로''의 캐릭터 루피가 사악하게 웃는 짤에서 출발한 밈으로, 2020년 3월 ''군침이 싹 도노''라는 문구와 결합하며 폭발적으로 확산됐다. 직장인들의 억눌린 감정을 대신 표현해주는 밈으로 인기를 끌며 2021년에는 정식 캐릭터 사업으로도 이어졌다.',
    '2019년 제작된 루피 표정 짤이 2020년 3월 트위터발 ''군침이 싹 도노'' 문구와 결합하며 대유행', '얄미운 상황, 은근히 좋아하는 감정을 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('덕분에 챌린지', '덕분에-챌린지', array['Thanks Challenge','의료진 덕분에 챌린지']::text[], '코로나19 의료진에게 감사 수어를 담아 올리는 릴레이 응원 챌린지', '2020년 4월 중앙재난안전대책본부가 시작한 캠페인으로, ''존경합니다''라는 뜻의 수어 동작을 사진·영상으로 찍어 올리고 다음 참여자 3명을 태그하는 방식으로 확산됐다. 대통령과 유명 연예인까지 동참하며 전국적 감사 캠페인이 됐다.',
    '2020년 4월 16일 중앙재난안전대책본부가 의료진 응원을 위해 시작', '감사·응원의 뜻을 담은 캠페인성 챌린지로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', 'https://ko.wikipedia.org/wiki/%EB%8D%95%EB%B6%84%EC%97%90_%EC%B1%8C%EB%A6%B0%EC%A7%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('부부의 세계 명대사 밈', '부부의-세계-명대사-밈', array['지선우 명대사','이 지옥같은 고통을']::text[], 'JTBC 드라마 ''부부의 세계'' 속 김희애 대사가 밈으로 소비된 것', '2020년 방영된 JTBC 드라마 ''부부의 세계''에서 배우 김희애가 연기한 지선우의 강렬한 대사들이 온라인에서 화제가 되며 각종 패러디와 짤로 재생산됐다. ''그러게 남의 물건은 함부로 건드리는 게 아니지'' 등의 대사가 유행어처럼 쓰였다.',
    '2020년 3~5월 방영된 JTBC 드라마 ''부부의 세계'' 극중 대사에서 유래', '통쾌한 복수·경고성 발언을 인용할 때 드립으로 사용', '실제 불륜·이혼 상황에 무신경하게 쓰면 상처가 될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1일1깡', '1일1깡', array['깡 밈','1일1깡 챌린지','비 깡']::text[], '가수 비의 2017년 노래 ''깡''을 하루에 한 번씩 봐야 한다는 밈 놀이', '2017년 발매 당시 혹평받았던 비(정지훈)의 ''깡'' 뮤직비디오가 2020년 5월 유튜브 댓글놀이와 패러디 영상을 통해 재조명되며 ''1일1깡''이라는 말까지 생겼다. 비 본인이 직접 놀이에 응하면서 조롱이 애정 어린 놀이 문화로 바뀐 사례로 꼽힌다.',
    '2020년 5월 한 여고생의 ''깡'' 패러디 영상을 시작으로 유튜브 댓글·영상 놀이로 확산', '흑역사를 애정으로 소비하는 상황에 비유', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EA%B9%A1(%EB%85%B8%EB%9E%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('ITZY Wannabe 챌린지', 'ITZY-Wannabe-챌린지', array['워너비있지 챌린지','미미미 춤']::text[], '있지 ''WANNABE'' 후렴 ''미미미'' 손동작을 따라 하는 틱톡 댄스 챌린지', '2020년 3월 있지의 컴백곡 ''WANNABE'' 발매와 함께 공식 틱톡 계정이 시작한 챌린지. 얼굴을 스치듯 훑는 ''미미'' 동작과 팔을 뻗는 ''히어로'' 동작이 특징으로, 공개 하루 만에 수십만 조회수를 기록했다.',
    '2020년 3월 9일 ITZY 공식 틱톡 계정이 ''WANNABE'' 컴백과 함께 시작', '개성을 강조하는 포인트 안무 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://newsroom.tiktok.com/ko-kr/wannabeitzy', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('덤디덤디 챌린지', '덤디덤디-챌린지', array['DUMDi DUMDi 챌린지','여자아이들 덤디덤디']::text[], '(여자)아이들 ''덤디덤디''의 여름 느낌 드럼 손동작 댄스 챌린지', '2020년 8월 (여자)아이들이 신곡 ''덤디덤디'' 발매와 함께 시작한 틱톡 챌린지로, 손을 교차하며 두드리는 드럼 동작과 휘파람 손동작이 특징이다. 소녀시대 효연, 레드벨벳 슬기 등 다수의 아이돌과 연예인이 참여하며 화제를 모았다.',
    '2020년 8월 3일 (여자)아이들이 신곡 발매와 함께 시작한 틱톡 챌린지', '여름 시즌 청량한 챌린지 예시로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스우파 Hey Mama 관크 챌린지', '스우파-Hey-Mama-관크-챌린지', array['Hey Mama 챌린지','노제 안무','관크']::text[], '''스트릿 우먼 파이터''에서 노제가 춘 ''Hey Mama'' 안무가 만든 챌린지', '2021년 Mnet ''스트릿 우먼 파이터'' 2차 미션 리더 계급 배틀에서 노제가 선보인 ''Hey Mama'' 안무가 틱톡 챌린지로 폭발적 인기를 끌었다. 스우파 출연 댄서와 아이돌들이 잇달아 챌린지 영상을 올리며 프로그램 흥행에 크게 기여했다.',
    '2021년 8~10월 방영된 Mnet ''스트릿 우먼 파이터'' 방송분에서 유래', '댄스 서바이벌·안무 챌린지를 얘기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('청하 Bicycle 챌린지', '청하-Bicycle-챌린지', array['청하 바이시클 챌린지']::text[], '청하 ''Bicycle'' 후렴 안무를 따라 하는 2021년 틱톡 댄스 챌린지', '2021년 2월 발매된 청하의 ''Bicycle'' 안무 중 일부를 따라 하는 틱톡 챌린지로, 세븐틴 호시·우지 등 아이돌들도 참여하며 화제를 모았다.',
    '2021년 2월 청하 ''Bicycle'' 발매와 함께 틱톡에서 확산', '2021년 초반 K팝 챌린지 예시로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('에스파 Next Level 챌린지', '에스파-Next-Level-챌린지', array['Next Level 챌린지','에스파 챌린지']::text[], '에스파 ''Next Level'' 후렴 포인트 안무를 따라 하는 틱톡 챌린지', '2021년 5월 발매된 에스파의 ''Next Level''은 그해 최고 히트곡으로 꼽히며 후렴구 포인트 안무를 중심으로 한 틱톡 챌린지가 크게 유행했다. 전 세계 팬과 인플루언서들이 참여하며 신드롬을 만들었다.',
    '2021년 5월 에스파 ''Next Level'' 발매와 함께 틱톡에서 확산', '2021년 대표 K팝 챌린지·히트곡 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('깻잎 논쟁', '깻잎-논쟁', array['깻잎논쟁','깻잎 뗄까 말까']::text[], '이성 친구의 깻잎을 떼어줘도 되는지를 둘러싼 MZ세대 가치관 논쟁', '예능에 출연한 노사연·이무송 부부의 일화에서 시작된 논쟁으로, 남편이 아내의 여자 후배가 깻잎을 못 떼자 대신 눌러준 것을 두고 아내가 화를 낸 상황이 온라인에서 화제가 됐다. 이후 이성 친구 사이의 선을 가늠하는 질문으로 자리잡아 새우껍질 논쟁, 롱패딩 논쟁 등 파생 논쟁을 낳았다.',
    '방송 예능에 출연한 노사연·이무송 부부의 일화가 2021년 하반기 SNS에서 화제가 되며 확산', '연인·이성친구 사이 애매한 선을 얘기할 때 화두로 사용', '실제 연인 관계에서 진지한 다툼거리로 번질 수 있어 장난스럽게만 쓸 것',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B9%BB%EC%9E%8E%20%EB%85%BC%EC%9F%81', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('BTS Dynamite 챌린지', 'BTS-Dynamite-챌린지', array['다이너마이트 챌린지','Dynamite Dance Challenge']::text[], 'BTS ''Dynamite'' 복고풍 디스코 안무를 따라 하는 글로벌 틱톡 챌린지', '2020년 8월 발매된 BTS의 첫 완전 영어곡 ''Dynamite'' 공개와 함께 공식 틱톡 계정에서 다양한 버전의 안무 영상을 올리며 챌린지가 시작됐다. 쉬운 복고풍 동작으로 전 세계 아미와 일반 이용자들이 대거 참여했다.',
    '2020년 8월 23일 BTS 공식 틱톡 계정이 ''Dynamite'' 안무 영상을 공개하며 시작', '2020년 하반기 최고 히트 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아이유 셀럽 챌린지', '아이유-셀럽-챌린지', array['Celeb Challenge','아이유 Celebrity 챌린지']::text[], '아이유 ''Celebrity''에 맞춰 나만의 다른 모습을 보여주는 SNS 챌린지', '2020년 12월 공개된 아이유의 ''셀러브리티''를 바탕으로 한 챌린지로, SNS 속 모습과 내면의 나를 자신만의 방식으로 표현하는 콘셉트였다. 2021년 1월 말 진행되며 아이유가 직접 참가자들에게 댓글을 남겨 화제가 됐다.',
    '2021년 1월 29일부터 2월 5일까지 진행된 공식 팬 이벤트로 시작', '자존감·자기표현을 주제로 한 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('선미 보라빛밤 챌린지', '선미-보라빛밤-챌린지', array['pporappippam 챌린지','보라빛 밤 챌린지']::text[], '선미가 모자로 얼굴을 가렸다 벗으며 반전 매력을 보여주는 틱톡 챌린지', '2020년 6월 발매된 선미의 ''보라빛 밤''을 홍보하기 위해 선미가 직접 모자로 얼굴을 가렸다가 벗어 던지며 분위기를 반전시키는 틱톡 챌린지 영상을 공개했다. 하트를 그리거나 얼굴을 가리는 포즈가 특징이다.',
    '2020년 6월 선미 ''보라빛 밤'' 발매 홍보를 위해 공식적으로 시작', '신곡 홍보용 반전 콘셉트 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오징어게임 달고나 챌린지', '오징어게임-달고나-챌린지', array['달고나 챌린지','Dalgona Challenge']::text[], '넷플릭스 ''오징어게임'' 속 달고나 모양을 바늘로 오려내는 챌린지', '2021년 9월 넷플릭스에서 공개된 ''오징어게임''이 전 세계적 신드롬을 일으키며, 극중 등장한 달고나(설탕 과자)의 별·우산 등 모양을 깨지 않고 오려내는 챌린지가 SNS에서 유행했다. 해외에서는 달고나 만들기 키트가 불티나게 팔릴 정도였다.',
    '2021년 9월 넷플릭스 ''오징어게임'' 공개 이후 전 세계 SNS에서 확산', '오징어게임 신드롬을 얘기할 때 대표 챌린지로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오징어게임 무궁화꽃이피었습니다 챌린지', '오징어게임-무궁화꽃이피었습니다-챌린지', array['무궁화 꽃이 피었습니다 챌린지','Red Light Green Light Challenge']::text[], '''오징어게임'' 첫 게임인 얼음땡 놀이를 따라 하는 전 세계 챌린지', '''오징어게임'' 1화에 등장한 전통 놀이 ''무궁화 꽃이 피었습니다''가 극중 거대 인형의 구호와 함께 세계적으로 알려지며, 외국인들이 한국어 구호에 맞춰 얼음이 되는 영상을 올리는 챌린지가 유행했다.',
    '2021년 9월 넷플릭스 ''오징어게임'' 공개 이후 전 세계 SNS에서 확산', '오징어게임 신드롬을 얘기할 때 대표 챌린지로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('환불원정대', '환불원정대', array['Refund Sisters','놀면뭐하니 환불원정대']::text[], '이효리·화사·제시·엄정화가 뭉친 ''놀면 뭐하니?''의 부캐 걸그룹', 'MBC ''놀면 뭐하니?''에서 유재석의 부캐 ''지미유'' 기획으로 결성된 프로젝트 걸그룹. 이효리(천옥), 화사(실비), 제시(은비), 엄정화(만옥)가 모여 2020년 10월 ''DON''T TOUCH ME''로 데뷔하며 부캐 신드롬의 정점을 찍었다.',
    '2020년 8월 MBC ''놀면 뭐하니?''에서 결성 발표, 10월 데뷔', '부캐·프로젝트 그룹을 얘기할 때 대표 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%99%98%EB%B6%88%EC%9B%90%EC%A0%95%EB%8C%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펜트하우스 명대사 밈', '펜트하우스-명대사-밈', array['천서진 밈','벌써 떨리는군']::text[], 'SKY캐슬 이후 막장 끝판왕 ''펜트하우스'' 속 대사가 밈으로 쓰인 것', '2020~2021년 방영된 SBS 드라마 ''펜트하우스''의 과장된 전개와 대사들이 온라인에서 밈으로 소비됐다. 주단태의 ''벌써 떨리는군'', 천서진의 광기 어린 피아노씬 등이 카카오톡 이모티콘으로도 출시될 만큼 화제를 모았다.',
    '2020년 10월부터 방영된 SBS 드라마 ''펜트하우스'' 극중 대사·장면에서 유래', '과장된 막장 전개나 허세를 놀릴 때 인용', null,
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('SNL코리아 주현영 주기자 밈', 'SNL코리아-주현영-주기자-밈', array['주기자','주현영 인턴기자']::text[], 'SNL코리아 속 자신감 넘치는 신입사원 ''주기자'' 캐릭터가 만든 밈', '2021년 쿠팡플레이 ''SNL 코리아'' 리부트에서 배우 주현영이 연기한 인턴기자 캐릭터. 눈을 부자연스럽게 크게 뜨고 확신에 찬 어투로 뻔한 말을 늘어놓는 ''MZ세대 신입사원'' 연기로 큰 화제를 모으며 각종 패러디와 짤을 양산했다.',
    '2021년 9월 쿠팡플레이 ''SNL 코리아 리부트''에서 첫 공개', '근거 없는 자신감으로 밀어붙이는 상황을 놀릴 때 인용', '실존 신입사원 비하로 오용되지 않도록 주의',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%A3%BC%ED%98%84%EC%98%81', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가짜사나이 "너 인성 문제 있어?" 밈', '가짜사나이-"너-인성-문제-있어?"-밈', array['인성 문제 있어','가짜사나이 밈']::text[], '유튜브 ''가짜사나이''에서 교관 이근의 훈계가 만능 답글로 쓰인 것', '2020년 유튜브 콘텐츠 ''가짜사나이''에서 교관 이근이 훈련생에게 던진 질문 ''너 인성 문제 있어?''가 어이없는 상황을 지적하는 만능 댓글 밈으로 확산됐다. ''가짜사나이'' 자체가 2020년 최대 화제의 유튜브 콘텐츠로 꼽힌다.',
    '2020년 7월 유튜브 콘텐츠 ''가짜사나이'' 1기 방영분에서 유래', '몰상식하거나 개념 없는 행동을 지적할 때 댓글로 사용', '이근 관련 이후 논란으로 호불호가 갈릴 수 있어 정치적 맥락은 피할 것',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EA%B0%80%EC%A7%9C%EC%82%AC%EB%82%98%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('IVE Eleven 챌린지', 'IVE-Eleven-챌린지', array['ELEVEN 챌린지','아이브 헤븐댄스']::text[], '아이브 데뷔곡 ''ELEVEN'' 후렴의 손동작 ''헤븐댄스''를 따라 하는 챌린지', '2021년 12월 데뷔한 아이브의 ''ELEVEN''에서 여섯 멤버가 손으로 하트 모양을 만드는 ''헤븐댄스''가 틱톡에서 챌린지로 유행했다. 해외에서는 전체 안무 대신 손동작과 손가락 줌 효과만 따라 하는 방식으로도 확산됐다.',
    '2021년 12월 1일 아이브 데뷔곡 ''ELEVEN'' 발매와 함께 시작', '신인 걸그룹 데뷔 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('모니카 A4용지 눈물 밈', '모니카-A4용지-눈물-밈', array['A4용지로 눈물 닦는 모니카','스우파 모니카 밈']::text[], '스우파 스핀오프에서 모니카가 A4 용지로 눈물 닦은 장면이 만든 밈', '''스트릿 우먼 파이터'' 스핀오프 콘텐츠에서 댄서 모니카가 감정을 추스르며 A4 용지로 눈물을 닦는 장면이 포착돼 화제가 됐다. 이후 ''대충 살자, A4용지로 눈물 닦는 모니카처럼''이라는 문구와 함께 힘 빼고 사는 태도를 나타내는 밈으로 쓰였다.',
    '2021년 ''스트릿 우먼 파이터'' 스핀오프 영상에서 유래', '힘 빼고 대충 넘기는 태도를 유쾌하게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Red Velvet Queendom 챌린지', 'Red-Velvet-Queendom-챌린지', array['퀸덤 챌린지','QueendomChallenge']::text[], '레드벨벳 ''Queendom'' 후렴 안무를 따라 하는 2021년 틱톡 챌린지', '2021년 8월 발매된 레드벨벳의 ''Queendom'' 공식 틱톡 계정을 통해 ''#QueendomChallenge'' 해시태그로 진행된 댄스 챌린지. 신스팝 사운드에 맞춘 경쾌한 후렴 안무가 특징이다.',
    '2021년 8월 레드벨벳 ''Queendom'' 발매와 함께 SM엔터테인먼트가 공식 진행', '2021년 후반 K팝 챌린지 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('05학번이즈백', '05학번이즈백', array['05학번이즈백','오오학번이즈백','05즈백']::text[], '2000년대에 멈춘 복학생 선배 콘셉트 피식대학 콩트 시리즈', '유튜브 채널 피식대학이 2021년 공개한 콩트 시리즈로, 대학교 공감 시리즈에 이은 두 번째 작품이다. 후배 역의 김민수가 유튜브를 몰라 ''UCC''라 부르는 05학번 선배들을 촬영한다는 설정으로, 2000년대 패션과 말투를 그대로 재현해 화제를 모았다. 08학번은 너무 최근이라 시대감이 애매하다는 이유로 05학번으로 설정했다고 밝혔다.',
    '유튜브 채널 피식대학(이용주·정재형·김민수)이 2021년 제작한 콩트 시리즈', '2000년대 복고 감성이나 ''나 때는'' 식 허세를 놀릴 때 쓰기 좋다', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/피식대학/05학번이즈백', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('최준(B대면데이트)', '최준(B대면데이트)', array['최준','준며들다','니곡내곡','최준체']::text[], '피식대학 김해준의 느끼한 부캐, 화상소개팅 허세남 캐릭터', '피식대학 ''B대면데이트'' 시리즈에서 김해준이 연기한 캐릭터로, 화상 소개팅에서 만난 상대에게 오글거리는 허세와 자기자랑을 늘어놓는 컨셉이다. 코 막힌 듯한 ''피글렛 창법''과 3인칭 화법이 특징이며, 초대 가수와 노래를 부르는 코너 ''니곡내곡''으로 큰 인기를 얻었다. 팬들은 그 특유의 매력에 빠지는 것을 ''준며들다''라고 부른다.',
    '유튜브 채널 피식대학 ''B대면데이트'' 시리즈, 배우 김해준의 부캐', '느끼한 허세나 오글거리는 자기자랑을 장난스럽게 가리킬 때', '실존 인물을 놀릴 때 캐릭터 패러디가 비하처럼 들리지 않게 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/피식대학/B대면데이트', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('한사랑산악회', '한사랑산악회', array['한사랑산악회','이택조','B산악회']::text[], '중년 아저씨들의 산악회를 그린 피식대학 휴먼 시트콤', '피식대학이 2021년 공개한 콩트 시리즈로, 산악회에 소속된 중년 남성들의 인간관계와 허세, 텃세를 사실적으로 묘사해 화제가 됐다. 부회장 이택조(배우 이창호 분) 등 주변에 있을 법한 아저씨 캐릭터들이 큰 공감과 웃음을 이끌어냈다. 같은 소속사 메타코미디의 채널 ''더 면상''에서 만우절 패러디로 다루기도 했다.',
    '유튜브 채널 피식대학이 2021년 제작한 콩트 시리즈', '중년 아저씨 특유의 텃세나 허세 상황을 묘사할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/피식대학/한사랑산악회', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가짜사나이', '가짜사나이', array['가짜사나이','이근 어록','할많하않']::text[], 'UDT 체험 예능에서 나온 교관들의 명대사가 만든 밈 유행', '2020년 7월 피지컬갤러리와 무사트가 공개한 UDT/SEAL 훈련 체험 콘텐츠로, 교관 이근 대위 등의 강렬한 어록이 범용성 높은 밈으로 퍼졌다. 댓글, 게시물 제목, 방송 자막에까지 광범위하게 인용됐다. 다만 2020년 10월 출연진의 논란과 악플 사태로 관련 영상이 전부 비공개 처리됐다.',
    '피지컬갤러리·무사트 제작 유튜브 콘텐츠, 2020년 7월 공개', '각오를 다지거나 빡센 상황을 과장해서 표현할 때', '출연진 관련 논란으로 인물 자체를 미화하는 맥락은 피할 것',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/가짜사나이', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펭수 펭하', '펭수-펭하', array['펭하','펭수','자이언트펭TV']::text[], 'EBS 펭귄 캐릭터 펭수의 인사말, ''펭수 하이'' 줄임말', 'EBS 유튜브 채널 ''자이언트 펭TV''의 마스코트 펭수가 쓰는 인사말로, ''펭수 하이''를 줄인 말이다. 눈치 안 보는 솔직한 언행으로 2019년 말부터 선풍적 인기를 끌었고 2020년에는 성인 시청자층까지 사로잡으며 ''인싸'' 인사말로 자리잡았다. 인기가 커지자 ''펭수'', ''펭하'' 등을 일반인이 상표 선점하는 일까지 벌어졌다.',
    'EBS 유튜브 채널 ''자이언트 펭TV''의 캐릭터 펭수, 2019년 데뷔', '밝고 친근하게 인사할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/펭수', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('네고왕', '네고왕', array['네고왕','황광희 네고왕']::text[], '유튜버가 프랜차이즈 본사와 직접 가격 협상하는 예능', '달라스튜디오가 제작한 웹예능으로, 황광희가 소비자 요청을 모아 프랜차이즈 기업과 직접 가격 협상(네고)을 벌이는 콘텐츠다. 2020년 8월 BBQ 편이 큰 화제를 모으며 조회수 수백만 회를 기록했고, 이후 유튜브 가격 네고 콘텐츠 붐의 시초가 됐다. 2020년 대한민국 유튜브 인기 광고 상위권에도 오를 만큼 광고 형식 자체가 밈처럼 소비됐다.',
    '달라스튜디오 제작 웹예능, 2020년 방영', '가격이나 조건을 과감하게 깎아달라고 할 때 농담처럼', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/네고왕', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유산슬', '유산슬', array['유산슬','유재석 부캐','뽕포유']::text[], '유재석이 만든 트로트 가수 부캐, 2020년 부캐 열풍의 상징', 'MBC ''놀면 뭐하니?''의 ''뽕포유'' 프로젝트에서 탄생한 유재석의 트로트 가수 부캐다. 가수 진성이 즉흥적으로 지어준 이름이 그대로 예명이 됐고, 실제 음원을 발매해 포털 검색 시 유재석 프로필이 뜰 정도로 독립된 캐릭터가 됐다. 2020년 ''부캐의 세계'' 특집에서 여러 부캐가 동시에 활약하며 부캐 전성시대를 이끈 대표 사례로 꼽힌다.',
    'MBC 놀면 뭐하니 ''뽕포유'' 프로젝트, 2019년 탄생 2020년 확장', '본업과 다른 새로운 부캐를 소개할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/유산슬(가수)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('MZ오피스', 'MZ오피스', array['MZ오피스','주현영','오늘내일기획']::text[], 'SNL코리아의 세대차이 회사 콩트, 신입사원 주현영이 화제', '쿠팡플레이 SNL 코리아의 인기 코너로, 가상의 광고회사 ''오늘내일기획''을 배경으로 세대 간 회사 생활 차이를 코믹하게 그렸다. 배우 주현영이 연기한 신입사원의 특유의 말투와 리액션이 큰 화제를 모으며 배우 자체가 스타덤에 올랐다. 다만 MZ세대를 다소 희화화한다는 논란도 함께 제기됐다.',
    '쿠팡플레이 ''SNL 코리아'' 코너, 2021년 방영', '세대차이로 인한 회사 내 웃픈 상황을 가리킬 때', '특정 세대를 싸잡아 조롱하는 뉘앙스로 쓰지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/MZ 오피스', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스우파 별명 밈(노이로제·린정)', '스우파-별명-밈(노이로제·린정)', array['노이로제','린정','스우파 별명']::text[], '스트릿 우먼 파이터 댄서 이름을 장난스럽게 바꿔 부른 밈', '2021년 Mnet ''스트릿 우먼 파이터'' 인기와 함께 시청자들이 댄서 이름을 유머러스하게 변형해 부르기 시작했다. 리정은 ''린정'', 노제는 ''노이로제''로 불리는 식으로 애정 어린 별명이 커뮤니티에서 유행했다. 프로그램의 폭발적 인기로 ''댄서''가 포털 프로필의 정식 직업란에 추가되는 계기가 되기도 했다.',
    'Mnet ''스트릿 우먼 파이터''(2021년 8~10월) 시청자 커뮤니티발 별명 밈', '애정 어린 말장난으로 이름을 살짝 바꿔 부를 때', '본인 앞에서 불쾌해할 수 있으니 맥락과 친밀도를 고려',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2021, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/스트릿 우먼 파이터', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('싹쓰리', '싹쓰리', array['싹쓰리','유두래곤','린다G','비룡']::text[], '유재석·이효리·비가 뭉친 2020년 여름 프로젝트 혼성그룹', 'MBC ''놀면 뭐하니?''에서 유두래곤(유재석)·린다G(이효리)·비룡(비)이 결성한 프로젝트 그룹으로, 사라진 여름 댄스가요를 부활시키자는 취지로 만들어졌다. 데뷔곡 ''다시 여기 바닷가''가 음원차트를 휩쓸며 2020년 여름 최고의 화제작이 됐다. 그룹명은 레전드 3인과 차트를 싹쓸이하자는 중의적 의미를 담았다.',
    'MBC 놀면 뭐하니 프로젝트, 2020년 5~7월 결성·활동', '레전드급 인물들이 갑자기 힘을 합친 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/싹쓰리', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('달고나커피 챌린지', '달고나커피-챌린지', array['달고나커피','달고나커피챌린지','Dalgona Coffee']::text[], '코로나 집콕 시기 수백 번 저어 만드는 커피가 세계적으로 유행', '2020년 1월 배우 정일우가 마카오에서 마신 커피 맛을 ''달고나 같다''고 소개하며 레시피가 알려졌고, MBC ''전지적 참견 시점''에서 이영자가 맛있게 먹는 모습이 흥행에 불을 붙였다. 코로나19로 집에 머무는 시간이 늘자 유튜브·틱톡에서 커피를 수백 번 저어 만드는 영상이 폭발적으로 유행했다. K팝 아이돌들의 참여로 해외에서도 ''Dalgona Coffee''라는 이름으로 알려졌다.',
    '2020년 1월 국내 방송·SNS발 레시피, 코로나 집콕 트렌드와 결합', '집에서 지루함을 달래는 소소한 도전을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/달고나 커피', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내돈내산(뒷광고 사태)', '내돈내산(뒷광고-사태)', array['내돈내산','뒷광고','2020년 유튜버 뒷광고 사건']::text[], '2020년 유튜버 뒷광고 폭로 사태로 급부상한 검증 표현', '2020년 8월 유튜버 참PD가 여러 인플루언서들이 협찬을 받고도 ''내돈내산(내 돈 주고 내가 산 것)''이라며 광고 표기 없이 홍보했다고 폭로하며 큰 논란이 일었다. 이 사태 이후 ''내돈내산''은 진짜 자비로 구매했음을 강조하는 표현이자, 동시에 뒷광고를 의심할 때 쓰는 반어적 유행어로도 쓰이게 됐다. 다수의 대형 유튜버가 사과하거나 활동을 중단하는 등 파장이 컸다.',
    '유튜버 참PD의 2020년 8월 뒷광고 폭로 콘텐츠', '진짜 자기 돈으로 산 것임을 강조하거나 협찬을 의심하는 농담으로', '특정 유튜버를 저격하는 용도로 쓰면 명예훼손 소지가 있으니 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2020, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/2020년 유튜버 뒷광고 사건', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나래바', '나래바', array['나래바','박나래 홈바']::text[], '박나래가 집에 꾸민 화려한 홈바, 파티 문화의 상징 밈', 'MBC ''나 혼자 산다''에서 박나래가 집에 마련한 개인 홈바 ''나래바''를 공개하며 화제가 됐다. 2020년 5월 더욱 화려해진 ''NEW 나래바''가 공개되며 파티·유흥 문화를 유쾌하게 상징하는 고유명사로 자리잡았다. 이후 ''나래바 갈래?''라는 말이 신나는 홈파티를 뜻하는 유행어처럼 쓰였다.',
    'MBC ''나 혼자 산다'' 박나래 편, 2020년 공개', '집에서 화려하게 노는 홈파티 분위기를 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('다이너마이트 챌린지', '다이너마이트-챌린지', array['다이너마이트챌린지','BTS Dynamite']::text[], '방탄소년단 ''Dynamite'' 안무를 따라 춘 2020년 글로벌 챌린지', '2020년 8월 발매된 방탄소년단의 디스코팝 싱글 ''Dynamite''에 맞춰 틱톡에서 진행된 안무 챌린지다. 그룹이 공식 계정으로 다양한 버전의 챌린지 영상을 공개하며 참여를 이끌었다. 코로나19로 지친 이들에게 활력을 주자는 취지로 만든 곡이 실제로 전 세계적인 댄스 챌린지 열풍을 일으켰다.',
    '방탄소년단 2020년 8월 발매곡 ''Dynamite'' 공식 챌린지', '밝고 신나는 분위기의 댄스 챌린지를 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2020, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', 'https://namu.wiki/w/Dynamite', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미스터 인크레더블 밈', '미스터-인크레더블-밈', array['Mr. Incredible Becoming Uncanny','인크레더블 밈','언캐니 밈']::text[], '표정이 점점 기괴해지는 미스터 인크레더블 비교 영상 밈', '픽사 애니메이션 ''인크레더블''의 주인공이 행복한 표정에서 점점 기괴하고 소름끼치는 표정으로 변해가는 과정을 비교하는 영상 포맷의 밈이다. 2021년 말 해외에서 시작돼 2022년 1월 한국 커뮤니티와 유튜브 쇼츠로 유입되며 다양한 패러디가 쏟아졌다.',
    '해외 팬 편집 영상에서 시작, 2022년 1월 한국 SNS·쇼츠로 유입', '두 상태를 비교하는 반전 영상 소재로 가볍게 사용', '우려먹기가 심해 2023년 이후 촌스럽다는 반응이 많음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('코카인 댄스', '코카인-댄스', array['꼬카인 댄스','Kokain 댄스']::text[], '손으로 몸을 훑는 섹시 콘셉트의 중독성 있는 댄스 밈', '독일 곡 ''Kokain 2021''에 맞춰 손으로 몸과 얼굴을 쓸어내리는 춤이다. BJ하루가 2021년 말 아프리카TV에서 유행시켰고, 2022년 1월 배우 허성태와 2월 마마무 화사가 SNL 코리아에서 패러디하며 전국적으로 퍼졌다.',
    'BJ하루(아프리카TV, 2021년 말)에서 시작, 2022년 SNL 코리아 패러디로 전국구 확산', '댄스 커버·예능 패러디 소재로 사용', '성적 제스처를 희화화한 춤이라 격식 있는 자리나 아동 앞에서는 부적절',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('곽윤기 뒷선수 시점', '곽윤기-뒷선수-시점', array['뒷선수 시점','곽윤기 짤']::text[], '쇼트트랙 선수가 다리 사이로 뒤를 확인한 장면 밈', '2022 베이징 동계올림픽 쇼트트랙 계주에서 곽윤기가 허리를 숙여 다리 사이로 뒷선수 위치를 확인한 장면이 트위터 팬아트로 퍼지며 화제가 됐다. 곽윤기 본인이 이 장면을 SNS에서 직접 재연하며 밈이 완성됐다.',
    '2022년 2월 베이징 올림픽 쇼트트랙 중계 영상과 곽윤기 본인의 SNS 재연', '과하게 신경 쓰거나 견제하는 상황을 유쾌하게 비유할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('저 반바지 아니에요', '저-반바지-아니에요', array['반바지 아니에요','창빈 현진 반바지']::text[], '반바지를 부인하다 들통나 태세 전환한 라이브 밈', '스트레이 키즈 멤버 창빈이 라이브 방송에서 반바지가 아니라고 말했지만, 현진이 다리를 때려 반바지임을 확인시켜주자 곧바로 태세를 전환한 장면이다. 2022년 2월 트위터를 중심으로 K팝 팬덤 사이에서 컬트적 인기를 끌었다.',
    '2022년 2월 스트레이 키즈 라이브 방송 클립', '말을 순식간에 뒤집는 상황을 놀릴 때 인용', '팬덤 내부 맥락이 강해 모르면 재미가 반감될 수 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지구방위대 챌린지', '지구방위대-챌린지', array['지구방위대 댄스']::text[], '슈퍼전대 포즈를 딴 흥겨운 단체 댄스 챌린지', '일본 특촬물 슈퍼전대 시리즈의 파이팅 포즈를 모티브로 한 중독성 있는 안무와 노래로 구성된 틱톡 챌린지다. 2022년 국내 크리에이터가 올린 영상이 틱톡을 통해 전 세계로 퍼졌다.',
    '2022년 국내 크리에이터의 틱톡 영상에서 시작해 글로벌 확산', '단체로 따라 추기 좋은 밝은 분위기의 챌린지', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('부럽지가 않어', '부럽지가-않어', array['장기하 부럽지가 않어']::text[], '자랑하다 반전을 주는 숏폼에 쓰인 장기하 노래 밈', '2022년 2월 발매된 장기하의 곡으로, 유튜브 쇼츠에서 무언가를 자랑하는 척하다 ''부럽지가 않어'' 가사와 함께 반전을 주는 콘텐츠의 배경음악으로 크게 유행했다.',
    '장기하 ''부럽지가 않어''(2022년 2월 발매) 발매 후 유튜브 쇼츠 패러디로 확산', '자랑하다 오히려 부러운 반전 상황에 배경음으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('LOVE DIVE 챌린지', 'LOVE-DIVE-챌린지', array['러브다이브 챌린지','거울춤','다이빙춤']::text[], '아이브 ''LOVE DIVE''의 거울춤·다이빙춤 포인트 안무 챌린지', '2022년 4월 발매된 아이브의 데뷔곡 ''LOVE DIVE''의 쉽고 중독적인 포인트 안무(거울춤, 다이빙춤)를 따라하는 틱톡 챌린지다. 공개 일주일 만에 관련 해시태그 영상 조회수가 2억 뷰를 넘겼고, 2022년 한국 틱톡에서 가장 많이 쓰인 음원 1위에 올랐다.',
    '아이브 ''LOVE DIVE'' 뮤직비디오·포인트 안무 공개(2022년 4월 15일)', '커버댄스·챌린지 영상 소재로 부담없이 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('소울리스좌', '소울리스좌', array['영혼 없는 춤','에버랜드 소울리스좌','김한나']::text[], '에버랜드 알바생의 영혼 없는 완벽한 춤으로 유명해진 밈', '에버랜드 놀이기구 ''아마존 익스프레스'' 안내 아르바이트생 김한나가 무표정하게 완벽한 랩과 춤을 선보인 영상이 2022년 5월 화제가 되며 ''영혼 없이 일하는 사람 중 최고''라는 뜻의 별명이 붙었다. 이후 각 놀이공원 캐스트들의 유사한 챌린지가 이어졌다.',
    '2022년 5월 에버랜드 아마존 익스프레스 캐스트 영상', '일은 완벽히 해내지만 텐션 없는 상황을 칭찬할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('That That 챌린지', 'That-That-챌린지', array['댓댓 챌린지','싸이 슈가 챌린지']::text[], '싸이와 슈가의 ''That That'' 포인트 안무 챌린지', '2022년 4월 발매된 싸이와 방탄소년단 슈가의 협업곡 ''That That''의 포인트 안무를 따라하는 챌린지로, 여러 K팝 아이돌과 예능 프로그램에서 커버 무대가 이어졌다.',
    '싸이 ''That That (Prod. & Feat. SUGA)'' 발매(2022년 4월 29일)와 뮤직비디오 안무', '커버 댄스·합동 무대 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('눗눗', '눗눗', array['Terrified Noot Noot','핑구 밈','눗눗 핑구']::text[], '핑구가 울다 진지해지는 표정 클로즈업 합성 밈', '애니메이션 캐릭터 핑구가 ''눗눗'' 소리를 낸 뒤 클로즈업된 진지한 표정에 모차르트 레퀴엠이 흐르는 합성 영상이다. 2022년 5월 한 유튜버의 2D 애니메이션이 다른 유튜버에 의해 3D로 재가공되며 한국을 포함해 전 세계적으로 유행했다.',
    '2022년 5월 유튜버 Telepurte의 합성 영상에서 파생, 이후 3D 리메이크로 확산', '갑자기 분위기가 진지해지는 상황에 삽입하는 편집 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여기어때송 챌린지', '여기어때송-챌린지', array['여기어때 챌린지']::text[], '중독성 있는 숙박앱 광고송에 맞춘 틱톡 챌린지', '숙박 앱 ''여기어때''가 공개한 CM송에 맞춰 춤을 추거나 패러디하는 틱톡 챌린지로, 6500만 뷰를 돌파하며 브랜드 챌린지 성공 사례로 꼽혔다. 2022년에는 황광희, 이미주, 윤종신 등이 출연한 다양한 시즌별 광고가 이어지며 밈으로 계속 회자됐다.',
    '''여기어때'' CM송 및 틱톡 브랜드 챌린지(2021년 겨울 공개, 2022년 각 시즌 광고로 확산)', '귀에 맴도는 중독성 있는 광고송 드립으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오붕가', '오붕가', array['Obunga']::text[], '넥스트봇 추격전 영상에 쓰인 오바마 합성 괴물 캐릭터 밈', '2013년 4chan에서 오바마 전 미국 대통령 얼굴을 괴물처럼 합성한 캐릭터 ''오붕가''가, 2022년 게리모드 넥스트봇 추격 콘텐츠에 활용되면서 재발굴됐다. 유튜버 Rogurt의 영상이 크게 히트하며 한국에도 2022년 6월경부터 유행했다.',
    '2013년 4chan 합성 이미지 → 2022년 게리모드 넥스트봇 추격 영상으로 재유행', '공포 게임 콘텐츠·추격전 편집 소재로 사용', '놀람 요소가 있어 어린이 대상 콘텐츠에는 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이상한 변호사 우영우 밈', '이상한-변호사-우영우-밈', array['우영우 고래밈','우영우 자몽 우영우']::text[], '드라마 ''우영우'' 속 고래·회전문 장면이 쇼츠로 퍼진 밈', '2022년 방영된 드라마 ''이상한 변호사 우영우''에서 주인공이 고래를 좋아하고 회전문을 어려워하는 설정, 그리고 ''우영우 자몽 좋아하는 자몽 우영우'' 같은 팰린드롬 자기소개가 유튜브 쇼츠·틱톡에서 재연 영상으로 크게 유행했다.',
    'ENA 드라마 ''이상한 변호사 우영우''(2022년 6~8월 방영) 명장면 클립', '자기소개나 좋아하는 것을 소개할 때 패러디로 사용', '자폐 스펙트럼 캐릭터를 다루는 만큼 장애를 희화화하지 않도록 주의',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('모기송(만다린)', '모기송(만다린)', array['모기송','만다린 모기송']::text[], '모기 죽이는 법을 가사로 담은 유튜버 노래 밈', '유튜버 만다린이 2019년 올린, 모기를 죽이는 다양한 방법을 가사로 담은 노래다. 발표 당시엔 반응이 적었지만 2022년 중순 숏폼 영상에서 갑자기 유행하며 밈이 됐다.',
    '유튜버 만다린의 2019년 곡, 2022년 7월경 숏폼 영상에서 재유행', '여름철 모기 관련 콘텐츠의 배경음으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('점점 빨라지는 노래', '점점-빨라지는-노래', array['World''s Smallest Violin','월드 스몰리스트 바이올린']::text[], '편집 영상에서 점점 빨라지며 긴장감을 높이는 배경음 밈', 'AJR의 ''World''s Smallest Violin'' 등 곡을 속도를 점점 높여가며 삽입해 몰입감과 코믹함을 동시에 주는 편집 기법이다. 2022년 7월경 다양한 밈 편집 영상의 배경음으로 유행했다.',
    '기존 곡을 점진적으로 가속하는 편집 기법이 2022년 밈 영상 트렌드로 정착', '상황이 점점 과열되는 편집 영상의 배경음으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제네시스좌', '제네시스좌', array['서초동 현자','제네시스좌 로또']::text[], '제네시스 차주로 밝혀진 남성의 춤 영상이 유행한 밈', '거리에서 춤을 추던 한 남성의 영상이 화제가 되며 ''서초동 현자''로 불리다가, 타고 있던 차종이 제네시스로 밝혀지면서 ''제네시스좌''로 별명이 바뀌었다. 소울리스좌 신드롬 직후인 2022년 8월 함께 회자됐다.',
    '2022년 8월 서초·강남 일대에서 촬영된 개인 영상이 SNS로 확산', '흥에 겨워 즉흥적으로 춤추는 상황을 가리킬 때 사용', '사전 동의 없이 촬영된 일반인 영상이 퍼진 사례라 당사자 존중 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('슬픈 고양이 댄스', '슬픈-고양이-댄스', array['Sad Cat Dance','그랜절 댄스']::text[], '애니메이션 캐릭터가 울면서 춤추는 해외발 밈이 역수입된 사례', '애니메이션 ''체인소 맨''의 캐릭터가 눈물을 흘리며 춤추는 장면이 빨라진 리믹스 음악과 합쳐져 2022년 여름 해외에서 폭발적으로 유행했다. 절을 하는 ''그랜절'' 동작이 서구권에 낯설게 다가와 화제성이 더 커졌고 한국에도 역수입됐다.',
    '애니메이션 장면 편집 + 리믹스 음악, 2022년 8월 스트리머 Waldokun의 트위터 게시로 확산', '과장된 슬픔+흥겨움이 섞인 반전 편집 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('알빠노', '알빠노', array['알바노','알 바 아니다']::text[], '무책임한 태도를 뜻하는 롤 스트리밍 채팅 유래 유행어', '''알 바 아니다''를 줄인 신조어로, 2022년 리그 오브 레전드를 플레이하던 스트리머 방송에서 팀원이 무책임한 플레이 후 채팅으로 ''알빠노''라 답한 것이 유래다. 도파 등의 유튜브 영상이 크게 퍼지며 여러 커뮤니티로 확산됐다.',
    '2022년 트위치 스트리머 PAKA 방송 중 발생한 롤 게임 채팅 사건', '책임 회피성 태도를 가볍게 비꼴 때 사용', '상대를 비꼬는 어감이 있어 친한 사이가 아니면 무례하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('새삥 챌린지', '새삥-챌린지', array['새삥 댄스']::text[], 'BE''O·이영지의 ''새삥''에 맞춘 숏폼 댄스 챌린지', '2022년 9월 발매된 지코 프로듀싱의 스트릿 맨 파이터 계급 미션곡 ''새삥''에 맞춰 추는 챌린지로, 유튜브 쇼츠에 올라온 커버 영상이 1000만 조회수를 넘기며 크게 유행했다.',
    '''새삥''(2022년 9월 6일 발매, 스트릿 맨 파이터 계급 미션곡) 댄스 커버 쇼츠 확산', '신남을 표현하는 댄스 챌린지 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제로투 회피', '제로투-회피', array['Zero Two Dodging','제로투 회피 챌린지']::text[], '제로투 댄스로 야구방망이 공격을 피하는 기묘한 컬트 밈', '중국 틱톡커 @opppleeen이 2022년 7월 올린 영상으로, 남친을 구하러 가는 여주인공이 괴한의 야구방망이 공격을 제로투 댄스로 피하는 내용이다. 90년대풍의 기묘한 연출이 컬트적 인기를 끌며 5일 만에 2400만 조회수를 기록했다.',
    '틱톡커 @opppleeen의 2022년 7월 7일 영상', '위기를 우스꽝스럽게 피하는 상황의 편집 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('중요한 것은 꺾이지 않는 마음', '중요한-것은-꺾이지-않는-마음', array['중꺾마']::text[], '롤드컵 인터뷰 제목에서 나온 불굴의 의지 유행어', '2022년 리그 오브 레전드 월드 챔피언십 그룹 스테이지에서 패배한 DRX 데프트의 인터뷰에 기자가 붙인 제목 ''중요한 건 꺾이지 않는 마음''에서 유래했다. 실제 데프트는 그런 말을 하지 않았지만 e스포츠 팬들 사이에서 대유행했고, 이후 카타르 월드컵을 거치며 전국민적 유행어가 됐다.',
    '2022년 롤드컵 DRX 데프트 인터뷰 영상 제목(기자 문대찬 작성)', '패배나 좌절 후에도 포기하지 않는 마음가짐을 응원할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('띠용흥민', '띠용흥민', array['띠용 표정','손흥민 띠용']::text[], '손흥민의 귀여운 놀란 표정이 중계 카메라에 포착된 밈', '2022 카타르 월드컵 우루과이전에서 격렬한 몸싸움 도중 손흥민이 지은 놀란 듯 귀여운 표정이 중계 카메라에 잡히며 전 세계 팬들 사이에서 밈으로 퍼졌다.',
    '2022년 11월 카타르 월드컵 한국-우루과이전 중계 영상', '귀엽게 놀란 표정을 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('귀여워서 미안해 챌린지', '귀여워서-미안해-챌린지', array['可愛くてごめん 챌린지']::text[], '손키스·사과 포즈를 따라하는 일본발 댄스 챌린지', 'HoneyWorks의 캐릭터송 ''귀여워서 미안해''에 맞춰 손키스를 하거나 사과하는 듯한 포즈, 뺨에 손을 대는 동작을 따라하는 틱톡 챌린지다. 2022년 8월 동인 버전 공개 후 9월부터 유행해 12월에는 K팝 아이돌들도 참여했다.',
    'HoneyWorks ''귀여워서 미안해'' 동인 버전(2022년 8월) 및 정식 발매(2022년 11월)', '애교 섞인 사과 표현 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뉴진스의 하입보이요', '뉴진스의-하입보이요', array['하입보이요','지금 무슨 노래 듣고 계세요 하입보이요']::text[], '질문에 뜬금없이 ''하입보이요''라 답하는 유행어 밈', '''지금 무슨 노래 듣고 계세요?''라는 콘텐츠에서 다른 질문에도 무조건 ''○○의 ○○이요'' 식으로 답하는 형식이 유행하던 중, 2022년 말 뉴진스의 ''Hype Boy''가 인기를 끌며 ''뉴진스의 하입보이요''라는 답변과 춤이 인스타 릴스·쇼츠에서 크게 퍼졌다.',
    '2022년 12월 인스타그램 릴스에서 시작된 ''뉴진스의 하입보이요'' 밈 영상', '엉뚱한 질문에 노래 제목으로 답하는 드립으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뉴진스 어텐션 챌린지', '뉴진스-어텐션-챌린지', array['Attention 챌린지']::text[], '뉴진스 데뷔곡 ''Attention'' 안무를 따라하는 틱톡 챌린지', '2022년 7월 데뷔한 뉴진스의 타이틀곡 ''Attention'' 안무를 따라하는 챌린지로, 챌린지 시작 이틀 만에 관련 콘텐츠가 400% 늘어나는 등 폭발적으로 확산되며 뉴진스 공식 틱톡 팔로워가 100만을 넘겼다.',
    '뉴진스 ''Attention'' 데뷔 무대·안무 공개(2022년 7월)와 틱톡 챌린지', '자연스러운 힘 뺀 안무 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폼 미쳤다', '폼-미쳤다', array['폼미쳤다']::text[], '실력이 대단하다는 뜻으로 쓰이는 축구 유래 유행어', '''기량이 좋다, 대단하다''는 뜻으로 쓰이는 유행어로, 축구 해설가 이주헌의 유튜브 채널 ''이스타TV''에서 축구 승부 예측 방송 중 파생된 여러 드립 중 하나로 탄생했다. 2022년 각종 유튜브 쇼츠·릴스에서 칭찬 또는 반어적 놀림 표현으로 유행했다.',
    '유튜브 채널 ''이스타TV''(이주헌 축구 해설가) 방송 드립에서 파생', '칭찬하거나 반어적으로 놀릴 때 두루 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짱구야 아빠를 속인거니?', '짱구야-아빠를-속인거니?', array['아빠를 속인거니','짱구 아빠 문 열어줘']::text[], '짱구 아빠 성대모사 영상에서 파생된 협박조 패러디 밈', '짱구 아빠 성대모사로 유명한 일본 유튜버 Kame의 더빙 쇼츠가 2022년 7월 일본에서 크게 유행한 뒤, 국내에서는 11월경 문을 열어달라 협박하는 서사에 ''짱구야 아빠를 속인거니?''라는 문구가 결합된 형태로 재밈화됐다.',
    '일본 유튜버 Kame의 짱구 성대모사 쇼츠(2022년 7월) → 국내 커뮤니티 변형(2022년 11월)', '과장된 협박·추궁 상황을 패러디할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('기가차드', '기가차드', array['Gigachad','기가채드']::text[], '궁극의 상남자를 뜻하는 근육질 합성 캐릭터 밈', '러시아 사진작가가 여러 보디빌더 사진을 합성해 만든 가상 인물 ''GigaChad''가 레딧·4chan에서 ''찌질이 vs 상남자'' 비교 밈의 상남자 역할로 쓰였다. 2021년 말~2022년 초 한국에도 유입돼 운동·자기계발 영상 편집 음악(기가차드 테마)과 함께 크게 유행했다.',
    '사진작가 크리스타 수드말리스의 ''Sleek ''N'' Tears'' 프로젝트 합성 사진, 2021년 말~2022년 초 한국 유입', '운동·자기관리 동기부여 영상의 편집 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('넥스트봇 추격전 밈', '넥스트봇-추격전-밈', array['NextBot','넥스트봇']::text[], '게임 속 넥스트봇 NPC가 집요하게 쫓아오는 공포 콘텐츠 장르', '소스 엔진의 길찾기 NPC ''넥스트봇''을 활용해 오붕가 등 캐릭터가 집요하게 플레이어를 쫓아오는 추격전 콘텐츠 장르다. 2022년 5월 유튜버 Rogurt의 ''you cant hide'' 영상이 대히트하며 관련 채널과 콘텐츠가 폭발적으로 늘었다.',
    '소스 엔진 넥스트봇 기능을 활용한 게임 콘텐츠, 2022년 5월 Rogurt 영상으로 대유행', '공포+코믹이 섞인 추격 콘텐츠 장르로 사용', '갑작스런 등장(점프스케어) 연출이 있어 놀랄 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('알파벳로어', '알파벳로어', array['Alphabet Lore']::text[], '알파벳 26글자가 서로 싸우고 협력하는 애니메이션 시리즈', '유튜버 Mike Salcedo가 2022년 2월부터 하루 한 편씩 만든 애니메이션으로, 알파벳 F가 다른 글자들을 습격하며 벌어지는 이야기를 담았다. 한국 어린이·청소년 사이에서 쇼츠로 폭발적인 인기를 얻었다.',
    '유튜버 Mike Salcedo가 2022년 2월 2일부터 연재한 애니메이션 시리즈', '어린이 대상 콘텐츠·패러디 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('백룸', '백룸', array['Backrooms','백룸 밈']::text[], '현실과 닮았지만 어긋난 공간에 갇힌다는 공포 콘텐츠 장르', '2019년 4chan에서 시작된 ''오프(off)''한 느낌의 이미지가 기원이며, 2022년 1월 유튜버 Kane Pixels가 올린 단편 영상 ''The Backrooms''가 크게 히트하며 10대들 사이에서 세계관과 공포 콘텐츠 장르로 폭발적으로 소비됐다.',
    '2019년 4chan 게시물 기원, 2022년 1월 Kane Pixels의 단편 영상으로 대유행', '으스스한 공간감을 다루는 공포 콘텐츠 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('와다다 챌린지', '와다다-챌린지', array['WA DA DA 챌린지','위글위글 챌린지','오오오 댄스']::text[], '케플러 데뷔곡 ''WA DA DA''의 위글위글·오오오 댄스 챌린지', '2022년 1월 데뷔한 케플러의 타이틀곡 ''WA DA DA''의 강약이 뚜렷한 ''와다다 댄스''와 엄지손가락을 활용한 ''오오오 댄스''로 구성된 틱톡 챌린지다. 공식 챌린지 영상 조회수가 7억 뷰를 넘겼다.',
    '케플러 ''WA DA DA'' 데뷔 무대·안무 공개(2022년 1월 3일)', '손동작 위주 포인트 안무 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('톰보이 챌린지', '톰보이-챌린지', array['TOMBOY 챌린지']::text[], '(여자)아이들 ''톰보이''의 파워풀한 안무를 따라하는 챌린지', '2022년 발매된 (여자)아이들의 ''TOMBOY'' 안무를 따라하는 챌린지로, 빌보드 선정 2022 베스트 K팝 곡 1위에 오를 만큼 인기를 끌며 각종 예능·아이돌 챌린지 무대에서 커버됐다.',
    '(여자)아이들 ''TOMBOY'' 발매 및 안무 공개(2022년)', '파워풀한 걸크러시 콘셉트 커버댄스로 사용', '골반·힙 강조 동작이 있어 미성년자가 따라할 때 과도한 노출·선정성 연출은 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핑크베놈 챌린지', '핑크베놈-챌린지', array['Pink Venom 챌린지','송곳니 챌린지']::text[], '블랙핑크 ''Pink Venom''의 송곳니 포인트 안무 챌린지', '2022년 8월 공개된 블랙핑크의 선공개곡 ''Pink Venom''에서 손으로 송곳니를 표현하는 포인트 안무를 따라하는 챌린지로, 공개 8시간 만에 안무 영상이 810만 뷰를 기록했다.',
    '블랙핑크 ''Pink Venom'' 안무 영상 공개(2022년 8월 25일)', '손으로 송곳니를 표현하는 포인트 안무로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('억텐', '억텐', array['억지 텐션']::text[], '내키지 않는 상황에 억지로 텐션을 내는 것을 뜻하는 스트리밍 유행어', '''억지 텐션''의 줄임말로, 시청자가 원하지 않는 콘텐츠를 진행하거나 분위기가 처질 때 억지로 텐션을 끌어올리는 상황을 가리키는 말이다. 2022년 스트리머 재욱임 관련 방송 클립을 통해 트위치·유튜브 커뮤니티에서 유행어로 굳어졌다.',
    '2022년 스트리머 재욱임(송재욱) 방송 클립에서 파생', '억지로 분위기를 띄우는 상황을 자조적으로 표현할 때 사용', '스트리밍 커뮤니티 맥락이 강해 일반인에겐 생소할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마보이 챌린지', '마보이-챌린지', array['Ma Boy 챌린지','씨스타19 마보이']::text[], '2011년 곡 ''마보이''가 2022년 여름 역주행한 거울 댄스 챌린지', '씨스타19의 2011년 곡 ''Ma Boy''에 맞춰 꿀렁이는 춤을 추는 챌린지로, 2022년 6월 중순부터 해외 틱톡커들이 먼저 유행시킨 뒤 국내에서도 거울 챌린지 형태로 크게 확산됐다.',
    '씨스타19 ''Ma Boy''(2011년 곡)의 2022년 6월 틱톡 역주행 챌린지', '레트로 감성의 거울 댄스 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('애프터 라이크 챌린지', '애프터-라이크-챌린지', array['After LIKE 챌린지']::text[], '아이브 ''After LIKE''의 손하트 포인트 안무 틱톡 챌린지', '2022년 8월 발매된 아이브의 ''After LIKE'' 안무 중 손으로 하트를 그리는 포인트 동작을 따라하는 챌린지다. 아이브는 컴백 하루 전 틱톡을 통해 신곡을 선공개하며 챌린지 열풍을 예고했다.',
    '아이브 ''After LIKE'' 틱톡 선공개 및 안무 공개(2022년 8월)', '손 하트 포인트 안무 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폴라로이드 러브 챌린지', '폴라로이드-러브-챌린지', array['Polaroid Love 챌린지']::text[], '엔하이픈 ''Polaroid Love'' 가사를 시각화한 댄스 챌린지', '엔하이픈의 수록곡 ''Polaroid Love''가 가사를 시각화한 안무와 함께 틱톡 챌린지로 확산됐다. 2022년 1월 미국 포브스에도 소개되며 국내외에서 화제를 모았다.',
    '엔하이픈 ''Polaroid Love'' 수록 및 틱톡 챌린지(2022년 1월)', '가사를 손동작으로 표현하는 감성 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('매니악 챌린지', '매니악-챌린지', array['MANIAC 챌린지','핑핑챌린지']::text[], '스트레이 키즈 ''MANIAC''의 나사 빠진 듯한 포인트 안무 챌린지', '2022년 3월 발매된 스트레이 키즈의 타이틀곡 ''MANIAC''의 포인트 안무를 따라하는 챌린지로, 뮤직비디오는 공개 97일 만에 1억 뷰를 달성했고 다른 아이돌들의 커버 영상도 이어졌다.',
    '스트레이 키즈 ''MANIAC'' 발매 및 안무 공개(2022년 3월 18일)', '과장되고 유쾌한 포인트 안무 챌린지로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('조규성 혓바닥 세리머니', '조규성-혓바닥-세리머니', array['조규성 세리머니']::text[], '월드컵 골 후 혀를 내밀며 손가락을 교차하는 세리머니 밈', '2022 카타르 월드컵 가나전에서 멀티골을 넣은 조규성이 혓바닥을 내밀고 검지·중지를 교차하는 세리머니를 선보이며 화제가 됐다. 이후 팬들과 다른 선수들의 패러디가 이어졌다.',
    '2022년 11월 카타르 월드컵 한국-가나전 중계 영상', '골 세리머니·득의양양한 순간을 표현할 때 패러디로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('던던댄스 릴레이댄스', '던던댄스-릴레이댄스', array['Dun Dun Dance 릴레이댄스']::text[], '자유분방한 초창기 감성이 재조명된 오마이걸 릴레이댄스', '2021년 5월 발매된 오마이걸 ''Dun Dun Dance''의 릴레이댄스로, 파트 구분 없이 자유롭게 추는 초창기 릴레이댄스 특유의 분위기 덕에 2022년 3월 M2·STUDIO CHOOM 제작진이 뽑은 ''가장 좋아하는 릴레이댄스''로 재조명받았다.',
    '오마이걸 ''Dun Dun Dance'' 릴레이댄스 영상(2021년), 2022년 제작진 인터뷰로 재조명', '자유분방하고 즉흥적인 단체 댄스 콘텐츠로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('재즈를 뭐라고 생각하세요?', '재즈를-뭐라고-생각하세요?', array['재즈가 뭐라고 생각하세요']::text[], '즉흥 재즈 스캣으로 답하는 유래 깊은 방송 유행어', '1976년 그래미 시상식에서 멜 토메가 엘라 피츠제럴드에게 재즈를 설명해달라 묻자 즉흥 스캣으로 답한 데서 유래한 밈으로, 2022년 웹툰 작가 주호민이 개인방송에서 이를 코믹하게 따라 하며 재유행했다.',
    '1976년 그래미 시상식 원본 + 2022년 주호민 개인방송 패러디', '엉뚱한 질문에 즉흥적으로 얼버무릴 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2022, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인주 앨리스', '인주-앨리스', array['히토바시라 앨리스']::text[], '틱톡 짜깁기 영상에서 갑자기 제로투 댄스가 나와 화제 된 밈', '2008년 니코니코동화에 올라온 보컬로이드 곡 ''히토바시라 앨리스''를 배경으로, 유명 틱톡커 4명의 영상을 짜깁기한 편집물에서 두 번째 인물이 뜬금없이 제로투 댄스를 추는 장면이 황당한 전개로 화제가 됐다. 한 트위터 유저의 ''두번째 앨리스 뭐하노'' 코멘트와 함께 2022년 8월 폭발적으로 유행했다.',
    '2008년 보컬로이드 곡 원곡 + 2022년 8월 틱톡 짜깁기 영상 및 트위터 코멘트로 밈화', '황당하게 튀는 전개를 가리킬 때 인용', '원곡 가사와 세계관이 다소 음산해 맥락을 모르면 낯설 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2022, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TikTok', null, 'unknown'::copyright_status from ins where false;

commit;
