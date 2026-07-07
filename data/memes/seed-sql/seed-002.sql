-- 밈캐치 시드 배치 2 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('생활의 발견 ''여기서 이러시면 안됩니다''', '생활의-발견-여기서-이러시면-안됩니다', array['김기리 명대사','여기서 이러시면']::text[], '진지한 상황에 끼어드는 종업원 역 김기리의 개콘 유행어', '개그콘서트 ''생활의 발견'' 코너에서 송준근·신보라가 심각한 이별 이야기를 나눌 때 식당 종업원 역의 김기리가 본분에 충실하며 끼어들어 던진 대사. 2012년 무렵 큰 인기를 끌며 유행어가 됐다.',
    '2012년 KBS 개그콘서트 ''생활의 발견'' 코너, 김기리', '진지한 대화에 뜬금없이 끼어들 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%83%9D%ED%99%9C%EC%9D%98%20%EB%B0%9C%EA%B2%AC(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 못친소 페스티벌', '무한도전-못친소-페스티벌', array['못친소','못생긴 친구를 소개합니다']::text[], '외모 콤플렉스 스타들이 자신감을 뽐낸 무한도전 특집', '2012년 11월 방영된 무한도전 ''못친소(못생긴 친구를 소개합니다) 페스티벌'' 특집. 스스로 외모가 뛰어나지 않다고 여겨지는 배우·가수들을 초청해 당당한 매력을 보여주며 외모지상주의를 유쾌하게 비틀었다는 평가를 받았다.',
    '2012년 11월 MBC ''무한도전'' 특집', '자기 외모를 유쾌하게 셀프 디스할 때', '코너명 자체가 외모 비하성 표현이라 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84%20%EB%AA%BB%C2%B7%EC%B9%9C%C2%B7%EC%86%8C%20%ED%8E%98%EC%8A%A4%ED%8B%B0%EB%B2%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('형돈이와 대준이 (자유로 가요제 형용돈죵)', '형돈이와-대준이-(자유로-가요제-형용돈죵)', array['형용돈죵','정형돈 지드래곤 듀오']::text[], '무한도전 가요제에서 결성된 정형돈-디피컴 합작 유닛', '2011년 무한도전 가요제를 계기로 정형돈과 래퍼 디피컴(defconn)이 결성한 힙합 듀오. 이후에도 정규 앨범을 내며 활동을 이어갔고, 2013년 자유로 가요제에서는 정형돈이 지드래곤과 ''형용돈죵'' 팀을 이뤄 베스트커플상을 받는 등 무한도전 가요제 시리즈의 대표적 밈이 됐다.',
    '2011년 MBC ''무한도전'' 가요제 특집', '의외의 케미 조합을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%98%95%EB%8F%88%EC%9D%B4%EC%99%80%20%EB%8C%80%EC%A4%80%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('슈퍼스타K3 울랄라세션 우승', '슈퍼스타K3-울랄라세션-우승', array['울랄라세션','임윤택 신드롬']::text[], '버스커버스커를 꺾고 우승한 2011년 퍼포먼스 그룹', '2011년 11월 ''Mnet 슈퍼스타K3'' 결승에서 임윤택·박승일·김명훈·박광선으로 구성된 울랄라세션이 버스커버스커를 꺾고 우승했다. 이후 리더 임윤택이 암 투병 끝에 2013년 별세하며 큰 안타까움과 함께 재조명됐다.',
    '2011년 11월 Mnet ''슈퍼스타K3'' 결승전', '뜻밖의 이변 우승 사례를 말할 때', '임윤택 별세 관련 언급 시 예의를 갖출 것',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9A%B8%EB%9E%84%EB%9D%BC%EC%84%B8%EC%85%98', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('정글의 법칙 ''병만족''', '정글의-법칙-병만족', array['병만족','부족장 김병만']::text[], '김병만이 이끄는 오지 생존 예능의 ''부족'' 콘셉트', '2011년 10월 시작한 SBS ''김병만의 정글의 법칙''에서 오지에 파견된 출연진을 ''병만족''이라 부르고 김병만을 ''부족장''으로 칭하며 화제를 모았다. 큰 인기를 끌며 장수 예능으로 자리잡았다.',
    '2011년 10월 SBS ''김병만의 정글의 법칙''', '생존·야외 상황을 재밌게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('삼둥이 ''대한민국만세''', '삼둥이-대한민국만세', array['대한 민국 만세','송일국 삼둥이']::text[], '송일국 세쌍둥이 등장으로 재조명된 예능 신드롬', '2014년 7월 KBS ''슈퍼맨이 돌아왔다''에 송일국의 세쌍둥이 대한·민국·만세가 출연하며 프로그램 2차 전성기를 이끌었다. 테마곡 가사 속 ''대한민국만세''라는 표현이 큰 인기를 끌며 삼둥이의 상징이 됐다.',
    '2014년 7월 KBS ''슈퍼맨이 돌아왔다''', '귀여운 아이들 등장을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%BC%EB%91%A5%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('개그콘서트 ''감사합니다''', '개그콘서트-감사합니다', array['감사합니다 코너','정태호 감사합니다']::text[], '어떤 상황도 긍정으로 반전시키는 개콘 노래 코너', '정태호·송병철·이상훈 등이 출연한 개그콘서트 코너로, 따라 부르기 쉬운 멜로디와 ''감사합니다''로 상황을 반전시키는 긍정적 가사가 특징이었다. 2010년 무렵 방영되며 아이들에게도 큰 인기를 끌었다.',
    '2010년 KBS 개그콘서트 ''감사합니다'' 코너', '안 좋은 상황을 억지 긍정으로 넘길 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%90%EC%82%AC%ED%95%A9%EB%8B%88%EB%8B%A4(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 ''명수는 12살''', '무한도전-명수는-12살', array['명수는 12살','박명수 어린시절 특집']::text[], '박명수의 유년 시절을 재현한 무한도전 레전드 특집', '2011년 12월 방영된 무한도전 특집으로, 단체 놀이에 서툴렀던 박명수를 위해 멤버들이 1980년대 12살 국민학생으로 분해 그 시절 놀이를 재현했다. 무한도전 10주년 특집 투표에서 역대 최고의 특집 3위에 오를 정도로 명작으로 꼽힌다.',
    '2011년 12월 MBC ''무한도전'' 278~279회', '옛 추억이나 순수했던 시절을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%AA%85%EC%88%98%EB%8A%94%2012%EC%82%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아빠 어디가 윤후 짜파구리', '아빠-어디가-윤후-짜파구리', array['윤후 짜파구리','사랑입니다']::text[], '어린이 출연자 윤후로 화제가 된 2013년 육아 예능', '2013년 MBC ''아빠 어디가''에 출연한 윤후가 짜파구리를 맛있게 먹는 모습으로 큰 인기를 끌며 관련 광고까지 찍었다. 아이들의 순수한 말과 행동이 그대로 유행어처럼 회자되며 프로그램은 그해 MBC 연예대상을 수상했다.',
    '2013년 MBC ''아빠 어디가''', '아이의 순수하고 귀여운 모습을 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%84%EB%B9%A0!%20%EC%96%B4%EB%94%94%EA%B0%80%3F', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('박명수 어록', '박명수-어록', array['명언 제조기','일찍 일어나는 새가 피곤하다']::text[], '기존 격언을 뒤집은 박명수식 반전 명언 모음', '무한도전에서 박명수가 남긴 ''일찍 일어나는 새가 피곤하다'', ''참을 인이 세 번이면 호구 된다'' 등 기존 격언을 뒤집은 어록들이 2010년대 초중반부터 인터넷상에서 짤방으로 크게 유행했다.',
    'MBC ''무한도전'' 방송 속 박명수 발언 모음', '교훈적인 말을 유쾌하게 비틀 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%B0%95%EB%AA%85%EC%88%98/%ED%8A%B9%EC%A7%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('런닝맨 월요커플', '런닝맨-월요커플', array['개리 송지효 커플','월요커플']::text[], '개리와 송지효의 케미로 탄생한 런닝맨 커플 밈', '런닝맨 초반 술래였던 개리가 수비조 송지효를 봐주는 대신 전화번호를 받은 에피소드에서 시작돼 두 사람의 케미가 ''월요커플''로 불리며 2011년 큰 인기를 끌었다. 멤버들이 질투하는 모습까지 웃음 포인트가 됐다.',
    '2010~2011년 SBS ''런닝맨''', '케미 좋은 짝을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%86%A1%EC%A7%80%ED%9A%A8/%EB%9F%B0%EB%8B%9D%EB%A7%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나 혼자 산다 시작', '나-혼자-산다-시작', array['나혼산','남자가 혼자 살 때']::text[], '1인 가구 트렌드를 다룬 예능의 시작', '2013년 2월 ''남자가 혼자 살 때''라는 제목의 파일럿으로 시작해 3월 정규 편성되며 ''나 혼자 산다''가 됐다. 1인 가구 증가라는 사회적 흐름과 맞물려 트렌드 예능으로 호평받으며 장수 프로그램의 발판을 마련했다.',
    '2013년 MBC 파일럿·정규 예능 시작', '1인 가구 생활을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%82%98%20%ED%98%BC%EC%9E%90%20%EC%82%B0%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('코리아갓탤런트 최성봉', '코리아갓탤런트-최성봉', array['최성봉 넬라판타지아','고아 성악가']::text[], '보육원 출신 노점상의 반전 성악 실력으로 화제가 된 오디션', '2011년 ''코리아 갓 탤런트'' 시즌1에서 껌과 에너지드링크를 팔며 생계를 유지하던 최성봉이 ''넬라 판타지아''를 열창해 큰 화제를 모았다. 그의 사연이 유튜브를 통해 CNN 등 해외 언론에도 소개되며 세계적으로 알려졌다.',
    '2011년 tvN ''코리아 갓 탤런트'' 시즌1', '반전 실력이나 감동 스토리를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%B5%9C%EC%84%B1%EB%B4%89', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('위대한 탄생 백청강', '위대한-탄생-백청강', array['연변 청년 백청강','위탄 우승']::text[], '연변 출신 무명 가수의 오디션 우승 신화', '2011년 MBC ''스타 오디션 위대한 탄생'' 시즌1에서 중국 옌볜 출신으로 밤무대를 전전하던 백청강이 최종 우승을 차지했다. 오디션 참가를 위해 36시간 기차를 탔다는 일화가 알려지며 화제를 모았다.',
    '2011년 MBC ''스타 오디션 위대한 탄생'' 시즌1', '밑바닥에서 이룬 성공 스토리를 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EB%B0%B1%EC%B2%AD%EA%B0%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('봉숭아학당 ''동혁이형''', '봉숭아학당-동혁이형', array['동혁이형','유세윤 동혁이형']::text[], '유세윤이 연기한 자칭 ''쿨한 형'' 캐릭터의 유행어', '개그콘서트 봉숭아학당 코너에서 유세윤이 연기한 ''동혁이형'' 캐릭터가 ''세상 그 누구보다 샤우팅을 사랑하는 쿨한 형''을 자처하며 남긴 대사들이 2012년 무렵 유행어가 됐다.',
    '2012년 KBS 개그콘서트 ''봉숭아학당'' 코너, 유세윤', '허세 섞인 자칭 ''쿨한 사람''을 놀릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://ko.wikipedia.org/wiki/%EB%B4%89%EC%88%AD%EC%95%84_%ED%95%99%EB%8B%B9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짝(SBS) 몇 호', '짝(SBS)-몇-호', array['애정촌','남자1호','여자1호','짝 애정촌']::text[], 'SBS 짝에서 실명 대신 번호로 부르던 방식이 유행어가 됨', '2011년 3월 방영을 시작한 SBS 리얼리티 프로그램 짝에서 출연자를 실명 대신 ''남자1호'', ''여자3호'' 등 번호로 부르는 애정촌 포맷이 화제가 됐다. 이 화법은 각종 커뮤니티와 예능에서 패러디됐고, 무한도전은 이를 ''우정촌''으로 바꿔 패러디하기도 했다.',
    'SBS 예능 짝(2011~2014) 애정촌 포맷에서 유래', '연애/소개팅 상황을 가볍게 패러디할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%A7%9D(SBS)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('보고 있나?', '보고-있나?', array['보고있나','무한도전 보고있나']::text[], '무한도전 조정특집에서 유래한 공개 섭외·저격용 유행어', '2011년 무한도전 조정특집에서 멤버 길이 배우 조인성을 조정 멤버로 영입하려고 트위터로 공개 섭외하며 퍼진 말이다. 이후 정형돈이 지드래곤을 향해 농담 삼아 사용하면서 크게 유행했다. 누군가를 지목해 우스갯소리로 도발하거나 어필할 때 쓰였다.',
    'MBC 무한도전 2011년 조정특집(멤버 길의 조인성 공개 섭외)', '과거 예능 회고 콘텐츠에서 인용', '현재는 거의 쓰이지 않는 옛날 유행어',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('행쇼', '행쇼', array['행복하십쇼']::text[], '지드래곤이 무한상사에서 쓴 인사말이 전 국민 유행어가 됨', '2012년 무한도전 무한상사 편에 권지용 사원으로 출연한 지드래곤이 ''행복하십쇼''를 줄인 ''행쇼''라는 인사말을 사용하면서 사회 전반으로 크게 유행했다. 방송·광고·일상 인사말로도 두루 쓰였다.',
    'MBC 무한도전 2012년 무한상사 특집, 지드래곤 출연분', '인사말 패러디로 쓸 수 있으나 지금은 옛말 취급', '유행이 끝난 지 오래된 표현',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맛있게 울어', '맛있게-울어', array['맛있게울어','정형돈 눈물']::text[], '박명수가 정형돈의 눈물 자료화면에 붙인 짤막한 드립', '2012년 10월 무한도전 300회 특집에서 봅슬레이 특집 당시 울던 정형돈의 옛 자료화면을 보며 박명수가 ''그냥 우는 게 아니라 맛있게 우네''라고 한 데서 나온 표현이다. 누군가 과장되게 우는 모습을 놀릴 때 짤과 함께 쓰였다.',
    'MBC 무한도전 2012년 300회 특집', '우는 모습을 짓궂게 놀릴 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 꼼수다 깔때기', '나는-꼼수다-깔때기', array['깔때기','쌍깔때기']::text[], '결국 자기 자랑으로 끝나는 화법을 비꼬던 팟캐스트 유행어', '2011년 시작한 정치 풍자 팟캐스트 나는 꼼수다에서 정봉주가 어떤 말을 하든 결국 자기 자랑으로 수렴시키는 화법을 두고 ''깔때기''라 불렀다. 이후 서로를 치켜세우며 결과적으로 자기도 치켜세우는 ''쌍깔때기'' 등 변형어도 생겼다.',
    '팟캐스트 나는 꼼수다(2011) 정봉주 발언', '자화자찬으로 흘러가는 대화를 놀릴 때 사용', '정치 팟캐스트 유래라 맥락에 따라 편향 논쟁 소지',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%82%98%EB%8A%94%20%EA%BC%BC%EC%88%98%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('애정남 애매합니다잉', '애정남-애매합니다잉', array['애매한 것을 정해주는 남자','애정남']::text[], '개그콘서트 애정남 코너의 애매한 기준 정리 유행어', '2011년 개그콘서트 코너 ''애매한 것을 정해주는 남자''(애정남)에서 최효종이 일상 속 애매한 기준을 코믹하게 정리해주며 ''애매~합니다잉'', ''~되는 거 어렵지 않아요'' 같은 어투가 유행했다. 애매한 상황을 정리할 때 패러디로 쓰였다.',
    'KBS 개그콘서트 애정남 코너(2011)', '애매한 기준을 웃기게 정리할 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%A0%EC%A0%95%EB%82%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여기서 이러시면 안됩니다', '여기서-이러시면-안됩니다', array['생활의 발견']::text[], '개그콘서트 생활의 발견에서 염장질 커플에 끼어들며 쓴 대사', '2011년 개그콘서트 코너 ''생활의 발견''에서 신보라·송준근 커플의 애정행각에 주변인이 끼어들며 ''여기서 이러시면 안 됩니다''라고 말하는 장면이 유행했다. 이후 공공장소에서 부적절한 행동을 지적하는 농담으로 널리 쓰였다.',
    'KBS 개그콘서트 생활의 발견 코너(2011)', '공공장소 애정행각을 장난스럽게 지적할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%83%9D%ED%99%9C%EC%9D%98%20%EB%B0%9C%EA%B2%AC(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('패션왕 웹툰 짤', '패션왕-웹툰-짤', array['패션왕','기안84 패션왕']::text[], '기안84의 병맛 웹툰 패션왕에서 파생된 합성 짤들', '기안84가 2011년 5월부터 네이버 웹툰에 연재한 패션왕은 어색한 전개와 특유의 병맛 그림체로 큰 화제를 모았다. 특정 장면과 대사가 캡처·합성되어 커뮤니티에서 짤방으로 널리 퍼졌다.',
    '네이버 웹툰 패션왕(기안84, 2011~2013 연재)', '병맛 전개나 어색한 장면을 놀릴 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://ko.wikipedia.org/wiki/%ED%8C%A8%EC%85%98%EC%99%95_(%EB%A7%8C%ED%99%94)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('노스페이스 등골브레이커', '노스페이스-등골브레이커', array['등골브레이커','등골 브레이커']::text[], '10대 사이 고가 노스페이스 패딩 유행을 비꼰 말', '2011년 무렵 중고생 사이에서 60만~80만원대 노스페이스 패딩이 교복처럼 유행하자, 부모의 등골이 휜다는 뜻으로 ''등골브레이커''라는 말이 생겼다. 과시적 소비와 또래 압력을 비판하는 사회적 신조어로 자리잡았다.',
    '2011년 노스페이스 청소년 유행에 대한 사회 비판 신조어', '과시적 소비 세태를 지적할 때 사용', '특정 브랜드·계층을 비하하는 뉘앙스로 흐를 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EB%85%B8%EC%8A%A4%ED%8E%98%EC%9D%B4%EC%8A%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('화성인 바이러스 난장판녀', '화성인-바이러스-난장판녀', array['난장판녀','화성인바이러스']::text[], '청소를 전혀 안 한 집을 공개해 논란이 된 방송 사례', '2011년 7월 방영된 화성인 바이러스에서 한 번도 청소를 하지 않았다는 자취녀가 출연해 ''난장판녀''로 불리며 화제가 됐다. 방송 조작 의혹까지 제기되며 한동안 커뮤니티에서 캡처 짤이 돌았다.',
    'tvN 화성인 바이러스 2011년 7월 방영분', '극단적인 사례를 소개하는 옛날 방송 회고에 인용', '실존 인물 조롱으로 이어질 수 있어 신상 언급 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2011, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%99%94%EC%84%B1%EC%9D%B8%20%EB%B0%94%EC%9D%B4%EB%9F%AC%EC%8A%A4/%EB%82%9C%EC%9E%A5%ED%8C%90%EB%85%80%ED%8E%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야매토끼 오므라이스 짤방', '야매토끼-오므라이스-짤방', array['역전 야매요리','야매토끼','정다정']::text[], '엉망인 요리 완성 사진으로 유명해진 웹툰 짤방', '정다정 작가가 네이버 웹툰에 연재한 ''역전! 야매요리''는 요리 과정을 사진으로 재구성한 개그 웹툰으로, 오므라이스 편 등에서 나온 엉망인 완성 사진이 짤방으로 유명해지며 2012년 카레·탕수육 편 등으로 인기가 이어졌다.',
    '네이버 웹툰 역전! 야매요리(정다정)', '요리 실패담을 웃기게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%97%AD%EC%A0%84!%20%EC%95%BC%EB%A7%A4%EC%9A%94%EB%A6%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('얼리 엑세스 닭장 비유 짤', '얼리-엑세스-닭장-비유-짤', array['얼리엑세스 짤','후원 먹튀 닭장']::text[], '얼리엑세스 게임의 먹튀 문제를 치킨·닭장에 비유한 짤', '2013년 디시인사이드 게임 갤러리에 얼리 액세스 게임의 개발 중단·먹튀 문제를 후원과 부실 치킨, 닭장에 비유해 요약한 글이 올라오며 화제가 됐다. 이후 비슷한 사례가 생길 때마다 이 비유가 짤방으로 재소환됐다.',
    '디시인사이드 게임 갤러리 2013년 게시물', '부실한 크라우드펀딩·얼리엑세스 사례를 비판할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안녕들하십니까 대자보', '안녕들하십니까-대자보', array['안녕들 하십니까']::text[], '철도 파업을 계기로 전국에 퍼진 대학가 대자보 운동', '2013년 12월 10일 고려대학교 후문에 붙은 ''안녕들 하십니까'' 대자보에서 시작된 사회 현상이다. 철도 민영화 반대 파업과 시국 상황을 언급하며 안부를 묻는 형식의 대자보가 전국 50여개 대학으로 퍼졌다.',
    '고려대학교 학생 주현우의 2013년 12월 대자보', '사회 이슈에 대한 관심을 환기할 때 인용되는 상징적 문구', '정치적 맥락이 강해 상황에 따라 논쟁을 부를 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EC%95%88%EB%85%95%EB%93%A4%ED%95%98%EC%8B%AD%EB%8B%88%EA%B9%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우리가 어떤 민족입니까', '우리가-어떤-민족입니까', array['배달의민족 광고','배민 광고']::text[], '배달의민족이 류승룡을 내세운 2014년 B급 광고 카피', '배달의민족이 2014년 배우 류승룡을 모델로 내세워 ''우리가 어떤 민족입니까''라는 질문을 던지는 B급 감성 광고를 선보였다. 배달 민족과 브랜드명 배달의민족을 엮은 언어유희로 화제를 모으며 배달앱 시장의 판도를 바꾼 광고로 꼽힌다.',
    '배달의민족 2014년 TV 광고(모델 류승룡)', 'B급 감성 광고 카피를 인용하는 밈으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B0%B0%EB%8B%AC%EC%9D%98%EB%AF%BC%EC%A1%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('구라龍팝', '구라龍팝', array['SNL코리아 구라龍팝','크레용팝 패러디']::text[], 'SNL코리아가 크레용팝을 패러디해 화제가 된 코너', '2013년 SNL코리아 시즌4에서 걸그룹 크레용팝을 패러디한 ''구라龍팝'' 코너가 방영돼 네이버 실시간 검색어에 오를 정도로 화제가 됐다. 아이돌 그룹 특유의 안무와 컨셉을 코믹하게 비튼 패러디 사례로 회자된다.',
    'tvN SNL코리아 시즌4(2013) 크레용팝 패러디 코너', '아이돌 패러디 콩트를 언급할 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2013, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('팩트폭력', '팩트폭력', array['팩폭','팩력배','뼈 맞았다']::text[], '불편한 진실을 직설적으로 지적하는 것을 뜻하는 신조어', '2013년경 인터넷에서 ''팩트''라는 말이 대중적으로 범람하며 파생된 신조어로, 듣기 싫은 진실을 정면으로 지적하는 것을 ''팩트폭력''이라 불렀다. 여기서 파생된 ''팩력배'', ''뼈 맞았다'' 같은 표현도 함께 유행했다.',
    '2013년 인터넷 커뮤니티에서 ''팩트'' 유행어의 파생 표현', '불편하지만 맞는 말을 들었을 때 반응으로 사용', '상대를 몰아붙이는 말로 쓰이면 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무대를 뒤집어 놓으셨다', '무대를-뒤집어-놓으셨다', array['나는가수다 무대를 뒤집어놓으셨다']::text[], '나는가수다에서 박미경이 남긴 리액션 멘트가 유행어가 됨', '2012년 방영된 MBC 나는 가수다에서 가수 백두산의 무대가 끝난 뒤 박미경이 ''오우~ 무대를 뒤집어 놓으셨다''라고 감탄한 장면이 화제가 되며 유행어로 퍼졌다. 인상적인 무대나 퍼포먼스에 대한 감탄사로 패러디됐다.',
    'MBC 나는 가수다 2012년 방영분, 박미경 리액션', '인상적인 무대나 퍼포먼스를 극찬할 때 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마음의소리 따란', '마음의소리-따란', array['따란','마음의소리 마술사람']::text[], '마음의소리 마술사람 편 이후 유행한 감탄 표현', '조석 작가의 마음의소리 597화 ''마술사람'' 편 이후로 ''따란''이라는 감탄사가 이후 회차에서 반복적으로 애용되며 팬들 사이 유행어가 됐다. 웃기거나 어이없는 상황을 강조할 때 쓰였다.',
    '네이버 웹툰 마음의소리(조석) 597화 마술사람 편', '마음의소리 팬 커뮤니티에서 옛날 짤 회고 시 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%A7%88%EC%9D%8C%EC%9D%98%EC%86%8C%EB%A6%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미생 신드롬', '미생-신드롬', array['장그래','미생']::text[], '직장인 공감을 얻으며 신드롬을 일으킨 바둑 소재 웹툰', '윤태호 작가가 2012년 1월부터 다음에 연재한 미생은 인턴사원 장그래를 주인공으로 한 직장 생활 웹툰으로, 직장인들 사이에서 폭발적인 공감을 얻어 ''미생 신드롬''을 일으켰다. ''장그래''와 ''미생''이라는 단어 자체가 미완성된 삶을 뜻하는 일상어로 널리 쓰이게 됐다.',
    '다음 웹툰 미생(윤태호, 2012~2013 연재)', '직장인의 애환이나 미완성된 상태를 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%AF%B8%EC%83%9D(%EC%9B%B9%ED%88%B0)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('명언 -박명수', '명언--박명수', array['박명수 명언 짤','박명수 어록']::text[], '진지한 격언에 냉소적인 반전을 붙이는 패러디 짤 형식', '무한도전에서 박명수가 ''늦었다고 생각할 때가 진짜 늦은 때다''처럼 기존 격언을 비틀어 현실적인 조언을 한 것이 계기가 되어, 그럴듯한 명언 뒤에 ''-박명수''를 붙여 웃음을 주는 이미지 짤 형식이 유행했다. 진지한 명언과 허무한 반전의 대비가 포인트였다.',
    'MBC 무한도전 박명수의 어록에서 파생된 짤 형식', '진지한 말에 허무한 반전을 주는 유머 형식으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2010, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%B0%95%EB%AA%85%EC%88%98/%ED%8A%B9%EC%A7%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('런닝맨 기린', '런닝맨-기린', array['이광수 기린','광바타']::text[], '큰 키 때문에 붙은 이광수의 별명이 대명사처럼 쓰임', '2010년 시작한 SBS 런닝맨에서 이광수가 큰 키로 ''기린''이라는 별명을 얻었고, 2012년 무렵 ''배신 캐릭터''와 함께 확고히 자리잡으며 주변에 키 큰 사람을 ''이광수''라 부를 정도로 대명사가 됐다.',
    'SBS 런닝맨 이광수 캐릭터(2010~2012년 정착)', '키가 큰 사람을 놀리듯 부를 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%B4%EA%B4%91%EC%88%98/%EB%9F%B0%EB%8B%9D%EB%A7%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('용감한 녀석들', '용감한-녀석들', array['개그콘서트 용감한 녀석들']::text[], '군가풍 구호로 시작하던 개그콘서트 인기 코너 유행어', '2012년 2월부터 1년간 방영된 개그콘서트 코너 ''용감한 녀석들''은 ''한숨 대신 함성으로! 걱정 대신 열정으로! 포기 대신 죽기 살기로! 우리가 바로 용감한 녀석들!''이라는 구호로 시작해 유행어가 됐다.',
    'KBS 개그콘서트 용감한 녀석들 코너(2012~2013)', '의욕을 다지는 구호를 패러디할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9A%A9%EA%B0%90%ED%95%9C%20%EB%85%80%EC%84%9D%EB%93%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('됐어! 나 빈정 상했어!', '됐어!-나-빈정-상했어!', array['감수성 빈정상했어','개그콘서트 감수성']::text[], '작은 일에도 삐지는 상황을 과장한 개그콘서트 유행어', '2011년 개그콘서트 코너 ''감수성''에서 사소한 말에도 예민하게 반응하며 ''됐어! 나 빈정 상했어! 집에 갈 거야!''라고 외치는 장면이 유행했다. 과하게 삐지는 상황을 놀릴 때 인용됐다.',
    'KBS 개그콘서트 감수성 코너(2011)', '과하게 삐지는 반응을 장난스럽게 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EA%B0%90%EC%88%98%EC%84%B1(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('응답하라 1994 쓰레기', '응답하라-1994-쓰레기', array['쓰레기 남편찾기','응사 쓰레기']::text[], '응답하라 1994에서 신드롬을 일으킨 남주인공 별명', '2013년 방영된 tvN 드라마 응답하라 1994에서 정우가 연기한 캐릭터 별명 ''쓰레기''가 전국적 신드롬을 일으켰다. 극중 성나정의 미래 남편이 누구인지를 둘러싼 ''남편찾기'' 떡밥이 방영 내내 화제였다.',
    'tvN 드라마 응답하라 1994(2013) 등장인물 별명', '드라마 속 인기 캐릭터 별명을 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2013, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%93%B0%EB%A0%88%EA%B8%B0(%EC%9D%91%EB%8B%B5%ED%95%98%EB%9D%BC%201994)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1도 모르겠다', '1도-모르겠다', array['1도 없다','하나도 모르겠다']::text[], '헨리가 만든 발음 실수가 전국구 유행어가 된 사례', '2014년 4월 13일 방영된 MBC 진짜 사나이에서 가수 헨리가 퀴즈 정답으로 ''모라고 했는지 1도 몰으갰습니다''라고 답한 것이 유래다. ''하나도''를 ''1도''로 잘못 발음한 것이 오히려 화제가 되며 ''1도 없다'' 등 파생 표현까지 크게 유행했다.',
    'MBC 진짜 사나이 2014년 4월 54화, 헨리 발언', '전혀 모르겠다는 뜻을 강조할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/1%EB%8F%84%20%EB%AA%A8%EB%A5%B4%EA%B2%A0%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국뽕', '국뽕', array['국뽕 드립','국까 반대말']::text[], '과도한 국가주의적 자부심을 비꼬는 인터넷 신조어', '국가와 히로뽕(마약)을 합친 조어로, 근거 없이 과도하게 자국을 치켜세우는 태도를 비꼬는 말이다. 2013년 국내야구 갤러리와 축구 갤러리 등 스포츠 커뮤니티를 중심으로 본격적으로 확산됐다.',
    '디시인사이드 스포츠 갤러리(2013년경 확산)', '과도한 국가 자랑을 비꼬는 농담으로 사용', '맥락에 따라 진지한 애국심 표현을 조롱하는 것으로 오해될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B5%AD%EB%BD%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('타진요 사건 짤', '타진요-사건-짤', array['타진요','타블로에게 진실을 요구합니다']::text[], '타블로 학력을 의심하며 벌어진 대규모 온라인 마녀사냥', '2010년 네이버 카페 ''타진요''를 중심으로 가수 타블로의 스탠퍼드대 학력이 위조라는 의혹이 확산되며 대규모 온라인 논쟁으로 번졌다. 타블로가 학력 인증 방송까지 했음에도 논란이 이어졌고, 결국 2012년 핵심 유포자들이 실형을 선고받으며 사건이 마무리됐다.',
    '네이버 카페 타진요, 2010년 타블로 학력위조 의혹 제기', '온라인 마녀사냥의 대표 사례로 회고할 때 언급', '실존 인물에 대한 근거 없는 비방·명예훼손 사건이므로 재확산에 주의',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'negative'::meme_sentiment, 2010, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%83%80%EB%B8%94%EB%A1%9C%20%ED%95%99%EB%A0%A5%EC%9C%84%EC%A1%B0%20%EB%88%84%EB%AA%85%20%EC%82%AC%EA%B1%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신라면 블랙 설렁탕 논란', '신라면-블랙-설렁탕-논란', array['신라면 블랙','우골보양식사']::text[], '설렁탕급 영양을 내세웠다가 과장광고로 적발된 라면 광고', '농심이 2011년 4월 ''우골보양식사''를 내세워 기존보다 두 배 비싼 신라면 블랙을 출시했으나, 공정거래위원회가 ''설렁탕 한 그릇 영양''이라는 광고 문구를 허위·과장으로 판단해 과징금을 부과했다. 이후 과장 광고 사례로 두고두고 회자됐다.',
    '농심 신라면 블랙 2011년 출시 및 공정위 과징금 부과', '과장된 광고 문구를 비꼴 때 사례로 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EC%8B%A0%EB%9D%BC%EB%A9%B4%20%EB%B8%94%EB%9E%99', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('펭수 짤', '펭수-짤', array['자이언트 펭TV','EBS 아이돌 펭수']::text[], '직설적 화법의 EBS 펭귄 캐릭터 표정·대사 캡처짤', 'EBS 유튜브 ''자이언트 펭TV''의 주인공 펭수가 기존 어린이 캐릭터와 달리 거침없는 독설과 솔직한 화법을 보여주며 방송 한 달 만에 화제가 됐다. 무표정한 사백안 얼굴에 자막을 더한 캡처 짤이 SNS와 커뮤니티에서 유행어처럼 쓰였다. 2019년 11월 카카오톡 이모티콘 출시 하루 만에 전 연령대 인기 순위 상위권을 휩쓸었다.',
    'EBS 유튜브 채널 ''자이언트 펭TV''(2019)', '귀엽고 당돌한 캐릭터를 인용할 때 무해하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://namu.wiki/w/펭수', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('앙 기모띠', '앙-기모띠', array['기모찌','기모띠']::text[], '일본어 ''기분 좋다''에서 온 감탄 표현, 급식체의 상징', '일본어 키모치 이이(気持ち良い)에서 유래한 감탄사로, BJ 철구의 말투를 통해 크게 유행하며 급식체의 필수 요소가 됐다. 2015년 말부터 성지순례가 이어지며 2016년 들어 패러디의 대상으로 널리 퍼졌다.',
    '일본어 표현+BJ 철구 말투 유행(2015~2016)', '친한 사이 장난조로만, 공식적 자리에서는 피할 것', 'AV 콘텐츠에서 유래해 맥락에 따라 저속하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('급식체', '급식체', array['급식충 말투']::text[], '2010년대 중후반 10대가 쓰던 줄임말·초성체 말투 총칭', '급식을 먹는 초중고생들이 쓰는 문체로, 줄임말과 초성체, 유행어를 뒤섞어 만든 말투다. tvN ''SNL코리아 시즌9''의 급식체 특강 코너로 대중에 널리 알려지며 2017년 전후 큰 화제가 됐다.',
    '10대 커뮤니티+SNL코리아 급식체 특강(2017)', '복고풍 드립으로 옛날 말투 언급할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/급식체', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사딸라 짤', '사딸라-짤', array['4달러','야인시대 사딸라']::text[], '드라마 야인시대 김두한의 ''사딸라'' 협상 장면 합성짤', '2003년 드라마 야인시대에서 김영철이 연기한 김두한이 미군과 협상하며 외친 ''사딸라!!!''가 합성짤의 소재가 됐다. 처음엔 심영 합성물의 일부였지만 2017년부터 아예 4달러 파트만 따로 쓰는 합성짤이 유행했고, 2019년 버거킹 광고에도 재등장했다.',
    '드라마 야인시대(2003) 김영철 연기 장면', '가격 흥정이나 협상 상황을 유머러스하게 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/4달러', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나만 없어 고양이', '나만-없어-고양이', array['나만없어고양이']::text[], '남들 다 있는 고양이만 나만 없다는 자조 짤방', '''진짜 사람들 고양이 다 있고 나만 없어''라는 문구와 함께 반려묘를 갖고 싶어하는 아쉬움을 유머러스하게 표현한 짤방이다. 2016년 말부터 온라인 커뮤니티에서 유행하며 관련 티셔츠·굿즈까지 나왔다.',
    '온라인 커뮤니티 유행(2016년 말)', '나만 못 가진 것에 대한 부러움을 귀엽게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('소확행', '소확행', array['소소하지만 확실한 행복']::text[], '작지만 확실한 일상의 행복을 뜻하는 신조어', '무라카미 하루키의 수필집에서 유래한 ''작지만 확실한 행복''이라는 표현이 한국에서 신조어로 확산됐다. 2018년 올해의 유행어 1위로 꼽힐 만큼 크게 유행하며 라이프스타일 트렌드를 대표하는 말이 됐다.',
    '무라카미 하루키 수필(1994)+한국 신조어화(2018)', '작은 행복을 이야기할 때 긍정적으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/소확행', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('복세편살', '복세편살', array['복잡한 세상 편하게 살자']::text[], '''복잡한 세상 편하게 살자''를 줄인 처세 신조어', '배우 박성웅이 팬에게 보낸 ''복잡한 세상 편하게 살자''라는 메시지가 줄임말로 인터넷에서 유행했다. 소확행과 비슷한 시기에 확산되며 2018년 전후 밀레니얼 세대의 처세관을 대표하는 말이 됐다.',
    '배우 박성웅의 팬 메시지', '스트레스 상황에서 마음을 편하게 먹자고 할 때', null,
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
  values ('갑분싸', '갑분싸', array['갑자기 분위기 싸해짐']::text[], '갑자기 분위기가 어색하게 식는 상황을 뜻하는 말', '2017년 유행했던 ''개꿀잼 몰카'' 영상 댓글에서 기대만큼 재미없을 때 ''갑자기 분위기 싸해짐ㄷㄷ''이라 쓰던 것이 줄어든 말이다. 트위치·아프리카TV 방송 채팅을 중심으로 퍼지며 2018년 초 방송에서도 급식체의 대표 사례로 소개됐다.',
    '인터넷 방송 채팅 드립(2017)', '어색해진 분위기를 셀프 디스할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/갑분싸', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('롬곡옾눞(야민정음)', '롬곡옾눞(야민정음)', array['폭풍눈물','댕댕이체']::text[], '한글 자모를 비슷한 모양으로 바꿔 쓰는 놀이 문화', '디시인사이드 국내야구 갤러리(야갤)에서 시작된 표기 놀이로, ''폭풍눈물''을 180도 뒤집으면 ''롬곡옾눞''처럼 보이는 것에서 착안했다. ''야갤''과 ''훈민정음''을 합쳐 야민정음이라 불리며 2018년 한글날 전후로 언론에도 크게 소개됐다.',
    '디시인사이드 국내야구 갤러리(야갤)', '글자 모양 말장난으로 웃음을 줄 때', '기원이 극우 성향 커뮤니티라는 점은 알아둘 것',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/야민정음', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인정? 어인정', '인정?-어인정', array['인정','노인정']::text[], '동의한다는 뜻의 채팅 반응, 초성 ㅇㅈ로도 사용', '아프리카TV 채팅 문화에서 시작된 표현으로, 상대 말에 공감할 때 ''인정? 어 인정''이라고 답하며 퍼졌다. 초성 ''ㅇㅈ''으로 줄여 쓰기도 했으며, 2017년 하반기부터는 ''동의? 어 보감'' 같은 말장난 변형이 등장했다.',
    '아프리카TV 채팅 문화', '상대 의견에 동의를 유쾌하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/인정', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼모노', '혼모노', array['혼모노 오타쿠']::text[], '현실과 가상을 구분 못하는 민폐 오타쿠를 가리키는 은어', '일본어로 ''진짜''를 뜻하는 혼모노(本物)가 한국에서는 현실과 가상을 혼동해 주변에 민폐를 끼치는 오타쿠를 가리키는 속어로 쓰였다. 2016년 영화 ''너의 이름은'' 개봉 후 극장에서 소란을 피우는 관객들이 화제가 되며 본격적으로 확산됐다.',
    '일본어 ''本物''+''너의 이름은'' 개봉 논란(2016~2017)', '특정 팬덤의 지나친 행동을 지적할 때 제한적으로', '특정 취미 집단 전체를 비하하는 뉘앙스로 번질 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/혼모노(은어)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인싸', '인싸', array['인사이더','핵인싸']::text[], '무리에 잘 어울리는 사람을 뜻하는 신조어', '인사이더(Insider)의 줄임말로 아싸(아웃사이더)의 반대말이다. 2018년 연말 유행어 설문에서 최고 인기 신조어로 꼽힐 만큼 폭발적으로 퍼지며 ''인싸템'', ''인싸력'' 등 파생어를 낳았다.',
    '대학가 은어+SNS 확산(2018)', '사교적이고 유행에 밝은 사람을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/인싸', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('TMI', 'TMI', array['Too Much Information']::text[], '굳이 알고 싶지 않은 과한 정보를 뜻하는 줄임말', '영어 Too Much Information의 약자로, 관심 없는 사생활 정보를 늘어놓을 때 쓰는 표현이다. 2000년대 해외에서 먼저 쓰이다 2018년 중반 한국 방송·SNS를 통해 급속히 퍼지며 신조어로 자리잡았다.',
    '영어권 인터넷 은어의 국내 유입(2018)', '불필요하게 자세한 정보를 들었을 때 장난스럽게', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('스불재', '스불재', array['스스로 불러온 재앙']::text[], '자신이 자초한 곤란한 상황을 자조하는 말', '우리동네 음악대장의 곡 ''Lazenca, Save Us'' 가사 중 ''스스로 불러온 재앙에 짓눌려''에서 따온 말이다. 새로운 도전을 벌였다가 스스로 힘들어질 때 자조적으로 쓰이며 2019년 신조어 목록에 자주 등장했다.',
    '밴드 곡 ''Lazenca, Save Us'' 가사 인용', '자기가 벌인 일 때문에 고생할 때 셀프 디스로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://femiwiki.com/w/스불재', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오조오억', '오조오억', array['오조오억개']::text[], '헤아릴 수 없이 많은 양을 강조하는 팬심 표현', '프로듀스101 시즌2 참가자 박우진에 대한 트위터 팬 댓글에서 의식의 흐름으로 ''오조오억''이라는 표현이 등장해 크게 퍼졌다. 무량대수를 뜻하는 과장된 애정 표현으로 덕질 문화 전반에서 널리 쓰이게 됐다.',
    '프로듀스101 시즌2 트위터 팬 댓글(2017)', '애정이나 팬심을 과장해서 표현할 때', '여초 커뮤니티발 표현이라는 이유로 정치적 낙인이 붙기도 함',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'X', 'https://namu.wiki/w/오조오억', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허버허버', '허버허버', array['허벌허벌']::text[], '음식을 급하게 먹는 모습을 표현하는 의태어 신조어', '급하게 먹는다는 뜻으로 여초 커뮤니티에서 남자친구 흉을 볼 때 쓰이던 표현이 2018년 초부터 퍼졌다. 이후 남성 혐오 표현이 아니냐는 논란이 커지며 2021년 카카오가 관련 이모티콘 판매를 중단하는 사태로 번졌다.',
    '여초 커뮤니티 표현(2018년 초)', '논란을 인지한 상태에서 아카이브 목적으로만 언급', '성별 혐오 표현 논쟁의 대상이므로 실사용은 권장하지 않음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/허버허버', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오또케 짤', '오또케-짤', array['오또케오또케']::text[], '위급 상황에서 당황만 한다며 여경을 조롱한 표현', '''어떡해''를 귀엽게 표현한 말이지만, 2018년 9월 디시인사이드 국내야구 갤러리에서 여성 경찰이 현장 대응 없이 ''오또케''만 외친다고 조롱하는 글이 퍼지며 여성 비하 밈으로 굳어졌다.',
    '디시인사이드 국내야구 갤러리(2018)', '아카이브 목적 외 실사용은 피할 것', '특정 직군·성별에 대한 비하 표현으로 논란이 많음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/오또케', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('문찐', '문찐', array['문화찐따']::text[], '유행에 뒤처져 트렌드를 모르는 사람을 뜻하는 말', '''문화''와 ''찐따''를 합친 말로, 남들 다 아는 유행이나 신조어를 모르는 사람을 가리킨다. 2019년 신조어 아카이브에 포함되며 언론에도 자주 소개됐다.',
    '청소년 커뮤니티 신조어(2019)', '본인이 유행에 뒤처졌다고 셀프 디스할 때', '타인에게 쓰면 무시하는 뉘앙스가 될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/문찐', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오지고 지리고', '오지고-지리고', array['오지고지리고렛잇고']::text[], '엄청나다는 뜻의 급식체 대표 리듬감 표현', '''오지다''라는 표준어에 운율이 비슷한 말을 덧붙여 만든 급식체 표현이다. 2017년 SNL코리아 급식체 특강에서 소개된 뒤 2018년 초중고생 사이에서 크게 유행했다.',
    '급식체 유행(SNL코리아, 2017~2018)', '복고 급식체 드립으로 장난스럽게 인용할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('라떼는 말이야', '라떼는-말이야', array['Latte is horse']::text[], '''나 때는 말이야''를 비꼰 꼰대 풍자 유행어', '기성세대가 자주 쓰는 ''나 때는 말이야''를 발음이 비슷한 ''라떼는 말이야''로 바꿔 풍자한 신조어다. 2018년 말부터 2019년 초 사이 유행하며 ''Latte is horse''라는 영문 패러디까지 낳았다.',
    '발음 유사성을 이용한 언어유희(2018년 말~2019년 초)', '꼰대 같은 발언을 유머러스하게 지적할 때', '직장 등에서 윗사람에게 직접 쓰면 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/라떼는 말이야', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('자만추', '자만추', array['자연스러운 만남 추구']::text[], '소개팅이 아닌 자연스러운 만남을 선호한다는 뜻', '''자연스러운 만남 추구''를 줄인 연애 신조어로 2016년경부터 커뮤니티에서 쓰이기 시작했다. 2018년 예능 ''런닝맨''에서 뜻을 묻는 퀴즈로 나오며 대중적으로 널리 알려졌다.',
    '온라인 커뮤니티 연애 신조어(2016)', '연애관을 캐주얼하게 설명할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/자만추', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그뤠잇 스튜핏', '그뤠잇-스튜핏', array['스튜핏','그뤠잇']::text[], '김생민이 가계부를 평가하며 외친 감탄사 유행어', 'KBS ''김생민의 영수증''에서 김생민이 소비 내역을 보고 잘한 소비엔 ''그뤠잇!'', 잘못한 소비엔 ''스튜핏!''을 외치며 유행했다. 2017년 6월 방송 시작 후 그해 말 직장인 대상 유행어 설문 1위에 오를 만큼 큰 인기를 끌었다.',
    '팟캐스트·방송 ''김생민의 영수증''(2017)', '소비를 칭찬하거나 지적할 때 유머러스하게', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('플렉스', '플렉스', array['Flex 해버렸지 뭐야']::text[], '부나 성공을 과시한다는 뜻의 힙합 유래 신조어', '미국 힙합 문화에서 부를 과시할 때 쓰던 ''Flex''가 한국에 들어와 신조어가 됐다. 2019년 래퍼 염따가 자신의 SNS와 ''쇼미더머니8''에서 ''플렉스 해버렸지 뭐야''라는 말을 쓰며 크게 유행시켰다.',
    '미국 힙합 문화+래퍼 염따(2019)', '과시성 소비나 자랑을 유쾌하게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', 'https://namu.wiki/w/FLEX', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고구마(유행어)', '고구마(유행어)', array['고답이']::text[], '답답한 전개나 상황을 삶은 고구마에 비유한 표현', '목 막히게 답답한 삶은 고구마의 느낌을 빗대 답답한 상황을 표현하는 신조어다. 2015년경 여초 커뮤니티에서 드라마·웹소설의 답답한 전개를 가리키던 말이 2016~2017년 정치·사회 전반으로 확산됐다.',
    '여초 커뮤니티 서브컬처 밈(2015~2017)', '답답한 전개나 상황을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/고구마(유행어)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사이다(유행어)', '사이다(유행어)', array['사이다 전개']::text[], '통쾌하고 시원한 전개나 발언을 뜻하는 표현', '청량음료 사이다의 시원한 느낌에 빗대 통쾌한 전개나 발언을 가리키는 신조어다. 답답함을 뜻하는 ''고구마''와 짝을 이루며 2016~2017년 정치·방송 담론에서 널리 쓰였다.',
    '고구마와 대조되는 신조어 확산(2016~2017)', '속 시원한 해결이나 발언을 칭찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/사이다(유행어)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('댕댕이', '댕댕이', array['멍멍이 야민정음']::text[], '강아지를 뜻하는 ''멍멍이''의 야민정음식 표현', '디시인사이드 국내야구 갤러리에서 ''멍''을 모양이 비슷한 ''댕''으로 바꿔 부르며 퍼진 야민정음 사례다. 2018~2019년 언론에서까지 적극적으로 사용할 만큼 대중적으로 정착했다.',
    '디시인사이드 국내야구 갤러리 야민정음', '강아지를 귀엽게 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/댕댕이', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('띵작', '띵작', array['명작 야민정음']::text[], '''명작''을 모양이 비슷한 글자로 바꾼 야민정음 표현', '''명작''의 자모를 모양이 비슷한 글자로 바꿔 ''띵작''이라 쓰는 야민정음 사례다. 2018년 5월 언론에서 급식체 시리즈로 소개되며 널리 알려졌다.',
    '디시인사이드 국내야구 갤러리 야민정음(2018)', '훌륭한 작품·콘텐츠를 재치 있게 칭찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('커여워', '커여워', array['귀여워 야민정음']::text[], '''귀여워''를 모양이 비슷한 글자로 바꾼 야민정음 표현', '''귀여워''의 자모를 비슷한 모양의 글자로 바꿔 쓰는 야민정음 사례로, 띵작과 함께 2018년 언론 소개를 통해 대중적으로 퍼졌다.',
    '디시인사이드 국내야구 갤러리 야민정음(2018)', '귀여운 대상을 장난스럽게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('낄끼빠빠', '낄끼빠빠', array['낄 때 끼고 빠질 때 빠져라']::text[], '눈치껏 낄 때 끼고 빠질 때 빠지라는 처세 신조어', '분위기 파악 못하고 끼어드는 사람을 지적할 때 쓰는 사자성어풍 신조어다. 2015년 방송 보도에서 다뤄질 만큼 이미 널리 쓰이고 있었고, 이후 여초 커뮤니티를 넘어 예능에서도 자주 언급됐다.',
    '온라인 커뮤니티 처세 신조어', '눈치 없이 끼어드는 상황을 지적할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/낄끼빠빠', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('헬조선', '헬조선', array['지옥불반도']::text[], '한국 사회를 지옥에 빗대 비판하는 자조적 신조어', '지옥을 뜻하는 헬(Hell)과 조선을 합쳐 청년 실업, 불평등 등 사회 문제를 비판하는 신조어다. 2010년 처음 등장했지만 2014년부터 확산되어 2015~2016년 수저계급론과 함께 폭발적으로 유행했다.',
    '디시인사이드 역사 갤러리(2010)+2015~2016년 확산', '사회 불평등을 자조적으로 비판할 때', '국가 전체를 비하하는 표현이라 맥락에 따라 반감을 살 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/헬조선', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('수저계급론', '수저계급론', array['흙수저','금수저']::text[], '부모의 재산에 따라 인생이 결정된다는 계급 비유', '영어 표현 ''은수저를 물고 태어나다''에서 착안해 부모의 자산에 따라 금수저·흙수저로 계급을 나누는 신조어다. 2015년 처음 등장해 그해 유행어 1위에 오를 만큼 청년 세대의 불평등 인식을 대표하는 말이 됐다.',
    '영어 관용구 변형+2015년 온라인 확산', '경제적 배경 차이를 풍자적으로 언급할 때', '부모나 가정환경을 저격하는 표현으로 상처가 될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/수저계급론', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('노오력', '노오력', '{}', '아무리 노력해도 소용없다는 자조를 담은 반어적 표현', '''노력''을 길게 늘여 발음해 강조한 반어법으로, 기성세대가 청년에게 노력 부족을 탓할 때 이를 비꼬아 되받아치는 데 쓰였다. 헬조선·수저계급론 담론과 함께 2015년경 크게 확산됐다.',
    '청년 세대의 사회 비판 담론(2015)', '노력만 강조하는 훈계를 반어적으로 비꼴 때', '세대 갈등을 자극하는 소재로 번질 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뭣이 중헌디', '뭣이-중헌디', array['뭐가 중헌디']::text[], '영화 ''곡성'' 아역 배우의 전라도 사투리 대사 유행어', '2016년 나홍진 감독 영화 ''곡성''에서 배우 김환희가 연기한 효진이가 던진 사투리 대사가 크게 유행했다. 정작 중요한 것을 놓치고 엉뚱한 데 몰두하는 상황을 지적하는 말로 각종 예능에서 인용됐다.',
    '영화 ''곡성''(2016) 대사', '엉뚱한 것에 집중하는 상황을 지적할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이생망', '이생망', array['이번 생은 망했다']::text[], '현재 상황이 절망적이라는 자조적 신조어', '''이번 생은 망했다''를 줄인 말로, 취업난·경쟁 사회 속 좌절감을 자조적으로 표현할 때 쓰인다. 2018년경 커뮤니티와 SNS에서 확산되며 2019년 신조어 기사에서 자주 다뤄졌다.',
    '온라인 커뮤니티 자조 신조어(2018)', '힘든 상황을 유머러스하게 자조할 때', '과도하게 쓰면 진짜 우울감으로 오해될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/이생망', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('워라밸', '워라밸', array['Work-life balance']::text[], '일과 삶의 균형을 뜻하는 직장 신조어', '영어 ''Work-life balance''의 앞글자를 딴 신조어로 한국에서는 2017년부터 본격적으로 쓰였다. 2018년 7월 주52시간 근무제 시행과 맞물려 뉴스·채용 공고에 공식 용어처럼 자리잡았다.',
    '고용노동부 근무혁신 제안(2017)', '일과 삶의 균형을 중시한다고 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/워라밸', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가심비', '가심비', array['가격 대비 심리적 만족']::text[], '가성비를 넘어 심리적 만족을 중시하는 소비 신조어', '가격 대비 성능을 뜻하는 ''가성비''에서 나아가 가격 대비 심리적 만족을 뜻하는 신조어다. 2017년 하반기부터 언급량이 가성비를 넘어서며 밀레니얼 소비 트렌드를 대표하는 말이 됐다.',
    '트렌드 분석 신조어(2017)', '가격보다 만족감을 우선하는 소비를 설명할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('탕진잼', '탕진잼', array['탕진하는 재미']::text[], '소소하게 돈을 쓰며 느끼는 재미를 뜻하는 신조어', '경제적 한도 내에서 소소한 소비를 즐기며 얻는 재미를 뜻하는 신조어로, 저성장 시대 젊은 층의 소비 트렌드를 반영한다. 2017년 전후로 언론과 SNS에서 크게 다뤄졌다.',
    '밀레니얼 소비 트렌드 신조어(2017)', '작은 사치를 즐긴다고 유쾌하게 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/탕진잼', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('만반잘부', '만반잘부', array['만나서 반가워 잘 부탁해']::text[], '''만나서 반가워 잘 부탁해''를 줄인 인사 초성어', '자기소개나 첫인사에서 쓰이는 긴 문장을 앞글자만 따서 줄인 Z세대 신조어다. 2019년 초 방송에서 소개되며 대학생·10대 사이 인싸 용어로 화제가 됐다.',
    'Z세대 초성 줄임말 유행(2019)', '가볍게 첫인사를 건넬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('세젤예/세젤귀', '세젤예/세젤귀', array['세상에서 제일 예뻐','세상에서 제일 귀여워']::text[], '''세상에서 제일 예쁘다/귀엽다''를 줄인 팬덤 표현', '''세상에서 제일''을 줄인 ''세젤'' 뒤에 예쁨·귀여움을 붙여 만든 신조어로, 아이돌 팬덤 커뮤니티에서 주로 쓰인다. 2015년 이전부터 쓰이다 이 시기 언론에서도 여러 차례 소개됐다.',
    '아이돌 팬덤 커뮤니티 신조어', '최애를 극찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/세젤', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국평오', '국평오', array['국민 평균 5등급']::text[], '국민 지적 수준을 수능 5등급에 빗대 조롱하는 표현', '''국민들의 평균 수능 등급은 5등급''이라는 뜻으로, 사회 문제의 원인을 대중의 낮은 지적 수준으로 돌리는 엘리트주의적 표현이다. 입시 커뮤니티에서 쓰이다 2018년 이후 대학 커뮤니티 전반으로 퍼졌다.',
    '입시·대학 커뮤니티(2018)', '아카이브 목적 외 사용을 권장하지 않음', '대중을 집단적으로 비하하는 엘리트주의 표현으로 논란이 많음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국룰', '국룰', array['국민 룰']::text[], '국민 대다수가 암묵적으로 받아들이는 규칙을 뜻함', '한자어 ''國''과 영어 ''rule''을 합친 말로, 공식 규정은 아니지만 대다수가 당연하게 받아들이는 관행을 가리킨다. 게임 커뮤니티 용어에서 출발해 2015~2018년경 일상 유행어로 자리잡았다.',
    '온라인 게임 커뮤니티 용어', '누구나 당연하게 하는 행동을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/국룰', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핵인싸', '핵인싸', array['핵-접두사']::text[], '매우 강조하는 접두사 ''핵''을 붙인 인싸의 강조형', '''정말·매우''를 뜻하는 접두사 ''핵''을 인싸에 붙여 만든 강조형 신조어다. 핵노잼, 핵꿀잼 등과 함께 인싸 유행에 힘입어 2018년 전후 널리 쓰였다.',
    '접두사 ''핵''+인싸 유행 결합(2018)', '모임을 주도하는 사교적인 사람을 강조해 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/핵', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뇌절', '뇌절', array['명절 뇌절']::text[], '적당한 선에서 끊지 못하고 질질 끄는 상황을 뜻함', '만화 나루토 캐릭터 하타케 카카시의 주력기 ''뇌절''을 이용한 만화 갤러리 드립에서 시작됐다. ''1절만 해라''가 ''2절, 3절도 하네'', ''명절에 뇌절도 하네'' 식으로 확장되며 2018년 급식체 유행과 함께 널리 퍼졌다.',
    '만화 갤러리 나루토 패러디(2017)', '같은 말을 반복해 질리게 하는 상황을 지적할 때', '상대를 무안하게 만들 수 있어 친한 사이에서만',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/뇌절', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('빼박캔트', '빼박캔트', array['빼도 박도 못한다']::text[], '명백해서 부정할 수 없는 사실을 뜻하는 신조어', '''빼도 박도 못한다''의 ''못한다''를 영어 can''t로 바꿔 만든 말이다. 2016년 무렵 등장해 명백한 사실을 강조하는 뜻으로 널리 쓰이게 됐다.',
    '기존 관용구+영어 합성(2016)', '명백한 사실을 강조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/빼도 박도 못한다', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('ㅇㄱㄹㅇ', 'ㅇㄱㄹㅇ', array['이거레알','반박불가']::text[], '''이거 레알(진짜)''의 초성을 딴 강한 공감 표현', '''이거 레알''을 초성으로 줄인 채팅 표현으로, 상대 말이 사실임을 강하게 인정할 때 쓴다. ''반박불가''의 초성 ㅂㅂㅂㄱ과 함께 쓰이며 급식체 초성 문화를 대표한다.',
    '온라인 채팅 초성체 문화', '강하게 공감할 때 짧게 답할 용도로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/이거레알 반박불가', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('싫존주의', '싫존주의', array['싫음도 존중']::text[], '싫어하는 것도 개인 취향으로 존중하자는 신조어', '''싫음도 존중해달라''는 뜻의 줄임말로, 오이를 싫어하는 모임(오싫모) 등 취향 존중 커뮤니티 확산과 함께 2018년 20대를 설명하는 트렌드 용어로 떠올랐다.',
    '페이스북 ''오이를 싫어하는 모임'' 등 취향 커뮤니티(2018)', '본인의 호불호를 당당히 밝힐 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인싸템', '인싸템', array['인싸 아이템']::text[], '인싸들이 애용한다고 홍보되는 유행 아이템', '''인싸''와 아이템의 ''템''을 합쳐 만든 소비 신조어로, 2019년 초 SNS에서 각종 패션·뷰티 상품을 ''인싸템''으로 홍보하는 마케팅 문구가 크게 유행했다.',
    '인싸 신조어 확산에 따른 마케팅 용어화(2019)', '유행 상품을 가볍게 소개할 때', '과도한 마케팅 남용으로 피로감을 줄 수 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('진지충', '진지충', '{}', '농담에 지나치게 진지하게 따지는 사람을 비하하는 말', '''진지하다''의 진지와 벌레를 뜻하는 ''충''을 합쳐 만든 말로, 웃자고 한 말에 죽자고 달려드는 사람을 가리킨다. 2015년 언론에서 ''일베충·맘충·설명충''과 함께 대표적인 ''OO충'' 신조어로 다뤄졌다.',
    '온라인 커뮤니티 ''OO충'' 접미사 유행(2015)', '장난스러운 자리에서 과도한 지적을 받았을 때 셀프 언급 정도로', '상대를 벌레에 비유하는 비하 표현이라 직접 쓰면 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/진지충', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('프로불편러', '프로불편러', array['프로불편']::text[], '사소한 일에도 예민하게 문제를 제기하는 사람을 조롱하는 말', '전문가를 뜻하는 Pro와 ''불편'', ''~하는 사람(er)''을 합친 신조어다. 2016년 강남역 살인사건 이후 성차별 문제를 지적하는 이들을 조롱하는 맥락으로 쓰이며 논쟁적인 용어가 됐다.',
    '온라인 커뮤니티(2016)', '정당한 문제 제기를 깎아내리는 데 쓰일 수 있어 주의', '정당한 지적조차 ''유난''으로 매도하는 데 악용될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/프로불편러', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('맘충', '맘충', array['mom+충']::text[], '일부 부모의 몰상식한 행동을 벌레에 빗대 비하하는 혐오 표현', '영어 Mom과 벌레 충(蟲)을 합친 말로, 공공장소에서 무례한 행동을 하는 유자녀 여성을 비하한다. 2015년 ''마이 리틀 텔레비전'' 채팅창 소동에서 시작돼 그해 8월 시사 매체에 다뤄지며 사회적 논쟁거리가 됐다.',
    'MBC ''마이 리틀 텔레비전'' 채팅 논란(2015)', '아카이브 목적 외에는 사용을 권장하지 않음', '여성·육아 부모 전체를 향한 혐오 표현으로 사용 시 큰 반감을 살 수 있음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/맘충', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('탈코르셋', '탈코르셋', array['탈코']::text[], '여성에게 강요된 미적 기준을 벗어나자는 사회 운동 용어', '''벗다''의 탈(脫)과 코르셋을 합친 말로, 화장이나 꾸밈 노동이 남성 중심 사회의 억압이라 보고 이를 벗어나자는 래디컬 페미니즘 운동 및 구호다. 2018년 초 SNS에서 ''#탈코르셋'' 인증샷이 확산되며 해외에도 보도됐다.',
    '국내 온라인 페미니즘 운동(2018)', '사회 운동 관련 논의에서 정확한 맥락과 함께 언급', '성별 담론에서 민감하게 받아들여질 수 있는 정치사회적 용어',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', 'https://namu.wiki/w/탈코르셋 운동', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('설명충', '설명충', '{}', '묻지 않은 것까지 장황하게 설명하는 사람을 비하하는 말', '''설명''과 벌레 ''충''을 합친 말로, 굳이 필요 없는 부연 설명을 늘어놓는 사람을 가리킨다. 2015년 진지충·맘충 등과 함께 대표적인 ''OO충'' 계열 신조어로 언론에 소개됐다.',
    '온라인 커뮤니티 ''OO충'' 접미사 유행(2015)', '과도한 부연설명을 셀프 디스할 때 정도로', '상대를 벌레에 빗대는 비하 표현이라 직접 사용은 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('한남충', '한남충', array['한남']::text[], '한국 남성 전체를 비하하는 여성 혐오 대항 표현', '메갈리아 커뮤니티에서 기존 ''김치녀'' 등 여성 혐오 표현에 대한 미러링으로 만든 말로, 한국 남성을 벌레에 빗대 비하한다. 2015년 메르스 갤러리·메갈리아 등장과 함께 확산돼 젠더 갈등의 상징적 단어가 됐다.',
    '메갈리아 커뮤니티 미러링 표현(2015)', '아카이브·논의 목적 외 실사용은 권장하지 않음', '특정 성별 전체를 비하하는 혐오 표현으로 매우 논쟁적임',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/한남충', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼귀다', '삼귀다', '{}', '사귀기 전 썸 타는 단계를 뜻하는 신조어 동사', '''사귀다''의 ''사(4)''보다 못 미치는 단계라는 뜻으로 숫자 ''3''을 붙여 만든 말장난 신조어다. 사귀지는 않지만 가까운 사이를 가리키며 2010년대 중반 10~20대 사이에서 널리 쓰이다 국어사전에도 등재됐다.',
    '10~20대 연애 신조어(2010년대 중반)', '썸 타는 단계의 관계를 설명할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/삼귀다', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('존맛탱', '존맛탱', array['JMT','존맛']::text[], '매우 맛있다는 뜻을 강조하는 대표 맛 표현 신조어', '비속어 ''존나''와 ''맛있다''를 합친 ''존맛''에 귀여운 어미 ''탱''을 붙인 신조어다. 2018년 알바몬 설문에서 20대가 뽑은 최애 신조어 1위에 오를 만큼 SNS와 일상 대화에서 폭발적으로 쓰였다.',
    '온라인 커뮤니티 맛 표현 신조어(2018)', '친한 사이에서 음식이 맛있다는 감탄으로', '비속어가 포함돼 격식 있는 자리에서는 피할 것',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/존맛', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('흙수저(수저계급론)', '흙수저(수저계급론)', array['금수저','은수저','수저계급론']::text[], '부모의 경제력에 따라 계급을 나눈 자조적 신조어', '부모의 자산 수준에 따라 금수저, 은수저, 흙수저로 계급을 나눈 신조어로 2015년 한국 사회의 불평등 담론을 상징하는 단어가 됐다. 영어 표현 ''born with a silver spoon''에서 착안했으며 온라인 커뮤니티에서 확산됐다.',
    '2015년 온라인 커뮤니티에서 확산, 영어 관용구 ''silver spoon''에서 착안', '사회 불평등을 이야기할 때 사용, 개인 신상 언급 시 예민할 수 있음', '특정인 배경 저격용으로 쓰면 무례하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/%EC%88%98%EC%A0%80%EA%B3%84%EA%B8%89%EB%A1%A0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('열정페이', '열정페이', array['열정 페이']::text[], '청년 노동력을 열정이란 명목으로 착취하는 저임금 관행', '경력을 쌓게 해준다는 명목으로 청년 구직자나 인턴에게 임금을 제대로 주지 않는 관행을 가리키는 말. 2014년 말 유명 패션 디자이너의 인턴 저임금 논란이 알려지며 2015년 사회적 신조어로 자리잡았다.',
    '2014~2015년 패션업계 인턴 저임금 논란(이상봉 디자인실 사건)에서 대중화', '노동 착취 관행을 비판할 때 사용', '특정 기업·개인 실명 거론 시 명예훼손 소지 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://ko.wikipedia.org/wiki/%EC%97%B4%EC%A0%95%ED%8E%98%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('극혐', '극혐', array['극혐하다']::text[], '정도가 심하게 싫어함을 뜻하는 인터넷 감탄사', '''극도로 혐오한다''의 줄임말로 무언가를 몹시 싫어하거나 불쾌할 때 쓰는 표현. 디시인사이드 스타크래프트 갤러리에서 시작해 2014~2015년 사용이 급증했고 국립국어원이 관련 표현을 신어로 조사할 만큼 대중화됐다.',
    '디시인사이드 스타크래프트 갤러리에서 시작, 2015년 전후 대중화', '친한 사이에서 과장된 반응으로 사용, 실제 혐오 표현과는 구분', '특정 집단 대상으로 쓰이면 혐오 표현으로 비칠 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%98%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('땅콩회항(갑질)', '땅콩회항(갑질)', array['땅콩 리턴','갑질']::text[], '대한항공 회항 사건에서 비롯된 ''갑질'' 신조어 확산', '2014년 12월 대한항공 조현아 부사장이 마카다미아 서비스를 문제 삼아 항공기를 되돌린 사건. 이 사건을 계기로 ''갑질''이라는 단어가 우월적 지위를 이용한 횡포를 뜻하는 신조어로 널리 퍼졌고 2015년 이후 각종 사회 문제를 지칭하는 데 일상적으로 쓰이게 됐다.',
    '2014년 12월 대한항공 086편 회항 사건', '권력 남용을 비판할 때 일상적으로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%ED%95%AD%EA%B3%B5_086%ED%8E%B8_%ED%9A%8C%ED%95%AD_%EC%82%AC%EA%B1%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뇌섹남', '뇌섹남', array['뇌섹녀','뇌가 섹시한 남자']::text[], '지적 매력이 뛰어난 사람을 가리키는 신조어', '''뇌가 섹시한 남자''의 줄임말로 똑똑하고 지적인 매력을 가진 사람을 가리킨다. 방송인 홍진호 등을 계기로 확산됐으며 2015년 국립국어원 신어 조사 및 포털 올해의 신조어에 포함되며 대중화됐다.',
    '예능 프로그램 출연진(홍진호 등)을 계기로 확산, 2015년 신조어로 선정', '칭찬 표현으로 무난하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%87%8C%EC%84%B9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('김치녀', '김치녀', '{}', '한국 여성을 비하하는 대표적 여성혐오 표현', '한국 여성을 된장녀류의 부정적 이미지로 싸잡아 비하하는 혐오 표현. 2010년 전후 일부 남초 커뮤니티에서 쓰이기 시작해 2015년 메갈리아 논쟁 등을 거치며 젠더 갈등 이슈로 언론에도 자주 다뤄졌다.',
    '2010년 전후 남초 커뮤니티에서 시작, 2015년 젠더 갈등 이슈로 재조명', '아카이브·비평 목적 외 실사용 비권장', '여성 전체를 비하하는 혐오 표현',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('N포세대', 'N포세대', array['삼포세대','오포세대','칠포세대','구포세대']::text[], '연애·결혼 등 여러 가지를 포기한 청년 세대를 뜻함', '연애, 결혼, 출산 세 가지를 포기한다는 ''삼포세대''에서 출발해 포기하는 항목이 늘며 오포, 칠포, N포세대로 확장된 신조어. 2011년 삼포세대가 처음 등장했고 2015년 무렵부터 ''N포세대''라는 표현으로 정착되며 청년 문제를 상징하는 단어가 됐다.',
    '2011년 삼포세대에서 출발, 2015년경 N포세대로 정착', '청년 세대의 어려움을 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/N%ED%8F%AC%EC%84%B8%EB%8C%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('만찢남/만찢녀', '만찢남/만찢녀', array['만찢','만화를 찢고 나온 남자']::text[], '만화 주인공처럼 뛰어난 외모를 칭찬하는 신조어', '''만화를 찢고 나온 남자(여자)''의 줄임말로 만화 캐릭터 못지않은 외모를 가진 사람을 가리킨다. 2012년경부터 쓰이기 시작해 2016년 KBS 뮤직뱅크가 프로젝트 그룹 ''만찢남''·''만찢녀''를 결성하며 대중적으로 크게 유행했다.',
    '2012년경 온라인에서 시작, 2016년 방송 프로젝트 그룹으로 대중화', '외모 칭찬 표현으로 무난하게 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A7%8C%EC%B0%A2%EB%82%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우주의 기운', '우주의-기운', array['온 우주가 도와준다']::text[], '박근혜 전 대통령 어록을 풍자하는 정치 밈', '박근혜 전 대통령이 ''간절히 원하면 우주가 나서서 도와준다''고 발언한 데서 비롯된 표현. 2016년 최순실 게이트가 터지며 무속·비선실세 논란과 엮여 정부를 조롱하는 풍자 밈으로 폭발적으로 쓰였다.',
    '박근혜 전 대통령 발언에서 유래, 2016년 최순실 게이트 계기로 밈화', '정치 풍자 맥락에서 사용, 시사 이해가 필요', '특정 정치 성향 논쟁으로 번질 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EC%9A%B0%EC%A3%BC%EC%9D%98%20%EA%B8%B0%EC%9A%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야민정음', '야민정음', array['댕댕이','띵작','커여워']::text[], '글자 모양이 비슷한 다른 글자로 바꿔쓰는 놀이', '훈민정음과 디시인사이드 국내야구 갤러리(야갤)를 합친 말로, 모양이 비슷한 한글 자모를 바꿔 쓰는 언어유희다. 멍멍이를 댕댕이로, 명작을 띵작으로 쓰는 식이며 2014년 야갤에서 시작해 2016년 전후로 폭발적으로 유행하며 다양한 커뮤니티로 퍼졌다.',
    '2014년 디시인사이드 국내야구 갤러리에서 시작', '귀엽고 장난스러운 맥락에서 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%95%BC%EB%AF%BC%EC%A0%95%EC%9D%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인싸/아싸', '인싸/아싸', array['인사이더','아웃사이더','핵인싸']::text[], '무리와 잘 어울리는 사람과 겉도는 사람을 뜻함', '인사이더(insider)를 줄인 ''인싸''는 사람들과 잘 어울리는 사람을, 아웃사이더를 줄인 ''아싸''는 무리에 섞이지 못하는 사람을 가리킨다. 대학가 은어였던 아싸가 2017년 이후 10대까지 확산되며 인싸와 짝을 이뤄 전국민적 유행어가 됐다.',
    '대학가 은어에서 시작, 2017년 이후 10대까지 확산', '친목 관계를 가볍게 표현할 때 사용', '아싸를 대상으로 놀리는 용도로 쓰면 상처가 될 수 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9D%B8%EC%8B%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오지고 지리고 렛츠고', '오지고-지리고-렛츠고', array['오지고 지리고 렛잇고']::text[], '감탄과 흥분을 과장해서 표현하는 급식체 유행어', '''오지다'', ''지리다'' 등 감탄사에 라임을 맞춘 영어 표현을 붙여 만든 급식체 유행어. 2017년 하반기 10대 사이에서 유행하기 시작해 SNL 코리아 등 방송에서 다뤄지며 전국적으로 알려졌다.',
    '2017년 10대 온라인 커뮤니티에서 유행 시작', '장난스러운 감탄 표현으로 또래 사이에서 사용', '''지리다''는 원래 실금을 뜻하는 비속어라 격식 있는 자리에는 부적절',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나야나(프로듀스101)', '나야나(프로듀스101)', array['PICK ME','나야 나']::text[], '프로듀스101 시즌2 주제곡이자 국민 밈이 된 곡', 'Mnet 서바이벌 프로그램 프로듀스101 시즌2(2017)의 주제곡으로 연습생들이 ''나야 나''를 외치며 자신을 어필하는 안무가 화제가 됐다. 특유의 과장된 표정과 몸짓이 각종 패러디와 합성 짤로 재생산되며 2017년 대표적인 예능·인터넷 밈이 됐다.',
    '2017년 Mnet 프로듀스101 시즌2 방영을 계기로 확산', '자기 어필이나 선택을 바라는 상황을 유쾌하게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'YouTube', 'https://www.youtube.com/watch?v=NIld_iEc67s', 'embeddable'::copyright_status from ins where true;
insert into meme_contents (meme_id, type, platform, content_id, url, is_representative)
select id, 'embed'::media_type, 'YouTube', 'NIld_iEc67s', 'https://www.youtube.com/watch?v=NIld_iEc67s', true from memes where slug = '나야나(프로듀스101)'
on conflict do nothing;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('존버', '존버', array['존나 버티기','존버는 승리한다']::text[], '힘든 상황에서도 끝까지 버티는 것을 뜻하는 유행어', '''존나 버티다''의 줄임말로 힘들어도 포기하지 않고 버티는 태도를 뜻한다. 스타크래프트 은어에서 비롯됐다는 설이 있으며 2017년 암호화폐(비트코인) 투자 열풍을 타고 ''존버는 승리한다''는 표현으로 크게 유행했다.',
    '스타크래프트 은어에서 유래한 것으로 추정, 2017년 암호화폐 투자 열풍으로 재유행', '포기하지 않고 버티는 상황을 응원할 때 사용', '비속어 ''존나''가 포함돼 격식 있는 자리에는 부적절',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A1%B4%EB%B2%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('가즈아', '가즈아', array['가즈아!!']::text[], '투자 대상이 오르길 기원하는 응원 감탄사', '''가자''를 길게 늘여 발음한 감탄사로 원래 스포츠 도박 응원 표현이었으나 2017년 하반기 암호화폐(비트코인) 투자 열풍을 타고 폭발적으로 유행했다. 방송, 게임 등 다양한 분야로 확산됐다.',
    '스포츠 도박 응원 표현에서 유래, 2017년 하반기 비트코인 열풍으로 대유행', '무언가 잘 되길 응원할 때 유쾌하게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%80%EC%A6%88%EC%95%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼밥/혼술', '혼밥/혼술', array['혼족','혼영']::text[], '혼자 밥 먹고 술 마시는 문화를 뜻하는 신조어', '혼자 밥을 먹는 ''혼밥'', 혼자 술을 마시는 ''혼술''을 가리키는 신조어로 1인 가구 증가와 개인주의 문화 확산을 상징한다. 2010년대 초 등장했으나 언급량이 2016년 급증하며 본격적으로 사회 트렌드로 자리잡았다.',
    '1인 가구 증가와 함께 등장, 2016년 언급량 급증하며 대중화', '혼자만의 시간을 즐기는 라이프스타일을 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://ko.wikipedia.org/wiki/%ED%98%BC%EC%A1%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('신박하다', '신박하다', array['신박함']::text[], '새롭고 놀랍다는 뜻으로 정착된 인터넷 신조어', '''새롭고 놀랍다''는 뜻의 형용사로 원래 디시인사이드 WOW(월드오브워크래프트) 갤러리 은어였다. 어원을 알기 어려울 만큼 자연스러운 말투 덕분에 2018년경 방송과 신문 제목까지 광범위하게 쓰이는 표준어급 신조어가 됐다.',
    '디시인사이드 WOW 갤러리 은어에서 출발, 2018년경 전국민적으로 대중화', '참신하고 놀라운 것을 칭찬할 때 무난하게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2018, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%8B%A0%EB%B0%95%ED%95%98%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오또케', '오또케', array['오또케오또케']::text[], '여성 무능을 조롱하는 데 악용된 젠더 혐오 표현', '''어떡해''를 애교스럽게 표현한 아이돌 말투였으나 2018년 디시인사이드 만화 갤러리 게시물을 계기로 여성을 무능하고 나약하게 묘사해 조롱하는 혐오 표현으로 변질됐다. 2019년 대림동 여경 논란과 엮이며 남초 커뮤니티에서 여성 비하 목적으로 확산됐다.',
    '아이돌 애교 표현에서 출발, 2018년 디시인사이드에서 여성혐오 표현으로 변질', '아카이브·비평 목적 외 실사용 비권장', '여성을 무능하다고 조롱하는 혐오 표현으로 악용된 사례',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2018, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%98%A4%EB%98%90%EC%BC%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('현타', '현타', array['현자타임','현실 자각 타임']::text[], '열중하다 갑자기 허탈해지는 순간을 뜻하는 신조어', '원래 성적 행위 직후의 무기력한 심리 상태를 가리키던 은어였으나 ''현실 자각 타임''이라는 재해석을 거쳐 무언가에 몰두하다 문득 허무함이나 후회를 느끼는 순간을 뜻하는 말로 확장됐다. 2018년 전후 10~20대 사이에서 널리 쓰이는 일상어가 됐다.',
    '성적 은어에서 출발, ''현실 자각 타임''으로 재해석되며 대중화', '몰입 후 허탈한 감정을 표현할 때 사용', '원래 성적 은어에서 파생된 만큼 어원을 이야기할 땐 맥락 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2018, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%98%84%ED%83%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사이다', '사이다', array['사이다 발언','사이다 전개']::text[], '답답함이 시원하게 풀리는 통쾌한 상황·발언을 뜻함', '막힌 속을 뚫어주는 탄산음료 사이다에 빗대 통쾌한 전개나 발언을 가리키는 말. 반대말인 ''고구마''와 짝을 이뤄 2015~2016년 크게 유행했다. 드라마·예능 감상평에 자주 쓰였다.',
    '2013년경 고구마와 짝을 이루는 신조어로 등장, 2015~2016년 언론 보도로 대중화', '통쾌한 전개나 발언에 감상평으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%82%AC%EC%9D%B4%EB%8B%A4(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('고구마', '고구마', array['고구마 전개','답답함']::text[], '목이 막히듯 답답한 상황·전개를 뜻함', '사이다의 반대말로, 먹으면 목이 메는 고구마에 빗대 답답한 상황이나 캐릭터를 가리킨다. 드라마·웹툰 전개가 갑갑할 때 흔히 쓰였다.',
    '2013년경 등장, 사이다와 짝을 이루며 2015년 전후 대중화', '답답한 전개나 상황에 감상평으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B3%A0%EA%B5%AC%EB%A7%88(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아싸', '아싸', array['아웃사이더']::text[], '무리에 어울리지 못하는 사람, 아웃사이더의 줄임말', 'outsider를 줄인 대학가 은어로 무리에 섞이지 못하고 혼자 지내는 사람을 뜻한다. 인싸의 반대말로 함께 유행하며 반싸·마싸 등 파생어도 생겼다.',
    '대학생 은어에서 시작, 인싸의 반대 개념으로 확산', '자조적으로 자신의 성향을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%95%84%EC%8B%B8(%EC%8B%A0%EC%A1%B0%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('창렬스럽다', '창렬스럽다', array['창렬']::text[], '가격 대비 부실한 제품·구성을 비꼬는 말', '가수 김창렬의 이름을 딴 편의점 냉동식품이 가격에 비해 부실하다는 평을 받으며 생긴 말. 이후 가성비 나쁜 제품 전반을 가리키는 신조어로 굳어졌다. 반대말은 ''혜자스럽다''.',
    '김창렬 이름을 붙인 편의점 냉동식품 리뷰에서 유래', '가성비 나쁜 상품·서비스를 유머러스하게 비판할 때', '특정인 이름을 부정적으로 소비하는 표현이라 당사자 언급 시 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%B0%BD%EB%A0%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혜자스럽다', '혜자스럽다', array['혜자']::text[], '가격 대비 알찬 구성을 칭찬하는 말', '탤런트 김혜자 이름을 내건 편의점 도시락이 가성비가 좋다는 평을 받으며 생긴 신조어. 창렬스럽다의 반대말로 함께 유행했다.',
    '김혜자 이름의 편의점 도시락 브랜드에서 유래', '가성비 좋은 제품이나 상황을 칭찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('롬곡옾눞', '롬곡옾눞', array['롬곡옾높','폭풍눈물 뒤집기']::text[], '''폭풍눈물''을 위아래로 뒤집어 쓴 말장난 표기', '''폭풍눈물''이라는 글자를 상하로 뒤집으면 ''롬곡옾눞''처럼 보인다는 데서 나온 말장난 밈. 2018년경 온라인 커뮤니티에서 신기한 한글 뒤집기 사례로 화제가 됐다.',
    '한글 자모 뒤집기 놀이에서 발견돼 커뮤니티에 공유되며 확산', '슬프거나 눈물 나는 상황을 위트있게 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('억까', '억까', array['억지로 까기']::text[], '근거 없이 억지로 비난하는 것을 뜻함', '게임 로스트아크 유저들이 불합리한 패턴을 두고 쓰던 말에서 시작돼, 이후 억지스러운 비난 전반을 가리키는 신조어로 퍼졌다.',
    '로스트아크 이용자 커뮤니티에서 발생', '부당하고 억지스러운 비난 상황을 지적할 때', null,
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2019, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%B5%EA%B9%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('돈쭐', '돈쭐', array['돈쭐내다']::text[], '선행 가게를 매출로 응원하는 것을 뜻함', '''돈''과 ''혼쭐내다''를 합친 역설적 표현으로, 어려운 형제에게 무료로 치킨을 준 가게 사연에 사람들이 몰려 주문 폭주를 일으킨 사건에서 비롯됐다.',
    '2019년 7월 홍대 파스타 가게 등 선행 자영업자 미담이 알려지며 확산', '선행을 베푼 가게를 응원하며 쓰는 말', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2019, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%8F%88%EC%AD%90%EB%82%B4%EB%8B%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('팩폭', '팩폭', array['팩트폭행','팩트폭력']::text[], '사실을 있는 그대로 말해 상대에게 상처 주는 것', '''팩트''와 ''폭행''을 합친 말로 돌려 말하지 않고 정곡을 찌르는 직설적 발언을 가리킨다. 2017년 전후 예능·커뮤니티에서 자주 쓰였다.',
    '온라인 커뮤니티에서 ''사실 지적''을 가리키는 말로 확산', '아프지만 맞는 말을 들었을 때 반응으로 사용', '상대에게 상처를 주는 발언을 정당화하는 데 쓰이지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('세젤예', '세젤예', array['세상에서 제일 예쁨']::text[], '세상에서 제일 예쁘다는 뜻의 감탄 표현', '''세상에서 제일''을 줄인 ''세젤''에 ''예쁘다''를 붙인 말로 주로 여초 커뮤니티에서 여자 연예인을 향한 감탄사로 쓰였다. 세젤귀, 세젤착 등 파생어가 있다.',
    '2015년경 여초 커뮤니티(여성 팬덤)에서 연예인 감탄사로 등장', '좋아하는 대상의 외모를 극찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%84%B8%EC%A0%A4%EC%98%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('케바케', '케바케', array['Case by case']::text[], '상황에 따라 다르다는 뜻의 줄임말', '영어 ''Case by case''를 한국식으로 줄인 표현으로 2010년대 후반 온라인과 일상 대화에서 널리 쓰였다. ''사바사''와 짝을 이룬다.',
    '영어 표현 Case by case를 한글 발음대로 줄여 사용', '상황마다 다르다는 점을 가볍게 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('사바사', '사바사', array['사람 by 사람']::text[], '사람마다 다르다는 뜻의 줄임말', '''사람 by 사람''을 줄인 말로 케바케와 같은 시기에 함께 유행하며 개인차를 강조할 때 쓰였다.',
    '케바케의 파생 표현으로 등장', '사람에 따라 다르다는 점을 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('급식충', '급식충', array['급식체 사용자 비하']::text[], '급식 먹는 10대 청소년을 비하하는 말', '학교 급식을 먹는 초중고생을 벌레에 빗대 낮잡아 부르는 말로, 여기서 파생된 10대 특유의 말투가 ''급식체''라 불리게 됐다.',
    '어른 세대가 10대를 비하하며 만든 ''~충'' 계열 멸칭', '아카이브·설명 목적 외 실제 대상에게 직접 쓰지 않는 것이 좋음', '청소년 전체를 비하하는 멸칭이므로 사용에 주의가 필요함',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('별다줄', '별다줄', array['별걸 다 줄임']::text[], '뭐든지 줄여 말하는 신조어 세태를 가리킴', '''별걸 다 줄인다''는 뜻으로 급식체·신조어들이 지나치게 줄임말로 만들어지는 현상 자체를 가리키는 자조적 표현이다.',
    '청소년 줄임말 신조어 세태를 비꼬며 등장', '과도한 줄임말 사용 세태를 가볍게 지적할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('애빼시', '애빼시', array['애교 빼면 시체']::text[], '애교가 없으면 아무것도 아니라는 뜻', '''애교 빼면 시체''의 줄임말로 애교가 매력의 전부라는 뜻으로 쓰인 신조어. 2017년 전후 청소년 은어 목록에 자주 등장했다.',
    '청소년 은어 목록으로 언론에 소개되며 확산', '애교 많은 사람을 놀리듯 칭찬할 때', null,
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
  values ('갓띵작', '갓띵작', array['God+명작']::text[], '최고의 명작이라는 뜻의 감탄 표현', '신을 뜻하는 ''갓''과 명작을 발음을 살짝 비튼 ''띵작''을 합친 말로, 애니메이션·게임 등 최고의 작품을 극찬할 때 쓰인다.',
    '''갓'' 접두사 유행과 자음 유사 표기 놀이(띵작)가 결합', '뛰어난 작품을 극찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('갑통알', '갑통알', array['갑자기 통장을 보니 알바']::text[], '통장 잔고를 보고 알바를 결심하게 되는 상황', '''갑자기 통장을 보니 알바를 해야 할 것 같다''는 뜻의 줄임말로 청년층의 경제적 어려움을 자조적으로 표현한 신조어다.',
    '청년층 사이에서 경제적 자조 표현으로 등장', '갑자기 돈이 궁해진 상황을 자조적으로 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('뇌피셜', '뇌피셜', array['뇌+오피셜']::text[], '근거 없는 개인 생각을 사실처럼 주장하는 것', '''뇌''와 ''오피셜(공식)''을 합친 말로, 증거 없는 개인 추측을 마치 공인된 사실처럼 말하는 행위나 사람을 가리킨다.',
    '온라인 커뮤니티에서 근거 없는 주장을 비꼬며 등장', '근거 없는 추측성 발언임을 지적할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%87%8C%ED%94%BC%EC%85%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안물안궁', '안물안궁', array['안 물어봤고 안 궁금함']::text[], '묻지도 궁금하지도 않다는 뜻의 줄임말', '''안 물어봤고 안 궁금하다''를 줄인 말로, 상대가 원치 않는 정보나 잔소리를 늘어놓을 때 쓰는 방어적 표현이다.',
    '청소년 사이에서 상대의 참견을 차단하는 표현으로 등장', '원치 않는 참견이나 잔소리를 가볍게 차단할 때', '무례하게 들릴 수 있어 상대와 관계에 따라 조심스럽게 사용',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('취존', '취존', array['취향 존중']::text[], '각자의 취향을 존중하자는 뜻의 줄임말', '''취향 존중''을 줄인 말로 타인의 개인적 선호나 취향을 있는 그대로 인정하자는 의미로 쓰인다.',
    '청소년·청년 온라인 문화에서 개인 취향 존중 태도로 확산', '서로 다른 취향을 존중하자고 말할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('순삭', '순삭', array['순간 삭제']::text[], '눈 깜짝할 사이 사라졌다는 뜻의 줄임말', '''순간 삭제''의 줄임말로 게임에서 캐릭터가 시작하자마자 죽는 상황을 가리키던 말이 시간이 순식간에 지나갔다는 뜻으로 확장됐다.',
    '온라인 게임 커뮤니티에서 유래', '시간이 빨리 지나간 느낌을 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('저세상', '저세상', array['이 세상 것이 아닌']::text[], '상식을 초월한 수준을 가리키는 강조 표현', '음료 광고 카피 ''이 세상 커피가 아니다''에서 파생돼 2017년부터 ''저세상 텐션''처럼 상상을 초월하는 무언가를 강조하는 접두어로 쓰였다.',
    '레쓰비 광고 카피에서 파생돼 온라인에서 재유행', '무언가를 극단적으로 강조하고 싶을 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2017, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A0%80%EC%84%B8%EC%83%81', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('좋댓구알', '좋댓구알', array['좋아요 댓글 구독 알림설정']::text[], '좋아요·댓글·구독·알림설정을 줄인 유튜브 용어', '유튜버들이 시청자에게 요청하는 ''좋아요, 댓글, 구독, 알림설정''을 줄인 말로 유튜브 대중화와 함께 2018년 이후 널리 쓰였다.',
    '유튜브 크리에이터들의 구독 유도 멘트에서 파생', '유튜브 콘텐츠에 대한 지지를 요청·표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('개이득', '개이득', array['ㄱㅇㄷ']::text[], '아주 큰 이득이라는 뜻의 강조 표현', '접두사 ''개-''와 ''이득''을 합친 말로 리그오브레전드 방송인 해물파전이 퍼뜨리며 게임 커뮤니티를 넘어 널리 퍼졌다.',
    'BJ 해물파전의 리그오브레전드 방송에서 확산', '뜻밖의 이득이나 행운을 강조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%9C%EC%9D%B4%EB%93%9D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핵이득', '핵이득', array['핵+이득']::text[], '개이득보다 더 강조된 엄청난 이득', '''개이득''에 강조 접두사 ''핵''을 붙인 표현으로 더 큰 이득이나 행운을 강조할 때 쓰인다.',
    '''개이득''의 강조형으로 파생', '아주 큰 이득이나 행운을 강조할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('인만추', '인만추', array['인위적인 만남 추구']::text[], '소개팅 등 인위적인 만남을 추구한다는 뜻', '''인위적인 만남 추구''의 줄임말로 소개팅·미팅 등 주선된 만남을 선호하는 연애관을 가리킨다. 자만추와 함께 2018년 유행했다.',
    '자만추의 반대 개념으로 함께 등장', '소개팅 등 주선된 만남을 선호할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('혼밥', '혼밥', array['혼자 밥먹기']::text[], '혼자 밥을 먹는 문화·행위를 뜻함', '''혼자''와 ''밥''을 합친 말로 1인 가구 증가와 함께 2016년 언급량이 폭발적으로 늘며 새로운 라이프스타일 트렌드로 자리잡았다.',
    '1인 가구 증가 트렌드 속에서 확산, tvN 드라마 ''혼술남녀'' 방영으로 재조명', '혼자 밥 먹는 것을 즐기는 문화를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%ED%98%BC%EB%B0%A5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('혼술', '혼술', array['혼자 술마시기']::text[], '혼자 술을 마시는 문화·행위를 뜻함', '''혼자''와 ''술''을 합친 말로 혼밥과 함께 2016년 tvN 드라마 ''혼술남녀'' 방영을 계기로 널리 알려졌다.',
    '1인 가구·개인주의 트렌드 확산 속 tvN 드라마 방영으로 대중화', '혼자 술 마시는 여가를 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%ED%98%BC%EC%88%A0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('갈비', '갈비', array['갈수록 비호감']::text[], '갈수록 비호감이 된다는 뜻의 줄임말', '''갈수록 비호감''을 줄인 신조어로, 처음엔 괜찮았지만 시간이 지날수록 부정적으로 느껴지는 사람이나 상황을 가리킨다.',
    '청소년 신조어로 언론에 소개되며 확산', '점점 비호감이 되는 상황을 가볍게 표현할 때', '특정인을 직접 겨냥하면 무례하게 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2015, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%88%EB%B9%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('핑프', '핑프', array['핑거프린세스','핑거프린스']::text[], '검색하면 나올 정보도 굳이 물어보는 사람', '''finger princess''를 줄인 말로 스스로 검색하지 않고 커뮤니티에 질문 글부터 올리는 사람을 가리킨다. 여초 커뮤니티에서 시작해 2016년 전후 널리 쓰였다.',
    '2012년경 여초 커뮤니티에서 시작, 이후 전반적으로 확산', '검색으로 해결 가능한 질문을 반복하는 사람을 지적할 때', '상대를 게으르다고 조롱하는 뉘앙스가 있어 직접 사용 시 무례할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2016, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%95%91%ED%94%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('있어빌리티', '있어빌리티', array['있어 보이는 능력']::text[], '실제보다 있어 보이게 만드는 연출 능력', '''있다''와 영어 ''ability''를 합친 말로, SNS에 소소한 일상을 그럴듯하게 연출해 올리는 능력을 가리킨다. 2015~2016년 트렌드 키워드로 소개됐다.',
    'SNS 과시 문화를 분석하는 트렌드 용어로 등장', 'SNS 연출을 가볍게 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2015, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Instagram', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('만찢남', '만찢남', array['만화 찢고 나온 남자']::text[], '만화 주인공처럼 잘생긴 남자를 뜻함', '''만화를 찢고 나온 남자''의 줄임말로 실사 같지 않은 뛰어난 외모의 남성을 가리키는 신조어다.',
    '온라인 커뮤니티에서 외모 극찬 표현으로 등장', '만화 캐릭터 같은 외모를 극찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%A7%8C%EC%B0%A2%EB%82%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('만찢녀', '만찢녀', array['만화 찢고 나온 여자']::text[], '만화 주인공처럼 예쁜 여자를 뜻함', '''만화를 찢고 나온 여자''의 줄임말로 실사 같지 않은 뛰어난 외모의 여성을 가리키는 신조어다.',
    '온라인 커뮤니티에서 외모 극찬 표현으로 등장', '만화 캐릭터 같은 외모를 극찬할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2016, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%A7%8C%EC%B0%A2%EB%85%80', 'embeddable'::copyright_status from ins where true;

commit;
