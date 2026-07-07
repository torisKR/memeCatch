-- 밈캐치 시드 배치 4 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('god의 육아일기', 'god의-육아일기', array['god 재민이 육아']::text[], '아이돌 그룹 god가 아기를 돌보며 화제를 모은 국내 최초 관찰 육아 예능', '그룹 god 멤버들이 아기 한재민을 돌보는 모습을 담은 프로그램으로, 국내 관찰 예능·육아 예능의 시초로 꼽히며 god가 국민 그룹으로 자리잡는 데 결정적 역할을 했다.',
    '2000년 1월 9일부터 2001년 5월 12일까지 MBC에서 방영.', '관찰 예능·육아 예능의 원조 사례로 언급', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/god%EC%9D%98%20%EC%9C%A1%EC%95%84%EC%9D%BC%EA%B8%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('너 죽을래?', '너-죽을래?', array['장나라 너 죽을래']::text[], '시트콤 ''뉴 논스톱''에서 장나라가 유행시킨 협박성 애교 유행어', 'MBC 청춘 시트콤 ''뉴 논스톱''에서 장나라가 극 중 반복한 대사로, 위협적인 말투와 귀여운 캐릭터의 반전 매력으로 인기를 끌었다.',
    '2000~2002년 방영된 MBC 시트콤 ''뉴 논스톱''.', '장난스러운 협박 멘트로 친한 사이에 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%89%B4%20%EB%85%BC%EC%8A%A4%ED%86%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오바다', '오바다', array['조인성 오바다']::text[], '시트콤 ''뉴 논스톱''에서 조인성이 유행시킨 과장 지적 유행어', '상대의 말이나 행동이 지나치다고 지적할 때 조인성이 극 중에서 반복한 유행어로, 이후 ''오버하다''의 줄임말로 일상 대화에서도 널리 쓰였다.',
    '2000~2002년 방영된 MBC 시트콤 ''뉴 논스톱''.', '과장된 반응을 가볍게 지적할 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%89%B4%20%EB%85%BC%EC%8A%A4%ED%86%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왕껀이', '왕껀이', array['양동근 왕껀이']::text[], '시트콤 ''뉴 논스톱''에서 양동근이 만든 캐릭터성 유행어', '양동근이 극 중에서 사용한 독특한 말투의 유행어로, 박경림과의 콤비 케미와 함께 시트콤 인기에 힘을 보탰다.',
    '2000~2002년 방영된 MBC 시트콤 ''뉴 논스톱''.', '2000년대 초 시트콤 감성 회고에 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%89%B4%20%EB%85%BC%EC%8A%A4%ED%86%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('순풍, 순풍, 순풍, 야!', '순풍,-순풍,-순풍,-야!', array['순풍산부인과 구호']::text[], '시트콤 ''순풍산부인과'' 등장인물들이 외치던 구호성 유행어', 'SBS 일일 시트콤 ''순풍산부인과'' 극 중에서 등장인물들이 흥을 돋우기 위해 외친 구호로, 시트콤의 유쾌한 분위기를 상징하는 장면으로 자주 회자된다.',
    '1998년 3월 2일부터 2000년 12월 1일까지 방영된 SBS 시트콤 ''순풍산부인과''.', '1990년대말~2000년대초 시트콤 붐 이야기할 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%88%9C%ED%92%8D%EC%82%B0%EB%B6%80%EC%9D%B8%EA%B3%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고마해라, 마이 묵었다 아이가', '고마해라,-마이-묵었다-아이가', array['마이 무따 아이가']::text[], '영화 ''친구''(2001) 동수의 유언으로 남은 부산 사투리 명대사', '2001년 개봉해 800만 관객을 동원한 영화 ''친구''에서 사시미칼에 수차례 찔린 동수(유오성)가 남긴 마지막 대사로, 부산 사투리의 리듬감 때문에 이후 부산 사투리 유행어의 대명사가 됐다.',
    '2001년 3월 31일 개봉한 영화 ''친구''의 명장면 대사, 유오성(동수 역).', '과음이나 과식을 그만하라고 장난스럽게 말릴 때 인용', '원 장면이 폭력적인 죽음 장면이라 무겁게 받아들이는 사람도 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%B9%9C%EA%B5%AC(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내는 뭔데? 내는 니 시다바리가?', '내는-뭔데?-내는-니-시다바리가?', array['니 시다바리가']::text[], '영화 ''친구''(2001)에서 나온 서열·자존심 관련 명대사', '영화 ''친구''에서 준석과 상택의 관계를 상징하는 대사로, 친구 사이의 위계와 자존심 문제를 압축해 보여주는 장면으로 꼽히며 오래도록 인용됐다.',
    '2001년 개봉한 영화 ''친구''의 대사.', '부당하게 아랫사람 취급받을 때 항의조로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%B9%9C%EA%B5%AC(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여자라서 행복해요', '여자라서-행복해요', array['지펠 CF']::text[], '김남주가 출연한 삼성 지펠 냉장고 CF의 대표 카피', '삼성전자 지펠 냉장고 광고에서 배우 김남주가 우아한 이미지로 던진 카피로, 2000년대 초 최고 인기 CF 카피 중 하나로 꼽히며 다양한 방식으로 패러디됐다.',
    '2002년경 방영된 삼성전자 지펠 TV광고 시리즈.', '2000년대 초 CF 카피 회고 소재로 인용', '성역할 고정관념이 담긴 카피라 그대로 인용 시 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이정현 ''와'' 무대', '이정현-와-무대', array['이정현 목폴라']::text[], '독특한 반복 가사와 스타일로 화제를 모은 2000년 히트곡 ''와''', '가수 이정현이 발표한 ''와''는 중독성 있는 반복 후렴과 개성 있는 무대 스타일링으로 큰 인기를 끌며 당시 가요 프로그램에서 자주 회자된 무대였다.',
    '2000년 발매된 이정현의 히트곡 ''와'' 활동 무대.', '2000년대 초 가요 무대 회고 콘텐츠에 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박지윤 ''성인식'' 무대', '박지윤-성인식-무대', array['성인식']::text[], '파격적인 콘셉트로 화제를 모은 2000년 박지윤의 히트곡 무대', '가수 박지윤이 발표한 ''성인식''은 당시 기준으로 파격적인 가사와 퍼포먼스로 큰 화제를 모으며 음악 방송 최고의 이슈 무대 중 하나로 꼽혔다.',
    '2000년 발매된 박지윤의 히트곡 ''성인식'' 활동 무대.', '2000년대 초 가요계 파격 마케팅 사례로 언급', '당시에도 선정성 논란이 있었던 무대라 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2000, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대~한민국 박수 응원', '대~한민국-박수-응원', array['짝짝짝짝짝 응원','대한민국 파이팅 박수']::text[], '2002 한일 월드컵 때 전국을 하나로 만든 5박자 박수 응원법', '''대~한민국''을 외친 뒤 ''짝짝짝, 짝짝''으로 이어지는 박수 리듬이 거리 응원과 방송 중계를 통해 전국으로 퍼지며, 세대와 지역을 뛰어넘는 참여형 응원 문화의 상징이 됐다.',
    '2002년 한일 월드컵 거리 응원과 경기장 응원에서 자연발생적으로 확산됐다.', '단체 응원이나 축제 분위기를 살릴 때 재현하기 좋음', '없음',
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
  values ('감축하옵니다', '감축하옵니다', array['허준 사극체']::text[], '드라마 ''허준''에서 유행한 사극식 축하 인사말', '''축하합니다''를 사극체로 바꾼 ''감축하옵니다''가 드라마 ''허준''의 인기와 함께 일상 대화에서도 장난스럽게 쓰이는 유행어가 됐다.',
    '1999년 11월 22일부터 2000년 6월 27일까지 방영된 MBC 드라마 ''허준''.', '축하 인사를 장난스럽게 건넬 때 사극체로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%97%88%EC%A4%80(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아마, 이랬을 것입니다', '아마,-이랬을-것입니다', array['심현섭 유행어']::text[], '심현섭이 개그콘서트에서 유행시킨 진지한 척 추측성 유행어', '심현섭이 코너에서 반복한 대사로, 확신 없는 상황을 능청스럽게 단정 짓는 화법이 웃음 포인트였다. ''어떻게 표현이 안됩니다''와 함께 심현섭의 대표 유행어로 꼽힌다.',
    '2001~2002년 개그콘서트에서 심현섭이 사용한 유행어.', '근거 없는 추측을 진지하게 말할 때 패러디로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
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
  values ('화니지니', '화니지니', array['폭소클럽 화니지니']::text[], '두 노래를 하나로 잇는 믹스콘서트로 인기를 끈 폭소클럽 최장수 코너', '서로 다른 두 곡(예: 박상민의 ''해바라기''와 비틀즈의 ''Let it be'')을 한 곡처럼 자연스럽게 이어 부르는 ''믹스콘서트'' 형식으로, 국내 최초 스탠드업 코미디 프로그램 ''폭소클럽''을 대표하는 장수 코너였다.',
    '2002년 11월 1일 ''폭소클럽'' 첫 방송부터 2005년 8월까지 방영.', '곡 조합 개그 형식의 원조 사례로 언급', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8F%AD%EC%86%8C%ED%81%B4%EB%9F%BD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('서남용의 사물흉내개그', '서남용의-사물흉내개그', array['사물흉내개그']::text[], '각종 사물과 효과음을 성대모사로 재현한 폭소클럽 코너', '개그맨 서남용이 다양한 사물과 소리를 목소리와 몸짓만으로 흉내 내는 콩트 코너로, 스탠드업 코미디 형식의 폭소클럽에서 독특한 개인기 코너로 자리잡았다.',
    '2002년 12월 27일부터 2004년 5월 10일까지 방영된 ''폭소클럽'' 코너.', '성대모사·의성어 개그 소재로 언급', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8F%AD%EC%86%8C%ED%81%B4%EB%9F%BD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우리의 개그는 죽도록 웃긴 개그', '우리의-개그는-죽도록-웃긴-개그', array['우비 삼남매','우와~']::text[], '물건을 활용한 황당 개그를 스스로 해설하는 개그콘서트 코너 유행어', '박준형, 권진영, 김다래가 출연해 소품을 이용한 황당한 개그를 선보인 뒤 관객이 이해하지 못하면 ''우리의 개그는 ○○하는 개그''라고 스스로 해설해주는 형식으로 인기를 끌었다.',
    '2003년 1월 19일부터 9월 28일까지 방영된 개그콘서트 ''우비 삼남매'' 코너.', '난해한 개그를 스스로 설명할 때 패러디로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9A%B0%EB%B9%84%20%EC%82%BC%EB%82%A8%EB%A7%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정말~ 재수없어!!', '정말~-재수없어!!', array['수능 박선생']::text[], '박준형이 수능 강사 캐릭터로 유행시킨 개그콘서트 대사', '수능 강사 캐릭터를 연기한 박준형이 학생들을 향해 내뱉은 반어법 대사로, 2004년 개그콘서트 인기 코너 중 하나로 꼽혔다.',
    '2004년 개그콘서트 ''수능 박선생'' 코너.', '반어법으로 상대를 놀릴 때 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뭬야?!', '뭬야?!', array['여인천하 뭬야']::text[], '사극 ''여인천하'' 경빈 박씨의 격앙된 반응이 만든 유행어', 'SBS 대하사극 ''여인천하''에서 도지원이 연기한 경빈 박씨가 놀라거나 화날 때 외친 ''뭬야?!''가 각종 예능 프로그램에서 패러디될 정도로 큰 인기를 끌며 사극 유행어의 대표 사례가 됐다.',
    '2001년 초부터 2002년 중반까지 방영된 SBS 드라마 ''여인천하''.', '황당하거나 어이없는 소식에 놀란 반응으로 인용', '없음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%97%AC%EC%9D%B8%EC%B2%9C%ED%95%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('친구 - 느그 아부지 뭐하시노', '친구---느그-아부지-뭐하시노', array['아부지 뭐하시노']::text[], '영화 친구 속 폭력 교사의 대사, 각종 설문 명대사 1위', '담임교사가 학생을 다그치며 던진 대사로, 극중 폭력적 맥락과 별개로 성대모사·일상 유머 소재로 폭넓게 쓰였다. 여러 매체 설문에서 2000년대 영화 명대사 1위로 꼽히기도 했다.',
    '영화 ''친구''(2001)', '부산 사투리 성대모사 개그로 흔히 인용', '원 장면이 학교 체벌·폭력 상황이라 맥락 없이 쓰면 불편해할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%B9%9C%EA%B5%AC(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('친구 - 니가 가라, 하와이', '친구---니가-가라,-하와이', '{}', '영화 친구, 위기를 피하라는 권유를 거절하는 대사', '준석이 동수에게 잠시 하와이에 가 있으라 권하자 동수가 심드렁하게 거절하며 던진 대사로, 부산 사투리 억양과 리듬 덕에 폭넓게 회자됐다.',
    '영화 ''친구''(2001)', '내키지 않는 제안을 거절하는 상황에서 패러디용으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=dkPehjszHFE', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'dkPehjszHFE', 'https://www.youtube.com/watch?v=dkPehjszHFE', true from memes where slug = '친구---니가-가라,-하와이'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기적인 그녀 - 견우야 미안해 나도 어쩔 수 없는 여잔가봐', '엽기적인-그녀---견우야-미안해-나도-어쩔-수-없는-여잔가봐', '{}', '영화 엽기적인 그녀, 전지현의 대표 대사', '전지현이 연기한 ''그녀''가 견우에게 미안함을 전하며 던진 대사로, 영화 흥행과 함께 폭넓게 회자되며 성대모사 단골 소재가 됐다.',
    '영화 ''엽기적인 그녀''(2001), 전지현', '엉뚱한 행동을 사과하는 척 넘어갈 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%97%BD%EA%B8%B0%EC%A0%81%EC%9D%B8%20%EA%B7%B8%EB%85%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('BC카드 CF - 여러분, 부자 되세요', 'BC카드-CF---여러분,-부자-되세요', array['부자되세요']::text[], 'IMF 이후 국민에게 희망을 준 BC카드 광고 유행어', '김정은이 눈밭에서 외친 새해 인사 콘셉트 광고 카피로, IMF 경제난 이후 국민적 공감을 얻으며 당시 최고의 CF 유행어로 꼽혔다.',
    'BC카드 TV광고(2001~2002), 김정은', '새해 인사말로 지금도 종종 인용됨', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=eq8tsa_fGpc', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'eq8tsa_fGpc', 'https://www.youtube.com/watch?v=eq8tsa_fGpc', true from memes where slug = 'BC카드-CF---여러분,-부자-되세요'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당 연변총각 - ~슴다 말투', '봉숭아학당-연변총각---~슴다-말투', array['연변총각']::text[], '개그콘서트 연변총각 캐릭터의 과장된 말투 유행어', '강성범이 연기한 연변총각이 한국보다 연변이 더 좋다며 허풍을 떠는 콩트로, ''~였슴다'' 식의 과장된 말투가 유행어처럼 쓰였다.',
    'KBS 개그콘서트 ''봉숭아 학당'' 연변총각, 강성범(2001)', '옛 개그콘서트 캐릭터 이야기할 때만 언급', '조선족 말투를 과장해 희화화한 캐릭터라 오늘날 기준으로는 조심스럽게 다뤄야 함',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('공익광고 - 또 밟으면 데이트 신청할 겁니다', '공익광고---또-밟으면-데이트-신청할-겁니다', '{}', '2002년 교통질서 공익광고 유행어', '무단횡단 예방을 소재로 한 공익광고협의회 캠페인 카피로, 엉뚱한 화법 때문에 당시 유행어처럼 회자됐다.',
    '공익광고협의회 교통질서 캠페인(2002)', '엉뚱한 협박 개그로 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
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
  values ('야인시대 - 사딸라', '야인시대---사딸라', '{}', '드라마 야인시대, 김두한의 어눌한 발음 대사', '김두한이 미군에게 배상금 4달러를 요구하며 어눌하게 발음한 대사로, 극적인 상황과 어색한 발음의 부조화 때문에 회자됐다. 2008년 이후 인터넷 합성물로 재조명되며 세대를 넘어 유명해졌다.',
    'SBS 드라마 ''야인시대''(2003), 김영철(김두한 역)', '어눌한 발음을 강조해 웃길 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%BC%EC%9D%B8%EC%8B%9C%EB%8C%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야인시대 - 내가 고자라니', '야인시대---내가-고자라니', '{}', '드라마 야인시대, 악역 심영의 절규 대사', '고자(생식 불능자)로 몰린 심영이 억울함을 토로하며 외친 대사로, 2008년 이후 인터넷에서 ''심영물'' 합성 밈으로 폭발적으로 재유행했다.',
    'SBS 드라마 ''야인시대''(2003), 김영인(심영 역)', '황당한 누명에 억울함을 표현할 때(원맥락 이해하고 사용)', '''고자''라는 단어가 신체적 비하 표현이라 실제 사람을 향해 직접 쓰면 불쾌감을 줄 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2003, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%8B%AC%EC%98%81(%EC%95%BC%EC%9D%B8%EC%8B%9C%EB%8C%80)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('실미도 - 나를 쏘고 가라', '실미도---나를-쏘고-가라', '{}', '영화 실미도 속 절규의 명대사', '684부대원이 남긴 절박한 대사로, 한국 최초 천만 관객 영화의 대표 명대사 중 하나로 꼽힌다.',
    '영화 ''실미도''(2003)', '과장된 각오를 표현하는 패러디로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%8B%A4%EB%AF%B8%EB%8F%84(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('실미도 - 비겁한 변명입니다', '실미도---비겁한-변명입니다', '{}', '영화 실미도의 또 다른 명대사', '부조리한 명령에 항의하며 내뱉은 대사로, 개봉 당시부터 각종 성대모사·패러디 소재로 쓰였다.',
    '영화 ''실미도''(2003)', '상대의 핑계를 지적하며 장난스레 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%8B%A4%EB%AF%B8%EB%8F%84(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('다모 - 아프냐? 나도 아프다', '다모---아프냐?-나도-아프다', '{}', '드라마 다모, 절제된 사랑 고백 명대사', '다친 여주인공에게 무심한 듯 건넨 대사로 ''다모폐인''이라는 신조어까지 낳으며 2003년 최고의 유행어 중 하나로 꼽혔다.',
    'MBC 드라마 ''다모''(2003), 이서진', '오글거리는 다정함을 장난스레 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=TqCAtf1QDo8', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'TqCAtf1QDo8', 'https://www.youtube.com/watch?v=TqCAtf1QDo8', true from memes where slug = '다모---아프냐?-나도-아프다'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('X맨을 찾아라 - 쪼아~', 'X맨을-찾아라---쪼아~', '{}', '예능 X맨을 찾아라의 흥 넘치는 추임새 유행어', '신정환이 흥이 오를 때 하던 말을 유재석·강호동이 프로그램에서 자주 따라 하며 ''쪼아송'', ''쪼아댄스''까지 만들어질 정도로 유행했다.',
    'SBS 예능 ''일요일이 좋다-X맨을 찾아라''(2003)', '기분 좋을 때 흥을 표현하는 추임새로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/X%EB%A7%A8(%EC%98%88%EB%8A%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('천국의 계단 - 사랑은 돌아오는 거야!', '천국의-계단---사랑은-돌아오는-거야!', '{}', '드라마 천국의 계단, 부메랑 명대사', '권상우가 부메랑을 던지며 외친 대사로, 방영 당시 초등학생들 사이에서 부메랑 붐을 일으킬 정도로 화제였다.',
    'SBS 드라마 ''천국의 계단''(2003), 권상우', '떠난 무언가가 다시 돌아올 거라 우스갯소리로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당 갤러리 정 - 웨이러 미닛!', '봉숭아학당-갤러리-정---웨이러-미닛!', '{}', '개그콘서트 갤러리 정 캐릭터의 콩글리시 유행어', '정형돈이 연기한 캐릭터가 어설픈 영어 발음으로 외친 유행어로, 스타밸리 소속 개그맨들의 대거 이적 공백기에 개그콘서트를 지탱한 신인들의 대표 유행어 중 하나다.',
    'KBS 개그콘서트 ''봉숭아 학당'' 갤러리 정, 정형돈(2003)', '어설픈 영어 발음 개그로 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('파리의 연인 - 이 안에 너 있다', '파리의-연인---이-안에-너-있다', '{}', '드라마 파리의 연인, 2004년 최고의 유행어 1위', '수혁(이동건)이 자기 가슴에 손을 얹게 하며 사랑을 고백한 대사로, 네티즌 투표에서 2004년 올해의 유행어 1위에 선정될 만큼 신드롬을 일으켰다.',
    'SBS 드라마 ''파리의 연인''(2004), 이동건', '오글거리는 고백 멘트를 장난스레 흉내낼 때', '손발이 오그라드는 대사로 유명해 진지하게 쓰면 오히려 웃음거리가 됨',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8C%8C%EB%A6%AC%EC%9D%98%20%EC%97%B0%EC%9D%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('파리의 연인 - 애기야, 가자', '파리의-연인---애기야,-가자', '{}', '드라마 파리의 연인, 박신양의 무심한 유행어', '박신양이 연기한 재벌 3세가 태영을 부르며 반복한 짧은 대사로, ''이 안에 너 있다''와 함께 2004년 유행어 순위 상위권에 올랐다.',
    'SBS 드라마 ''파리의 연인''(2004), 박신양', '누군가를 무심하게 재촉하며 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8C%8C%EB%A6%AC%EC%9D%98%20%EC%97%B0%EC%9D%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('풀하우스 - 밥 줘!', '풀하우스---밥-줘!', array['너 조류지?','닭대가리냐']::text[], '드라마 풀하우스, 비의 능청스러운 유행어', '정지훈(비)이 연기한 남주인공이 여주인공에게 무심하게 던지던 대사들로, 아시아 한류 붐을 일으킨 드라마의 상징적 유행어가 됐다.',
    'KBS 드라마 ''풀하우스''(2004), 비(정지훈)', '무심한 듯 다정한 말투를 흉내낼 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%92%80%ED%95%98%EC%9A%B0%EC%8A%A4(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미안하다 사랑한다 - 나랑 밥 먹을래?', '미안하다-사랑한다---나랑-밥-먹을래?', '{}', '드라마 미안하다 사랑한다의 애틋한 유행어', '소지섭이 연기한 남자 주인공이 여자 주인공에게 반복해 건넨 대사로, ''미사폐인''이라 불린 팬들 사이에서 애틋한 유행어처럼 회자됐다.',
    'KBS 드라마 ''미안하다, 사랑한다''(2004), 소지섭', '무심한 듯 다정하게 밥을 권할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AF%B8%EC%95%88%ED%95%98%EB%8B%A4,%20%EC%82%AC%EB%9E%91%ED%95%9C%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가문의 영광 - 가문의 영광을 위하여!', '가문의-영광---가문의-영광을-위하여!', '{}', '영화 가문의 영광, 조폭 가족의 단체 구호', '영화 클라이맥스에서 가족이 다같이 외치는 구호로, 영화 흥행과 함께 유쾌한 조폭 코미디를 상징하는 대사로 회자됐다.',
    '영화 ''가문의 영광''(2002)', '가족·팀 단위로 파이팅을 외칠 때 패러디', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EA%B0%80%EB%AC%B8%EC%9D%98%20%EC%98%81%EA%B4%91(%EC%98%81%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('순풍산부인과 - 책임을 져야지, 그러엄~', '순풍산부인과---책임을-져야지,-그러엄~', array['그러엄','책임져']::text[], '시트콤 순풍산부인과, 미달이-정배 커플 관련 유행어', '이창훈이 미달이-정배 커플의 스킨십 장면마다 던진 대사로, ''~해야지, 그러엄~'' 말투가 2000년 당시 전국적으로 유행했다. 같은 시트콤의 ''순풍순풍순풍 야!'' 구호와 함께 대표 유행어로 꼽힌다.',
    'SBS 시트콤 ''순풍산부인과'', 이창훈', '장난스레 책임을 묻는 상황에서 패러디용으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%88%9C%ED%92%8D%EC%82%B0%EB%B6%80%EC%9D%B8%EA%B3%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Into the Arena', 'Into-the-Arena', array['신해철 월드컵 응원가','꿈은 이루어진다 수록곡']::text[], '신해철이 2002 월드컵 응원가로 만든 곡, 공식 응원 앨범 수록', '가수 신해철이 2002 한일 월드컵 시즌에 맞춰 제작한 응원가로, 월드컵 공식 응원 앨범 ''꿈★은 이루어진다''의 1번 트랙에 수록되었다. ''대~한민국'' 박수 리듬을 음악적으로 확산시키는 데 기여한 곡으로 꼽힌다.',
    '신해철이 2002 월드컵 시즌에 맞춰 작곡, 공식 응원 앨범에 수록', '2002 월드컵 응원 문화의 배경음악으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD%20%EC%B6%95%EA%B5%AC%20%EA%B5%AD%EA%B0%80%EB%8C%80%ED%91%9C%ED%8C%80/%EC%9D%91%EC%9B%90%EA%B0%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Be the Reds 티셔츠', 'Be-the-Reds-티셔츠', array['비더레즈','붉은악마 티셔츠']::text[], '2002 월드컵 국민 유니폼이 된 붉은 ''Be the Reds'' 티셔츠', '붉은악마 서포터즈가 만든 문구 ''Be the Reds!''를 새긴 빨간 티셔츠로, 2002년 5월 출시 이후 한 달 만에 수십만 장이 팔리며 전 국민이 입는 ''국민 유니폼''이 되었다. 이후 디자인 저작권을 둘러싼 소송으로도 화제가 됐다.',
    '붉은악마 공식 서포터즈 굿즈로 2002년 출시, 디자이너 박영철 도안', '2002 월드컵 열기를 상징하는 굿즈로 언급 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://en.wikipedia.org/wiki/Be_the_Reds!', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('붉은악마 치우천왕 로고', '붉은악마-치우천왕-로고', array['치우천왕기','붉은악마 도깨비 로고']::text[], '붉은악마 서포터즈의 도깨비 얼굴 상징, 치우천왕을 표방한 로고', '1997년 결성된 축구 국가대표 서포터즈 ''붉은악마''가 내세운 상징으로, 고대 배달국 치우천왕을 형상화했다고 알려진 도깨비 얼굴 로고다. 1999년 처음 등장해 2002 월드컵을 거치며 전 세계에 알려졌다. 다만 사학계에서는 실제 치우와의 직접적 연관성에 의문을 제기하기도 한다.',
    '붉은악마 서포터즈가 1999년 브라질 친선전에서 처음 사용, 2002 월드컵으로 대중화', '붉은악마 응원 역사를 설명할 때 배경지식으로 언급', '실제 치우와의 연관성은 학계에서 부정확하다고 지적됨',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B6%89%EC%9D%80%EC%95%85%EB%A7%88(%EC%84%9C%ED%8F%AC%ED%84%B0%EC%A6%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안정환 반지 세리머니', '안정환-반지-세리머니', array['반지의 제왕','골든골 세리머니']::text[], '2002 월드컵 16강 이탈리아전 골든골 직후 안정환의 반지 키스 세리머니', '2002 한일 월드컵 16강전에서 안정환이 이탈리아를 상대로 연장 골든골을 넣은 뒤 손가락에 낀 반지에 입을 맞추는 세리머니를 펼쳐 ''반지의 제왕''이라는 별명이 붙었다. 이 골로 한국은 8강에 진출했지만, 정작 안정환은 소속팀에서 방출되는 아픔을 겪기도 했다.',
    '2002년 6월 18일 한국-이탈리아 16강전, 안정환의 결승골 세리머니', '2002 월드컵 명장면을 언급할 때 바로 통하는 표현', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%9E%88%EB%94%A9%ED%81%AC%ED%98%B8/2002%20FIFA%20%EC%9B%94%EB%93%9C%EC%BB%B5%20%ED%95%9C%EA%B5%AD%C2%B7%EC%9D%BC%EB%B3%B8/%EC%9D%B4%ED%83%88%EB%A6%AC%EC%95%84%EC%A0%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('산소탱크 박지성', '산소탱크-박지성', array['산소탱크','두 개의 심장']::text[], '뛰어난 활동량과 체력의 박지성을 부르는 별명, 2002 월드컵으로 확산', '2002 한일 월드컵에서 4강 신화의 주역으로 활약한 박지성의 엄청난 활동량과 지구력을 빗대어 붙은 별명이다. 이후 국내외에서 그의 트레이드마크 별명으로 굳어졌고, 해외에서는 ''Three-Lung Park''라는 표현으로도 알려졌다.',
    '2002 월드컵 전후 박지성의 뛰어난 체력을 두고 언론과 팬들이 붙인 별명', '체력·활동량이 좋은 사람을 칭찬할 때 응용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EB%B0%95%EC%A7%80%EC%84%B1/%EB%B3%84%EB%AA%85', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('반칙왕 오노', '반칙왕-오노', array['오노 사건','안톤 오노 판정 논란','할리우드 액션']::text[], '2002 솔트레이크 쇼트트랙서 김동성을 실격시킨 오노 판정 논란', '2002 솔트레이크시티 동계올림픽 쇼트트랙 1500m 결승에서 안톤 오노가 추월당하자 양팔을 들어 올리는 ''할리우드 액션''을 취했고, 심판이 이를 앞서가던 김동성의 반칙으로 판정해 오노가 금메달을 가져갔다. 이 판정은 두고두고 논란이 되며 오노는 한국에서 오랫동안 비호감 인물로 회자되었다.',
    '2002년 2월 21일 솔트레이크시티 올림픽 쇼트트랙 1500m 결승 판정 사건', '스포츠 오심 논란을 이야기할 때 대표 사례로 언급', '특정 국가·선수 비하로 번질 수 있어 맥락에 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EC%95%84%ED%8F%B4%EB%A1%9C%20%EC%95%88%ED%86%A4%20%EC%98%A4%EB%85%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('싸이 - 새', '싸이---새', array['나 완전히 새 됐어','엽기가수 싸이']::text[], '싸이 데뷔곡, ''나 완전히 새 됐어'' 후렴구로 엽기가수 별명 얻음', '2001년 발표된 싸이의 데뷔곡으로, 통통한 몸매와 파격적인 퍼포먼스로 당시 유행하던 ''엽기'' 트렌드와 맞물려 큰 화제를 모았다. ''나 완전히 새 됐어''라는 후렴구가 유행어처럼 쓰였고, 이 곡으로 싸이는 ''엽기가수''라는 별명을 얻었다.',
    '2001년 1월 싸이 1집 ''PSY From The Psycho World!'' 타이틀곡으로 발표', '황당하거나 낭패를 봤을 때 ''새 됐다''는 표현으로 응용', '원곡 가사 중 일부가 부적절하다는 지적을 받은 바 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EC%8B%B8%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('싸이 - 챔피언', '싸이---챔피언', array['Champion','2002 월드컵 챔피언']::text[], '2002 월드컵 붉은악마 응원에서 영감받은 싸이의 건전 응원가', '싸이가 2002 한일 월드컵 당시 서울광장에서 펼쳐진 붉은악마의 응원을 보고 영감을 받아 만든 곡으로, 해롤드 팔터마이어의 ''Axel F''를 샘플링했다. 2002년 9월 발매돼 크게 히트하며 싸이에게 ''건전하게 노는 가수''라는 새 이미지를 안겼다.',
    '2002 월드컵 붉은악마 응원 현장에서 영감을 받아 작곡, 2002년 9월 19일 발매', '응원가·파티 분위기를 띄울 때 지금도 자주 소환', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%B1%94%ED%94%BC%EC%96%B8(%EC%8B%B8%EC%9D%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('god - 길', 'god---길', array['god 4집 타이틀곡']::text[], '인생의 길을 묻는 가사로 큰 사랑을 받은 god의 2001년 타이틀곡', '2001년 11월 발매된 god 정규 4집의 타이틀곡으로, 자신의 삶의 목표를 찾아 헤매는 심경을 담은 가사가 큰 공감을 얻었다. 그해 연말 시상식에서 대상을 휩쓸며 god의 전성기를 대표하는 곡 중 하나로 남았다.',
    '2001년 11월 15일 god 정규 4집 타이틀곡으로 발매', '막막한 진로·인생 고민을 이야기할 때 가사 인용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
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
  values ('god - 촛불하나', 'god---촛불하나', array['god 3집 타이틀곡']::text[], '2000년 겨울 god의 전성기를 상징한 3집 타이틀곡', '2000년 11월 발매된 god 정규 3집의 타이틀곡으로, 발매 즉시 각종 가요 순위를 휩쓸며 god가 국민 그룹으로 자리매김하는 데 결정적인 역할을 했다. 연말까지 이어진 인기로 2000년 가요계를 대표하는 곡 중 하나로 꼽힌다.',
    '2000년 11월 3일 god 정규 3집 타이틀곡으로 발매', '2000년대 초 가요를 회상할 때 대표곡으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
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
  values ('god의 육아일기 - 재민이', 'god의-육아일기---재민이', array['재민이','god 육아일기']::text[], 'god 멤버들이 22개월 아기 재민이를 돌본 관찰 예능, 국민 그룹 등극 계기', '2000년 1월부터 MBC에서 방영된 관찰 예능의 시초 격 프로그램으로, god 멤버들이 돌 지난 아기 한재민을 함께 돌보는 모습이 큰 화제를 모았다. 멤버들이 끼니를 굶는 장면에 팬들이 쌀과 반찬을 보내는 등 신드롬을 일으키며 god를 ''국민 그룹''으로 만든 결정적 계기가 되었다.',
    '2000년 1월 MBC ''일요일 일요일 밤에''·''목표달성 토요일'' 코너로 방영 시작', '관찰 예능의 원조 사례로 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/god%EC%9D%98%20%EC%9C%A1%EC%95%84%EC%9D%BC%EA%B8%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이정현 - 와', '이정현---와', array['야야야','눈그려진 부채']::text[], '외계인 콘셉트와 ''야야야'' 후렴구로 세기말을 상징한 테크노 히트곡', '1999년 말 발표돼 2000년 초까지 선풍적 인기를 끈 이정현의 데뷔곡으로, 외계인을 연상시키는 파격적 콘셉트와 ''야야야'' 후렴구가 인상적이다. 눈이 그려진 빨간 부채와 새끼손가락 마이크는 이정현의 상징적 소품이 되었고, 당시 테크노 열풍을 대중적으로 확산시켰다.',
    '1999년 10월 발매, 2000년 초까지 인기 지속된 이정현 1집 타이틀곡', '2000년대 초 테크노 열풍을 회상할 때 대표 사례로 언급', '1999년 10월 발매곡으로 유행 절정은 2000년 초임',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%99%80(%EC%9D%B4%EC%A0%95%ED%98%84)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왁스 - 화장을 고치고', '왁스---화장을-고치고', array['국민가요 화장을 고치고']::text[], '전 세대가 함께 부른 왁스의 2001년 국민가요', '2001년 발매된 왁스 2집의 타이틀곡으로, 세대를 아우르는 인기를 얻어 ''국민가요''로 불릴 정도로 크게 히트했다. 각종 가요 프로그램 1위를 휩쓸었고, 당시 여성 솔로 가수 음반 판매량 기록을 세울 만큼 사랑받았다.',
    '2001년 왁스 정규 2집 타이틀곡으로 발매', '노래방 단골곡, 2000년대 초 가요 회상용으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
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
  values ('브라운아이즈 - 벌써 일년', '브라운아이즈---벌써-일년', array['얼굴 없는 가수']::text[], '얼굴 없는 가수 콘셉트로 21주 연속 1위를 기록한 2001년 히트곡', '브라운아이즈의 데뷔 타이틀곡으로, 방송 활동을 거의 하지 않는 ''얼굴 없는 가수'' 콘셉트로 화제를 모았다. 배우들이 출연한 드라마 형식의 뮤직비디오와 함께 음원차트 21주 연속 1위라는 기록을 세웠다.',
    '2001년 브라운아이즈 데뷔 앨범 타이틀곡으로 발매', '드라마타이즈 뮤직비디오 유행을 설명할 때 대표 사례', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B2%8C%EC%8D%A8%20%EC%9D%BC%EB%85%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신화 - Wild Eyes 의자 퍼포먼스', '신화---Wild-Eyes-의자-퍼포먼스', array['신화 의자춤']::text[], '의자를 활용한 퍼포먼스로 신화의 시그니처가 된 2001년 무대', '신화 4집 수록곡 ''Wild Eyes'' 활동 당시 선보인 의자를 이용한 군무가 신화의 대표 퍼포먼스로 자리잡았다. 컴퓨터 그래픽을 활용한 뮤직비디오도 화제가 되어 당시 어린 팬들에게는 다소 무섭게 느껴졌다는 반응도 있었다.',
    '2001년 신화 정규 4집 ''Hey, Come On!'' 수록곡 활동 중 등장한 안무', '2000년대 초 아이돌 시그니처 안무를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Wild%20Eyes', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신화 - Perfect Man', '신화---Perfect-Man', array['신화 스탠드마이크 퍼포먼스']::text[], '스탠드마이크를 활용한 파워풀한 퍼포먼스로 인기 끈 2002년 타이틀곡', '신화 정규 5집의 타이틀곡으로, 강렬한 사운드와 스탠드마이크를 활용한 독특한 퍼포먼스로 큰 인기를 얻었다. 이후 리마스터된 고화질 뮤직비디오가 공개되며 다시금 화제가 되기도 했다.',
    '2002년 신화 정규 5집 타이틀곡으로 발매', '2000년대 초 보이그룹 퍼포먼스를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Perfect%20Man', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('비 - 나쁜 남자', '비---나쁜-남자', array['Rain 데뷔곡']::text[], '가수 겸 배우 비(Rain)의 2002년 솔로 데뷔 타이틀곡', '2002년 5월 발매된 비의 솔로 데뷔 앨범 타이틀곡으로, 박진영이 작사·작곡에 참여했다. 이후 후속곡 ''안녕이란 말 대신''으로 더 큰 사랑을 받으며 비는 2000년대를 대표하는 남성 솔로 가수로 성장했다.',
    '2002년 5월 13일 비 1집 앨범 타이틀곡으로 발매', '비의 데뷔 초창기를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B9%84(%EC%97%B0%EC%98%88%EC%9D%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('조성모 - 아시나요', '조성모---아시나요', array['조성모 3집 타이틀곡']::text[], '베트남전을 배경으로 한 영화급 뮤직비디오로 화제 모은 2000년 히트곡', '2000년 9월 발매된 조성모 3집의 타이틀곡으로, 베트남 전쟁을 배경으로 한 대작 뮤직비디오에 정준호, 신민아, 허준호 등 스타 배우들이 출연해 화제를 모았다. 이 앨범은 그해 최다 판매 음반에 오르며 H.O.T, 서태지, god를 제치고 연말 시상식 대상을 수상했다.',
    '2000년 9월 1일 조성모 정규 3집 타이틀곡으로 발매', '드라마타이즈 뮤직비디오 전성기를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%84%EC%8B%9C%EB%82%98%EC%9A%94', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('세븐 - 와줘', '세븐---와줘', array['SE7EN 데뷔곡']::text[], '세븐의 2003년 솔로 데뷔 타이틀곡', 'YG엔터테인먼트 소속 가수 세븐이 2003년 ''와줘''로 솔로 데뷔했다. 이후 2004년 ''열정''으로 시그니처 프리즈 댄스를 선보이며 남성 솔로 댄스가수로 입지를 굳혔다.',
    '2003년 세븐 데뷔 앨범 타이틀곡으로 발매', '2000년대 초 YG 솔로 가수 계보를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
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
  values ('빅마마 - Break Away', '빅마마---Break-Away', array['빅마마 데뷔곡']::text[], '압도적 가창력으로 데뷔와 동시에 최고 보컬그룹 등극한 2003년 곡', '2003년 YG엔터테인먼트 소속으로 데뷔한 4인조 보컬그룹 빅마마의 데뷔곡으로, 음원차트 9주 연속 1위를 기록하고 그해 뮤직비디오 대상을 수상했다. 데뷔와 동시에 국내 최고의 여성 보컬그룹이라는 평가를 받았다.',
    '2003년 빅마마 데뷔 앨범 타이틀곡으로 발매', '2000년대 초 실력파 보컬그룹을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B9%85%EB%A7%88%EB%A7%88(%EA%B0%80%EC%88%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이효리 - 10 Minutes', '이효리---10-Minutes', array['핑클 이효리 솔로 데뷔곡']::text[], '핑클 이효리의 솔로 데뷔곡, 파격 안무로 방송 금지 논란도 겪은 곡', '2003년 8월 발매된 이효리의 솔로 데뷔 앨범 타이틀곡으로, R&B·힙합 사운드와 파격적인 안무로 단숨에 그녀를 톱스타 반열에 올렸다. 안무가 지나치게 선정적이라는 이유로 한때 일부 방송사에서 방송 금지 조치를 받기도 했다.',
    '2003년 8월 13일 이효리 솔로 데뷔 앨범 ''Stylish...'' 타이틀곡으로 발매', '2000년대 초 여성 솔로 데뷔 신드롬 사례로 언급', '당시 선정성 논란이 있었던 안무이므로 맥락 설명과 함께 언급 권장',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'controversial'::meme_sentiment, 2003, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/10%20minutes', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('S.E.S - U', 'S.E.S---U', array['에스이에스 U']::text[], '1세대 걸그룹 S.E.S의 2000년 5집 타이틀곡', 'S.E.S 5집의 타이틀곡으로 ''나만의 삶을 선택하겠다''는 메시지를 담아 컴백과 동시에 각종 차트 1위에 올랐다. 라이벌 그룹 핑클과 함께 1세대 걸그룹 경쟁 구도를 상징하는 곡 중 하나로 꼽힌다.',
    '2000년 S.E.S 정규 5집 타이틀곡으로 발매', '1세대 걸그룹 라이벌 구도를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/S.E.S.', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('베이비복스 - Get Up', '베이비복스---Get-Up', array['베복 Get Up']::text[], '국내 첫 섹시 콘셉트로 화제 모은 베이비복스의 2001년 타이틀곡', '베이비복스가 2001년 6월 발매한 앨범의 타이틀곡으로, 당시 여러 매체로부터 ''한국 걸그룹 최초의 섹시 콘셉트''로 평가받았다. 이후 베이비복스는 중국·동남아 시장에서도 큰 인기를 얻으며 활동 영역을 넓혔다.',
    '2001년 6월 4일 베이비복스 앨범 타이틀곡으로 아시아 4개국 동시 발매', '1세대 걸그룹 콘셉트 변천사를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Get%20up(%EB%B2%A0%EC%9D%B4%EB%B9%84%EB%B3%B5%EC%8A%A4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이수영 - 라라라', '이수영---라라라', array['이수영 4집 타이틀곡']::text[], '단순하고 중독적인 후렴구로 사랑받은 이수영의 2002년 히트곡', '2002년 발매된 이수영 정규 4집의 타이틀곡으로, ''라라라''라는 단순한 후렴구가 큰 인기를 끌며 당시 가요 순위를 휩쓸었다. 발라드 가수로서 이수영의 입지를 다진 대표곡 중 하나다.',
    '2002년 이수영 정규 4집 ''마이 스테이 인 센다이'' 타이틀곡으로 발매', '2000년대 초 발라드 명곡을 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
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
  values ('자우림 - 매직 카펫 라이드', '자우림---매직-카펫-라이드', array['자우림 3집 타이틀곡']::text[], '자우림을 메인스트림 록밴드로 올려놓은 2000년 메가히트곡', '2000년 발매된 자우림 3집 ''Jaurim, the Wonderland''의 타이틀곡으로, 보컬 김윤아가 샤워 중 떠올린 멜로디로 만들어졌다고 알려져 있다. 이 곡의 대성공으로 자우림은 인디 감성에서 벗어나 완전한 메인스트림 록밴드로 자리매김했다.',
    '2000년 자우림 정규 3집 타이틀곡으로 발매', '2000년대 초 록밴드 히트곡을 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Jaurim,%20the%20Wonderland', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('SG워너비 - Timeless', 'SG워너비---Timeless', array['SG워너비 데뷔곡']::text[], '미디엄템포 발라드 유행을 이끈 SG워너비의 2004년 데뷔곡', '2004년 발매된 SG워너비 1집의 타이틀곡으로, 당시 유행하던 미디엄템포 발라드의 중심에 선 곡이다. 디지털 음원 플랫폼에서 대성공을 거두며 SG워너비를 단숨에 스타 그룹으로 만들었다.',
    '2004년 4월 SG워너비 데뷔 앨범 타이틀곡으로 발매', '2000년대 중반 발라드 그룹 전성기를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Timeless(SG%EC%9B%8C%EB%84%88%EB%B9%84)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('코요태 - 비몽', '코요태---비몽', array['코요태 2003년 히트곡']::text[], '2003년 발표돼 코요태 전성기를 이끈 댄스 히트곡', '코요태가 2003년 발표한 타이틀곡으로, 이듬해인 2004년까지 이어진 코요태 전성기의 시작점이 된 곡이다. 이후 코요태는 ''비몽''을 포함한 여러 히트곡으로 2004년 한 해 가장 많은 가요 프로그램 1위를 차지했다.',
    '2003년 코요태 앨범 타이틀곡으로 발매', '2000년대 초 혼성 댄스그룹 전성기를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
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
  values ('H.O.T 해체', 'H.O.T-해체', array['에이치오티 해체','H.O.T FOREVER']::text[], '1세대 아이돌 H.O.T가 2001년 갑작스럽게 해체를 선언한 사건', '1996년 데뷔해 1세대 아이돌 붐을 이끈 H.O.T가 2001년 2월 마지막 콘서트 이후 석 달 만인 5월 13일 돌연 해체를 발표했다. 해체는 없다던 약속이 뒤집히자 충격받은 팬들이 소속사 앞에서 시위를 벌이기도 하며, 1세대 아이돌 팬덤 문화의 상징적 사건으로 남았다.',
    '2001년 5월 13일 멤버 3인의 기자회견으로 사실상 해체 확정', '1세대 아이돌 팬덤 문화·해체 사건을 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/H.O.T.%2F%ED%95%B4%EC%B2%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('보아 - No.1', '보아---No.1', array['보아 2집 타이틀곡']::text[], '세계적 가수를 향한 포부를 담은 보아의 2002년 유로댄스 히트곡', '2002년 4월 발매된 보아 정규 2집의 타이틀곡으로, 밝은 유로댄스 사운드에 세계 최고의 가수가 되겠다는 포부를 담았다. 그해 50만 장 이상 판매되며 보아를 명실상부한 톱 아이돌 반열에 올려놓았다.',
    '2002년 4월 보아 정규 2집 타이틀곡으로 발매', '2000년대 초 솔로 아이돌 전성기를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/No.1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('동방신기 - Hug', '동방신기---Hug', array['동방신기 데뷔곡']::text[], '멤버들의 화음을 강조한 동방신기의 2004년 데뷔 타이틀곡', '2004년 1월 발매된 동방신기의 데뷔 싱글 타이틀곡으로, 이전 SM 남성 아이돌과 달리 밝고 대중친화적인 미디엄템포 댄스팝을 선보였다. 댄스와 아카펠라를 모두 소화하는 ''만능 그룹'' 이미지를 각인시키며 신인상을 휩쓸었다.',
    '2003년 12월 첫 무대 이후 2004년 1월 14일 데뷔 싱글로 정식 발매', '2000년대 중반 아이돌 세대교체를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Hug', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('god - 어머님께', 'god---어머님께', array['짜장면이 싫다고 하셨어']::text[], 'god 3집 대표곡, ''짜장면'' 가사로 유명한 효 발라드', 'god 정규 3집 타이틀곡으로 리더 박준형의 어린 시절 실화를 바탕으로 만든 곡이다. ''어머님은 짜장면이 싫다고 하셨어''라는 가사가 큰 공감을 얻으며 전 국민이 따라 부르는 국민 발라드가 됐고, 이 대사는 지금도 효 관련 콘텐츠에서 패러디·인용된다.',
    '2000년 7월 25일 god 정규 3집 ''Chapter 3'' 타이틀곡으로 발표', '부모님 사랑, 효도를 이야기할 때 가사 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%96%B4%EB%A8%B8%EB%8B%98%EA%BB%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('서태지 - 울트라맨이야', '서태지---울트라맨이야', array['서태지 6집 타이틀곡']::text[], '발매 첫날 90만 장 초동을 기록한 서태지의 2000년 컴백작', '서태지 정규 6집 타이틀곡으로, 국내에 생소했던 누메탈 장르를 메이저 시장에 알린 곡이다. 발매 첫날 초동 판매량 90만 장을 기록해 역대 초동 1위에 올랐고, 한 가지에 몰두하는 ''마니아'' 심리를 다룬 파격적인 사운드로 화제를 모았다.',
    '2000년 9월 8일 서태지 정규 6집 타이틀곡으로 컴백', '서태지 컴백, 2000년대 초 록·메탈 사운드를 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EC%9A%B8%ED%8A%B8%EB%9D%BC%EB%A7%A8%EC%9D%B4%EC%95%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박지윤 - 성인식', '박지윤---성인식', array['성인식 댄스']::text[], '18세 박지윤의 파격 안무로 화제 모은 2000년 데뷔 타이틀곡', '당시 18세였던 박지윤이 박진영 프로듀싱으로 발표한 곡으로, 관능적인 사운드와 파격적인 안무로 큰 화제를 모았다. 20여 년이 지난 지금도 K팝 아이돌 연습생들이 연습하는 안무곡으로 꼽힐 만큼 상징성이 크다.',
    '2000년 박지윤 정규 4집 타이틀곡으로 발표, JYP엔터테인먼트 이적 후 첫 활동', '2000년대 초 파격 안무의 대표 사례로 인용', '미성년자 성적 대상화 논란이 있었던 곡이라 언급 시 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2000, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%84%B1%EC%9D%B8%EC%8B%9D(%EB%B0%95%EC%A7%80%EC%9C%A4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('젝스키스 해체', '젝스키스-해체', array['젝키 해체 선언']::text[], '1세대 아이돌 젝스키스의 전격 해체 발표와 고별무대', '1997년 데뷔한 젝스키스가 2000년 5월 18일 기자회견을 열고 전격 해체를 발표하고, 이틀 뒤 드림콘서트 무대를 끝으로 활동을 마쳤다. 리더 은지원이 팬들의 사랑을 받을 때 떠나야 한다며 먼저 해체를 제안했다는 사실이 훗날 알려졌다.',
    '2000년 5월 18일 멤버들의 자발적 해체 발표, 5월 20일 드림콘서트 고별무대', '1세대 아이돌 문화, 2000년대 초 팬덤을 회상할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4/%ED%95%B4%EC%B2%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('S.E.S 해체', 'S.E.S-해체', array['에스이에스 활동중단']::text[], '1세대 걸그룹 S.E.S의 활동 중단과 공식 해체 발표', '1997년 데뷔한 1세대 걸그룹 S.E.S가 2002년 12월 멤버 유진의 재계약 거부로 공식 해체 수순을 밟았다. H.O.T, 젝스키스에 이어 1세대 아이돌 시대의 막을 내린 상징적 사건으로 꼽힌다.',
    '2002년 12월 19일 SM엔터테인먼트가 S.E.S 재계약 불발을 공식 발표', '1세대 걸그룹 팬덤, 2000년대 초 가요계 세대교체를 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/S.E.S./%ED%99%9C%EB%8F%99/%ED%95%9C%EA%B5%AD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('캔 - 내 생에 봄날은...', '캔---내-생에-봄날은...', array['내생에 봄날은 간다']::text[], '드라마 ''피아노'' 삽입곡으로 대박난 2001년 발라드', '일본 가수 TUBE의 곡을 번안한 발라드로, SBS 드라마 ''피아노''에 삽입되며 폭발적인 인기를 끌어 가요 차트 1위까지 차지했다. 2000년대 초 드라마 OST 마케팅의 대표 성공 사례로도 꼽힌다.',
    '2001년 캔 정규 3집 타이틀곡으로 발표, 드라마 ''피아노'' 삽입곡', '2000년대 초 드라마 OST, 봄 감성 발라드에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%B4%20%EC%83%9D%EC%97%90%20%EB%B4%84%EB%82%A0%EC%9D%80...', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('MC몽 - 너에게 쓰는 편지', 'MC몽---너에게-쓰는-편지', array['편지 MC몽']::text[], '랩과 발라드를 결합한 MC몽의 2004년 데뷔 대표곡', '2004년 데뷔한 MC몽이 랩과 서정적인 멜로디를 결합해 큰 인기를 끈 대표곡이다. 편지 형식의 애틋한 가사가 공감을 얻으며 이후 힙합 발라드 장르 유행에 영향을 준 곡으로 평가된다.',
    '2004년 MC몽 솔로 데뷔 앨범 수록곡으로 발표', '편지 콘셉트, 힙합 발라드를 소개할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%84%88%EC%97%90%EA%B2%8C%20%EC%93%B0%EB%8A%94%20%ED%8E%B8%EC%A7%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('길거리 응원', '길거리-응원', array['시청 앞 응원','광화문 응원']::text[], '경기장 밖 시청·광화문 대형 스크린 앞 집단 응원 문화', '2002 월드컵 기간 시청 앞 광장 등에 대형 스크린을 설치하고 수십만 명이 모여 함께 응원한 문화 현상으로, 이후 국제경기 응원 방식의 표준이 됐다. 국가적 결집을 상징하는 장면으로 언론에 지속적으로 소환된다.',
    '2002 한일 월드컵 기간 서울시청 앞 광장 등에서 자연발생적으로 확산', '국제경기 단체 응원 문화를 설명할 때 사용', null,
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
  values ('4강 신화', '4강-신화', array['대한민국 4강 신화']::text[], '2002 월드컵 한국의 4강 진출을 부르는 표현', '개최국 한국이 4강까지 오른 2002 월드컵의 성과를 가리키는 상징적 표현으로, 이후에도 예상을 뛰어넘는 기적적 성과를 비유할 때 널리 쓰인다. 히딩크호의 도전과 온 국민의 거리 응원이 만든 결과라는 의미가 함께 담겨 있다.',
    '2002 한일 월드컵 대한민국 대표팀의 4강 진출 성과를 언론이 명명', '예상 밖의 큰 성과를 비유할 때 사용', null,
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
  values ('완소남', '완소남', array['완전 소중한 남자','정일우 완소남']::text[], '''완전 소중한 남자''의 준말, 정일우 인기에서 퍼진 2007년 유행어', 'MBC 시트콤 거침없이 하이킥에 출연한 배우 정일우의 인기에서 비롯된 신조어로 ''완전 소중한 남자''를 줄인 말이다. 2007년 온라인 스타 투표에서 정일우가 관련 부문 1위를 차지하는 등 화제를 모으며 10대 사이에서 널리 쓰였고 이후 방송 자막 등에서도 인용됐다.',
    'MBC 시트콤 거침없이 하이킥 정일우 인기에서 파생된 신조어(2007)', '2000년대 후반 청소년 유행어를 회고할 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('원더걸스 Tell Me 꼭지점춤', '원더걸스-Tell-Me-꼭지점춤', array['텔미 춤','살랑살랑 춤','팔찌 춤']::text[], '원더걸스 Tell Me 후렴구 손동작이 전 국민 유행 댄스가 된 사건', '2007년 발매된 원더걸스의 ''Tell Me''는 살랑살랑 춤, 찌르기 춤, 팔찌 춤 등 후렴구 손동작이 세대와 직업을 불문하고 따라 하는 국민 신드롬을 일으켰다. 학생부터 노인, 경찰, 군인까지 춤을 따라 추는 UCC가 쏟아지며 ''원더걸스 모르면 간첩''이라는 말까지 생겼다.',
    'JYP엔터테인먼트 원더걸스 ''Tell Me''(2007) 안무, 박진영 지도', '2000년대 후반 K팝 댄스 유행을 회고하거나 커버댄스 콘텐츠에 활용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Tell%20Me', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('빅뱅 거짓말 커버댄스', '빅뱅-거짓말-커버댄스', array['거짓말 춤']::text[], '빅뱅 ''거짓말'' 안무를 따라 추는 커버댄스 UCC가 크게 유행', '2007년 8월 발매된 빅뱅의 ''거짓말''은 소몰이 발라드가 지배하던 가요계 흐름을 바꾼 곡으로, 후크송·아이돌 댄스 시대를 연 대표곡 중 하나다. 노래 인기와 함께 일반인들이 안무를 따라 춘 커버댄스·패러디 영상이 인터넷에 대량으로 공유됐다.',
    'YG엔터테인먼트 빅뱅 미니앨범 Always 타이틀곡 ''거짓말''(2007.8)', '2007년 아이돌 커버댄스 문화를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B1%B0%EC%A7%93%EB%A7%90(BIGBANG)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당 유행어(인생 뭐 있어)', '봉숭아학당-유행어(인생-뭐-있어)', array['인생 뭐 있어','야야야 브라더스']::text[], '개그콘서트 봉숭아학당에서 나온 2006년 학생 캐릭터 유행어들', '개그콘서트의 장수 코너 봉숭아학당에서 2006년 여름 안일권이 밀던 ''인생 뭐 있어~!''와 그해 가을 등장한 ''짜증나고 우울할 땐? 야야야 브라더스!''가 학생들 사이 유행어로 번졌다. 두 대사 모두 봉숭아학당 특유의 짧고 반복적인 유행어 남발 방식의 대표 사례로 꼽힌다.',
    'KBS 개그콘서트 봉숭아학당 코너(2006)', '체념 섞인 허무개그 톤으로 인용할 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B4%89%EC%88%AD%EC%95%84%20%ED%95%99%EB%8B%B9(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('원더걸스 Nobody 총알춤', '원더걸스-Nobody-총알춤', array['노바디 춤','총알 댄스']::text[], '원더걸스 Nobody의 복고풍 총알춤이 전 세대에 유행한 2008년 대표 댄스', '2008년 9월 발매된 원더걸스의 ''Nobody''는 So Hot에 이어 그해 세 번째 메가히트를 기록하며 완전한 원톱 자리에 올랐다. 스테이시 큐 곡을 샘플링한 디스코 리듬에 맞춘 포인트 안무 ''총알춤''은 연예인은 물론 정치인까지 패러디할 정도로 범국민적 유행이 됐다.',
    'JYP엔터테인먼트 원더걸스 ''Nobody''(2008.9) 안무', '2008년 K팝 댄스 신드롬을 회고하거나 패러디 콘텐츠 소재로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Nobody', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('원더걸스 So Hot V라인댄스', '원더걸스-So-Hot-V라인댄스', array['소핫 춤','V라인 댄스']::text[], '원더걸스 So Hot의 복고 로큰롤 안무가 2008년 상반기를 휩쓴 유행', '2008년 5~6월 발매된 원더걸스의 ''So Hot''은 복고 아날로그 악기와 로큰롤 리듬이 특징인 곡으로, 배윤정 안무가가 만든 V라인 댄스가 큰 인기를 끌었다. So Hot과 뒤이은 Nobody까지 이어지며 2008년 원더걸스의 3연타 메가히트를 이끌었다.',
    'JYP엔터테인먼트 원더걸스 ''So Hot''(2008.5~6) 안무, 배윤정', '2008년 걸그룹 댄스 유행을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/So%20Hot', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('손담비 미쳤어 UCC 논란', '손담비-미쳤어-UCC-논란', array['미쳤어 의자춤','손담비 춤']::text[], '손담비 ''미쳤어'' 의자춤 유행 중 어린이 따라부르기 UCC 저작권 논란까지 발생', '2008년 발매된 손담비의 ''미쳤어''는 미국 게이클럽 안무에서 착안한 의자춤이 하반기 신드롬을 일으켰다. 일반인 패러디 UCC가 폭증하는 가운데 한 네티즌이 올린 5세 딸이 노래를 흥얼거리는 영상이 저작권 침해로 삭제되면서 사회적 논쟁이 벌어졌고, 방송사가 자체적으로 노출을 자제하는 해프닝도 있었다.',
    '손담비 미니앨범 타이틀곡 ''미쳤어''(2008) 의자춤 안무', '2008년 UCC 저작권 논쟁 사례로 언급할 때', '어린이 대상 저작권 분쟁이라는 민감한 배경이 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AF%B8%EC%B3%A4%EC%96%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('동방신기 미로틱 안무 논란', '동방신기-미로틱-안무-논란', array['주문-MIROTIC 논란']::text[], '동방신기 ''주문-MIROTIC'' 노출·선정성 논란으로 안무 수정까지 간 사건', '2008년 발매된 동방신기 4집 타이틀곡 ''주문-MIROTIC''은 파격적인 가사와 안무로 성적 표현 논란에 휩싸여 청소년보호위원회로부터 유해매체물 판정을 받았다. 결국 그룹은 수정된 안무를 그해 골든디스크 시상식에서 공개했으며, 원래 안무 영상은 이후에도 화제성으로 회자됐다.',
    'SM엔터테인먼트 동방신기 4집 ''주문-MIROTIC''(2008.9)', '2008년 가요 심의·선정성 논란 사례로 언급할 때', '성적 표현 논란이 핵심이므로 맥락 설명이 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/MIROTIC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('카라 프리티걸', '카라-프리티걸', array['Pretty Girl 안무']::text[], '카라를 소녀시대·원더걸스와 경쟁하는 걸그룹 반열에 올린 2008년 히트곡', '2008년 12월 발매된 카라의 두 번째 미니앨범 타이틀곡 ''프리티걸''은 중독성 있는 멜로디와 깜찍한 안무로 큰 인기를 끌며 카라를 소녀시대·원더걸스와 경쟁하는 걸그룹 반열에 올려놓았다. 이 곡의 성공은 이듬해 ''미스터'' 신드롬으로 이어지는 발판이 됐다.',
    'DSP미디어 카라 미니앨범 ''Pretty Girl'' 타이틀곡(2008.12)', '2008년 걸그룹 경쟁 구도를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Pretty%20Girl', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('2008 촛불집회 아프리카TV 생중계', '2008-촛불집회-아프리카TV-생중계', array['아프리카 생중계 열풍','BJ 촛불 중계']::text[], '2008년 광우병 촛불집회를 개인 BJ들이 아프리카TV로 생중계하며 대안매체로 급부상', '2006년 서비스를 시작한 아프리카TV는 2008년 미국산 쇠고기 수입 반대 촛불집회를 BJ들이 캠코더와 노트북으로 생중계하면서 전국적 주목을 받았다. 한 여대생이 군홧발에 맞는 장면이 실시간으로 100만 명 넘게 시청되는 등 화제를 모으며 아프리카TV가 대안 미디어로 자리잡는 계기가 됐다.',
    '아프리카TV BJ들의 2008년 촛불집회 개인 생중계', '1인 방송·시민 저널리즘의 초기 사례로 언급할 때', '정치적으로 민감한 사회운동과 결부된 사건',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('카라 미스터 엉덩이춤', '카라-미스터-엉덩이춤', array['미스터 골반춤']::text[], '카라 ''미스터''의 골반을 돌리는 안무가 ''엉덩이춤''으로 불리며 신드롬을 일으킴', '2009년 카라의 ''미스터''는 원래 서브곡이었지만 안무가 배윤정이 만든 골반 돌리기 동작이 첫 방송 직후 대히트해 오히려 타이틀곡보다 주목받았다. 네티즌들이 ''엉덩이춤''이라 부르며 화제가 됐고, 이후 일본에서도 하나의 사회현상으로 소개될 만큼 인기를 끌었다.',
    'DSP미디어 카라 ''미스터''(2009) 안무, 배윤정', '2009년 걸그룹 포인트 안무 유행을 회고할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AF%B8%EC%8A%A4%ED%84%B0(%EC%B9%B4%EB%9D%BC)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('브아걸 시건방춤', '브아걸-시건방춤', array['아브라카다브라 춤','시건방댄스']::text[], '브라운아이드걸스 ''Abracadabra''의 파격 섹시 안무가 낳은 신드롬 댄스', '2009년 발매된 브라운아이드걸스의 ''Abracadabra''는 발매 초 반응이 약했지만 방송 활동으로 역주행해 그해 하반기 최대 히트곡이 됐다. 안무가 배윤정이 만든 ''시건방춤''은 보수적이던 당시 정서에 파격을 안기며 2009~2010년 각종 예능에서 따라 하는 단골 소재가 됐다.',
    '진크림엔터테인먼트 브라운아이드걸스 ''Abracadabra''(2009) 안무, 배윤정', '2009년 섹시 콘셉트 안무 유행 회고나 예능 패러디 소재로', '선정적 안무라는 평가가 있어 맥락에 따라 조심스러울 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Abracadabra(%EB%B8%8C%EB%9D%BC%EC%9A%B4%EC%95%84%EC%9D%B4%EB%93%9C%EA%B1%B8%EC%8A%A4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('소녀시대 Gee 개다리춤', '소녀시대-Gee-개다리춤', array['Gee 다리춤','개다리 댄스']::text[], '소녀시대 ''Gee''의 개다리춤이 세대를 초월해 유행하며 스키니진 열풍까지 이끔', '2009년 1월 발매된 소녀시대의 ''Gee''는 안무 중 다리를 교차하는 ''개다리춤''이 귀엽고 엉뚱한 매력으로 남녀노소에게 사랑받으며 유행했다. 곡 인기와 함께 컬러 스키니진이 전국민 패션 아이템이 될 정도로 파급력이 컸고, 각종 음원 차트에서 신기록을 세웠다.',
    'SM엔터테인먼트 소녀시대 ''Gee''(2009.1) 안무', '2009년 걸그룹 댄스·패션 유행을 회고할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Gee', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('슈퍼주니어 쏘리쏘리', '슈퍼주니어-쏘리쏘리', array['쏘리쏘리 춤','Sorry Sorry 안무']::text[], '잘못을 비는 손동작 안무로 아시아 전역에 커버댄스 열풍을 일으킨 곡', '2009년 3월 발매된 슈퍼주니어 3집 타이틀곡 ''쏘리쏘리''는 가사처럼 잘못을 비는 듯한 손동작 안무가 누구나 따라 하기 쉬워 10~20대 사이에서 노래와 춤 모두 유행어처럼 번졌다. 한국을 넘어 중국·대만·태국·필리핀 등 아시아 각국 음원 차트를 석권하며 글로벌 커버댄스 열풍을 일으켰다.',
    'SM엔터테인먼트 슈퍼주니어 정규 3집 ''쏘리쏘리''(2009.3)', '2009년 아이돌 커버댄스 열풍의 대표 사례로 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Sorry,%20Sorry', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('티아라 보핍보핍 고양이춤', '티아라-보핍보핍-고양이춤', array['Bo Peep Bo Peep 안무','고양이 춤']::text[], '티아라를 단숨에 정상급으로 올린 2009년 겨울 히트곡의 고양이춤', '2009년 겨울 발표된 티아라의 ''Bo Peep Bo Peep''은 섹시하면서도 귀염성 있는 의상과 중독성 강한 멜로디로 큰 인기를 끌었고, 특히 포인트 안무인 ''고양이춤''이 화제였다. 소녀시대·원더걸스가 양강 구도를 이루던 걸그룹 시장에서 티아라를 단숨에 정상급 반열로 올려놓은 곡으로 평가된다.',
    '코어콘텐츠미디어 티아라 ''Bo Peep Bo Peep''(2009.12) 안무', '2009년 걸그룹 안무 유행을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/Bo%20Peep%20Bo%20Peep', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('분장실의 강선생님', '분장실의-강선생님', array['강선생님','영광인 줄 알아 이것들아']::text[], '개그맨들의 분장실 뒷모습을 과장한 2009년 개그콘서트 코너', '2009년 방영된 개그콘서트 코너로 강유미, 안영미, 변기수, 김준현 등이 우스꽝스러운 분장을 하고 후배에게 군기 잡는 선배 연예인을 풍자했다. ''영광인 줄 알아 이것들아'', ''똑바로 해 이것들아'', ''니들이 고생이 많다'' 등 다양한 유행어를 낳았다.',
    'KBS 개그콘서트', '선배 코스프레·허세 상황 패러디에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B6%84%EC%9E%A5%EC%8B%A4%EC%9D%98%20%EA%B0%95%EC%84%A0%EC%83%9D%EB%8B%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('달인(김병만)', '달인(김병만)', array['안 해봤으면 말을 하지 마세요','김병만 달인']::text[], '몸개그의 달인 김병만이 기술 시연 후 일침 놓는 코너', '2007년 12월 시작해 개그콘서트 최장수 코너가 된 ''달인''. 김병만이 위험한 몸개그와 마술 같은 기술을 선보인 뒤 ''XX 해 봤어요? 안 해봤으면 말을 하지 마세요''라며 훈계하는 게 포인트였다.',
    'KBS 개그콘서트, 김병만', '도전·훈수 상황에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8B%AC%EC%9D%B8(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('웃찾사 ''그런거야'' 코너', '웃찾사-그런거야-코너', array['그런거야?','빙고']::text[], '군대 개그로 인기 끈 웃찾사 코너의 유행어', 'SBS ''웃음을 찾는 사람들''에서 인기를 끈 군대 콩트 코너로 ''그런거야~?'', ''빙고!'', ''못 들었겠다/안 들리시겠다~'' 같은 대사가 크게 유행했다.',
    'SBS 웃음을 찾는 사람들', '군대 드립·반문할 때 활용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9B%83%EC%9D%8C%EC%9D%84%20%EC%B0%BE%EB%8A%94%20%EC%82%AC%EB%9E%8C%EB%93%A4/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('희한하네', '희한하네', array['희한하네','제발 긴장 좀 허자']::text[], '웃찾사 콩트에서 나온 2005~2006년 유행어', '웃음을 찾는 사람들의 코너에서 나온 대사로 ''이상하게 ~하고 싶네'', ''희한하네'', ''제발 긴장 좀 허자~!'' 등이 당시 크게 유행했다.',
    'SBS 웃음을 찾는 사람들', '지금은 아는 사람만 아는 옛날식 유행어', '2020년대엔 통용되지 않는 사어에 가까움',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9B%83%EC%9D%8C%EC%9D%84%20%EC%B0%BE%EB%8A%94%20%EC%82%AC%EB%9E%8C%EB%93%A4/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그룹 싸쓰', '그룹-싸쓰', array['파파파파 붐치기 밥바 붐밥바']::text[], '웃찾사 언박자 댄스 듀오 코너의 유행어', '정만호·윤성한 콤비가 선보인 웃찾사의 댄스 듀오 콩트로, 엉성한 안무와 함께 외친 ''파 파파 파파, 붐치기 밥바 붐밥바''라는 후렴구가 당시 유행어처럼 따라 불려졌다.',
    'SBS 웃음을 찾는 사람들, 정만호·윤성한', '옛날 개그 패러디용, 알아보는 사람 적음', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B7%B8%EB%A3%B9%20%EC%8B%B8%EC%93%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제3세계 - 육봉달', '제3세계---육봉달', array['맨손으로 북경오리를 때려잡고']::text[], '박휘순의 장황한 자기소개 유행어를 낳은 개그콘서트 코너', '개그콘서트 ''제3세계'' 코너에서 박휘순이 연기한 캐릭터 ''육봉달''의 극도로 길고 과장된 자기소개 대사 ''맨손으로 북경오리를 때려잡고 떡볶이를 철근같이 씹어먹으며 달리는 마을버스 2-1번에서 뛰어내린 육봉달''이 화제가 됐다.',
    'KBS 개그콘서트, 박휘순', '장황한 허세 자기소개 패러디에 활용 가능', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A0%9C3%EC%84%B8%EA%B3%84(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1박2일 복불복', '1박2일-복불복', array['복불복']::text[], '1박2일에서 시작해 전 국민 유행어가 된 운·불운 게임 방식', '2007년 시작한 KBS 예능 ''1박2일''에서 숙소·식사·이동수단 등을 걸고 벌인 게임 방식 ''복불복''이 2008년 무렵 전 국민적 유행어가 됐다. ''1박!2일!!'' 같은 관련 표현도 함께 퍼졌다.',
    'KBS 1박2일', '운에 따라 벌칙·보상 갈릴 때 일상적으로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/1%EB%B0%95%202%EC%9D%BC/2008%EB%85%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('은초딩', '은초딩', array['은지원 은초딩']::text[], '1박2일 출연 후 은지원에게 붙은 순박한 캐릭터 별명', '가수 은지원이 2007~2008년 1박2일에 출연하며 예상 밖의 순진하고 엉뚱한 모습을 보여 ''은초딩''이라는 별명을 얻었다. 기존의 터프한 이미지와 상반된 반전 캐릭터로 화제가 됐다.',
    'KBS 1박2일', '순박하고 어리숙한 사람을 애정 있게 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허당', '허당', array['이승기 허당']::text[], '1박2일 이승기에게 붙은 허술한 매력 별명', '이승기가 1박2일에서 노래 실력과 달리 게임·상식 등에서 허술한 모습을 자주 보여 ''허당''이라는 별명을 얻었고, 이후 그의 트레이드마크 이미지로 굳어졌다.',
    'KBS 1박2일', '능력자인데 허술한 면 있는 사람에게 애정으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나영석 PD "안됩니다"', '나영석-PD-"안됩니다"', array['안됩니다','실패']::text[], '1박2일 나영석 PD가 자막으로 개입하며 만든 유행어', '1박2일 연출 나영석 PD가 출연진의 무리한 요구에 ''안 됩니다'', ''실패'', ''땡!'' 등의 자막으로 단호하게 답하는 것이 하나의 유행어처럼 자리 잡았다.',
    'KBS 1박2일, 나영석 PD', '단호하게 거절할 때 유머로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('햇님/달님', '햇님/달님', array['정형돈 달님','유재석 햇님']::text[], '무한도전 정형돈의 사투리 발음에서 나온 자막 유행어', '정형돈이 경상도 사투리로 유재석을 ''형님'' 대신 ''행님''이라 부르는 게 ''햇님''처럼 들린다는 데서 착안해, 자막으로 유재석은 ''햇님'', 정형돈은 ''해를 봐야 빛나는 달님''이라는 별명이 붙었다.',
    'MBC 무한도전 자막', '다정한 콤비 별명 드립에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A0%95%ED%98%95%EB%8F%88/%EB%B3%84%EB%AA%85', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('냉면(명카드라이브)', '냉면(명카드라이브)', array['냉면','명카드라이브']::text[], '무한도전 가요제에서 나온 박명수 듀엣곡, 그 해 인기곡 1위', '2009년 무한도전 ''올림픽대로 듀엣가요제''에서 박명수가 결성한 유닛 ''명카드라이브''가 부른 ''냉면''은 싸이월드 실시간 인기곡 1위, 엠넷닷컴 4위에 오르며 그 해 최고 인기곡 중 하나로 꼽혔다.',
    'MBC 무한도전 올림픽대로 듀엣가요제, 박명수', '예능 듀엣곡 패러디, 무해', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%83%89%EB%A9%B4(%EB%85%B8%EB%9E%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 강변북로가요제', '무한도전-강변북로가요제', array['무한도전 가요제','강변북로가요제']::text[], '무한도전 최초의 음악 특집, 이후 격년제 가요제의 시초', '2007년 방영된 무한도전 ''강변북로가요제''는 무한도전 최초의 가요제 특집으로, 이후 2015년까지 2년마다 열리는 무한도전 가요제 전통의 시작점이 됐다.',
    'MBC 무한도전', '음악 특집·합동 프로젝트 언급 시 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84%20%EA%B0%80%EC%9A%94%EC%A0%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대화가 필요해 "밥먹자"', '대화가-필요해-"밥먹자"', array['밥먹자','대화가 필요해']::text[], '가족 간 불통을 코믹하게 그린 개그콘서트 코너의 유행어', '2006년부터 2008년까지 방영된 개그콘서트 ''대화가 필요해''에서 아빠 역의 김대희가 무뚝뚝하게 반복한 말 ''밥먹자''가 대화 단절 가족을 상징하는 유행어가 됐다.',
    'KBS 개그콘서트, 김대희·신봉선·장동민', '무뚝뚝한 가족 소통 개그로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8C%80%ED%99%94%EA%B0%80%20%ED%95%84%EC%9A%94%ED%95%B4(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('옹달샘 "할매가 뿔났다"', '옹달샘-"할매가-뿔났다"', array['할매가 뿔났다','옹달샘']::text[], '유세윤·장동민·유상무 삼인조의 개그콘서트 코너', '2008~2009년 방영된 개그콘서트 코너로 장동민이 할머니, 유상무가 할아버지, 유세윤이 손자 역을 맡아 할머니가 화가 나서 할아버지를 때리는 상황극을 반복했다. 이 팀은 이후 ''옹달샘''이라는 유닛명으로 활동했다.',
    'KBS 개그콘서트, 유세윤·장동민·유상무', '부부·노년 다툼 개그 패러디', '폭력적 상황 묘사가 있어 맥락 따라 불편할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%95%A0%EB%A7%A4%EA%B0%80%20%EB%BF%94%EB%82%AC%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('황현희 PD의 소비자 고발', '황현희-PD의-소비자-고발', array['왜 그래 아마추어 같이','불결해']::text[], '말도 안 되는 트집으로 제품을 고발하는 풍자 코너 유행어', '2008~2009년 방영된 개그콘서트 코너로, 황현희가 PD로 등장해 억지스러운 이유로 제품을 고발하며 ''만지지 마! 더러워'', ''불결해!'', ''왜 그래? 아마추어 같이'' 등의 유행어를 남겼다.',
    'KBS 개그콘서트, 황현희', '억지 트집·과장된 지적질 개그에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%99%A9%ED%98%84%ED%9D%AC%20PD%EC%9D%98%20%EC%86%8C%EB%B9%84%EC%9E%90%20%EA%B3%A0%EB%B0%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마른인간연구 엑스파일', '마른인간연구-엑스파일', array['마른인간 연구']::text[], '유민상이 마른 사람들의 고충을 다룬 폭소클럽 코너', '2004년 말부터 2005년까지 방영된 폭소클럽 코너로 유민상이 마른 체형의 고충을 진지하게 연구하는 콘셉트를 선보였고, 매회 ''마른인간 연구, 이제는 국가와 사회가 나서야 할 문제입니다''라는 멘트로 마무리했다.',
    'KBS 폭소클럽, 유민상', '사소한 문제를 거창하게 마무리할 때 패러디', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A7%88%EB%A5%B8%EC%9D%B8%EA%B0%84%EC%97%B0%EA%B5%AC%20%EC%97%91%EC%8A%A4%ED%8C%8C%EC%9D%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('패밀리가 떴다 - 덤앤더머', '패밀리가-떴다---덤앤더머', array['덤앤더머','유재석 대성']::text[], '유재석과 대성의 티키타카 콤비에 붙은 별명', '2008년 시작한 SBS 예능 ''패밀리가 떴다''에서 유재석과 빅뱅 대성이 사소한 일에도 함께 즐거워하는 모습을 보여 시청자들이 ''덤앤더머''라는 별명을 붙였다.',
    'SBS 패밀리가 떴다', '죽이 잘 맞는 바보 콤비를 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8C%A8%EB%B0%80%EB%A6%AC%EA%B0%80%20%EB%96%B4%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('꽈당효리', '꽈당효리', array['이효리 꽈당효리']::text[], '예능에서 자주 넘어지는 이효리에게 붙은 별명', '이효리가 2008년 ''패밀리가 떴다'' 출연 중 자주 넘어지거나 부딪히는 모습을 보여 ''꽈당효리''라는 애칭이 붙었다.',
    'SBS 패밀리가 떴다', '허당끼 있는 사람 애정 있게 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8C%A8%EB%B0%80%EB%A6%AC%EA%B0%80%20%EB%96%B4%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박명수 "음~스멜"/"출바알"', '박명수-"음~스멜"/"출바알"', array['음스멜','출바알']::text[], '무한도전에서 박명수가 밀었던 2008년 유행어', '2008년 무한도전에서 박명수가 특유의 억양으로 내뱉은 ''음~ 스멜''과 ''출바알''이라는 표현이 화제가 되며 나름의 유행어로 자리 잡았다.',
    'MBC 무한도전, 박명수', '말장난 톤으로 인용 가능', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B0%95%EB%AA%85%EC%88%98/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사랑의 카운슬러', '사랑의-카운슬러', array['안녕하세요 사랑의 카운슬러 유세윤이에요','짓궂군요']::text[], '유세윤·강유미의 상담 형식 개그콘서트 코너', '2006년부터 2007년까지 방영된 개그콘서트 코너로, 유세윤이 ''안녕하세요? 사랑의 카운슬러, 유세윤이에요''라고 매회 인사하며 강유미의 연애 상담을 진행했다. ''짓궂군요!''라는 대사도 유행했다.',
    'KBS 개그콘서트, 유세윤·강유미', '정중한 듯 짓궂은 드립에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%AC%EB%9E%91%EC%9D%98%20%EC%B9%B4%EC%9A%B4%EC%8A%AC%EB%9F%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('빵꾸똥꾸', '빵꾸똥꾸', array['정해리 빵꾸똥꾸','지붕뚫고 하이킥']::text[], '시트콤 지붕뚫고 하이킥 아역의 필살기 욕설 대사', '2009년 방영된 MBC 시트콤 ''지붕뚫고 하이킥''에서 이순재의 손녀 정해리(진지희 분)가 마음에 안 드는 사람에게 내뱉는 ''빵꾸똥꾸!''라는 대사가 어린이부터 어른까지 따라 하는 전국구 유행어가 됐다. 방송통신심의위원회 권고 조치까지 받을 만큼 화제였다.',
    'MBC 지붕뚫고 하이킥, 진지희', '귀엽고 앙칼진 불만 표현으로 사용', '비속어 조합이라 격식 있는 자리에선 부적절',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B9%B5%EA%BE%B8%EB%98%A5%EA%BE%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내가 고자라니 (심영물)', '내가-고자라니-(심영물)', array['심영물','고자라니']::text[], '드라마 야인시대 짤에서 시작된 대표 합성물 밈', '2003년 방영된 SBS 드라마 야인시대에서 심영이 총상으로 고자가 됐음을 알고 절규하며 외친 대사 ''내가 고자라니!''가 2006년 무렵 판도라TV·디시인사이드 등에서 영상 클립·매드무비로 퍼지며 한국 인터넷 합성물 문화의 대표 밈이 됐다.',
    'SBS 야인시대(드라마), 디시인사이드 합성 갤러리 재가공', '합성물 문화 자체를 논할 때 인용 가능', '선정적 소재(거세) 기반이라 가벼운 자리에서 남발 주의',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%82%B4%EA%B0%80%20%EA%B3%A0%EC%9E%90%EB%9D%BC%EB%8B%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('텔미 신드롬', '텔미-신드롬', array['Tell Me 댄스','텔미 UCC','살랑살랑 춤']::text[], '원더걸스 Tell Me 안무를 따라추는 2007년 전국민 댄스 유행', '2007년 9월 발매된 원더걸스의 ''Tell Me''가 크게 히트하며 살랑살랑 춤, 감수분열 춤 등 안무를 일반인·연예인·군인까지 UCC로 따라 올리는 신드롬이 일어났다. 당시 UCC 열풍과 맞물려 그해 최고 인기 동영상 소재가 됐다.',
    'JYP엔터테인먼트 원더걸스의 정규 1집 타이틀곡 ''Tell Me'' 발매 후 방송·UCC로 확산', '2000년대 후반 커버댄스 챌린지 원조 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('노홍철 돌+아이', '노홍철-돌+아이', array['돌아이','무한도전 노홍철']::text[], '무한도전 노홍철의 기행을 가리키는 별명이자 유행어', 'MBC 무한도전 초기(2006년) 노홍철이 상식을 뛰어넘는 언행과 사기꾼 컨셉 캐릭터를 보이며 ''돌+아이''라는 별명이 붙었고, 이는 이후 예능 자막과 유행어로 정착됐다.',
    '무한도전 방송 중 노홍철의 캐릭터를 시청자들이 ''돌+아이''로 부르며 확산', '친한 사이 장난스러운 별명으로 사용 가능', '실제 장애 비하 표현으로 오인될 수 있어 공식 자리에서는 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아브라카다브라 시건방춤', '아브라카다브라-시건방춤', array['가인 시건방춤','브아걸 아브라카다브라']::text[], '무표정으로 허리만 흔드는 브아걸 대표 안무 유행', '2009년 여름 브라운아이드걸스의 ''Abracadabra''가 히트하며 멤버 가인이 선보인, 무표정으로 골반만 좌우로 흔드는 ''시건방춤''이 예능인들의 최고 패러디 안무가 됐다.',
    '브라운아이드걸스 3집 타이틀곡 안무 중 가인의 파트에서 유래', '시크한 표정으로 장난칠 때 패러디용으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('손담비 미쳤어 의자춤', '손담비-미쳤어-의자춤', array['미쳤어 토끼춤','손담비 의자춤']::text[], '2008년 예능을 휩쓴 손담비 미쳤어의 의자춤 유행', '2008년 9월 발매된 손담비의 ''미쳤어'' 의자춤이 신드롬을 일으켜 허이재를 시작으로 수많은 연예인이 예능에서 따라했고, 방송국에서 자체적으로 ''미쳤어 자제령''을 내릴 정도로 유행했다.',
    '손담비 2집 미니앨범 타이틀곡 안무, 미국 게이클럽 춤에서 모티브를 얻음', '회식이나 장기자랑에서 패러디용으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박명수 어록 "늦었다고 생각할 때가 진짜 늦은 거다"', '박명수-어록-"늦었다고-생각할-때가-진짜-늦은-거다"', array['박명수 명언','늦었다고 생각할 때']::text[], '통상 격언을 뒤집은 박명수식 반전 어록', '2009년 무한도전에서 간염으로 입원한 박명수가 병문안 온 멤버들에게 통상적 격언 ''늦었다고 생각할 때가 가장 빠른 때''를 뒤집어 ''늦었다고 생각할 때 진짜 늦은 거다, 그러니 지금 당장 시작해라''라고 말해 화제가 됐다.',
    'MBC 무한도전 방송분에서 박명수의 발언', '미루는 사람을 웃으며 재촉할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('슈퍼주니어 쏘리쏘리 칼군무', '슈퍼주니어-쏘리쏘리-칼군무', array['쏘리쏘리 춤','슈주 칼군무']::text[], '다수 멤버가 각 맞춰 추는 슈퍼주니어 대표 칼군무', '2009년 발매된 슈퍼주니어 3집 ''Sorry, Sorry''가 후크송 열풍 속 메가히트하며 멤버 전원이 각을 맞춰 추는 ''칼군무''가 K팝 남자 아이돌 군무의 대명사가 됐다.',
    '슈퍼주니어 정규 3집 타이틀곡 안무', '아이돌 군무 이야기할 때 대표 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당 동혁이형', '봉숭아학당-동혁이형', array['동혁이형','형이 누구라고']::text[], '개그콘서트 봉숭아학당 캐릭터 동혁이형의 샤우팅 유행어', '2005~2006년 개그콘서트 ''봉숭아학당'' 코너에서 등장한 캐릭터 ''동혁이형''이 ''형이 누구라고? 동혁이형이야!''라며 소리치는 대사가 유행어가 됐다.',
    '개그콘서트 봉숭아학당 코너의 캐릭터 대사', '허세 부리는 상황을 장난스럽게 흉내낼 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이효리 유고걸 댄스', '이효리-유고걸-댄스', array['U-Go-Girl 댄스','유고걸']::text[], '단순한 동작으로 누구나 따라춘 이효리 유고걸 안무', '2008년 발매된 이효리의 ''U-Go-Girl''이 크게 히트하며 단순하고 따라 하기 쉬운 포인트 안무 덕에 ''진짜 유행가''로 불릴 만큼 남녀노소가 따라췄다.',
    '이효리 3집 앨범 수록곡 안무', '쉬운 커버댄스 이야기할 때 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('브라운아이드걸스 하우컴 레트로댄스', '브라운아이드걸스-하우컴-레트로댄스', array['How Come 댄스']::text[], '레트로풍 브아걸 How Come 안무와 레깅스 유행', '2008년 발매된 브라운아이드걸스의 ''How Come''은 복고풍 댄스곡으로 그룹의 이미지를 R&B 보컬팀에서 댄스팀으로 바꾼 전환점이 됐고, 무대 의상의 레깅스 패션이 유행했다.',
    '브라운아이드걸스 미니앨범 ''My Style'' 타이틀곡 안무', '2008년 레트로 댄스 유행 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('웃찾사 "그만해"', '웃찾사-"그만해"', array['그만해 유행어','웃찾사 그만해']::text[], '닭살 커플을 놀리는 웃찾사 코너의 유행어', '2006년 12월부터 2007년 6월까지 SBS ''웃음을 찾는 사람들''에서 방영된 코너로, 놀러간 아이들이 닭살 커플의 애정행각을 보고 ''그만해~!''라고 외치는 게 유행어가 됐다.',
    'SBS 웃찾사 코너 대사', '오글거리는 애정행각을 보고 장난스럽게 말릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('웃찾사 빌리진 "이건 정말 아니잖아"', '웃찾사-빌리진-"이건-정말-아니잖아"', array['빌리진 유행어']::text[], '웃찾사 코너 빌리진의 황당 상황 지적 유행어', '2007년 10월부터 방영된 SBS 웃찾사 코너 ''빌리진''에서 나온 ''이건 정말 아니잖아''라는 대사가 황당한 상황을 지적하는 유행어로 쓰였다.',
    'SBS 웃찾사 코너 대사', '말도 안 되는 상황에 태클 걸 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 "무비 무비 무비"', '무한도전-"무비-무비-무비"', array['무비무비무비','move it 유재석']::text[], '이동할 때마다 유재석이 외치던 무한도전 유행어', '2007~2008년 무렵 무한도전에서 다음 미션 장소로 이동할 때 유재석이 영화 속 ''Move it, Move it, Move it!''을 변형해 ''무비 무비 무비''라고 외치는 것이 유행어가 됐다.',
    'MBC 무한도전 방송 중 유재석의 애드리브', '빨리 이동하자고 재촉할 때 장난스럽게 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('원더걸스 Irony 데뷔', '원더걸스-Irony-데뷔', array['아이러니','원더걸스 데뷔곡']::text[], '원더걸스가 2007년 초 데뷔곡 Irony로 첫 등장', '2007년 2월 발매된 원더걸스의 데뷔 싱글 ''Irony''는 이후 초대박 히트곡 ''Tell Me''가 나오기 전 그룹의 첫 방송 활동곡으로, 2000년대 후반 걸그룹 전성기의 시작을 알렸다.',
    'JYP엔터테인먼트가 기획한 원더걸스 데뷔 싱글', '원더걸스 초기 활동을 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭소클럽2 "택배유~ 택배왔슈~"', '폭소클럽2-"택배유~-택배왔슈~"', array['택배코너 유행어']::text[], '폭소클럽2 택배 코너에서 나온 사투리 유행어', '2006년 방영된 SBS ''폭소클럽2''의 택배 코너에서 배달원이 외치던 ''택배유~ 택배왔슈~''라는 충청도 사투리 대사가 유행어가 됐다.',
    'SBS 폭소클럽2 코너 대사', '택배 받을 때 장난스럽게 사투리 흉내', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭소클럽2 "아, 미안, CHEERS!"', '폭소클럽2-"아,-미안,-CHEERS!"', array['김준현 치어스']::text[], '폭소클럽2 Mr.귀족 코너 김준현의 장면 전환 유행어', '2006년 SBS ''폭소클럽2''의 ''Mr.귀족'' 코너에서 김준현이 다음 이야기로 넘어갈 때마다 외치던 ''아, 미안, CHEERS!''라는 대사가 유행어로 자리잡았다.',
    'SBS 폭소클럽2 코너 대사, 김준현', '화제를 급히 전환할 때 장난스럽게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('원더걸스 Nobody 쌍권총춤', '원더걸스-Nobody-쌍권총춤', array['노바디 춤','쌍권총 춤']::text[], '손동작으로 쌍권총을 쏘는 원더걸스 Nobody 안무', '2008년 발매된 원더걸스의 ''Nobody''는 모타운 사운드를 재해석한 복고풍 곡으로, 후렴구의 쌍권총 손동작 춤이 크게 유행하며 K팝의 해외 진출 발판이 됐다.',
    '원더걸스 ''Nobody'' 싱글 안무', '2008년 걸그룹 댄스 유행 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('동방신기 주문-MIROTIC 논란', '동방신기-주문-MIROTIC-논란', array['미로틱 논란','크리스탈 레드오션']::text[], '선정적 가사 해석 논란을 부른 동방신기 히트곡', '2008년 동방신기 4집 타이틀곡 ''주문-MIROTIC''이 가사 속 ''크리스탈'', ''레드오션'' 표현이 성적 은유라는 논란으로 청소년유해매체물 판정을 받아 화제가 됐지만, 곡 자체는 그해 최고 히트곡 중 하나로 남았다.',
    'SM엔터테인먼트 동방신기 정규 4집 타이틀곡', '2008년 가요계 논란 사례로 언급', '가사 해석 논란은 민감할 수 있어 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('카라 프리티걸 예예춤', '카라-프리티걸-예예춤', array['예예춤','카라 프리티걸']::text[], '카라 프리티걸에서 반복되는 손동작 예예춤 유행', '2008년 12월 발매된 카라의 ''프리티걸''은 데뷔 후 처음으로 차트 2위까지 오른 곡으로, 노래 중 반복되는 손동작 안무인 ''예예춤''이 인기를 끌며 그룹 성장의 발판이 됐다.',
    '카라 ''프리티걸'' 싱글 안무', '카라 초기 인기곡을 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('SS501 U R Man 암욜맨', 'SS501-U-R-Man-암욜맨', array['암욜맨','어깨춤 U R Man']::text[], '후렴구가 이상하게 들려 별명이 붙은 SS501 히트곡', '2008년 발매된 SS501의 ''U R Man''은 어깨를 흔드는 안무와 자켓을 벗었다 입는 동작이 유행했고, 후렴구가 ''암욜맨''으로 들린다는 이유로 별명이 붙어 화제가 됐다. 이후 수능 금지곡으로도 유명해졌다.',
    'SS501 싱글 ''U R Man'' 안무 및 후렴구 발음', '2008년 아이돌 팬덤 문화를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('2PM 짐승돌 신드롬', '2PM-짐승돌-신드롬', array['짐승돌','2PM 야수돌']::text[], '강렬한 퍼포먼스로 짐승돌 별명이 붙은 2PM 신드롬', '2008년 데뷔한 2PM이 곡예에 가까운 격렬한 퍼포먼스와 마초적 이미지로 활동하며 ''짐승돌(짐승 같은 아이돌)''이라는 신조어를 만들어냈고, 이는 이후 아이돌 콘셉트 분류 용어로 자리잡았다.',
    'JYP엔터테인먼트 2PM 데뷔 활동 중 형성된 이미지', '강렬한 퍼포먼스형 아이돌을 가리킬 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('호박고구마', '호박고구마', array['호-박-고-구-마','호박고구마 사건']::text[], '발음이 꼬여 한 글자씩 크게 외치는 장면이 명장면으로 남은 밈', '2006년 11월 14일 방영된 거침없이 하이킥 7화에서 나문희가 ''호박고구마''라는 단어를 제대로 발음하지 못하다가 한 글자씩 끊어 크게 외치는 장면에서 나왔다. 이순재가 ''이 할망구가 왜 이래, 밥상에서!''라고 반응하는 장면과 함께 하이킥 시리즈 명장면 투표에서 1위를 차지할 정도로 오래 회자되는 장면이다.',
    'MBC 시트콤 거침없이 하이킥 7화(2006.11.14), 나문희 역', '발음이 꼬이거나 어색한 상황을 웃기게 묘사할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%98%B8%EB%B0%95%EA%B3%A0%EA%B5%AC%EB%A7%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('꽈당민정', '꽈당민정', array['서민정','꽈당 민정']::text[], '자꾸 넘어지고 사고 치는 캐릭터라 팬들이 붙여준 별명', '거침없이 하이킥(2006~2007)에서 서민정이 연기한 캐릭터가 극 중에서 자주 넘어지고 크고 작은 해프닝을 겪는 모습을 보이자 팬들이 붙여준 별명이다. 초반에는 감초 캐릭터였다가 삼각관계 스토리 라인으로 변경되며 시청률이 급등했다.',
    'MBC 시트콤 거침없이 하이킥, 서민정 역', '덤벙대고 잘 넘어지는 사람을 애정 있게 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%84%9C%EB%AF%BC%EC%A0%95(%EA%B1%B0%EC%B9%A8%EC%97%86%EC%9D%B4%20%ED%95%98%EC%9D%B4%ED%82%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('김병만의 달인', '김병만의-달인', array['달인(개그콘서트)','안 해봤으면 말을 하지 마세요']::text[], '16년간 수련했다는 허풍으로 시작해 결국 들통나는 개그콘서트 최장수 코너', '2007년 12월 9일부터 2011년까지 4년간 방영된 개그콘서트 최장수 코너. 김병만이 음식 빨리 먹기, 웃음 참기 등 특정 분야의 ''달인''을 자처하며 그럴듯하게 말하다가 결정적 단서로 엉터리임이 들통나는 구성이다. ''~해 봤어요? 안 해 봤으면 말을 하지 마세요'' 등의 대사가 유행했다.',
    'KBS 개그콘서트(2007.12.09~), 김병만 역', '근거 없는 자신감이나 허풍을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8B%AC%EC%9D%B8(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대화가 필요해', '대화가-필요해', array['보일러 매','김대희 아버지']::text[], '보냉재를 만 매로 아들을 때리는 장면이 반복되며 유명해진 개그콘서트 가족 코너', '2006년 11월 19일부터 방영된 개그콘서트 코너로 김대희(아버지), 신봉선(어머니), 장동민(아들)이 출연했다. 김대희가 아들 역의 장동민을 때릴 때 쓰는 매는 보일러 보냉재를 돌돌 만 소품으로, 실제로는 아프지 않지만 코믹한 타격 소리와 리액션이 반복되며 밈처럼 회자됐다.',
    'KBS 개그콘서트(2006.11.19~2008.11.30)', '가족 간 실랑이를 과장되게 코믹하게 표현할 때', '체벌을 소재로 한 코미디라 맥락 없이 쓰면 불편할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8C%80%ED%99%94%EA%B0%80%20%ED%95%84%EC%9A%94%ED%95%B4(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왕비호', '왕비호', array['왕비호 캐릭터','누가 수업 끝이래']::text[], '손을 빙빙 돌리며 상대를 갈구는 봉숭아학당 캐릭터, 윤형빈을 스타로 만듦', '2008년 4월 6일부터 개그콘서트 봉숭아학당에 등장한 캐릭터로, 윤형빈이 연기했다. ''누가 수업 끝이래?'', 손을 빙빙 돌리다 뜸을 들이며 부르는 ''어이~ OOO...누구?'' 등의 유행어로 개그계 스타덤에 올랐다.',
    'KBS 개그콘서트 봉숭아학당(2008.04.06~2011.01.02), 윤형빈 역', '장난스럽게 상대를 놀리듯 부를 때', '실제 상하관계에서 갑질처럼 들릴 수 있어 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%99%95%EB%B9%84%ED%98%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('강변북로 가요제', '강변북로-가요제', array['무한도전 1회 가요제','강변가요제 패러디']::text[], '무한도전 멤버가 가수와 짝을 이뤄 자작곡을 부른 첫 가요제 특집', '2007년 무한도전이 옛 강변가요제를 패러디해 이름 붙인 첫 가요제 특집. 멤버들이 실제 가수들과 짝을 이뤄 자작곡을 만들고 야외무대에서 공연하는 포맷으로, 이후 격년으로 열리는 무한도전 가요제 시리즈의 시초가 됐다.',
    'MBC 무한도전(2007)', '예능인이 만든 자작곡 프로젝트를 얘기할 때 원조격으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84%20%EA%B0%80%EC%9A%94%EC%A0%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뚱뚱보 브라더스', '뚱뚱보-브라더스', array['뚱보 정준하','뚱뚱보브라더스']::text[], '체형을 소재로 한 무한도전 초기 정형돈·정준하 콤비 캐릭터', '2006년 정준하가 무한도전에 합류하며 정형돈이 밀던 ''뚱보'' 캐릭터를 이어받아 두 사람 모두 뚱뚱한 체격이라는 이유로 ''뚱뚱보 브라더스''로 불렸다. 이후 정준하는 ''알콜 CEO'' 등 자신만의 캐릭터로 발전시켰다.',
    'MBC 무한도전(2006), 정형돈·정준하', '예능 초기 캐릭터 잡기 역사를 설명할 때', '체형을 소재로 한 별명이라 지금 기준으로는 외모 비하로 읽힐 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A0%95%ED%98%95%EB%8F%88/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인생극장 Yes or No', '인생극장-Yes-or-No', array['인생극장 무한도전','Yes or No 특집']::text[], '이휘재의 TV인생극장을 패러디한 무한도전 인기 특집', '개그맨 이휘재의 전성기 대표작 ''TV인생극장''의 ''갈까 말까'' 포맷을 패러디한 무한도전 특집. 멤버들이 선택의 갈림길에서 두 가지 결말을 모두 보여주는 콩트로, 무한도전 역대 리얼 버라이어티 특집 중 손꼽히는 인기를 얻었다.',
    'MBC 무한도전(2009년경, 149~150회)', '두 가지 선택지의 결과를 코믹하게 비교할 때 원조로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84%20%EC%9D%B8%EC%83%9D%EA%B7%B9%EC%9E%A5%20Yes%20or%20No', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미녀들의 수다', '미녀들의-수다', array['미수다']::text[], '외국인 여성 패널들이 한국살이 경험을 이야기해 큰 화제를 모은 예능', '2006년 11월 26일부터 방영된 KBS 예능으로, 다양한 국적의 외국인 여성 출연자들이 한국 생활 경험과 문화 차이를 입담으로 풀어내며 큰 인기를 끌었다. 줄임말 ''미수다''로 불리며 당시 하나의 사회적 신드롬이 됐지만, 후반으로 갈수록 국가별 편견을 부추긴다는 비판도 받았다.',
    'KBS2 미녀들의 수다(2006.11.26~2010.05.03)', '2000년대 후반 예능 트렌드를 이야기할 때 언급', '국가·인종 고정관념을 소재로 삼아 논란이 있었던 프로그램',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AF%B8%EB%85%80%EB%93%A4%EC%9D%98%20%EC%88%98%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무릎팍도사', '무릎팍도사', array['강호동 도사','무릎팍']::text[], '강호동이 무속인으로 분해 게스트 고민을 상담해주는 토크쇼 코너', '2007년 1월 31일 정식 코너로 자리잡은 황금어장의 토크쇼 코너. 강호동이 무속인 캐릭터 ''무릎팍도사''로 분해 게스트의 인생 상담을 해주는 형식으로, 거침없는 질문 스타일이 화제를 모으며 2000년대 후반 예능의 ''거친 방송'' 트렌드를 이끌었다는 평가를 받는다.',
    'MBC 황금어장 ''무릎팍도사''(2007.01.31~), 강호동', '진솔한 인생 상담을 예능식으로 풀어낼 때 원조로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AC%B4%EB%A6%8E%ED%8C%8D%EB%8F%84%EC%82%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('패밀리가 떴다 국민남매', '패밀리가-떴다-국민남매', array['유재석 이효리 남매','국민남매 라인']::text[], '유재석과 이효리의 케미가 화제를 모은 야외 버라이어티 커플 라인', '2008년 6월 15일 시작한 SBS 패밀리가 떴다에서 유재석과 이효리가 보여준 남매 같은 케미가 ''국민남매''로 불리며 큰 인기를 끌었다. 이 외에도 프로그램 내 여러 커플·라인 조합이 화제가 되며 2008~2009년 SBS 연예대상 공동 수상으로 이어졌다.',
    'SBS 패밀리가 떴다(2008.06.15~2010.07.11)', '친남매처럼 편한 관계를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%8C%A8%EB%B0%80%EB%A6%AC%EA%B0%80%20%EB%96%B4%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('X맨을 찾아라', 'X맨을-찾아라', array['X맨','브레인 서바이버']::text[], '몰래 숨은 훼방꾼을 찾아내는 게임에서 나온 ''내부의 방해자'' 지칭 표현', '2003년부터 2007년까지 SBS에서 방영된 예능 코너로, 출연진 중 일부러 게임을 방해하는 미션을 받은 ''X맨''을 나머지 출연진과 시청자가 찾아내는 형식이었다. 2000년대 중반 최고 인기를 누리며 ''조직 안의 방해자''를 가리키는 ''X맨''이라는 표현을 일상 언어로 남겼다.',
    'SBS 야심만만/일요일이 좋다 코너 ''X맨을 찾아라''(2003~2007)', '조직이나 팀 안에서 은근히 방해하는 사람을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/X%EB%A7%A8(%EC%98%88%EB%8A%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('세대공감 Old&New', '세대공감-Old&New', array['올드앤뉴','상상플러스 세대공감']::text[], '인터넷 신조어를 부모 세대가 맞히는 게임으로 세대차를 코미디화한 코너', '2005년 5월 10일부터 방영된 KBS 상상플러스의 인기 코너로, 청소년이 쓰는 신조어나 줄임말을 부모 세대 패널이 맞히지 못해 웃음을 유발하는 형식이다. 세대 간 언어 차이를 예능 소재로 대중화시킨 대표적 코너로 꼽힌다.',
    'KBS 상상플러스 ''세대공감 OLD & NEW''(2005.05.10~2007.09.18)', '세대 간 언어 차이를 재미있게 설명할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%84%B8%EB%8C%80%EA%B3%B5%EA%B0%90%20OLD%20&%20NEW', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('애정남(애매한 것을 정해주는 남자)', '애정남(애매한-것을-정해주는-남자)', array['애매합니다잉','애정남']::text[], '애매한 기준을 코믹하게 정해주던 개그콘서트 코너 유행어', '2011년 개그콘서트 코너 ''애정남''에서 최효종이 일상의 애매한 기준들을 능청스럽게 정해주며 ''애매~ 합니다잉~'', ''~되는거 어~렵지 않아요!''라는 대사로 큰 인기를 끌었다. 2012년 5월 종영 전까지 시사적 소재까지 다루며 사랑받았다.',
    '2011년 KBS 개그콘서트 코너, 개그맨 최효종 대사에서 시작', '애매한 기준을 놓고 장난스럽게 정리할 때 인용하기 좋음', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%A0%EC%A0%95%EB%82%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('귀요미송', '귀요미송', array['1더하기1은 귀요미','귀요미 플레이어']::text[], '손동작으로 숫자를 귀엽게 표현하는 2013년 히트곡·챌린지', 'BTOB 정일훈이 예능에서 선보인 ''귀요미 플레이어'' 손동작이 SNS로 확산되며 화제가 됐고, 이를 바탕으로 하리가 부른 ''1더하기1은 귀요미''가 2013년 2월 ''귀요미송''으로 재발매돼 각종 커버 영상이 쏟아졌다.',
    '2013년 정일훈의 방송 손동작 유행에서 시작, 하리의 곡으로 확산', '귀여운 척하는 상황을 유쾌하게 패러디할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://ko.wikipedia.org/wiki/%EA%B7%80%EC%9A%94%EB%AF%B8%EC%86%A1', 'embeddable'::copyright_status from ins where true;

commit;
