-- 밈캐치 시드 배치 5 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안녕들 하십니까', '안녕들-하십니까', array['안녕들하십니까 대자보']::text[], '2013년 대학가에서 시작된 사회 성찰형 대자보 유행어', '2013년 12월 10일 고려대생 주현우가 철도 민영화 반대 파업 등을 언급하며 붙인 대자보 제목에서 유래했다. 이후 전국 수십개 대학과 해외 대학까지 유사한 대자보가 이어지며 그해의 키워드로 꼽혔다.',
    '2013년 12월 고려대학교 후문 대자보, 학생 주현우', '시사적 무기력함을 짚을 때 인용되나 정치적 맥락이 강함', '정치적 사안과 얽혀 있어 맥락 없이 쓰면 논쟁적으로 읽힐 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://ko.wikipedia.org/wiki/%EC%95%88%EB%85%95%EB%93%A4_%ED%95%98%EC%8B%AD%EB%8B%88%EA%B9%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('강남스타일', '강남스타일', array['말춤','오빤 강남스타일']::text[], '싸이의 말춤과 함께 세계적으로 퍼진 2012년 최대 히트 챌린지', '2012년 7월 발매된 싸이의 ''강남스타일''은 안무가 이주선이 만든 ''말춤''과 함께 유튜브를 통해 세계적으로 확산됐다. 엘렌쇼 출연 등으로 미국 방송까지 진출하며 한국 대중가요 최초로 30개국 이상 차트 1위를 기록했다.',
    '2012년 7월 싸이 정규 6집 타이틀곡, 안무가 이주선의 말춤', '흥겨운 분위기나 챌린지 인용에 두루 안전하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EA%B0%95%EB%82%A8%EC%8A%A4%ED%83%80%EC%9D%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('됐어! 나 빈정 상했어!(감수성)', '됐어!-나-빈정-상했어!(감수성)', array['감수성 오랑캐','빈정상했어']::text[], '사소한 말에도 삐지는 캐릭터를 그린 개그콘서트 코너 유행어', '2011년 개그콘서트 코너 ''감수성''에서 김지호가 연기한 오랑캐 캐릭터가 조금만 서운해도 ''됐어! 나 빈정 상했어! 집에 갈거야!''라며 토라지는 패턴으로 인기를 끌었다. 전쟁 배경의 코미디임에도 현대적 감성 캐릭터로 웃음을 줬다.',
    '2011년 KBS 개그콘서트 코너 ''감수성'', 개그맨 김지호 대사', '과하게 삐지는 사람을 놀릴 때 애정어린 표현으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%90%EC%88%98%EC%84%B1(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('~앙까(백청강 사투리)', '~앙까(백청강-사투리)', array['백청강 앙까','위탄 앙까']::text[], '연변 사투리 말투가 그대로 유행어가 된 오디션 스타 백청강의 밈', '2011년 MBC 오디션 프로그램 ''위대한 탄생''에서 우승한 옌볜 출신 백청강이 ''아십니까''를 ''앙까''로 발음하는 특유의 말투를 쓰면서 화제가 됐고, 이 사투리 어미가 그 자체로 유행어처럼 회자됐다.',
    '2011년 MBC 스타오디션 위대한 탄생, 우승자 백청강의 연변 사투리', '당시 팬덤 사이에서 애정 어린 흉내로 쓰였음', '출신 지역 사투리를 흉내내는 방식이라 놀림조로 쓰이면 실례가 될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EB%B0%B1%EC%B2%AD%EA%B0%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('직렬5기통 춤(크레용팝)', '직렬5기통-춤(크레용팝)', array['빠빠빠 춤','크레용팝 헬멧춤']::text[], '자동차 엔진 피스톤 운동을 닮았다는 크레용팝의 점프 안무', '크레용팝의 ''빠빠빠'' 안무 중 엇갈려 점프하는 동작이 자동차 5기통 엔진의 피스톤 운동과 비슷하다고 팬들이 이름 붙였다. 2013년 7월 유희열의 스케치북 출연을 계기로 역주행 인기를 얻었고, 국내외 커버댄스·패러디 UCC가 쏟아졌다.',
    '2013년 크레용팝 ''빠빠빠'' 안무, 팬들이 붙인 별명에서 유래', '복고풍 챌린지나 패러디 영상에 인용하기 좋음', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%ED%81%AC%EB%A0%88%EC%9A%A9%ED%8C%9D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('산와머니 광고송', '산와머니-광고송', array['산와산와산와머니','걱정마세요 광고']::text[], '콩·팥 캐릭터가 부르는 대부업체 산와머니의 중독성 CM송', '''뚜루뚜 산와 산와 산와머니 산와 산와 믿으니까 우~ 걱정 마세요~''라는 아카펠라 CM송이 2010년대 초 케이블·지상파에서 반복 노출되며 국민 대부분이 기억하는 광고 밈이 됐다. 초등학생 절반 이상이 대출광고 하면 이 노래를 떠올릴 정도로 각인 효과가 컸다.',
    '일본 대부업체 CM송을 한국어로 번안, 국내 TV광고로 반복 방영', '광고 중독성을 풍자하는 맥락에서 언급되는 경우가 많음', '대부업 광고 과다 노출·청소년 노출 문제로 비판받은 대상이라 홍보처럼 들리지 않게 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%B0%EC%99%80%EB%A8%B8%EB%8B%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여의도 텔레토비(SNL코리아)', '여의도-텔레토비(SNL코리아)', array['여의도텔레토비','또(김슬기)']::text[], '정치 풍자를 반장선거에 빗댄 SNL코리아 코너', '2012년 SNL코리아가 제18대 대통령 선거를 학교 반장 선거에 빗대 풍자한 코너로, 김슬기가 연기한 욕쟁이 캐릭터 ''또''가 큰 화제를 모으며 시즌 초반 인기를 이끌었다.',
    '2012년 tvN SNL코리아 코너, 제18대 대선 풍자', '정치 풍자 코미디임을 알고 인용해야 함', '특정 정치 상황을 풍자한 코너라 시사적 맥락 이해 없이 쓰면 오해될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/SNL%20%EC%BD%94%EB%A6%AC%EC%95%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('바꿔줘(정여사)', '바꿔줘(정여사)', array['정여사 바꿔줘']::text[], '막무가내로 물건을 바꿔달라던 개그콘서트 코너 유행어', '2010년 개그콘서트 코너 ''정여사''에서 정태호가 여장으로 등장해 억지스러운 요구를 하며 ''바꿔줘''를 반복하는 패턴으로 인기를 끌었다. 정태호는 이 코너로 신인상을 받았다.',
    '2010년 KBS 개그콘서트 코너 ''정여사'', 개그맨 정태호 대사', '막무가내로 우기는 상황을 코믹하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8/%EC%9C%A0%ED%96%89%EC%96%B4%20%EC%9D%BC%EB%9E%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('기린(이광수 별명)', '기린(이광수-별명)', array['런닝맨 기린','이광수 기린']::text[], '큰 키 때문에 붙은 런닝맨 초창기 이광수의 별명', '2010년 런닝맨 초기, 190cm가 넘는 큰 키의 이광수가 ''기린''이라는 별명을 얻었다. 김종국이 ''사자'', 이광수가 ''기린''으로 불리며 쫓고 쫓기는 구도가 런닝맨 초반 인기 요소가 됐다.',
    '2010년 SBS 런닝맨 초창기, 이광수의 큰 키에서 유래', '키 큰 사람을 친근하게 놀릴 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%B4%EA%B4%91%EC%88%98/%EB%9F%B0%EB%8B%9D%EB%A7%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여러분(임재범, 나는가수다)', '여러분(임재범,-나는가수다)', array['나는가수다 임재범 기립박수']::text[], '나는가수다 최초로 기립박수를 받은 임재범의 전설적 무대', '2011년 5월 MBC ''나는 가수다''에 출연한 임재범이 윤복희의 ''여러분''을 불러 청중평가단으로부터 프로그램 최초 기립박수를 받았다. 득표율 28.9%로 압도적 1위를 차지하며 ''여러분 신드롬''을 낳았다.',
    '2011년 5월 MBC 나는 가수다 3라운드, 가수 임재범의 무대', '감동적인 무대나 압도적인 실력을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9E%84%EC%9E%AC%EB%B2%94', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('네가지', '네가지', array['그래 나 인기없는 남자야']::text[], '콤플렉스를 당당히 인정하는 스탠드업 코미디 코너', '2012년 개그콘서트 코너 ''네가지''는 소품 없이 스탠드업 형식으로, 인기없는 남자·촌티나는 남자·뚱뚱한 남자 등이 ''그래, 나 뚱뚱하다'', ''그래도 나 무시하지 마라'' 식으로 콤플렉스를 인정하며 웃음을 줬다. 김준현을 개콘의 에이스로 만든 코너다.',
    '2012년 KBS 개그콘서트 코너, 김준현 등 출연진 대사', '자신의 단점을 당당히 인정하며 웃음으로 넘길 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%84%A4%EA%B0%80%EC%A7%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는가수다 재도전 논란', '나는가수다-재도전-논란', array['김건모 재도전 사건']::text[], '탈락자에게 재도전 기회를 준 것을 둘러싼 2011년 방송 논란', '2011년 3월 ''나는 가수다''에서 첫 탈락자가 된 김건모에게 이소라·김제동 등의 요청으로 이례적인 재도전 기회가 주어지며 공정성 논란이 일었다. 시청자 항의가 쇄도했고 담당 PD가 교체되는 등 큰 파장을 낳았다.',
    '2011년 3월 MBC 나는 가수다 방송 중 발생한 제작진 결정', '공정성 논쟁이나 특혜 시비를 이야기할 때 비유로 쓰임', '특정 가수·PD를 둘러싼 실제 논란이므로 존중하는 태도로 인용할 것',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%98%EB%8A%94%20%EA%B0%80%EC%88%98%EB%8B%A4/%EB%85%BC%EB%9E%80%20%EB%B0%8F%20%EB%B9%84%ED%8C%90/%EC%9E%AC%EB%8F%84%EC%A0%84%20%EB%85%BC%EB%9E%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('샤이보이(시크릿)', '샤이보이(시크릿)', array['시크릿 샤이보이']::text[], '복고풍 스윙 리듬으로 2011년 초 음원차트를 휩쓴 시크릿의 히트곡', '2011년 1월 발매된 시크릿의 ''샤이보이''는 1950~60년대 미국풍 레트로 스윙 리듬과 뮤지컬풍 무대 연출로 발매 직후 각종 음원차트 1위에 올랐다. 복고풍 의상과 안무가 큰 화제를 모았다.',
    '2011년 1월 시크릿 싱글, 로엔엔터테인먼트 발매', '복고 콘셉트 챌린지·패러디에 인용하기 좋음', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EC%83%A4%EC%9D%B4%EB%B3%B4%EC%9D%B4_(%EC%8B%9C%ED%81%AC%EB%A6%BF%EC%9D%98_%EB%85%B8%EB%9E%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Roly-Poly(티아라)', 'Roly-Poly(티아라)', array['롤리폴리','티아라 롤리폴리']::text[], '복고 열풍을 탄 티아라 2011년 최대 히트곡이자 안무 챌린지', '2011년 6월 발매된 티아라의 ''Roly-Poly''는 영화 ''써니''발 복고 열풍에 편승해 그해 멜론·가온 연간차트 1위를 기록했다. 40여개국 팬들이 커버댄스를 올렸고, 2012년 총선 때는 선거운동원들이 이 곡에 맞춰 춤추는 장면이 화제가 됐다.',
    '2011년 6월 티아라 미니앨범 타이틀곡, 안무가 배윤정 참여', '복고풍 커버댄스·챌린지 소재로 안전하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://ko.wikipedia.org/wiki/Roly-Poly_(%ED%8B%B0%EC%95%84%EB%9D%BC%EC%9D%98_%EB%85%B8%EB%9E%98)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짜파구리 신드롬(윤후)', '짜파구리-신드롬(윤후)', array['아빠어디가 짜파구리','윤후 짜파구리']::text[], '아역스타 윤후가 방송에서 맛있게 먹어 매출을 급증시킨 라면 조합', '2013년 예능 ''아빠! 어디가?''에서 윤후가 짜파게티와 너구리를 섞은 ''짜파구리''를 맛있게 먹는 장면이 방영되며 관련 라면 매출이 2억 5천만원 이상 뛰었고, 이후 광고 계약으로까지 이어졌다.',
    '2013년 MBC ''아빠! 어디가?'' 방영분, 출연자 윤후', '어린이 출연자의 순수한 반응이 대박난 사례로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9C%A4%ED%9B%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('족장(김병만, 정글의 법칙)', '족장(김병만,-정글의-법칙)', array['김병만족','정글의 법칙 족장']::text[], '오지 정글 생활 예능에서 팀을 이끄는 김병만의 별명', '2011년 10월 시작한 SBS ''김병만의 정글의 법칙''에서 아프리카 등 오지를 누비는 팀을 ''김병만족''이라 부르고, 리더 김병만을 ''족장''이라 칭하며 큰 인기를 끌었다.',
    '2011년 SBS 김병만의 정글의 법칙 방영과 함께 정착된 호칭', '무리를 이끄는 리더를 유쾌하게 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B9%80%EB%B3%91%EB%A7%8C%EC%9D%98%20%EC%A0%95%EA%B8%80%EC%9D%98%20%EB%B2%95%EC%B9%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여기서 이러시면 안됩니다(생활의 발견)', '여기서-이러시면-안됩니다(생활의-발견)', array['생활의 발견 김기리']::text[], '연인 다툼에 끼어들며 정색하던 개그콘서트 코너 대사', '개그콘서트 코너 ''생활의 발견''에서 커플의 다툼에 끼어든 김기리가 ''여기서 이러시면 안됩니다''라고 정색하며 상황을 정리하는 패턴으로 인기를 끌었다.',
    '2010~2011년 KBS 개그콘서트 코너 ''생활의 발견'', 개그맨 김기리 대사', '과열된 다툼을 진정시키는 정색 멘트로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%83%9D%ED%99%9C%EC%9D%98%20%EB%B0%9C%EA%B2%AC(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엉덩이춤(카라 미스터)', '엉덩이춤(카라-미스터)', array['카라 미스터','미스터 엉덩이춤']::text[], '허리를 돌리는 파격 안무로 한일 양국을 휩쓴 카라의 히트 안무', '카라의 ''미스터''는 안무가 배윤정이 만든 허리 돌리기 동작이 네티즌 사이에서 ''엉덩이춤''으로 불리며 화제가 됐다. 2010년 일본에서 하루 1억건이 넘는 노래방 재생·안무 수행량으로 계산될 만큼 사회현상이 됐다.',
    '2009년 발매곡, 2010년 한일 양국에서 안무가 사회현상급으로 확산', '2010년대 초 K팝 안무 트렌드를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AF%B8%EC%8A%A4%ED%84%B0(%EC%B9%B4%EB%9D%BC)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('훗(소녀시대)', '훗(소녀시대)', array['소녀시대 훗','활쏘기 댄스']::text[], '활 쏘는 동작을 안무 포인트로 삼은 소녀시대의 2010년 히트곡', '2010년 10월 발매된 소녀시대의 ''훗''은 노랫말에 맞춰 활을 쏘는 동작을 안무 포인트로 삼아 화제를 모았고, 음악방송 5주 연속 1위를 기록하며 그해 대표 걸그룹 곡 중 하나가 됐다.',
    '2010년 10월 소녀시대 3집 미니앨범 타이틀곡', '2010년 걸그룹 안무 트렌드 이야기에 인용하기 좋음', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%9B%97', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안돼(비상대책위원회)', '안돼(비상대책위원회)', array['김원효 안돼','고래(김준현)']::text[], '단호한 거절과 뜬금없는 고래 드립으로 인기를 끈 개그콘서트 코너', '2011~2012년 개그콘서트 코너 ''비상대책위원회''에서 김원효의 단호한 ''안돼''와 김준현이 말한 ''고래''가 큰 인기를 끌었다. 2012년 상반기 온라인 설문에서 ''고래''가 최고 유행어 1위(47% 지지)로 뽑히기도 했다.',
    '2011년 KBS 개그콘서트 코너 ''비상대책위원회'', 김원효·김준현 대사', '단호한 거절 의사를 코믹하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B9%84%EC%83%81%EB%8C%80%EC%B1%85%EC%9C%84%EC%9B%90%ED%9A%8C(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('버블팝 힙댄스 논란(현아·포미닛)', '버블팝-힙댄스-논란(현아·포미닛)', array['포미닛 버블팝','현아 힙댄스']::text[], '선정성 논란으로 방송금지곡이 된 2011년 포미닛의 히트곡 안무', '2011년 7월 발매된 포미닛의 ''버블팝''은 현아의 골반을 강조한 힙 안무가 선정성 논란에 휘말려 일부 방송사에서 방송 제재를 받았다. 논란과 별개로 곡과 안무는 큰 화제를 모으며 그해를 대표하는 걸그룹 이슈 중 하나가 됐다.',
    '2011년 7월 포미닛 미니앨범 타이틀곡, 현아 센터 안무', '안무 관련 방송심의 논란 사례로 인용될 때가 많음', '선정성 논란이 있었던 안무라 맥락 없이 따라하면 오해 소지가 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%98%84%EC%95%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그까이꺼 대충 해(달인)', '그까이꺼-대충-해(달인)', array['김병만 달인','그까이꺼']::text[], '매회 새로운 기술의 달인을 코믹하게 선보인 개그콘서트 최장수 코너', '2007년 12월부터 2011년 11월까지 4년간 방영된 개그콘서트 최장수 코너 ''달인''에서 김병만이 매회 온갖 기술의 달인으로 등장해 허세와 실수를 오가며 웃음을 줬다. 대충 하는 척 허세를 부리는 말투가 유행어로 자리잡았다.',
    '2007~2011년 KBS 개그콘서트 코너 ''달인'', 개그맨 김병만', '별거 아닌 척 허세부리는 상황을 코믹하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8B%AC%EC%9D%B8(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('강호동 1박2일 하차 논란', '강호동-1박2일-하차-논란', array['1박2일 시즌1 종영']::text[], '국민 예능 1박2일 시즌1 종영을 부른 2011년 강호동 하차 사태', '2011년 강호동의 하차설이 불거지며 파장이 커지자 KBS는 강호동을 포함한 멤버 전원이 동반 하차하는 형식으로 ''1박2일'' 시즌1을 6개월 뒤 종영하기로 결정했다. 강호동은 그해 9월 25일 방송을 끝으로 하차했다.',
    '2011년 강호동 세무조사 이슈로 촉발된 하차설과 방송 종영 결정', '장수 예능의 세대교체나 갑작스런 하차를 이야기할 때 비유로 인용', '실존 인물의 실제 논란·세무 이슈와 얽혀 있어 가십처럼 다루지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/1%EB%B0%95%202%EC%9D%BC/%EB%85%BC%EB%9E%80%20%EB%B0%8F%20%EC%82%AC%EA%B1%B4%20%EC%82%AC%EA%B3%A0/%EC%8B%9C%EC%A6%8C%201', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('감사합니다(개그콘서트)', '감사합니다(개그콘서트)', array['어텐션','브라우니 물어']::text[], '과장된 예의로 웃음을 준 개그콘서트 코너 유행어', '정태호·송병철·이상훈이 출연한 개그콘서트 코너 ''감사합니다''에서 반복되는 ''감사합니다~ 감사합니다~''와 ''어텐션!'', ''브라우니 물어!'' 같은 대사가 큰 인기를 끌었고, 2011년 최고 시청률 25%를 넘기기도 했다.',
    '2010~2011년 KBS 개그콘서트 코너 ''감사합니다''', '과장된 감사·격식을 유쾌하게 패러디할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%90%EC%82%AC%ED%95%A9%EB%8B%88%EB%8B%A4(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('응답하라1997', '응답하라1997', array['응답하라 시리즈','오빠 부대 나정']::text[], '복고 감성 붐을 일으킨 tvN 드라마이자 ''응답하라'' 포맷의 시초', '2012년 방영된 tvN ''응답하라1997''은 1990년대 팬덤 문화와 복고 정서를 다뤄 케이블 드라마로는 이례적인 흥행을 거뒀다. 이후 ''응답하라'' 접두어가 특정 시대에 대한 그리움을 표현하는 관용구처럼 널리 쓰이는 계기가 됐다.',
    '2012년 tvN 드라마 ''응답하라1997'' 방영 및 흥행', '특정 시대에 대한 추억을 소환할 때 ''응답하라 OOO'' 형식으로 응용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%91%EB%8B%B5%ED%95%98%EB%9D%BC%201997', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('응 아니야', '응-아니야', array['응 니애미','응 느금마','응 안사']::text[], '부정할 때 쓰는 짧고 시니컬한 인터넷 방송 유행어', '상대의 말이나 광고 등을 짧고 단호하게 부정할 때 쓰는 표현으로 ''응 니애미'', ''응 느금마'' 등 다양한 변형이 파생됐다. 다음팟 롤 관전방에서 유래했다는 설과 아프리카TV 축구게임 방송 중 나온 말이 유행했다는 설이 함께 전해진다.',
    '기원 불명확(롤 관전방 채팅 유래설과 아프리카TV BJ 방송 유래설이 공존)', '가벼운 부정·드립용으로만, 실제 반박 상황엔 부적절', '비속어 변형(느금마 등)은 상대를 비하하는 표현이라 주의',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9D%91%20%EC%95%84%EB%8B%88%EC%95%BC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('자낳괴', '자낳괴', array['자본주의가 낳은 괴물','별풍선이 낳은 괴물']::text[], '별풍선을 위해 상식 밖 행동을 하는 BJ·시청자를 이르던 말', '''자본주의가 낳은 괴물''의 줄임말로, 아프리카TV 리니지 방송인 꽃거지(꽃태자)의 방송에서 별풍선을 받으려 해괴한 짓을 하는 모습을 보고 시청자들이 ''택진이가 낳은 괴물'', ''리니지가 낳은 괴물''이라 드립친 것에서 시작됐다. 이후 철구 등 다른 BJ의 별풍선 유치 행동에도 두루 쓰이며 아프리카TV 전반의 유행어가 됐다.',
    '아프리카TV 리니지 BJ 꽃거지(꽃태자) 방송 시청자 드립', '돈이나 관심을 위해 과한 행동을 하는 상황을 놀릴 때', '대상을 비하하는 뉘앙스가 있어 실제 지인에게 쓰면 기분 상할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2010, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9E%90%EB%82%B3%EA%B4%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뿌잉뿌잉', '뿌잉뿌잉', array['뿌잉']::text[], '양띵의 애교 섞인 리액션 유행어', '양띵이 별풍선 리액션을 고민하던 중 당시 유행하던 표현을 변형하고, 콤플렉스인 광대를 가리는 손동작과 특유의 억양을 더해 만든 리액션이다. 원조를 둘러싸고 다른 방송 유래설도 있으나 아프리카TV에서는 양띵의 대표 유행어로 굳어졌다.',
    '아프리카TV BJ 양띵의 별풍선 리액션', '귀엽게 애교 부리는 상황을 흉내낼 때', '양띵 본인이 흑역사로 여겨 민망해한다는 점 참고',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%91%EB%9D%B5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미치게따', '미치게따', array['미치겠다↗']::text[], '별풍선 터질 때 양띵이 외치던 흥분 리액션', '양띵이 2012년부터 2014년 사이 별풍선이 터지는 등 방송이 잘 풀릴 때 흥분해서 외치던 억양 있는 리액션으로, ''왔다왔어''와 짝을 이뤄 자주 쓰였다.',
    '아프리카TV BJ 양띵 방송의 흥분 리액션', '기쁘거나 신나는 상황을 과장해서 표현할 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%91%EB%9D%B5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왔다왔어', '왔다왔어', array['왔다왔어↗']::text[], '좋은 일이 생겼을 때 양띵이 외치던 리액션 유행어', '양띵이 2012~2014년 즈음 방송 중 좋은 상황이 왔을 때 흥분해서 외치던 표현으로 ''미치게따''와 함께 세트로 쓰였다.',
    '아프리카TV BJ 양띵 방송의 흥분 리액션', '기다리던 일이 마침내 이루어졌을 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%91%EB%9D%B5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('양띵 마인즈 사건', '양띵-마인즈-사건', array['YD LOVE 사건','양띵 MineZ 사건']::text[], '양띵 팬들이 해외 마인크래프트 서버에 몰려가 채팅을 도배한 사건', '2013년 3월 1일 양띵이 해외 마인크래프트 서버 ''마인즈(MineZ)''에 접속하자 수백 명의 시청자가 서버 주소를 알아내 접속, 한국어 채팅과 ''YD LOVE'' 문구로 서버를 도배했다. 양띵이 자제를 당부했음에도 도배가 계속되자 서버 측이 ''YD'' 계정을 밴하며 논란이 됐고, 국내 인터넷 방송 팬덤의 해외 서버 민폐 사례로 회자됐다.',
    '아프리카TV BJ 양띵의 마인크래프트 방송 시청자들의 실시간 몰려가기', '팬덤의 몰려가기 민폐 사례를 설명할 때 인용', '해외 서버 이용자에게 실제 피해를 준 사건이라 미화하지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%91%EB%9D%B5%20%EB%A7%88%EC%9D%B8%EC%A6%88%20%EC%82%AC%EA%B1%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('달달하다', '달달하다', array['달달함']::text[], '커맨더지코의 말버릇에서 나온 감탄 표현', '아프리카TV BJ 커맨더지코가 방송 중 상황이 흡족하거나 기분 좋을 때 습관적으로 쓰던 말투로, 한때 아프리카TV 채팅 전반에서 널리 쓰였다.',
    '아프리카TV BJ 커맨더지코의 말버릇', '뭔가 흡족하고 만족스러운 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%BB%A4%EB%A7%A8%EB%8D%94%EC%A7%80%EC%BD%94', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('조시나', '조시나', array['ㅈㅅㄴ']::text[], 'BJ가 뭔가 하겠다고 해놓고 안 할 것 같을 때 쓰던 말', '커맨더지코의 말버릇에서 유래한 초성 표현으로, BJ가 무언가를 하겠다고 공언했을 때 시청자들이 ''어차피 안 할 것 같다''는 의미로 채팅에 자주 남기던 말이다.',
    '아프리카TV BJ 커맨더지코의 말버릇에서 파생된 채팅 유행어', '약속을 안 지킬 것 같은 상황을 놀릴 때', '상대를 못 미더워하는 뉘앙스라 실제 지인에게는 조심',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%BB%A4%EB%A7%A8%EB%8D%94%EC%A7%80%EC%BD%94', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('하꼬', '하꼬', array['하꼬방']::text[], '시청자 적은 소규모 인터넷 방송을 이르는 말', '허름한 판잣집을 뜻하는 ''하코방''에서 온 말로, 커맨더지코가 시청자 수가 적어 초라한 방송을 자조적으로 부르며 아프리카TV에 유행시켰다. 이후 소규모 방송 전반을 가리키는 은어로 굳어졌다.',
    '아프리카TV BJ 커맨더지코가 유행시킨 방송 은어', '본인 방송·모임 규모가 작다고 자조할 때', '타인의 채널·모임을 낮잡아 부르면 무례하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%BB%A4%EB%A7%A8%EB%8D%94%EC%A7%80%EC%BD%94', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쿰척쿰척', '쿰척쿰척', array['파오후 쿰척쿰척','하오옵 쿰척쿰척']::text[], '먹방 BJ 채팅에서 시작해 이후 혐오 표현으로 변질된 의성어', '아프리카TV BJ 박창의 먹방 방송 채팅창에 ''하오옵 쿰척쿰척''이 도배된 것이 시초로, 처음에는 음식 사진에 장난스럽게 붙이는 자학개그 표현이었다. 2013년 이후 일간베스트에서 특정 집단(오타쿠·과체중자)을 비하하는 ''파오후 쿰척쿰척''으로 변형되어 혐오 표현으로 굳어졌다.',
    '아프리카TV BJ 박창 먹방 방송 채팅창', '과거 아프리카TV 먹방 채팅 문화를 설명하는 아카이브 목적으로만', '현재는 특정 집단을 비하하는 혐오 표현으로 굳어져 실사용 금지',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'negative'::meme_sentiment, 2012, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%8C%8C%EC%98%A4%ED%9B%84%20%EC%BF%B0%EC%B2%99%EC%BF%B0%EC%B2%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('먹방', '먹방', array['먹는 방송']::text[], '많은 양의 음식을 먹는 모습을 보여주는 인터넷 방송 장르', '2010년 아프리카TV BJ 왕쥬가 대식 콘텐츠를 정착시키며 ''먹방''이라는 이름과 장르가 자리잡았다. 이후 국내를 넘어 해외에서도 ''Mukbang''이라는 이름으로 알려지며 한국 인터넷 방송을 대표하는 콘텐츠가 됐다.',
    '아프리카TV BJ 왕쥬가 대식 콘텐츠를 정착시키며 시작', '많이 먹는 콘텐츠나 그런 방송을 가리킬 때', '과식 조장 우려가 있어 건강 관련 맥락에서는 언급 주의',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/%EB%A8%B9%EB%B0%A9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('유리방광', '유리방광', array['요실금 드립']::text[], '화장실을 자주 가는 BJ를 놀리던 시청자 드립', '대도서관이 방송 중 물을 자주 마셔 화장실을 자주 다녀오자, 시청자들이 채팅창에 ''유리방광 또'', ''요실금'' 등의 드립을 반복해서 붙이며 생긴 놀림 표현이다.',
    '아프리카TV BJ 대도서관 방송 시청자 채팅 드립', '누군가 화장실을 자주 가는 걸 가볍게 놀릴 때', '신체 기능을 놀리는 드립이라 예민한 사람에겐 실례가 될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1도 없다', '1도-없다', array['1도 없어','1도 모르겠다']::text[], '조금도 없다는 뜻, 헨리의 어눌한 발음에서 유행', '2014년 MBC ''진짜 사나이''에서 헨리가 ''1도 몰르갰습니다''라고 답한 것에서 유래해 ''1도 없다/1도 모르겠다''는 표현이 유행어로 퍼졌다. 이후 각종 예능과 SNS에서 ''전혀 없다''는 뜻의 강조 표현으로 널리 쓰였다.',
    'MBC ''진짜 사나이'' 54화(2014.4.13) 헨리의 발언', '전혀 없음을 강조할 때 캐주얼하게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정유라 돈도 실력이야', '정유라-돈도-실력이야', array['니네 부모를 원망해','돈도 실력']::text[], '능력없으면 부모 원망하라던 정유라의 SNS 발언 논란', '최순실의 딸 정유라가 2014년 12월 SNS에 ''능력없으면 니네 부모를 원망해... 돈도 실력이야''라는 글을 올린 사실이 2016년 박근혜-최순실 게이트 보도 과정에서 재조명되며 공분을 사고 밈이 되었다. 특권과 불공정을 비판하는 인용구로 굳어졌다.',
    '정유라 개인 SNS(2014.12), 2016년 최순실 게이트 보도로 확산', '불공정·특권 비판 맥락의 인용구로 사용', '정치적으로 민감한 사건 인용이므로 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('포켓몬고 속초 신드롬', '포켓몬고-속초-신드롬', array['속초 성지순례','포켓몬 성지 속초']::text[], '국내 미출시 포켓몬고가 유일하게 실행된 속초 열풍', '2016년 7월 포켓몬GO가 한국에 정식 출시되지 않았음에도 서버 지역 설정의 특이점으로 강원도 속초 일대에서만 플레이가 가능하다는 사실이 알려지며 전국에서 사람들이 속초로 몰려들었다. 버스표 매진, 편의점 매출 급증 등 사회현상으로 번졌다.',
    '2016년 7월 강원 속초시 엑스포광장 일대', '게임 성지순례 현상을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('알파고 대 이세돌 신의 한 수', '알파고-대-이세돌-신의-한-수', array['인류를 지킨 한 판','이세돌 4국 78수']::text[], 'AI 알파고에 맞선 이세돌의 4국 승리를 부른 별칭', '2016년 3월 구글 딥마인드의 알파고와 이세돌 9단의 바둑 대국에서 이세돌이 유일하게 승리한 4국의 78수가 ''신의 한 수''로 불리며 화제가 됐다. AI 시대의 상징적 사건으로 각종 패러디와 인용이 쏟아졌다.',
    '2016년 3월 구글 딥마인드 챌린지 매치 4국', '예상 밖의 극적인 역전이나 묘수를 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 토토가', '무한도전-토토가', array['토요일 토요일은 가수다','토토가 신드롬']::text[], '무한도전이 부른 1990년대 가수 총출동 복고 열풍', '2014년 11월부터 2015년 1월까지 방영된 무한도전 특별기획 ''토요일 토요일은 가수다''에서 터보, 쿨, S.E.S 등 1990년대 인기 가수들이 총출동해 전국적 복고 신드롬을 일으켰다. 터보의 무대 당시 순간 최고 시청률 35.9%를 기록했다.',
    'MBC 무한도전 특별기획, 2014.11~2015.1', '복고 열풍이나 세대공감 소재로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('백종원 슈가보이', '백종원-슈가보이', array['슈가보이 백종원']::text[], '설탕을 듬뿍 넣는 모습으로 붙은 백종원의 별명', '2015년 MBC ''마이 리틀 텔레비전''에서 백종원이 요리에 설탕을 넉넉히 넣는 장면이 화제가 되며 ''슈가보이''라는 별명이 붙었다. 실제 비율과 무관하게 CG 연출로 과장되어 밈으로 굳어졌다.',
    'MBC ''마이 리틀 텔레비전'', 2015년', '요리에 설탕이나 당을 많이 쓰는 상황을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마네킹 챌린지', '마네킹-챌린지', array['Mannequin Challenge']::text[], '노래에 맞춰 마네킹처럼 정지 동작을 유지하는 챌린지', '2016년 10월 미국에서 시작된 마네킹 챌린지는 레이 스레머드의 ''Black Beatles''를 배경음악으로 사람들이 동작을 멈춘 채 정지하는 모습을 촬영하는 챌린지로, 같은 해 말 한국 아이돌(우주소녀, 여자친구, 트와이스 등)과 일반인 사이에서도 크게 유행했다.',
    '2016년 10월 미국 플로리다 학생의 트위터 영상', '단체 정지 동작 놀이나 챌린지를 소개할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허니버터칩 대란', '허니버터칩-대란', array['허니버터칩 품절대란']::text[], '출시 두 달 만에 품절 대란을 일으킨 국민 과자', '2014년 8월 해태제과가 출시한 허니버터칩은 달고 짠 맛으로 입소문을 타며 두 달 만에 전국적 품절 사태를 빚었다. 중고거래에서 정가의 3배 이상에 거래되고 편의점 앞에 대기줄이 생기는 등 하나의 사회현상이 됐다.',
    '해태제과, 2014년 8월 출시', '품절이나 품귀 현상을 비유할 때 원조격으로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Pick Me 픽미업', 'Pick-Me-픽미업', array['픽미','내꺼야 Pick Me']::text[], '프로듀스101 연습생들의 중독성 있는 데뷔 경쟁가', '2015년 12월 공개된 Mnet ''프로듀스 101'' 시즌1의 테마곡 ''PICK ME''는 101명의 연습생이 부른 중독성 강한 후렴구로 2016년 방송 기간 내내 각종 패러디와 커버, 선거 유세송 패러디까지 낳으며 그 해를 대표하는 밈송이 됐다.',
    'Mnet ''프로듀스 101'' 시즌1 테마곡, 2015.12 공개', '중독성 있는 후렴구나 경쟁 상황을 패러디할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=BiorIyrjTHc', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'BiorIyrjTHc', 'https://www.youtube.com/watch?v=BiorIyrjTHc', true from memes where slug = 'Pick-Me-픽미업'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('땅콩회항', '땅콩회항', array['대한항공 086편 회항 사건','땅콩 리턴']::text[], '마카다미아를 봉지째 준 것에 항공기를 되돌린 갑질 사건', '2014년 12월 대한항공 조현아 부사장이 견과류 서비스를 문제 삼아 이륙 준비 중이던 비행기를 램프리턴시키고 사무장을 내리게 한 사건. ''갑질''의 대명사가 되어 각종 광고·개그 패러디가 쏟아졌다.',
    '2014년 12월 5일 JFK발 인천행 대한항공 086편', '갑질이나 과잉 대응 상황을 풍자할 때 인용', '실존 인물 비하로 흐르지 않게 사실관계 위주로 언급',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2014, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('연민정 후 짤', '연민정-후-짤', array['장보리 후 짤','연민정 짤']::text[], '왔다 장보리 악녀 연민정의 비웃는 손짓 ''후~'' 장면', '2014년 MBC 드라마 ''왔다! 장보리''에서 배우 이유리가 연기한 악역 연민정이 상대에게 손바닥으로 ''후~''하고 바람을 부는 애드리브 장면이 화제가 되며 대표적인 표정·동작 짤로 자리잡았다. 극강의 발연기가 아닌 열연으로 유명해진 사례다.',
    'MBC 드라마 ''왔다! 장보리'', 2014년 방영분 중 이유리 애드리브', '얄밉게 비웃거나 약올리는 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼둥이 신드롬', '삼둥이-신드롬', array['대한민국 만세 삼둥이']::text[], '송일국의 세 쌍둥이 대한·민국·만세가 일으킨 육아 신드롬', '2014년 KBS2 ''슈퍼맨이 돌아왔다''에 출연한 송일국의 세 아들 대한·민국·만세가 등장과 동시에 전국적인 인기를 얻으며 ''삼둥이 신드롬''을 일으켰다. 2016년 초까지 최고 인기 키즈스타로 자리매김했다.',
    'KBS2 ''슈퍼맨이 돌아왔다'', 2014년', '귀여운 다둥이나 육아 예능 소재로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('최순실 우주의 기운', '최순실-우주의-기운', array['온 우주가 도와줄거야']::text[], '박근혜 대통령의 신비주의 화법이 조롱거리가 된 유행어', '박근혜 대통령이 평소 연설에서 ''간절히 원하면 우주가 도와준다''는 식의 표현을 즐겨 쓴 것이, 2016년 10월 박근혜-최순실 게이트가 불거지며 최태민 일가의 영향을 암시하는 조롱조 밈으로 재해석됐다. 각종 패러디 짤과 노래까지 등장했다.',
    '박근혜 대통령 각종 연설, 2016년 10월 게이트 보도로 재조명', '근거 없는 신비주의나 미신적 화법을 풍자할 때', '특정 정치 사건 관련이므로 시사 맥락 설명 권장',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼밥 혼술', '혼밥-혼술', array['혼자 밥먹기','혼자 술먹기','나홀로족']::text[], '혼자 밥 먹고 술 마시는 문화를 가리키는 신조어', '1인 가구 증가와 함께 2016년경 ''혼밥(혼자 밥 먹기)'', ''혼술(혼자 술 마시기)''이라는 표현이 대중화됐다. 혼영, 혼행 등 파생어가 잇따르며 ''나홀로 문화''를 상징하는 유행어로 자리잡았다.',
    '1인 가구 증가 트렌드, 2016년 언론·SNS에서 대중화', '혼자 하는 활동을 자연스럽게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('냉장고를 부탁해 쿡방 신드롬', '냉장고를-부탁해-쿡방-신드롬', array['냉부해','쿡방 열풍']::text[], '냉장고 속 재료로 셰프들이 대결하는 쿡방 원조 신드롬', '2014년 11월 시작한 JTBC ''냉장고를 부탁해''는 게스트의 냉장고를 그대로 스튜디오로 가져와 셰프들이 15분 안에 요리 대결을 벌이는 포맷으로, 이후 이어진 ''쿡방'' 열풍의 최전방에 섰던 프로그램이다.',
    'JTBC ''냉장고를 부탁해'', 2014.11.17 첫 방영', '요리 예능이나 쿡방 유행을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 식스맨 프로젝트', '무한도전-식스맨-프로젝트', array['식스맨 광희']::text[], '무한도전 새 멤버를 뽑은 국민 참여형 오디션 특집', '2015년 무한도전이 새 멤버를 선발하기 위해 ''식스맨 프로젝트''를 진행, 대국민 투표와 경쟁 끝에 황광희가 최종 발탁됐다. 광희는 발탁 직후 기존 출연 중이던 ''스타킹'', ''인기가요''에서 하차하며 화제를 모았다.',
    'MBC 무한도전, 2015년 초 방영', '새 멤버 영입이나 오디션 상황을 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('복면가왕', '복면가왕', array['미스터리 음악쇼 복면가왕']::text[], '가면 쓴 스타들이 목소리로 노래 대결하는 예능', '2015년 4월 시작한 MBC ''미스터리 음악쇼 복면가왕''은 출연자가 나이·직업·신분을 가린 가면을 쓰고 노래 실력만으로 경쟁하는 포맷으로 큰 화제를 모았다. ''우리 동네 음악대장'' 등 캐릭터가 유행하며 58개국에 포맷이 수출됐다.',
    'MBC ''미스터리 음악쇼 복면가왕'', 2015.4.5 첫 방영', '정체를 숨긴 반전 상황이나 가창 경연을 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아이유 제제 논란', '아이유-제제-논란', array['제제 논란','CHAT-SHIRE 논란']::text[], '동화 속 5세 소년을 성적으로 묘사했다는 가사 논란', '2015년 10월 발매한 아이유의 미니앨범 ''챗셔'' 수록곡 ''제제''가 소설 ''나의 라임오렌지나무''의 5살 주인공을 성적 대상으로 묘사했다는 비판을 받으며 그 해 최대 가요계 논란으로 꼽혔다. 아이유는 공식 사과했다.',
    '아이유 미니앨범 ''CHAT-SHIRE'' 수록곡 ''제제'', 2015.10 발매', '아동 성적 대상화 창작물 논란 사례로만 언급', '아동 성적 대상화 관련 민감 소재이므로 옹호나 희화화 금지',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아이스버킷챌린지', '아이스버킷챌린지', array['Ice Bucket Challenge','얼음물 챌린지']::text[], '얼음물을 뒤집어쓰고 기부·지목을 이어가는 루게릭병 챌린지', '2014년 전 세계적으로 확산된 루게릭병(ALS) 인식 개선 기부 챌린지로, 한국에서도 유재석을 시작으로 연예인·기업인·정치인들이 잇달아 참여하며 큰 화제를 모았다.',
    '2014년 미국에서 시작해 전 세계로 확산, 한국은 유재석 등 참여', '선한 영향력 릴레이 챌린지의 대표 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대나무숲 페이스북 페이지', '대나무숲-페이스북-페이지', array['OO대학교 대나무숲','대신 전해드립니다']::text[], '익명으로 사연을 대신 올려주는 대학가 페이스북 페이지 열풍', '2013년 말 서울대 학생이 만든 ''서울대학교 대나무숲'' 페이스북 페이지를 시작으로 2014년 연세대·고려대 등 전국 대학가로 익명 대신전달 페이지가 확산됐다. ''임금님 귀는 당나귀 귀'' 설화에서 이름을 땄다.',
    '서울대학교 대나무숲, 2013년 12월 개설 후 2014년 전국 확산', '익명 커뮤니티나 제보 게시판 문화를 설명할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼시세끼 차줌마', '삼시세끼-차줌마', array['차줌마 신드롬','차셰프']::text[], '삼시세끼에서 차승원이 보여준 반전 요리 실력 신드롬', '2015년 tvN ''삼시세끼'' 어촌편에서 차승원이 차가운 이미지와 달리 다재다능한 요리 솜씨를 뽐내며 ''차줌마'', ''차셰프''라는 별명과 함께 신드롬급 인기를 얻었다.',
    'tvN ''삼시세끼'' 어촌편, 2015년', '반전 매력을 보여준 상황을 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼이 비정상', '혼이-비정상', array['혼이 비정상이 될 수밖에 없다']::text[], '역사를 바르게 안 배우면 혼이 비정상이 된다는 발언', '2015년 11월 박근혜 대통령이 국무회의에서 역사교과서 국정화를 옹호하며 ''바르게 역사를 배우지 못하면 혼이 비정상이 될 수밖에 없다''고 발언, 기이한 화법으로 회자되며 유행어가 됐다.',
    '박근혜 대통령 국무회의 발언, 2015.11', '이상한 논리나 화법을 풍자할 때 인용', '정치적 발언 인용이므로 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('내가 이러려고 대통령을 했나', '내가-이러려고-대통령을-했나', array['이러려고 대통령 했나 자괴감']::text[], '박근혜 대통령 대국민 담화 중 나온 자괴감 발언', '2016년 11월 4일 박근혜-최순실 게이트 관련 2차 대국민 담화에서 ''내가 이러려고 대통령을 했나 자괴감이 들 정도''라고 말한 것이 유행어가 되어, ''내가 이러려고 ○○을 했나'' 형태의 패러디가 사회 전반에 번졌다.',
    '박근혜 대통령 대국민 담화, 2016.11.4', '허탈하고 억울한 상황을 과장해서 표현할 때', '정치적으로 민감한 발언의 패러디이며 상황에 따라 조롱으로 읽힐 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('배달의민족 우리가 어떤 민족입니까', '배달의민족-우리가-어떤-민족입니까', array['배민 류승룡 광고']::text[], '류승룡이 외친 배달의민족 광고 유행어', '2014년 배달의민족이 배우 류승룡을 모델로 내세워 영화 예고편 같은 B급 감성 광고를 선보였고, 그가 외친 ''우리가 어떤 민족입니까!''라는 대사가 큰 화제를 모으며 각종 패러디를 낳았다.',
    '배달의민족 TV광고, 2014년', '자신감 있게 무언가를 내세울 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핑크퐁 아기상어', '핑크퐁-아기상어', array['Baby Shark','상어가족']::text[], '뚜루루뚜루로 유명한 핑크퐁의 국민 동요', '2016년 초 유튜브에 공개된 핑크퐁의 ''아기상어(상어가족)''는 그 해 국내 최다 조회 유튜브 영상이자 동요 차트 1위에 오르며 아이들 사이에서 폭발적 인기를 얻었다. 이후 전 세계적인 초대형 밈으로 성장하는 발판이 됐다.',
    '더핑크퐁컴퍼니, 2016년 유튜브 공개', '중독성 있는 후렴구나 육아 콘텐츠를 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그린라이트', '그린라이트', array['그린라이트 켜줘']::text[], '상대에게 호감이 있다는 뜻으로 쓰인 연애 신조어', '2013~2015년 방영된 JTBC ''마녀사냥''의 코너 ''그린라이트를 켜줘''에서 유래해, 이성에게 호감이 있어 대시해도 된다는 뜻의 ''그린라이트''라는 표현이 20대 사이에서 크게 유행했다.',
    'JTBC ''마녀사냥'' 코너명, 2013년 시작 후 2014~2015년 대중화', '썸이나 호감 있는 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('겨울왕국 렛잇고', '겨울왕국-렛잇고', array['Let It Go','렛잇고 열풍']::text[], '겨울왕국 엘사의 노래를 온 국민이 따라 부른 열풍', '2014년 1월 한국 개봉한 디즈니 애니메이션 ''겨울왕국''의 주제가 ''Let It Go''가 어린이부터 어른까지 폭넓게 사랑받으며 국내 애니메이션 최초로 1000만 관객을 돌파, 노래방과 유치원마다 따라부르기 열풍이 일었다.',
    '디즈니 ''겨울왕국'' 한국 개봉, 2014.1.16', '다 같이 따라부르는 중독성 있는 노래를 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국민 프로듀서님', '국민-프로듀서님', array['전국의 프로듀서 여러분']::text[], '프로듀스101 시청자를 향한 호칭이 낳은 팬덤 밈', '2016년 Mnet ''프로듀스 101''에서 연습생들의 데뷔 여부를 투표로 결정하는 시청자를 ''국민 프로듀서''라 부르면서, 실제 선거 포스터를 패러디한 홍보물과 구호가 쏟아지는 등 팬덤 문화의 상징적 밈이 됐다.',
    'Mnet ''프로듀스 101'' 시즌1, 2016년', '팬덤의 투표 독려나 선택권을 강조하는 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('소혜야 가수가 하고 싶어?', '소혜야-가수가-하고-싶어?', array['소혜야 가수가 하고싶어','가수가 하고 싶어?']::text[], '프로듀스101서 안무 못 따라간 김소혜에 배윤정이 던진 유행어', '2016년 Mnet <프로듀스101> 4회에서 안무 강사 배윤정이 ''Irony'' 안무를 제대로 소화하지 못한 연습생 김소혜에게 던진 말이다. 직캠 영상이 화제가 되며 ''진짜 하고 싶은 게 맞냐''는 뜻의 놀림조 표현으로 온라인에서 패러디되어 널리 쓰였다.',
    '2016년 2월 12일 Mnet <프로듀스101> 4회, 안무가 배윤정이 연습생 김소혜에게 한 발언', '상대의 실력 미달을 장난스럽게 지적할 때 패러디로 사용', '실제 인물을 향한 조롱으로 쓰이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('냉장고를 부탁해 김풍 ''사파''', '냉장고를-부탁해-김풍-사파', array['정파를 깨부수는 사파','김풍 마교 교주']::text[], '비정통 야매 요리로 정통 셰프를 이기는 김풍을 부르는 무협풍 별명', 'JTBC <냉장고를 부탁해>에서 정식 요리 교육을 받지 않은 만화가 김풍이 파격적인 조리법으로 전문 셰프들을 상대로 선전하자, 무협지 클리셰에 빗대 ''정파를 깨부수는 사파''라는 별명이 붙었다. 만화 열혈강호의 한비광에 비유되며 화제를 모았다.',
    '2015년 JTBC <냉장고를 부탁해> 방영 중 시청자·커뮤니티에서 형성된 별명', '비주류·아마추어가 정통 강자를 이기는 상황을 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('백종원 ''슈가보이''', '백종원-슈가보이', array['슈가보이','백주부']::text[], '설탕을 듬뿍 넣는 레시피로 붙은 백종원의 마리텔 별명', '2015년 MBC <마이 리틀 텔레비전>에서 백종원이 요리에 설탕을 아낌없이 넣는 모습이 반복되며 ''슈가보이''라는 별명이 붙었다. 스스로를 ''백주부''라 칭하며 친근한 캐릭터로 큰 인기를 끌었다.',
    '2015년 1월 MBC <마이 리틀 텔레비전> 인터넷 방송 중 형성', '설탕이나 조미료를 과하게 넣는 레시피를 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어남류', '어남류', array['어차피 남편은 류준열','결남류','딱정남']::text[], '응팔 방영 중 ''진짜 남편이 누구냐'' 떡밥에서 나온 신조어', 'tvN <응답하라 1988> 방영 당시 여주인공 덕선의 미래 남편이 누구인지를 둘러싼 떡밥 논쟁에서 나온 신조어다. ''어차피 남편은 류준열''의 줄임말로, 정환 역의 류준열을 지지하는 팬덤에서 만들어져 커뮤니티 전반에 퍼졌다.',
    '2015년 tvN <응답하라 1988> 방영 중 디시인사이드 등 드라마 갤러리에서 형성', '다자 로맨스물에서 결말을 예측하며 편을 가를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정환이 첫사랑 신드롬', '정환이-첫사랑-신드롬', array['정환앓이','류준열 정환']::text[], '짝사랑만 하다 이어지지 못한 정환이의 순애보에 대한 안타까움', '<응답하라 1988>에서 류준열이 연기한 김정환은 덕선을 향한 마음을 끝내 고백하지 못하고 이별한다. 방영 후 ''가장 슬픈 첫사랑''으로 재평가받으며 관련 장면들이 짤과 영상으로 퍼져 큰 반향을 일으켰다.',
    '2015년 11월~2016년 1월 tvN <응답하라 1988> 방영분', '이루어지지 않은 순애보를 안타까워하며 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미생 신드롬 ''장그래''', '미생-신드롬-장그래', array['장그래','미생이다']::text[], '비정규직 청춘 장그래를 통해 ''미생''이 직장인 대명사가 됨', 'tvN 드라마 <미생>의 주인공 장그래(임시완)가 큰 반향을 일으키며 ''미생''이라는 바둑 용어가 불완전한 사회초년생·직장인을 뜻하는 유행어로 자리 잡았다. ''미생 신드롬'', ''미생 법'' 등 파생어가 생길 정도로 사회적 화제가 되었다.',
    '2014년 10~12월 tvN 드라마 <미생> 방영', '아직 다 자리 잡지 못한 직장인 처지를 자조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('추사랑 ''당근!''', '추사랑-당근!', array['당근','추사랑 당근 짤']::text[], '한국어 배우던 추사랑이 순간적으로 외친 ''당근''이 짤로 확산', 'KBS <슈퍼맨이 돌아왔다>에서 추성훈이 요리 중 ''당근''이라는 단어를 떠올리지 못하자 어린 딸 추사랑이 곧바로 ''당근!''이라 외쳐 화제가 됐다. 뛰어난 한국어 습득력과 귀여움이 겹치며 대표 짤로 소비되었다.',
    '2014년 KBS <슈퍼맨이 돌아왔다> 방영분', '예상 못한 순발력 있는 답변 상황에 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('은지원 천재 아니면 바보', '은지원-천재-아니면-바보', array['천재 아니면 바보','신서유기 은지원']::text[], '신서유기서 이승기가 은지원에 남긴 평가가 캐릭터로 굳어짐', 'tvN <신서유기>에서 이승기가 은지원의 엉뚱한 행동과 승부욕을 두고 ''천재 아니면 바보, 둘 중 하나''라고 평한 것이 화제가 되며 은지원의 캐릭터를 규정하는 표현으로 자리 잡았다.',
    '2015년 tvN <신서유기> 방영', '예측 불가능하고 엉뚱한 행동을 한 사람을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('차줌마', '차줌마', array['차줌마','차승원 셰프님']::text[], '삼시세끼 어촌편에서 요리 솜씨로 얻은 차승원의 별명', 'tvN <삼시세끼> 어촌편에서 차승원이 호탕한 성격과 뛰어난 요리 실력을 보이며 ''차승원+아줌마''를 합친 ''차줌마''라는 별명을 얻었다. 이후 대중적으로 정착된 애정 어린 별명이 되었다.',
    '2014~2015년 tvN <삼시세끼> 어촌편 방영', '살림과 요리를 잘하는 사람을 칭찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이애란 ''백세인생'' 전해라', '이애란-백세인생-전해라', array['못 간다고 전해라','전해라 밈','백세인생']::text[], '백세인생 가사의 ''~전해라''가 거절·전언 상황 유행어로 확산', '가수 이애란의 트로트 ''백세인생'' 가사 ''~전해라''가 짤방으로 퍼지며 완곡한 거절이나 메시지 전달을 코믹하게 표현하는 유행어가 됐다. 2015년 하반기 카카오톡 이모티콘 출시와 방송 출연이 겹치며 대중화됐다.',
    '기존곡이 2015년 하반기 짤방 확산과 방송 출연으로 대유행', '거절이나 전언을 완곡하고 코믹하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('태양의 후예 ''~말입니다''체', '태양의-후예-~말입니다체', array['다나까 말투','군대 말투 유행']::text[], '태양의 후예 군인 말투가 일상 대화 패러디로 유행', 'KBS2 드라마 <태양의 후예>에서 유시진 대위 등 군인 캐릭터들이 쓰는 ''~말입니다'', ''~다 말입니다'' 식의 군대식 말투가 인기를 얻으며 시청자들 사이에서 일상 대화를 패러디하는 유행으로 번졌다.',
    '2016년 2~4월 KBS2 <태양의 후예> 방영', '군대식 말투를 흉내내며 장난스럽게 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1도 모르겠습니다', '1도-모르겠습니다', array['1도 없다','1도 모르겠어요']::text[], '헨리가 속담 퀴즈에 남긴 답에서 나온 ''전혀 모른다''는 유행어', 'MBC <일밤-진짜 사나이>에서 외국인 멤버 헨리가 한국 속담 관련 퀴즈에 ''1도 모르겠습니다''라고 답한 장면이 화제가 됐다. 이후 ''1도 없다'', ''1도 모르겠다'' 식으로 ''조금도 없다/모르겠다''를 강조하는 유행어로 정착했다.',
    '2014년 MBC <일밤-진짜 사나이> 방영분', '''조금도 없다/모르겠다''를 강조하고 싶을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('양화대교 역주행', '양화대교-역주행', array['무한도전 영동고속도로가요제','자이언티 양화대교']::text[], '무도 가요제 출연 후 자이언티 ''양화대교''가 뒤늦게 차트 역주행', '자이언티가 2014년 9월에 발매했던 자작곡 ''양화대교''는 큰 반응이 없었으나, 2015년 7월 <무한도전> 영동고속도로 가요제에 출연해 곡에 얽힌 사연을 전한 뒤 재조명되며 음원 차트 역주행에 성공했다.',
    '2015년 7월 MBC <무한도전> ''영동고속도로 가요제'' 방영 계기로 재조명', '뒤늦게 재조명받아 성공한 사례를 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('형이 왜 거기서 나와?', '형이-왜-거기서-나와?', array['형이 왜 거기서 나와','거인의 유혹']::text[], '정형돈이 몰래카메라 속 유재석 등장에 당황한 반응짤', 'MBC <무한도전> ''유혹의 거인'' 특집에서 정형돈이 서장훈·정준하의 술자리 유혹에 못 이겨 합류했다가, 사실은 금주 약속을 지키는지 시험하는 몰래카메라였음을 알리며 유재석이 등장하자 당황하는 모습이 반응짤로 널리 쓰이게 됐다.',
    '2014년 12월 13일 MBC <무한도전> ''유혹의 거인'' 특집 방영분', '예상 못한 인물이 갑자기 등장했을 때 캡션으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('민상토론', '민상토론', array['민상토론','유민상 박영진']::text[], '돌려 말하는 시사 풍자 형식으로 인기를 끈 개콘 코너', 'KBS <개그콘서트>의 코너로, 진행자 박영진이 정치·시사 질문을 던지면 유민상이 당황하며 얼버무리는 방식으로 웃음을 줬다. 정치 자체보다 시사 프로그램 형식을 풍자한 코너로 큰 인기를 끌었다.',
    '2015년 KBS <개그콘서트> 코너', '돌려 까기 식 풍자 화법을 인용할 때', '정치적으로 민감한 소재라 자리·상대를 가려 사용',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼둥이 대한민국만세', '삼둥이-대한민국만세', array['대한민국만세','주겠니','삼둥이']::text[], '세쌍둥이 대한·민국·만세의 이름과 말투가 만든 국민 밈', 'KBS <슈퍼맨이 돌아왔다>에 등장한 송일국의 세쌍둥이 아들 이름이 ''대한, 민국, 만세''로, 이름을 부르는 것만으로 ''대한민국 만세''가 되는 것이 화제였다. 막내 만세의 ''~주겠니?''라는 애교 섞인 부탁 말투도 유행어가 됐다.',
    '2014년 7월 KBS <슈퍼맨이 돌아왔다> 삼둥이 편 첫 방영', '애교 섞인 부탁 말투를 흉내낼 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쇼미더머니4 송민호 가사 논란', '쇼미더머니4-송민호-가사-논란', array['MINO 가사 논란','산부인과 가사']::text[], '참가자 송민호의 여성비하성 가사로 불거진 힙합 서바이벌 논란', 'Mnet <쇼미더머니4> 경연 중 참가자 송민호(위너)가 여성을 비하하는 내용의 가사를 선보여 논란이 됐다. 산부인과 관련 학회가 공식 유감을 표명했고 송민호가 사과문을 발표하며 일단락됐다.',
    '2015년 7월 Mnet <쇼미더머니4> 3차 예선 방영분', '힙합 서바이벌 가사 논란 사례로만 인용', '여성비하 표현을 그대로 옮기거나 옹호하는 맥락으로 쓰지 말 것',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쇼미더머니5 블랙넛 논란', '쇼미더머니5-블랙넛-논란', array['Indigo Child 논란','블랙넛 가사 논란']::text[], '성희롱·세월호 조롱 가사로 물의를 일으킨 래퍼 블랙넛 관련 논란', 'Mnet <쇼미더머니5> 방영 시기 래퍼 블랙넛이 참여한 저스트뮤직 합동곡 ''Indigo Child''에서 여성비하·특정 인물 성희롱·세월호 참사 조롱으로 해석될 수 있는 가사가 나와 큰 논란이 됐다.',
    '2016년 Mnet <쇼미더머니5> 방영 시기 발매곡 관련 논란', '힙합 씬 가사 논란 아카이브 목적으로만 인용', '혐오·조롱성 표현이 재생산되지 않도록 인용 시 각별히 주의',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2016, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('셰프테이너', '셰프테이너', array['셰프테이너','쿡방 전성시대']::text[], '쿡방 붐 속 예능감 있는 셰프를 가리키는 신조어', '''셰프''와 ''엔터테이너''를 합친 신조어로, <냉장고를 부탁해> 등 쿡방 예능이 인기를 끌며 요리 실력과 예능감을 겸비한 스타 셰프들을 가리키는 말로 널리 쓰이게 됐다.',
    '2015년 전후 <냉장고를 부탁해> 등 쿡방 예능 붐 속에서 형성된 신조어', '요리와 예능감을 겸비한 셰프를 칭할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('○○하고 가실게요', '○○하고-가실게요', array['하고 가실게요','렛잇비 박은영']::text[], '직장 상황극에서 반복돼 유행한 개그콘서트 여직원 유행어', 'KBS <개그콘서트> ''렛잇비'' 코너에서 여사원 역의 박은영이 상사·동료에게 반복해서 던진 유행어다. 직장인의 애환을 다룬 ''미생코드'' 콩트로 시청자들의 공감을 사며 인기를 끌었다.',
    '2014~2015년 KBS <개그콘서트> ''렛잇비'' 코너, 박은영 대사', '직장 내 상황을 재치있게 마무리 지을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무선커플', '무선커플', array['최무성 커플']::text[], '응팔 속 최택 아빠와 선우 엄마의 중년 로맨스 커플명', '응답하라 1988에서 최무성(최택 아버지)과 선우 엄마(김선영)의 뒤늦은 로맨스가 시작되자 시청자들이 두 사람의 성을 따 붙인 커플명이다. 극 후반 재혼 서사가 화제가 되며 널리 쓰였다.',
    '응답하라 1988 시청자 커뮤니티에서 만들어진 신조어', '중년 로맨스나 뒤늦은 사랑을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어남택', '어남택', array['어차피 남편은 택이']::text[], '응팔에서 나온 ''어차피 남편은 택이''의 줄임말', '응답하라 1988 방영 당시 최택(박보검)이 남편이라 확신한 팬들이 만든 줄임말로, 어남류파와 온라인에서 치열하게 대립했다.',
    '응답하라 1988 시청자 커뮤니티', '응팔 남편 논쟁을 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('택신', '택신', array['등신(택이)','빙신(정환)']::text[], '바둑천재 최택과 우유부단 정환을 놀리는 말장난 별명', '최택은 밖에서는 바둑의 신이지만 친구들 앞에서는 등신이라는 뜻에서 택신·등신으로, 덕선에게 고백 못 하는 정환은 빙신으로 불렸다. 갭 모에 캐릭터를 부각하는 팬들의 애정 어린 놀림에서 나왔다.',
    '응답하라 1988 시청자들의 언어유희', '응팔 팬덤 내에서 캐릭터를 놀릴 때', '등신/빙신 자체는 비하어라 팬덤 맥락 밖에서 쓰면 무례하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그럼 살려요', '그럼-살려요', '{}', '태양의 후예 유시진의 로맨틱한 명대사', '강모연이 ''살릴 수 있어요?''라고 묻자 유시진이 ''그럼 살려요''라고 답한 장면이 화제가 되며 유행어가 됐다. 배우 진구가 촬영장에서 자주 따라해 현장 유행어로도 퍼졌다.',
    'KBS 드라마 태양의 후예 대사', '상대 부탁을 흔쾌히 들어줄 때 로맨틱하게 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('상상도 못한 정체', '상상도-못한-정체', '{}', '복면가왕에서 반전 정체가 드러날 때 쓰는 감탄 표현', '미스터리 음악쇼 복면가왕에서 실력자로 주목받던 참가자의 가면을 벗겼더니 예상 밖의 인물이었던 순간들이 반복되며 굳어진 밈이다.',
    'MBC 복면가왕 방송 반응', '예상 밖의 반전을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('포포몬쓰', '포포몬쓰', '{}', '신서유기 자막에서 탄생한 뜻 모를 애교 표현', 'tvN 신서유기 자막 제작진이 출연자의 어눌한 말이나 애교성 표현을 재치있게 받아 적으며 만든 신조어 중 하나로, 정확한 의미보다 어감과 웃음 포인트로 소비됐다.',
    '신서유기 자막팀', '신서유기 팬들 사이 드립으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('머선129', '머선129', array['머선일이고']::text[], '''무슨 일이고''의 사투리를 비튼 신서유기·아는형님 유행어', '강호동 특유의 경상도 사투리 ''무슨 일이고''가 신서유기와 아는형님 자막에서 ''머선129'', ''머선일이고'' 등으로 표기되며 유행했다. 129는 발음을 그대로 옮긴 말장난이다.',
    '강호동의 사투리를 자막화한 tvN 신서유기·JTBC 아는형님', '황당한 상황에 재치있게 반응할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가마이써', '가마이써', array['가만히 있어']::text[], '강호동의 ''가만히 있어'' 사투리 발음을 그대로 옮긴 유행어', '신서유기에서 강호동이 발음한 ''가만히 있어''가 자막으로 ''가마이써''로 표기되며 화제가 됐고, 이후 동생 라인 멤버들도 따라 쓰며 유행했다.',
    'tvN 신서유기 강호동 발언 자막', '장난스럽게 정지·대기를 지시할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맹모닝', '맹모닝', '{}', '냉장고를 부탁해 논란 요리에 붙은 조롱성 별명', '냉장고를 부탁해에서 셰프 맹기용이 고등어 통조림 샌드위치를 선보이자 비린내 등으로 혹평을 받았고, 그의 성을 딴 ''맹모닝''이라는 조롱 섞인 별명이 붙었다.',
    'JTBC 냉장고를 부탁해 2015년 방송분 논란', '요리 실패나 혹평받은 음식을 가리킬 때', '특정 셰프를 조롱하는 맥락이라 본인 앞에서는 쓰지 않는 게 좋음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이멤버 리멤버 포에버', '이멤버-리멤버-포에버', '{}', '1박2일 시즌3 김준호가 만든 팀워크 구호', '1박2일 시즌3(2013~2015)를 상징하는 구호로 김준호가 만들어 방송 곳곳에서 외쳤다. 시즌3 팀워크를 강조하는 대표 문구로 자리잡았다.',
    'KBS 1박2일 시즌3 김준호 발언', '팀워크나 의리를 강조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('칭찬해 아주 칭찬해', '칭찬해-아주-칭찬해', '{}', '아는형님 강호동의 대표 유행어', 'JTBC 아는형님(2015년 시작)에서 강호동이 게스트나 상황을 추켜세울 때 반복적으로 쓰며 프로그램 최고 유행어로 자리잡았다.',
    'JTBC 아는형님 강호동 발언', '누군가를 과장되게 칭찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('있던거야', '있던거야', '{}', '또 오해영 박도경의 대사가 낳은 유행어', 'tvN 또 오해영(2016)에서 박도경(에릭)이 오해영의 현관에 신발을 가져다 놓으며 한 대사가 SNL 코리아 등에서 패러디되며 유행어가 됐다.',
    'tvN 드라마 또 오해영 대사', '로맨틱한 상황을 유머러스하게 패러디할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혜리 애교', '혜리-애교', array['3초 애교']::text[], '진짜 사나이 여군특집에서 혜리를 스타덤에 올린 애교 영상', '리얼입대 프로젝트 진짜 사나이 여군특집(2014)에서 걸스데이 혜리가 보인 3초 애교 영상이 큰 화제를 모으며 이후 드라마 캐스팅으로 이어질 만큼 파급력을 가진 밈이 됐다.',
    'MBC 진짜 사나이 여군특집 방송분', '귀여운 애교 장면을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어차피 우승은 송민호', '어차피-우승은-송민호', array['어우송']::text[], '쇼미더머니4가 낳은 최고 유행어', '래퍼 블랙넛이 2차 예선 가사에 ''어차피 우승은 송민호''라는 구절을 넣은 것에서 시작된 유행어로, 실제로 송민호가 시즌4 우승을 차지하며 예언처럼 회자됐다.',
    'Mnet 쇼미더머니4 블랙넛 가사', '결과가 뻔한 상황을 예측할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짬에서 나오는 바이브', '짬에서-나오는-바이브', '{}', '쇼미더머니5가 남긴 연차·경력 강조 유행어', 'Mnet 쇼미더머니5(2016)에서 나온 표현으로, 오랜 경력에서 우러나오는 관록과 여유를 뜻하며 이후 다른 예능에서도 자주 인용됐다.',
    'Mnet 쇼미더머니5', '경력자의 여유로운 모습을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('모스트스럽게', '모스트스럽게', '{}', '그녀는 예뻤다가 남긴 신조어 말투', 'MBC 그녀는 예뻤다(2015)의 대사에서 파생된 표현으로, 극중 인물들의 독특한 말투가 시청자 일상 언어에 스며들며 유행어가 됐다.',
    'MBC 드라마 그녀는 예뻤다 대사', '드라마 대사를 흉내내며 장난스럽게 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('~한 경향이 없지 않아', '~한-경향이-없지-않아', '{}', '그녀는 예뻤다 특유의 완곡한 화법 유행어', '그녀는 예뻤다 등장인물들이 자주 쓴 완곡하고 만연체스러운 화법으로, 찰진 말투 덕에 시청자들 사이에서 따라하는 유행어가 됐다.',
    'MBC 드라마 그녀는 예뻤다 대사', '돌려 말하는 화법을 유머러스하게 흉내낼 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('도찐개찐', '도찐개찐', '{}', '킬미힐미가 만든 ''그게 그거''라는 뜻의 신조어', 'MBC 킬미, 힐미(2015)에서 다중인격 설정을 소재로 ''도현이나 세기나 어차피 한 사람''이라는 뜻으로 만들어진 말장난 신조어. 이후 ''도찐개찐'' 형태로 일상에서도 쓰였다.',
    'MBC 드라마 킬미 힐미 팬 신조어', '결국 같은 것이라는 뜻으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('낮도밤세', '낮도밤세', '{}', '킬미힐미의 인격 설정을 압축한 신조어', '낮에는 인격 도현, 밤에는 인격 세기라는 뜻으로 만들어진 킬미힐미 팬덤 신조어. 다중인격 캐릭터의 특징을 재치있게 요약한 표현이다.',
    'MBC 드라마 킬미 힐미 팬 신조어', '상황에 따라 다른 모습을 보이는 사람을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('할아버지께서는 말씀하셨지', '할아버지께서는-말씀하셨지', '{}', '응팔 정봉이의 맥가이버 패러디 대사', '응답하라 1988에서 정봉이 즉흥적으로 지어내는 격언 도입부로 반복해서 쓴 대사. 근거 없는 말을 그럴듯하게 포장할 때 쓰는 패러디성 유행어가 됐다.',
    '응답하라 1988 정봉이 대사', '근거 없는 말을 격언처럼 던질 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('한 봉지 더', '한-봉지-더', '{}', '응팔 정봉이의 악운과 행운을 상징하는 치토스 대사', '응답하라 1988에서 정봉이 과자를 사면 항상 ''한 봉지 더'' 당첨되는 장면이 반복되며 그의 캐릭터를 상징하는 대사이자 밈이 됐다.',
    '응답하라 1988 정봉이 에피소드', '반복되는 소소한 행운을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맙소사', '맙소사', '{}', '무한도전 가요제에서 나온 곡 제목 겸 유행어', '2015 무한도전 영동고속도로 가요제에서 지드래곤, 태양, 광희가 함께한 곡 제목이자 광희가 SNS에 남긴 표현으로 화제가 됐다.',
    'MBC 무한도전 영동고속도로 가요제', '황당하고 놀라운 상황에 감탄사로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('살린다 무슨 일이 있어도 살린다', '살린다-무슨-일이-있어도-살린다', '{}', '낭만닥터 김사부의 시그니처 명대사', 'SBS 낭만닥터 김사부(2016)에서 주인공 김사부가 의사로서 소명을 드러내며 반복한 대사로, 방송 후 명대사 모음 영상이 큰 조회수를 기록하며 회자됐다.',
    'SBS 드라마 낭만닥터 김사부 대사', '강한 책임감과 의지를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('치즈인호트랩', '치즈인호트랩', array['응답하라 백길동 칸타빌레']::text[], '치즈인더트랩 드라마화 논란을 비꼰 합성어', 'tvN 치즈인더트랩(2016)이 원작 주인공 유정보다 서브캐릭터 백인호 분량을 늘리자 팬들이 ''치즈인호트랩'', ''응답하라 백길동 칸타빌레'' 등으로 비꼰 신조어를 만들었다.',
    '치즈인더트랩 원작 팬 커뮤니티 비판 여론', '원작 훼손 논란을 이야기할 때', '특정 배우·제작진 비판이 섞인 표현이라 상황에 따라 예민할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('번복진트 쇼미더산', '번복진트-쇼미더산', '{}', '쇼미더머니4 탈락자 판정 번복 논란을 비꼰 신조어', '쇼미더머니4(2015)에서 산이와 버벌진트가 블랙넛을 탈락시켰다가 판정을 번복한 사건을 두고 타블로 등이 ''번복진트 쇼미더산''이라 지칭하며 화제가 됐다.',
    'Mnet 쇼미더머니4 판정 번복 논란', '번복되는 결정이나 우유부단한 판단을 비꼴 때', '특정 인물을 저격하는 뉘앙스가 있어 당사자 앞에서는 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('셀럽파이브', '셀럽파이브', '{}', 'B급 정서로 인기를 끈 예능인 프로젝트 걸그룹', '송은이, 김신영, 신봉선, 안영미, 김영희 등 여성 예능인 5명이 자체적으로 결성한 프로젝트 댄스팀으로, 방송사 기획 없이 온라인에서 자생적으로 화제를 모았다.',
    '여성 코미디언들이 자체 결성한 프로젝트 그룹', '자발적인 B급 유머 콘텐츠를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나에게 투표하면 기쁘으리', '나에게-투표하면-기쁘으리', '{}', '무한도전 선택 2014 국민의원 후보의 병맛 슬로건', '무한도전 ''선택 2014'' 특집에서 국민의원 후보로 나온 출연자가 내세운 과장된 유세 슬로건으로, 황당한 어조 때문에 짤방으로 회자됐다.',
    'MBC 무한도전 선택 2014 특집', '과장된 약속이나 공약을 우스꽝스럽게 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('굳이 우리가 알아야 할 필요가 있을까요', '굳이-우리가-알아야-할-필요가-있을까요', '{}', '무한도전 선택 2014에서 유재석이 남긴 능청 대사', '무한도전 선택 2014 특집에서 유재석이 정치적으로 민감한 질문에 능청스럽게 던진 대사로, 상황을 회피하는 재치있는 화법으로 화제가 되며 짤방으로 자주 쓰였다.',
    'MBC 무한도전 선택 2014 발언', '곤란한 질문을 능청스럽게 피할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 짜게 먹지', '나는-짜게-먹지', '{}', '이국주가 무한도전에서 남긴 유행어', '개그우먼 이국주가 2014년 무한도전에 출연해 던진 유행어로, 특유의 리듬감 있는 말투 덕에 그해 대세 유행어 중 하나로 꼽혔다.',
    'MBC 무한도전 이국주 출연분(2014)', '짠 음식을 좋아한다고 너스레를 떨 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('언니쓰', '언니쓰', '{}', '언니들의 슬램덩크가 만든 프로젝트 걸그룹', 'SBS 언니들의 슬램덩크(2016)에서 방송국 기획으로 결성된 프로젝트 걸그룹으로, 개그우먼 김숙 등이 참여해 화제를 모으며 프로그램 최고 시청률을 이끌었다.',
    'SBS 언니들의 슬램덩크 프로젝트 그룹 기획', '예능발 프로젝트 그룹을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('리중딱', '리중딱', array['리버풀은 중위권이 딱이야','리중딱 노래']::text[], '''리버풀은 중위권이 딱이야''를 줄인 말로, BJ 감스트의 개사곡이 유행시킨 축구 밈', '2014년 3월 선덜랜드 감독 거스 포옛이 ''수아레스가 없으면 리버풀은 중위권에 있을 것''이라 한 발언이 ''리중딱''으로 줄어 퍼졌다. 맨유 팬으로 알려진 BJ 감스트가 가수 송대관의 ''유행가''를 ''리중딱 리중딱 신나는 노래''로 개사해 부르면서 디시인사이드 등 커뮤니티를 통해 폭발적으로 확산됐다.',
    '2014년 거스 포옛 감독 발언에서 파생, BJ 감스트가 개사곡으로 만들어 확산시킴', '축구·BJ 문화 이야기할 때 배경 설명과 함께 사용', '특정 축구팀을 비하하는 의미가 있어 리버풀 팬 앞에서 쓰면 실례가 될 수 있음. 감스트 본인도 2018년 공식 사과함',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2014, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('씨스타 터치마이바디 애플힙춤', '씨스타-터치마이바디-애플힙춤', array['애플힙춤','터치마이바디 안무']::text[], '씨스타 ''Touch My Body''의 쉬운 포인트 안무가 낳은 패러디 열풍', '2014년 7월 발매된 씨스타의 ''Touch My Body'' 포인트 안무 일명 ''애플힙춤''은 누구나 쉽게 따라 할 수 있는 동작으로 각종 커버·패러디 영상을 낳았다. 옛 애니메이션 ''날아라 슈퍼보드''의 저팔계춤과 닮았다는 반응이 나오며 화제성이 배가됐고, 그해 빌보드 선정 K팝 톱10에 오르기도 했다.',
    '2014년 7월 씨스타 ''Touch My Body'' 안무 공개', '2014년 케이팝 안무 유행을 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('별그대 치맥 신드롬', '별그대-치맥-신드롬', array['천송이 치맥','치맥 신드롬']::text[], '''별에서 온 그대'' 천송이의 치맥 사랑이 중국까지 강타한 신드롬', '2013~2014년 방영된 SBS ''별에서 온 그대''에서 전지현이 연기한 천송이가 ''눈 오는 날엔 치맥이지''라고 말하는 장면이 화제가 되며 중국에서 치킨집 매출이 폭증하고 상하이에서 3시간씩 줄을 서는 등 사회현상으로 번졌다. 드라마 종영 후에도 ''치맥''이라는 말 자체가 하나의 한류 문화 코드로 굳어졌다.',
    '2014년 SBS 드라마 ''별에서 온 그대'' 천송이(전지현) 대사 장면, 중국 내 반응으로 확산', '한류 확산·치맥 문화를 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신서유기 ''끝!''', '신서유기-끝!', array['나영석 끝 멘트','신서유기 엔딩']::text[], '신서유기에서 나영석 PD가 매회 급작스레 외치는 마무리 멘트', '2015년 tvN·네이버TV캐스트 웹예능 ''신서유기''에서 나영석 PD가 편집상 갑작스레 ''끝!''을 외치며 회차를 마무리하는 연출이 하나의 시그니처 개그로 자리잡았다. 강호동·이수근 등 출연진의 케미와 함께 이후 시즌을 거듭하며 수많은 밈을 양산한 프로그램으로 평가받는다.',
    '2015년 9월 tvN·네이버TV캐스트 ''신서유기'' 시즌1 연출 방식에서 시작', '예능 편집 개그 사례로 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스윙스 우사인 볼트 어록', '스윙스-우사인-볼트-어록', array['끝까지 갔기 때문이에요','스윙스 축제 영상 밈']::text[], '스윙스의 대학 축제 발언 영상이 뒤늦게 발굴돼 퍼진 밈', '래퍼 스윙스가 한 대학 축제 무대에서 ''우사인 볼트가 왜 세상에서 가장 빠른지 알아요? 끝까지 갔기 때문이에요''라고 말한 영상이 뒤늦게 온라인 커뮤니티에 발굴되면서 특유의 말투 자체가 패러디 밈으로 굳어졌다. 쇼미더머니 출연 등으로 인지도가 높아진 시점과 맞물려 확산됐다.',
    '과거 대학 축제 강연 영상이 2015년 무렵 온라인 커뮤니티에서 재조명되며 확산', '힙합 커뮤니티 드립으로 사용, 당사자 앞에서는 주의', '당사자를 희화화하는 성격이 있어 놀림조로 소비될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('썸(썸타다)', '썸(썸타다)', array['썸타다','썸남썸녀']::text[], '사귀기 전 애매한 관계를 뜻하는 말이 노래 히트로 전국민화된 신조어', '영어 ''something''에서 온 ''썸''은 2011년 무렵부터 온라인에서 쓰이던 말이었으나, 2014년 2월 소유·정기고의 노래 ''썸''이 크게 히트하면서 ''썸타다''라는 표현이 전 국민적으로 퍼졌다. 이후 케이윌·마마무의 ''썸남썸녀'' 등 같은 소재의 후속곡들이 잇따라 나오며 유행어로 굳어졌다.',
    '2011년경 온라인에서 쓰이기 시작, 2014년 소유·정기고 ''썸'' 히트로 대중화', '연애 초기 애매한 관계를 가볍게 표현할 때 지금도 널리 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('방탄소년단 ''쩔어''', '방탄소년단-쩔어', array['쩔어 리액션 챌린지','화양연화 쩔어']::text[], '방탄소년단 초기 히트곡, 리액션 비디오 유행과 맞물려 해외까지 퍼진 곡', '2015년 4월 발매된 방탄소년단 ''화양연화 pt.1''의 수록곡 ''쩔어''는 완벽한 칼군무와 임팩트 있는 뮤직비디오로 화제를 모았다. 당시 유튜브에서 유행하던 ''리액션 비디오'' 문화에 힘입어 해외 팬들 사이에서도 입소문을 타며 이후 학교 축제 등에서 커버댄스로 자주 소비됐다.',
    '2015년 4월 29일 방탄소년단 미니 3집 ''화양연화 pt.1'' 수록곡 뮤직비디오', '방탄소년단 초기 인기 계기를 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('방탄소년단 ''불타오르네'' 333 센터씬', '방탄소년단-불타오르네-333-센터씬', array['전설의 333','불타오르네 센터']::text[], '불타오르네 뮤직비디오 3분 33초 지민 센터 안무가 낳은 ''333'' 밈', '2016년 5월 발매된 방탄소년단 ''불타오르네'' 뮤직비디오에서 3분 33초경 멤버 지민이 센터에서 선보인 파워풀한 군무 장면이 큰 임팩트를 남기며 ''전설의 333''이라는 별명으로 팬덤 사이에서 두고두고 회자됐다.',
    '2016년 5월 2일 방탄소년단 ''화양연화 Young Forever'' 타이틀곡 ''불타오르네'' 뮤직비디오', '방탄소년단 안무 명장면을 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아이오아이 ''너무너무너무''', '아이오아이-너무너무너무', array['너무너무너무','I.O.I Very Very Very']::text[], '프로듀스101 출신 프로젝트 걸그룹 아이오아이의 대표 히트곡', '프로듀스101을 통해 결성된 11인조 프로젝트 걸그룹 아이오아이가 2016년 10월 발표한 ''너무너무너무''는 짧은 활동 기간에도 불구하고 그해 가온·멜론 연간 차트에 오르며 국민적 사랑을 받았다. 프로듀스101에서 쌓인 서사와 팬덤이 그대로 화제성으로 이어진 대표 사례로 꼽힌다.',
    '2016년 10월 17일 아이오아이 컴백 타이틀곡 ''너무너무너무'' 뮤직비디오 공개', '2016년 걸그룹 신드롬 사례로 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=GdxvD7r58ng', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'GdxvD7r58ng', 'https://www.youtube.com/watch?v=GdxvD7r58ng', true from memes where slug = '아이오아이-너무너무너무'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마마무 ''Mr.애매모호'' 데뷔 신드롬', '마마무-Mr.애매모호-데뷔-신드롬', array['마마무 데뷔','Mr.애매모호']::text[], '신인답지 않은 실력으로 SNS에서 화제가 된 마마무의 데뷔 무대', '2014년 6월 19일 미니앨범 ''Hello''의 타이틀곡 ''Mr.애매모호''로 데뷔한 마마무는 무대 매너와 가창력이 신인 같지 않다는 반응을 얻으며 데뷔 직후 활동 영상이 페이스북 등 SNS에서 크게 화제가 됐다. 이 화제성 덕에 대학 축제·군부대 행사 등으로 러브콜이 쇄도했다.',
    '2014년 6월 19일 마마무 데뷔 타이틀곡 ''Mr.애매모호'' 무대 영상', '실력파 신인의 이례적인 데뷔 반응 사례로 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('옥빙구(옥택연) 삼시세끼', '옥빙구(옥택연)-삼시세끼', array['옥빙구','옥택연 별명']::text[], '망가지는 애교 캐릭터로 재발굴된 옥택연의 삼시세끼 별명', '2015년 tvN ''삼시세끼''에 출연한 옥택연은 특유의 망가지는 성격과 애교 많은 모습으로 다시 주목받으며 ''옥빙구''라는 별명을 얻었다. 특이한 성씨 ''옥''에 빗댄 여러 별명 중 하나로, 이 프로그램을 계기로 대중적으로 굳어졌다.',
    '2015년 tvN ''삼시세끼'' 방영 중 재조명된 캐릭터에서 정착한 별명', '망가지는 애교 캐릭터를 가리킬 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펭수', '펭수', array['펭수부장','자이언트 펭TV']::text[], 'EBS가 만든 자이언트 펭귄 캐릭터, 직급 파괴 개그로 인기', 'EBS 연습생 콘셉트의 남극에서 온 펭귄 캐릭터로, 상사인 EBS 사장 이름을 거리낌 없이 부르는 등 권위를 깨는 개그로 2019년 하반기 폭발적 인기를 얻었다. 유튜브 ''자이언트 펭TV''를 통해 급속도로 확산되며 ''10년에 한 번 나올까 말까 한 캐릭터''로 불렸다.',
    'EBS 유튜브 채널 ''자이언트 펭TV''에서 2019년 첫 공개', '지금도 통용되는 친근한 캐릭터 레퍼런스로 무난하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('워크맨', '워크맨', array['Workman','장성규 워크맨']::text[], '장성규가 각종 알바를 체험하는 웹예능, 선 넘는 드립으로 인기', 'JTBC 디지털스튜디오(현 스튜디오 룰루랄라)가 제작한 웹 예능으로, 아나운서 출신 장성규가 다양한 아르바이트 현장을 체험하며 거침없는 드립을 치는 콘셉트로 화제가 됐다. 2019년 첫 공개 이후 유튜브 조회수가 폭발적으로 증가하며 신흥 웹예능 강자로 자리잡았다.',
    '2019년 JTBC 디지털 스튜디오가 유튜브에 공개', '아르바이트/직장 체험 콘텐츠나 예능 드립 레퍼런스로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%9B%8C%ED%81%AC%EB%A7%A8(%EC%9B%B9%EC%98%88%EB%8A%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('와썹맨', '와썹맨', array['와썹맨TV','박준형 와썹맨']::text[], '박준형이 진행하는 JYP 유튜브 웹예능, 능청스러운 개그로 인기', 'JYP엔터테인먼트가 2018년 시작한 유튜브 웹예능으로, god 멤버 박준형이 다양한 장소를 찾아가며 특유의 능청스러운 개그를 선보였다. 워크맨과 함께 2018~2019년 웹예능 붐을 이끈 대표작으로 꼽힌다.',
    '2018년 JYP엔터테인먼트 유튜브 채널에서 시작', '유쾌한 아저씨 개그 레퍼런스로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
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
  values ('보이루', '보이루', array['보겸 보이루']::text[], 'BJ보겸의 인사말(보겸+하이루), 이후 여성혐오 논란으로 번짐', '아프리카TV BJ 보겸이 방송 시작 시 손가락 경례와 함께 외치는 고유 인사말로 ''보겸''과 ''하이루''의 합성어다. 2018년 3월 일부에서 ''보지+하이루''라는 여성혐오 표현으로 왜곡 해석하며 큰 논란이 됐고 법정 공방으로까지 이어졌다.',
    'BJ보겸이 방송 오프닝 인사말로 사용하며 유행, 2018년 논란 확산', '아카이브 목적 외 실사용 비추천, 맥락 설명 없이 쓰면 오해 소지', '여성혐오 논란과 명예훼손 소송까지 간 사안이라 무심코 쓰면 곤란해질 수 있음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%B3%B4%EC%9D%B4%EB%A3%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박막례 할머니', '박막례-할머니', array['Korea Grandma','박막례이대로죽을수없다']::text[], '손녀와 함께 찍은 여행 브이로그로 스타가 된 시니어 유튜버', '치매 예방을 위해 손녀 김유라 PD와 함께 영상을 찍기 시작한 박막례 할머니는 욕설 섞인 솔직한 입담과 호주·일본 여행기로 화제를 모았다. 2019년 구독자 100만 명을 돌파하며 시니어 유튜브 크리에이터의 대표주자가 됐다.',
    '2017년경 손녀 김유라와 함께 유튜브 시작, 2019년 급성장', '시니어 유튜버·세대공감 콘텐츠 언급 시 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%B0%95%EB%A7%89%EB%A1%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('흔한남매', '흔한남매', array['에이미','으뜸이']::text[], '웃찾사 출신 개그맨들이 만든 남매 시트콤 유튜브 채널', 'SBS 공채 코미디언 장다운과 한으뜸이 개그 코너를 바탕으로 만든 남매 콘셉트 시트콤 채널로 2018년 개설 이후 아동층에서 폭발적 인기를 끌었다. 과장된 남매 다툼 상황극이 특징이다.',
    '2018년 유튜브 채널 개설, 웃찾사 코너 ''흔한남매''가 원형', '어린이 콘텐츠·남매 개그 레퍼런스로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%ED%9D%94%ED%95%9C%EB%82%A8%EB%A7%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마이린TV', '마이린TV', array['마이린','최린']::text[], '초등학생 출신 최초로 구독자 100만을 달성한 키즈 크리에이터', '2006년생 최린이 초등학생 때부터 운영한 채널로, 장난감 리뷰와 또래 유튜버 인터뷰 등을 다루다 2019년 11월 구독자 100만 명을 돌파하며 ''초등학생 출신 첫 100만 유튜버'' 타이틀을 얻었다.',
    '2015년 채널 개설, 2019년 100만 구독자 돌파로 화제', '키즈 크리에이터 성공사례 언급 시 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%A7%88%EC%9D%B4%EB%A6%B0%20TV', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쯔양', '쯔양', array['Tzuyang']::text[], '엄청난 대식량 먹방으로 2019년 급성장한 먹방 유튜버', '2018년 11월 채널을 개설한 쯔양은 일반인 대비 몇 배에 달하는 식사량을 먹는 먹방으로 입소문을 타 2019년 상반기에만 구독자 100만 명을 돌파하며 급성장했다.',
    '2018년 11월 유튜브 채널 개설, 2019년 폭발적 성장', '먹방 유튜버 레퍼런스로 무난히 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%AF%94%EC%96%91', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잇섭', '잇섭', array['ITSub','황용섭']::text[], '통신·IT 리뷰로 유명해진 테크 유튜버', '2016년 대학 휴학 후 유튜브를 시작한 잇섭은 통신사 요금제, 스마트폰 리뷰 등 IT 콘텐츠로 입지를 다졌고 2019년 골드버튼(구독자 100만)을 받으며 대표 테크 유튜버로 자리잡았다.',
    '2016년 유튜브 채널 개설, 2019년 골드버튼 달성', 'IT 유튜버·리뷰 콘텐츠 레퍼런스로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%9E%87%EC%84%AD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('불닭볶음면 챌린지', '불닭볶음면-챌린지', array['Fire Noodle Challenge','영국남자 불닭챌린지']::text[], '영국남자 채널에서 확산된 매운 불닭볶음면 먹기 챌린지', '유튜브 채널 ''영국남자''가 외국인들에게 불닭볶음면을 먹이는 콘텐츠를 올리며 시작된 챌린지로, 해외 유튜버들이 따라 하며 전 세계적으로 확산됐다. K-푸드 열풍과 매운맛 챌린지 붐의 시초로 꼽힌다.',
    '2016~2017년 유튜브 채널 ''영국남자''에서 시작해 해외로 확산', '매운맛 챌린지·K-푸드 소개 콘텐츠에서 언급 가능', '과도한 매운맛 챌린지는 건강에 해로울 수 있어 안전 유의 문구 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EB%B6%88%EB%8B%AD%EB%B3%B6%EC%9D%8C%EB%A9%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아기상어(베이비샤크)', '아기상어(베이비샤크)', array['Baby Shark','핑크퐁 상어가족']::text[], '핑크퐁 동요가 세계적으로 히트해 빌보드 차트까지 진입', '스마트스터디의 ''핑크퐁 아기상어 체조'' 영상이 2018년부터 동남아를 거쳐 북미·유럽까지 확산되며 세계적 밈이 됐다. 2019년 1월 빌보드 핫100 32위에 오르며 한국 동요 최초로 빌보드에 진입했다.',
    '2015년 핑크퐁이 제작, 2018년 유튜브를 통해 세계적으로 확산', '중독성 있는 콘텐츠·키즈 콘텐츠 성공사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EC%83%81%EC%96%B4%20%EA%B0%80%EC%A1%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('JMT(존맛탱)', 'JMT(존맛탱)', array['존맛탱','존맛']::text[], '''엄청 맛있다''를 뜻하는 2018년 대표 먹방 신조어', '''존X 맛있다''를 줄인 ''존맛탱''의 초성을 딴 표현으로, 먹방 콘텐츠와 함께 폭발적으로 쓰였다. 2018년 신조어 언급량 1위를 차지할 만큼 대중화됐다.',
    '2018년 온라인 커뮤니티·먹방 콘텐츠에서 확산', '맛있는 음식 콘텐츠에서 가볍게 사용', '격식 있는 자리나 어린 학생 대상 글에는 순화 표현 권장',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://sports.khan.co.kr/article/201812281745003', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('팩폭(팩트폭력)', '팩폭(팩트폭력)', array['팩트폭행']::text[], '반박할 수 없는 사실로 상대에게 정신적 타격을 주는 것', '''팩트''와 ''폭력''을 합친 말로, 부정할 수 없는 사실을 지적해 상대에게 심리적 타격을 주는 행위를 뜻한다. 디시인사이드 등 커뮤니티에서 쓰이다 2017~2018년 널리 대중화됐다.',
    '디시인사이드 등 온라인 커뮤니티에서 시작, 2017년 대중화', '뼈 때리는 지적을 유머러스하게 표현할 때 사용', '상대에게 직접 쓰면 공격적으로 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%8C%A9%ED%8A%B8%ED%8F%AD%EB%A0%A5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오지고 지리고 렛잇고', '오지고-지리고-렛잇고', array['오지고 지리고']::text[], '''엄청 대단하다''는 뜻의 급식체 유행어', '급식체(청소년 은어) 표현으로 ''오지다'', ''지리다''에 디즈니 ''겨울왕국'' 노래 제목 ''렛잇고''를 라임 삼아 붙인 유행어다. 2017년 하반기 SNL코리아 등 방송에서 다뤄지며 널리 퍼졌다.',
    '청소년 온라인 커뮤니티에서 시작, 2017년 방송을 통해 확산', '세대 개그·복고 드립으로만 가볍게 사용(지금은 이미 옛날 유행어 취급)', '이미 유행이 지나 지금 쓰면 ''아재'' 느낌을 줄 수 있음',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://www.busan.com/view/busan/view.php?code=20171114000331', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사이다(전개)', '사이다(전개)', array['사이다 전개']::text[], '답답함 없이 시원하게 풀리는 이야기 전개를 뜻하는 표현', '탄산음료 사이다를 마신 것처럼 시원하고 통쾌하다는 뜻으로, 드라마·예능에서 갈등이 막힘없이 시청자가 원하는 대로 풀릴 때 쓰는 표현이다. 2017년 전후로 언론·정치 기사에서도 광범위하게 쓰이며 유행어로 자리잡았다.',
    '온라인 서브컬처 커뮤니티에서 시작, 2017년 대중매체로 확산', '드라마·예능 전개를 평가할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%82%AC%EC%9D%B4%EB%8B%A4(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고구마(전개)', '고구마(전개)', array['고구마 전개']::text[], '답답하게 막힌 이야기 전개를 뜻하는 ''사이다''의 반대말', '고구마를 먹으면 목이 막히듯, 이야기 전개가 느리고 답답할 때 쓰는 표현이다. ''사이다''와 짝을 이뤄 2017년 전후로 드라마·예능 평가 용어로 대중화됐다.',
    '온라인 서브컬처 커뮤니티에서 시작, 2017년 대중매체로 확산', '답답한 전개를 평가할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B3%A0%EA%B5%AC%EB%A7%88(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('~각', '~각', array['각 나온다','밤샐 각']::text[], '''~할 것 같은 상황''을 뜻하는 2018년 신조어', '게임 리그오브레전드에서 ''킬 각''처럼 가능성·상황을 뜻하던 표현이 일반화되어, ''혼날 각'', ''밤샐 각''처럼 어떤 일이 벌어질 것 같은 상황을 나타내는 말로 2018년 20대 사이에서 크게 유행했다.',
    '게임 커뮤니티 용어에서 파생, 2018년 대학생·20대 사이 대중화', '어떤 상황이 벌어질 것 같을 때 가볍게 붙여 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국민프로듀서(국프)', '국민프로듀서(국프)', array['국프','국민 프로듀서']::text[], 'Mnet ''프로듀스101''에서 시청자를 지칭하던 호칭', '아이돌 연습생의 데뷔 여부를 투표로 결정하는 시청자를 ''국민 프로듀서''로 부르며, 시즌2(2017)의 ''나야나'' 신드롬과 함께 팬덤 문화의 상징적 용어가 됐다. 이후 2019년 투표 조작 사건으로 큰 논란을 빚기도 했다.',
    '2016년 프로듀스101 시즌1에서 시작, 2017년 시즌2로 대중화', '팬덤 문화·오디션 프로그램 언급 시 사용', '2019년 투표 조작 사건 이후 씁쓸한 뉘앙스로 쓰이기도 함',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%94%84%EB%A1%9C%EB%93%80%EC%8A%A4%20101%20%EC%8B%9C%EC%A6%8C2', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나야나(PRODUCE 101 시즌2)', '나야나(PRODUCE-101-시즌2)', array['Nayana','워너원 나야나']::text[], '프로듀스101 시즌2의 중독성 강한 타이틀곡이자 팬덤 신드롬', '2017년 방영된 프로듀스101 시즌2의 콘셉트곡으로, 중독성 있는 후렴구와 안무로 큰 인기를 끌며 워너원 데뷔로 이어졌다. 전작 ''픽미''의 계보를 잇는 오디션 프로그램 대표곡으로 꼽힌다.',
    '2017년 Mnet ''프로듀스101 시즌2''에서 공개', '오디션 프로그램·아이돌 팬덤 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%94%84%EB%A1%9C%EB%93%80%EC%8A%A4%20101%20%EC%8B%9C%EC%A6%8C2', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국뽕 유튜버', '국뽕-유튜버', array['국뽕 콘텐츠']::text[], '한국을 극찬하는 외국인 콘텐츠로 인기를 끄는 유튜브 장르', '''국가''와 ''히로뽕''의 합성어인 ''국뽕''에서 파생된 말로, 외국인 유튜버가 한국 문화·기술을 극찬하며 조회수를 올리는 콘텐츠 장르를 가리킨다. 한류 확산과 맞물려 2017~2019년 유튜브에서 하나의 장르로 자리잡았다.',
    '2010년대 초 커뮤니티 용어에서 파생, 2017년경 유튜브 장르로 정착', '한류 콘텐츠 장르를 설명할 때 중립적으로 사용', '과도한 자국 자랑이나 국수주의로 비칠 경우 비꼬는 뜻으로도 쓰임',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/%EA%B5%AD%EB%BD%95%20%EC%9C%A0%ED%8A%9C%EB%B2%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('커엽다', '커엽다', array['커엽','야민정음 귀엽다']::text[], '''귀엽다''를 야민정음 방식으로 바꿔 쓴 신조어', '자음·모음 모양이 비슷한 글자를 바꿔 쓰는 ''야민정음'' 놀이에서 나온 말로 ''귀''를 모양이 비슷한 ''커''로 바꿔 쓴 것이다. 2018년 언론에서 한글파괴 우려와 함께 소개될 만큼 널리 퍼졌다.',
    '야구 갤러리 등에서 시작된 야민정음 놀이에서 파생, 2018년 대중화', '귀여운 것을 가리킬 때 장난스럽게 사용', '정식 맞춤법이 아니므로 공식 문서에는 부적절',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://news.sbs.co.kr/news/endPage.do?news_id=N1004964512', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나야나 (국민 프로듀서)', '나야나-(국민-프로듀서)', array['국프님','Pick Me','픽미픽미']::text[], '프로듀스101 시즌2 테마곡 후렴과 시청자를 부르는 ''국민 프로듀서'' 호칭', '2017년 Mnet ''프로듀스101 시즌2'' 테마곡 ''나야나(Pick Me)''의 후렴구가 그해 유행어가 되었고, 프로그램은 시청자를 ''국민 프로듀서''라 부르며 문자·온라인 투표로 데뷔조를 결정하는 포맷으로 신드롬을 일으켰다. 연습생들이 스스로 자신 관련 밈을 활용해 어필한 것도 화제였다.',
    'Mnet ''프로듀스101 시즌2'' (2017.4~6) 테마곡 및 프로그램 포맷', '2017년 아이돌 서바이벌 붐을 이야기할 때 인용', '이후 투표 조작 사건으로 프로그램 이미지가 훼손됐으니 단순 추억 언급 용도로만 사용 권장',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/프로듀스 101 시즌2', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('제이플라(J.Fla) 커버 신드롬', '제이플라(J.Fla)-커버-신드롬', array['J.Fla','커버곡 여신']::text[], '팝송 커버 영상으로 한국 개인 유튜버 최초 글로벌 스타가 된 현상', '유튜버 제이플라(김정화)가 2017년 ''Shape of You'' 등 팝송 커버 영상으로 급성장해 그해 11월 한국 개인 유튜버 구독자 1위에 올랐다. 2018년에는 한국 개인 유튜버 최초로 1000만 구독자를 달성하며 ''커버곡 유튜버'' 붐을 상징하는 인물이 되었다.',
    '유튜브 채널 J.Fla, 2017년 팝송 커버 영상 다수 히트', '커버 문화·유튜버 성공 사례를 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/J.Fla', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이병재 탓', '이병재-탓', array['고등래퍼2 탓 무대','빈첸 탓 무대']::text[], '고등래퍼2에서 이병재(빈첸)가 부른 자작곡 ''탓'' 무대가 실검을 휩쓴 사건', '2017년 Mnet ''고등래퍼2''에서 참가자 이병재(현 빈첸)가 선보인 자작곡 ''탓'' 무대가 큰 화제를 모아 방영 당일 네이버 실시간 검색어 상위권에 ''이병재''와 ''이병재 탓''이 동시에 오르는 이례적인 반응을 일으켰다.',
    'Mnet ''고등래퍼2''(2017) 이병재(빈첸) 자작곡 무대', '국힙 서바이벌 프로그램의 명장면을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'video'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/고등래퍼 2', 'embeddable'::copyright_status from ins where true;

commit;
