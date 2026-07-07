-- 밈캐치 시드 배치 1 (150 rows)
begin;

with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아햏햏', '아햏햏', array['아행행','어힝어힝힝']::text[], '뜻 없이 쓰던 2000년대 초 디시 유행 감탄사', '2002년 디시인사이드 엽기 갤러리에서 특정 코스프레 사진에 한 유저가 ''어힝어힝힝 아해햏햏''이라는 웃음소리 댓글을 달면서 퍼진 신조어다. ''거시기''처럼 딱히 뜻이 없는 만능 표현으로 쓰였고 2002년 국립국어원 신어 보고서에도 실렸다. 2004년 이후로는 급격히 쓰이지 않게 됐다.',
    '2002년 디시인사이드 엽기 갤러리 댓글에서 발생', '레트로 인터넷 밈 소개할 때 예시로만 언급', '이미 완전히 죽은 표현이라 실제 사용 시 맥락 없이는 이해 못 함',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%95%84%ED%96%8F%ED%96%8F', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('개죽이', '개죽이', array['gaejuggi']::text[], '대나무에 매달린 강아지 사진, 디시 최초의 필수요소', '2002년 한 네티즌이 자신이 기르던 강아지가 마당 대나무에 매달려 있는 사진을 찍어 올린 것이 디시인사이드에서 큰 인기를 끌었다. 2004년 7월 7일 캐릭터 일러스트 버전까지 나오며 폭발적 반응을 얻었고, 이후 ''필수요소'' 합성 놀이 문화의 시초가 된 디시인사이드 초창기 공인 마스코트다.',
    '2002년 개인이 촬영한 강아지 사진이 디시인사이드에 퍼짐', '한국 인터넷 밈 역사, 짤방 문화 설명할 때 좋은 예시', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 2004, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%9C%EC%A3%BD%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('필수요소', '필수요소', array['합성 필수요소']::text[], '패러디 합성에 반드시 들어가는 소스 이미지를 뜻하는 말', '개죽이 등 특정 이미지나 소리가 온갖 패러디 합성물에 반복적으로 쓰이면서 ''이건 합성에 꼭 들어가야 하는 요소''라는 뜻으로 붙은 디시인사이드발 용어다. 2004년 전후로 굳어졌고 지금도 템플릿형 밈을 지칭할 때 쓰인다.',
    '2004년경 디시인사이드 합성 갤러리 문화에서 정착', '템플릿 밈, 반복 합성 소재를 설명할 때 그대로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짤방', '짤방', array['짤림방지','짤']::text[], '글이 삭제되지 않게 붙이는 이미지, 지금의 ''짤''의 어원', '초창기 디시인사이드에서 사진 없는 글을 삭제하는 규정을 피하려고 아무 이미지나 첨부한 데서 ''짤림방지''가 줄어 ''짤방''이 됐다. 이후 재밌는 인터넷 이미지 전반을 가리키는 ''짤''이라는 말의 기원이 됐다.',
    '2000년경 디시인사이드 게시판 규정 우회 관행에서 생김', '지금도 ''짤'' ''짤방''이라는 말 자체로 일상적으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기토끼 마시마로', '엽기토끼-마시마로', array['마시마로','Mashimaro']::text[], '엽기적이고 뻔뻔한 표정의 토끼 플래시 캐릭터', '2000년 김재인 작가가 만든 플래시 애니메이션 캐릭터로, 순진한 외모와 달리 폭력적이고 엽기적인 개그를 선보여 큰 인기를 끌었다. 2000년대 초 한국 인터넷 캐릭터 붐을 이끈 대표작 중 하나다.',
    '2000년 김재인 작가의 개인 플래시 애니메이션 연재', '2000년대 초 캐릭터 밈 붐 설명할 때 언급', '원작 개그가 폭력적이고 엽기적인 장면이 많아 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('졸라맨', '졸라맨', array['Jjollaman']::text[], '단순한 졸라맨 그림체로 만든 폭력 개그 플래시 시리즈', '1999~2000년경 마리오네트 등이 제작한 졸라맨(막대인간) 캐릭터 플래시 애니메이션 시리즈로, 단순한 그림체와 과격한 슬랩스틱 개그로 인기를 끌었다. 초기 한국 플래시 밈 문화의 대표 사례다.',
    '1999~2000년 개인 제작자들의 플래시 애니메이션 연재', '초기 플래시 밈 사례로 언급, 이름 자체가 비속어 유래임을 인지', '''졸라''라는 비속어에서 이름이 유래해 격식 있는 자리에는 부적절',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1999, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스노우캣', '스노우캣', array['Snowcat','이한나']::text[], '온라인 다이어리 감성 캐릭터의 원조 격 고양이 그림', '1999년 이일호 작가가 연재한 온라인 다이어리 ''이한나의 스노우캣''의 캐릭터로, 소소한 일상 감성을 담은 단순한 그림체가 인기를 끌며 초기 한국 개인 홈페이지·블로그 문화를 상징하는 캐릭터가 됐다.',
    '1999년 이일호 작가의 개인 홈페이지 연재 다이어리', '2000년대 초 개인 홈페이지·감성 캐릭터 문화 설명 시 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('얼짱', '얼짱', array['얼굴짱']::text[], '''얼굴 최고''라는 뜻의 2001년 등장 신조어, 외모 트렌드의 시작', '''얼굴''과 ''최고''를 뜻하는 ''짱''이 합쳐진 말로 2001년 등장했다. 다음 카페 등 온라인 커뮤니티를 중심으로 ''얼짱''이 잇따라 발굴되며 하나의 사회 현상으로 번졌고, 이후 외모지상주의 논쟁의 시작점으로도 언급된다.',
    '2001년 온라인 커뮤니티·카페 문화에서 시작', '2000년대 초 외모 트렌드·온라인 문화 설명 시 사용', '외모 평가 문화라는 점에서 지금 기준으로는 조심스러운 소재',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2001, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%BC%EC%A7%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('얼짱각도', '얼짱각도', array['45도 각도']::text[], '카메라를 45도로 기울여 찍으면 예뻐 보인다는 촬영 각도론', '2003년경 수배 전단 속 인상착의 사진이 오히려 매력적으로 보인다는 반응이 퍼지며 ''얼짱각도''라는 말이 유행했다. 카메라와 얼굴 각도를 조절해 얼굴이 작고 예뻐 보이게 찍는 촬영법을 뜻하며 얼짱 신드롬과 함께 확산됐다.',
    '2003년 한 수배 사진이 화제가 되며 파생된 용어', '셀카 문화 초창기 사례로 설명할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('다모폐인', '다모폐인', array['폐인']::text[], '드라마에 밤새 몰입해 눈 밑이 시커매진 팬을 부르던 말', '2003년 MBC 드라마 ''다모'' 팬들이 온라인 게시판에서 밤새 토론하다 눈 밑이 시커매졌다는 데서 ''폐인''이라는 신조어가 나왔다. 이후 특정 콘텐츠에 과몰입한 온라인 팬덤을 가리키는 표현으로 널리 쓰이게 됐다.',
    '2003년 MBC 드라마 ''다모'' 온라인 팬 게시판에서 발생', '팬덤 과몰입 현상을 애정 어린 농담으로 언급할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://www.bizhankook.com/bk/article/16943', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('아프냐 나도 아프다', '아프냐-나도-아프다', array['다모 명대사']::text[], '2003년 드라마 ''다모''의 초절정 인기 대사', '2003년 MBC 드라마 ''다모''에서 종사관 황보윤이 다친 채옥에게 건넨 대사로, 절제된 감정 표현이 큰 화제를 모으며 그해 최고의 유행어 중 하나가 됐다. ''다모폐인''이라는 신조어를 만든 장면이기도 하다.',
    '2003년 MBC 드라마 ''다모'' 대사', '공감·위로 표현을 장난스럽게 인용할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%8B%A4%EB%AA%A8(%EB%93%9C%EB%9D%BC%EB%A7%88)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('선영아 사랑해', '선영아-사랑해', array['선영아 사랑해 광고']::text[], '2000년 전국을 궁금하게 만든 정체불명 게릴라 광고 문구', '2000년 4월 서울 곳곳 대학가와 강남역 등에 손글씨체로 ''선영아 사랑해''라고 적힌 벽보와 현수막이 붙어 고백 소동으로 오해를 샀다. 나중에 여성 포털 ''마이클럽''의 티저 광고로 밝혀지며 한국 게릴라·티저 마케팅의 대표 사례로 남았다.',
    '2000년 마이클럽닷컴의 오프라인 티저 광고 캠페인', '티저 마케팅·2000년대 초 광고 이야기할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%A7%88%EC%9D%B4%ED%81%B4%EB%9F%BD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('니가 가라 하와이', '니가-가라-하와이', array['친구 명대사']::text[], '2001년 영화 ''친구''의 전국구 유행어가 된 대사', '2001년 영화 ''친구''에서 장동건이 연기한 준석이 던진 대사로, 특유의 사투리 억양과 함께 이후 수년간 각종 패러디와 개그 소재로 반복 인용됐다. 한국 영화 역사상 가장 많이 패러디된 대사 중 하나로 꼽힌다.',
    '2001년 영화 ''친구'' 대사', '친근한 농담이나 패러디 자막으로 지금도 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('우리 친구 아이가', '우리-친구-아이가', array['친구 명대사2']::text[], '2001년 영화 ''친구''의 우정을 상징하는 유행어', '2001년 영화 ''친구'' 속 대사로, 진한 사투리와 우정을 강조하는 어감 때문에 개봉 이후 각종 방송·광고에서 패러디됐다. ''니가 가라 하와이''와 함께 이 영화를 대표하는 양대 유행어다.',
    '2001년 영화 ''친구'' 대사', '친구 사이 끈끈함을 장난스럽게 표현할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('밥은 먹고 다니냐', '밥은-먹고-다니냐', array['살인의 추억 명대사']::text[], '2003년 영화 ''살인의 추억''의 여운 짙은 마지막 대사', '2003년 봉준호 감독 영화 ''살인의 추억''에서 송강호가 연기한 형사가 범인을 향해 남긴 마지막 대사로, 개봉 이후 오랫동안 회자되며 다양한 패러디와 오마주의 대상이 됐다.',
    '2003년 영화 ''살인의 추억'' 대사', '안부를 씁쓸하거나 의미심장하게 물을 때 패러디로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2003, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('왼손은 거들 뿐', '왼손은-거들-뿐', array['슬램덩크 명대사']::text[], '일본 만화 ''슬램덩크''에서 온 한국식 만능 격언 밈', '1998년 SBS에서 방영돼 큰 인기를 끈 애니메이션 ''슬램덩크'' 속 강백호의 대사로, 이후 농구 상황을 넘어 ''결정적인 건 다른 요인이고 이건 그냥 거드는 것''이라는 만능 비유로 한국 인터넷에서 널리 인용됐다.',
    '일본 만화 ''슬램덩크'' 대사, 1998년 한국 애니메이션 방영으로 확산', '본질이 아닌 요소를 겸손하게 표현할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('삼사(3! 4!) 구호', '삼사(3!-4!)-구호', array['룰라 삼사','3!4!']::text[], '1995년 룰라 노래 인트로에서 나온 외침이 만능 구호가 됨', '1995년 그룹 룰라의 노래 ''3! 4!'' 도입부 외침이 크게 유행하며 무언가를 시작할 때 외치는 국민 구호처럼 쓰이게 됐다. 지금도 예능이나 행사에서 시작 신호로 패러디된다.',
    '1995년 그룹 룰라의 곡 ''3! 4!'' 인트로', '뭔가를 시작하기 전 구호로 그대로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('회오리춤', '회오리춤', array['터보 회오리바람 춤']::text[], '1996년 터보의 ''회오리 바람''이 만든 국민 댄스 유행', '1996년 그룹 터보(당시 터보엔진)의 ''회오리 바람'' 안무 중 팔을 회전시키는 동작이 크게 유행하며 학교와 방송 곳곳에서 따라 췄다. 1990년대 중반 댄스 가요 붐을 상징하는 안무 중 하나다.',
    '1996년 그룹 터보 ''회오리 바람'' 안무', '90년대 댄스가요 회고 콘텐츠에서 그대로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'dance'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('쿵따리 샤바라', '쿵따리-샤바라', array['클론 쿵따리샤바라']::text[], '1996년 클론 데뷔곡이 만든 후렴구·안무 유행', '1996년 여름 데뷔한 듀오 클론의 곡으로, 중독성 강한 후렴구와 독특한 안무가 나이트클럽과 학교에서 크게 유행했다. 1990년대 중후반 댄스가요 붐의 대표곡으로 꼽힌다.',
    '1996년 듀오 클론의 데뷔곡', '90년대 가요 회고, 후렴구 패러디에 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('방가방가', '방가방가', array['방가']::text[], '''반가워요''를 줄인 1990년대 PC통신 인사말', '하이텔·천리안 등 PC통신 채팅방에서 쓰던 대표적인 인사말로, ''반가워요''를 발음 나는 대로 줄여 쓴 말이다. 1990년대 채팅체 문화를 상징하는 표현 중 하나다.',
    '1990년대 중반 PC통신 채팅 문화', 'PC통신 세대 감성을 살린 인사말 패러디로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('추카추카', '추카추카', array['추카']::text[], '''축하합니다''를 줄인 1990년대 PC통신식 축하 표현', 'PC통신 채팅방과 게시판에서 쓰이던 표현으로 ''축하''를 귀엽게 변형한 말이다. 방가방가, 당근이지와 함께 1990년대 채팅체를 대표하는 유행어다.',
    '1990년대 중반 PC통신 채팅 문화', '복고풍 축하 인사로 장난스럽게 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('당근이지', '당근이지', array['당근']::text[], '''당연하지''를 재치있게 바꾼 1990년대 PC통신 신조어', '''당연하지''의 ''당연''을 채소 ''당근''으로 바꿔 말장난한 표현으로, PC통신 채팅과 학생들 사이에서 크게 유행했다. 이후 오랫동안 ''물론이지''라는 뜻의 구어체로 쓰였다.',
    '1990년대 중반 학생·PC통신 문화에서 발생', '긍정 대답을 재치있게 할 때 복고풍으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1994, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('글쿠나', '글쿠나', array['그렇구나 줄임']::text[], '''그렇구나''를 줄인 1990년대 채팅체 표현', 'PC통신·초기 인터넷 채팅에서 빠르게 타이핑하기 위해 ''그렇구나''를 줄여 쓰던 말로, 1990년대 후반 채팅체 문화를 대표하는 표현이다.',
    '1990년대 후반 채팅체 문화', '복고풍 채팅체를 흉내낼 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안냐세여', '안냐세여', array['안녕하세요 줄임']::text[], '''안녕하세요''를 발음 나는 대로 쓴 1990년대 채팅체', 'PC통신·초기 메신저 채팅에서 ''안녕하세요''를 발음대로 흘려 쓴 표현으로, 채팅체·통신체라 불리던 1990년대 말 유행 문체를 대표한다.',
    '1990년대 후반 채팅체 문화', '복고풍 채팅체 인사말로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('즐', '즐', array['즐거운 하루']::text[], '인사말이었다가 ''꺼져라''는 뜻으로 변질된 온라인 게임 용어', '온라인 게임 커뮤니티에서 ''즐거운 하루 되세요'' 류 인사말이 줄어 ''즐''이 됐고, 2002년경 전국적으로 크게 유행했다. 이후 거절·비아냥의 뜻으로 의미가 변질돼 다소 무례한 표현으로 굳어졌다.',
    '2000년대 초 온라인 게임 커뮤니티(리니지·바람의나라 등)', '2000년대 초 게임 은어를 설명하는 예시로 사용', '거절·비하 뉘앙스로 변질됐기 때문에 실제 인사말로 쓰면 오해 소지',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2002, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A6%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('냉무', '냉무', array['내용 없음']::text[], '제목만 있고 본문에 내용이 없다는 뜻의 게시판 관례어', '''내용 없음''이 한자 ''無''를 거쳐 ''냉무''로 줄어든 말로, 2000년대 초중반 게시판에서 질문 글 등에 자주 붙였다. 이후 ''제곧내''라는 표현에 자리를 내주며 잘 쓰이지 않게 됐다.',
    '2000년대 초 인터넷 게시판 관례', '레트로 게시판 문화를 설명할 때 언급', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%83%89%EB%AC%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('OTL', 'OTL', array['오티엘','orz']::text[], '알파벳 모양으로 무릎 꿇은 좌절 자세를 표현한 이모티콘', '일본에서 건너온 이모티콘으로 O(머리), T(팔과 몸통), L(다리)이 무릎 꿇고 엎드린 사람 모양을 이룬다. 2000년대 초 한국 개인 블로그·커뮤니티에서 좌절이나 낙담을 표현하는 대표 이모티콘으로 크게 유행했다.',
    '일본에서 유입돼 2000년대 초 한국 온라인 커뮤니티로 확산', '좌절·낙담을 유머러스하게 표현할 때 지금도 통함', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/OTL', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오빠부대', '오빠부대', array['오빠 부대']::text[], '1990년대 아이돌 열성 여성 팬 무리를 부르던 말', '서태지와 아이들, H.O.T 등 1990년대 아이돌 1세대 팬덤이 콘서트장·공항에 대거 몰려다니며 생긴 말로, 열성 팬 집단을 가리키는 표현으로 굳어졌다. 이후 한국 아이돌 팬덤 문화의 초기 형태를 상징하는 용어가 됐다.',
    '1990년대 초중반 아이돌 팬덤 문화(서태지와 아이들 등)', '아이돌 팬덤 역사를 설명할 때 중립적으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1992, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('빠순이', '빠순이', array['빠순']::text[], '여성 아이돌 팬을 비하하던 1990년대 유래 속어', '1990년대 H.O.T·젝스키스 등 1세대 아이돌 팬덤을 향해 붙여진 멸칭으로, 열성 여성 팬을 조롱하는 뜻으로 쓰였다. 지금은 성차별적 표현으로 지적받아 공식적인 자리에서는 쓰지 않는 것이 원칙이다.',
    '1990년대 후반 아이돌 팬덤을 향한 조롱성 속어', '팬덤 혐오 표현의 역사적 사례로만 아카이브용으로 언급', '여성 팬을 비하하는 성차별적 멸칭이라 실사용은 지양해야 함',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 1997, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('도토리', '도토리', array['싸이월드 도토리']::text[], '싸이월드 미니홈피에서 쓰던 가상화폐 ''도토리''', '2001년 서비스를 시작한 싸이월드가 배경음악·아이템 구매에 쓰도록 만든 가상화폐로, 국내 최초의 대중적 온라인 소액결제 모델로 꼽힌다. ''도토리''라는 이름 자체가 2000년대 초 한국 온라인 문화를 상징하는 단어가 됐다.',
    '2001년 싸이월드 미니홈피 서비스', '싸이월드 추억 이야기할 때 향수 소재로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('일촌', '일촌', array['일촌 맺기']::text[], '싸이월드에서 친한 사이를 맺던 ''1촌'' 관계 시스템', '2001년 싸이월드 미니홈피가 도입한 인맥 관계 기능으로, 친척 호칭인 ''촌수''를 빌려와 온라인 친구 관계를 ''1촌''으로 표현했다. SNS 이전 시대 한국식 온라인 인맥 문화를 대표하는 개념이다.',
    '2001년 싸이월드 미니홈피 서비스 기능', 'SNS ''친구 추가'' 개념의 원조로 설명할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('번개(모임)', '번개(모임)', array['벙개']::text[], 'PC통신 동호회에서 즉석으로 잡던 오프라인 모임을 부르던 말', '1990년대 하이텔·천리안 등 PC통신 동호회 회원들이 갑자기 정하는 즉석 오프라인 만남을 ''번개''라 불렀다. 정기모임인 ''정모''와 짝을 이루는 PC통신 문화의 대표 용어다.',
    '1990년대 PC통신 동호회 문화', '즉흥 모임을 지금도 ''번개''라는 말로 그대로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('간지', '간지', array['간지나다']::text[], '일본어 ''느낌''에서 온 ''멋있다''는 뜻의 속어', '일본어 感じ(간지, 느낌)에서 유래한 말로, 2000년대 초 오덕·서브컬처 커뮤니티를 중심으로 ''멋있다''는 뜻의 속어로 퍼졌다. 2003년경엔 이런 일본어투 표현을 풍자하는 ''오덕체'' 패러디 글이 나올 만큼 널리 퍼져 있었다.',
    '일본어 유래, 2000년대 초 한국 오덕 커뮤니티에서 확산', '복고풍 속어 소개 시 그대로 인용 가능', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2003, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%84%EC%A7%80(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('본좌', '본좌', array['본좌등극']::text[], '한 시대를 평정한 최강자에게 붙이는 스타크래프트 팬덤 칭호', '2001년 임요환이 온게임넷 스타리그를 연이어 제패하며 팬들 사이에서 ''본좌''라는 칭호로 불리기 시작했다. 이후 이윤열·최연성·마재윤 등으로 이어지며 e스포츠 역사에서 한 시대를 지배한 최강자를 가리키는 말로 굳어졌다.',
    '2001년 임요환의 스타크래프트 연속 우승 이후 팬덤에서 발생', '어떤 분야 최강자를 가리킬 때 지금도 사용되는 표현', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%B3%B8%EC%A2%8C(%EC%8A%A4%ED%83%80%ED%81%AC%EB%9E%98%ED%94%84%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('테란의 황제', '테란의-황제', array['황제 임요환']::text[], '프로게이머 임요환에게 붙은 전설적 별명', '1.07 패치로 테란이 약세이던 시절 임요환이 온게임넷 스타리그를 연달아 제패하며 얻은 별명이다. 한국 e스포츠 초창기 스타 탄생의 상징적 사례로 꼽힌다.',
    '2001년 임요환의 스타크래프트 리그 우승 이후 붙은 별명', 'e스포츠 역사 이야기할 때 그대로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지식인', '지식인', array['네이버 지식인 답변 짤']::text[], '엉뚱한 질문·답변이 캡처되어 웃음거리가 된 네이버 서비스', '2002년 출시된 네이버 지식iN은 이용자끼리 질문·답변을 주고받는 서비스인데, 그중 황당하거나 기발한 답변들이 캡처돼 유머 게시판에 퍼지며 하나의 웃음 장르가 됐다. 지금도 ''지식인 감성''이라는 말로 이런 유머 코드를 지칭한다.',
    '2002년 네이버 지식iN 서비스 출시 이후 커뮤니티에서 확산', '황당하지만 웃긴 답변을 언급할 때 ''지식인 감성''처럼 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('성지순례', '성지순례', array['성지']::text[], '나중에 유명해진 글을 뒤늦게 찾아가 인증하는 행위', '2001년 7월 디시인사이드에 올라온 한 평범한 판매 글이 훗날 전설적인 게시물로 회자되며, 이를 뒤늦게 찾아와 댓글을 남기는 행위를 종교 순례에 빗대 ''성지순례''라 부르기 시작했다. 지금도 화제가 된 과거 글·영상을 찾아갈 때 널리 쓰는 표현이다.',
    '2001년 디시인사이드의 유명 게시물에서 파생된 관행', '지금도 유명 게시물 댓글에 ''성지순례 왔습니다''로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2001, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%84%B1%EC%A7%80%EC%88%9C%EB%A1%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('합죽이가 됩시다 합', '합죽이가-됩시다-합', array['합!']::text[], '떠드는 사람을 조용히 시킬 때 쓰던 개그콘서트식 유행어', '2000년대 초 개그콘서트 ''봉숭아학당'' 코너에서 소란한 교실을 조용히 시킬 때 쓰인 대사로, 방영 당시 학생들 사이에서 실제로 따라 하며 크게 유행했다. 이후 여러 가수가 이 문구를 노래 제목으로 샘플링할 만큼 오래 회자됐다.',
    '2000년대 초 KBS 개그콘서트 ''봉숭아학당'' 코너', '교실이나 모임에서 조용히 시킬 때 장난스럽게 인용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%95%A9%EC%A3%BD%EC%9D%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엽기', '엽기', array['엽기적인']::text[], '2000년대 초 한국을 휩쓴 ''엽기적인'' 트렌드 자체를 가리키는 말', '본래 잔혹한 범죄를 뜻하던 ''엽기''가 2000년 전후 영화 ''엽기적인 그녀''와 엽기토끼 마시마로 등의 유행을 거치며 ''기상천외하고 황당하다''는 뜻의 유행어로 의미가 바뀌었다. 2000년대 초반 한국 대중문화 전반의 유행어였다.',
    '2000년 전후 영화·캐릭터 콘텐츠를 통해 의미가 확장', '황당하고 기발한 상황을 가리킬 때 복고풍으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2000, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뿌까', '뿌까', array['Pucca']::text[], '2000년 등장한 중식당 소녀 캐릭터, 초기 한국 캐릭터 IP 성공 사례', '국내 업체 부즈(VOOZ)가 2000년 선보인 플래시 애니메이션 캐릭터로, 짝사랑하는 소년을 쫓아다니는 중식당 딸 소녀를 주인공으로 했다. 이후 해외에서도 큰 인기를 끌며 초기 한국 캐릭터 산업의 성공 사례로 꼽힌다.',
    '2000년 부즈(VOOZ)의 플래시 애니메이션 캐릭터로 출시', '2000년대 초 한국 캐릭터 산업 성공 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('GG', 'GG', array['good game']::text[], '게임을 마칠 때 예의로 치는 ''good game''의 줄임말', '1998년 스타크래프트가 한국에서 폭발적으로 흥행하며 배틀넷 채팅 문화를 통해 ''GG''라는 표현이 대중화됐다. 승부가 갈린 뒤 상대에게 예의를 표하는 인사로, 지금도 모든 게임 장르에서 국제 공용어처럼 쓰인다.',
    '1998년 스타크래프트 배틀넷 채팅 문화에서 대중화', '게임이 끝났을 때 지금도 그대로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1998, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('광안리 대첩', '광안리-대첩', array['광안리 10만 대첩']::text[], '2004년 광안리 해수욕장에 10만 인파가 몰린 스타크래프트 결승전', '2004년 7월 17일 SKY 프로리그 결승전이 사상 처음 수도권을 벗어나 부산 광안리해수욕장에서 열렸고, 약 10만 명의 관중이 몰려 e스포츠 역사에 남을 장관을 연출했다. 이날 경기는 이후 ''광안리 대첩''이라는 이름으로 두고두고 회자된다.',
    '2004년 7월 부산 광안리해수욕장 SKY 프로리그 결승전', '한국 e스포츠 전성기 상징 사건으로 그대로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2004, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://ko.wikipedia.org/wiki/%EA%B4%91%EC%95%88%EB%A6%AC_%EB%8C%80%EC%B2%A9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안습', '안습', array['안구에 습기']::text[], '''안구에 습기 차다''를 줄인, 안타깝고 처량한 상황을 뜻하는 말', '개그맨 지상렬이 방송에서 자존심 상한 상황을 ''안구에 습기 차네''라고 표현한 데서 비롯됐고, 이를 네티즌들이 ''안습''으로 줄여 쓰며 대유행했다. 슬프거나 민망하고 처량한 상황을 가리킬 때 두루 쓰였다.',
    '방송인 지상렬의 방송 발언에서 네티즌이 줄여 만든 말', '안타까운 상황에 대한 댓글 반응으로 복고풍으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2003, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%95%88%EC%8A%B5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('낚였다', '낚였다', array['낚시글','떡밥']::text[], '제목과 다른 내용으로 클릭을 유도하는 게시물에 속았다는 뜻', '일본 대형 게시판 문화에서 건너온 개념으로, 그럴듯한 제목으로 호기심을 자극해 놓고 전혀 다른 내용을 보여주는 게시물을 ''낚시''라 부르고 여기에 속은 것을 ''낚였다''고 표현했다. 2000년대 초 한국 커뮤니티에서 자리 잡은 뒤 지금도 클릭베이드를 가리키는 표현으로 쓰인다.',
    '일본 게시판 문화에서 유입돼 2000년대 초 한국 커뮤니티에 정착', '클릭베이드에 속았을 때 지금도 그대로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쩐다', '쩐다', array['쩔어']::text[], '''대단하다, 굉장하다''는 뜻의 2000년대 초 PC방 감탄사', '2000년대 초 PC방과 게임 커뮤니티를 중심으로 퍼진 감탄사로, 실력이나 상황이 굉장할 때 ''쩐다'' ''쩔어''라고 표현했다. 이후 ''쩔다''는 형태로 오랫동안 젊은층 구어체에 남았다.',
    '2000년대 초 PC방·게임 커뮤니티 문화', '놀라움을 복고풍으로 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2002, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('참새 시리즈', '참새-시리즈', array['참새시리즈']::text[], '참새가 등장하는 말장난·아재개그로 유명한 1990년대 조크 시리즈', '참새를 주인공으로 한 짧은 말장난 유머들을 모은 시리즈로, PC통신과 유머집을 통해 1990년대 학생들 사이에서 크게 유행했다. 최불암·덩달이 시리즈 등과 함께 한국식 시리즈 유머 붐을 이끈 대표작이다.',
    '1990년대 PC통신·유머집을 통해 유행한 조크 장르', '90년대 아재개그·조크 시리즈 회고 소재로 사용', '일부 버전에 다소 저속한 내용이 섞여 있어 대상 고려 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('최불암 시리즈', '최불암-시리즈', array['최불암시리즈']::text[], '배우 최불암의 이름을 빌린 엉뚱한 답변형 조크 시리즈', '실존 배우 최불암의 이름을 빌려 진지한 질문에 엉뚱한 답을 내놓는 형식의 유머 시리즈로, 1990년대 초중반 학생들 사이에서 폭발적으로 유행했다. 실제 최불암 본인과는 무관한 순수 말장난 유머다.',
    '1990년대 초 학생들 사이에서 구전·유머집으로 확산', '90년대 유머 시리즈 회고 소재로 언급', '실존 인물의 이름을 소재로 삼았다는 점을 설명할 때 유의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1993, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('사오정 시리즈', '사오정-시리즈', array['사오정시리즈']::text[], '엉뚱하게 잘못 알아듣는 캐릭터를 소재로 한 1990년대 조크', '서유기 캐릭터 사오정이 상대 말을 엉뚱하게 알아듣고 딴소리로 답하는 형식의 유머 시리즈로, 1990년대 후반 학생들 사이에서 크게 유행했다. 소통 오류를 웃음 소재로 삼은 대표적인 시리즈 유머다.',
    '1990년대 후반 학생들 사이에서 구전·유머집으로 확산', '90년대 유머 시리즈 회고 소재로 언급', '청각장애 등을 희화화하는 것으로 오독되지 않게 맥락 설명 필요',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1997, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('덩달이 시리즈', '덩달이-시리즈', array['덩달이시리즈']::text[], '눈치 없이 덩달아 따라 하다 망하는 캐릭터의 1990년대 조크', '''덩달이''라는 캐릭터가 상황 파악 못 하고 남을 따라 하다 낭패를 보는 구조의 유머 시리즈로, 1990년대 중반 학생들과 PC통신에서 유행했다. 참새·최불암 시리즈와 함께 한국식 캐릭터 조크의 한 축이었다.',
    '1990년대 중반 학생들 사이에서 구전·유머집으로 확산', '90년대 유머 시리즈 회고 소재로 언급', null,
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1994, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('만득이 시리즈', '만득이-시리즈', array['만득이시리즈']::text[], '어수룩한 캐릭터가 주인공인 다소 짓궂은 1990년대 조크 시리즈', '눈치 없고 어수룩한 ''만득이'' 캐릭터를 주인공으로 한 유머 시리즈로, 1990년대 학생들 사이에서 유행했지만 다른 시리즈보다 성적이거나 짓궂은 내용이 많이 섞여 있었다.',
    '1990년대 학생들 사이에서 구전·유머집으로 확산', '90년대 유머 문화 사료로만 언급, 실제 재현은 지양', '지적장애 희화화·저속한 성적 내용이 섞여 있어 인용 시 주의',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1995, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('그래 결심했어', '그래-결심했어', array['인생극장 유행어']::text[], '1994년 ''인생극장'' 코너가 만든 국민 선택 유행어', '1994년 MBC ''일요일 일요일 밤에''의 코너 ''인생극장''에서 이휘재가 두 가지 선택지 중 하나를 고르며 외친 대사로, 이후 무언가를 결심할 때 쓰는 국민 유행어가 됐다. 1997년 재방영되며 다시 한번 크게 유행했다.',
    '1994년 MBC ''일요일 일요일 밤에'' 코너 ''인생극장''', '결정의 순간을 장난스럽게 강조할 때 지금도 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1994, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/TV%EC%9D%B8%EC%83%9D%EA%B7%B9%EC%9E%A5', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('영구 없다', '영구-없다', array['영구야 영구야']::text[], '코미디언 심형래의 바보 캐릭터 ''영구''의 국민 유행어', '1980년대 말 영화로 시작해 1990년대 방송 코미디에서도 이어진 심형래의 ''영구'' 캐릭터가 남긴 유행어로, 전 국민이 따라 할 만큼 크게 유행했다. 한국 코미디사에서 손꼽히는 장수 유행어 캐릭터다.',
    '코미디언 심형래의 ''영구'' 캐릭터 코미디에서 발생', '복고 코미디 회고 소재로 언급', '지적장애를 희화화하는 ''바보'' 캐릭터라는 점에 유의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 1991, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('초성체', '초성체', array['ㅇㅇ','ㄴㄴ','ㄱㅅ']::text[], '응, 노노, 감사처럼 첫 자음만 따서 쓰는 채팅 축약 표현', '버디버디·세이클럽 등 메신저와 채팅 문화가 확산된 1990년대 말부터, 단어의 초성만 따서 빠르게 타이핑하는 초성체가 자리 잡았다. 이후 지금까지도 온라인 채팅·댓글 문화의 기본 문법처럼 쓰이고 있다.',
    '1990년대 말 메신저·채팅 문화에서 정착', '짧은 대답이나 반응을 표현할 때 지금도 널리 사용', null,
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
  values ('포켓몬빵 띠부씰 열풍', '포켓몬빵-띠부씰-열풍', array['띠부씰','포켓몬빵']::text[], '1999년 포켓몬빵 속 스티커 수집 열풍으로 전국 품절 사태', '1999년 국내 출시된 포켓몬빵에 붙어 있던 ''떼었다 붙였다 씰(띠부씰)'' 스티커를 모으기 위해 어린이들이 빵을 사재기하며 품절 대란이 벌어졌다. 2022년 리부트로 다시 화제가 됐지만 원조 열풍은 1999년이다.',
    '1999년 국내 포켓몬빵 출시와 함께 시작된 스티커 수집 열풍', '90년대 말 어린이 문화·품절 대란 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 1999, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('다마고치 열풍', '다마고치-열풍', array['다마고치']::text[], '1997년 한국을 휩쓴 일본산 가상 애완동물 육성 완구 열풍', '일본에서 개발된 휴대용 가상 애완동물 육성 게임기 다마고치가 1997년 전후 한국에서도 폭발적으로 유행하며 학생들 사이 필수 아이템이 됐다. 밥 주고 돌보는 육성 요소가 당시로선 신선한 재미로 다가왔다.',
    '일본에서 개발돼 1997년 전후 한국에서 크게 유행', '90년대 말 완구 열풍 회고 소재로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1997, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('탑블레이드 열풍', '탑블레이드-열풍', array['베이블레이드','탑블레이드']::text[], '2002년 전후 팽이 대전 완구가 만든 학교 운동장 열풍', '일본 원작 애니메이션을 바탕으로 한 팽이 완구 ''탑블레이드(베이블레이드)''가 2002년 전후 한국 초등학생들 사이에서 크게 유행하며 학교 곳곳에서 팽이 대전이 벌어졌다. 완구 수집과 개조가 함께 유행한 사례다.',
    '일본 원작 완구·애니메이션이 2002년 전후 한국에서 유행', '2000년대 초 초등학생 완구 문화 회고 소재로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2002, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('포켓몬스터 열풍', '포켓몬스터-열풍', array['포켓몬 잡으러 가자']::text[], '1999년 게임보이·애니메이션으로 한국을 강타한 포켓몬 붐', '일본산 게임 ''포켓몬스터''가 1999년 게임보이 게임과 TV 애니메이션 형태로 한국에 정식 소개되며 어린이들 사이에서 폭발적인 인기를 끌었다. 카드·스티커 수집과 함께 세대를 상징하는 콘텐츠 붐이 됐다.',
    '1999년 게임보이 게임과 TV 애니메이션 국내 정식 방영', '90년대 말 콘텐츠 붐 사례로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('삐삐 숫자 코드', '삐삐-숫자-코드', array['8282','1004']::text[], '삐삐(무선호출기) 숫자 조합으로 메시지를 전하던 1990년대 문화', '1990년대 무선호출기(삐삐) 이용자들이 숫자만 보낼 수 있는 한계를 이용해 ''8282(빨리빨리)'' ''1004(천사)'' 같은 숫자 조합으로 의미를 전달하는 암호 문화를 만들었다. 삐삐 세대를 상징하는 대표적인 놀이 문화다.',
    '1990년대 중반 무선호출기(삐삐) 이용자 문화', '90년대 통신 문화 회고 소재로 그대로 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 1995, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('싱하형', '싱하형', array['싱하','이소룡 싱하']::text[], '이소룡 표정 짤과 함께 ''형이다 패버린다''식 허세 글을 쓴 디시 유저 밈', '디시인사이드 패션 갤러리 출신 유저가 스타크래프트 갤러리 등에서 자신을 ''형''이라 칭하며 위협조 글을 올릴 때 이소룡이 적을 쓰러뜨린 뒤 짓는 표정 사진을 함께 올리던 것에서 시작됐다. ''존내'', ''새퀴'', ''고고싱'' 같은 말투 유행도 함께 퍼졌다.',
    '디시인사이드 패션 갤러리 출신 유저 ''싱하''의 스타크래프트 갤러리 활동에서 시작', '허세 부리는 상황을 웃기게 패러디할 때', '과거 실제 협박·비하성 게시물에서 유래해 맥락 없이 쓰면 어색함',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%8B%B1%ED%95%98%ED%98%95', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지하철 개똥녀 사건', '지하철-개똥녀-사건', array['개똥녀']::text[], '지하철서 애완견 배설물을 안 치운 여성이 신상 공개당한 2005년 사건', '2005년 6월 서울 지하철 2호선에서 개가 설사를 하자 승객이 이를 제대로 치우지 않고 내린 모습이 사진과 함께 인터넷에 퍼지며 ''개똥녀''로 불렸다. 네티즌 수사대가 신상을 특정해 공개하면서 온라인 마녀사냥과 사이버불링 논쟁의 대표 사례가 됐다.',
    '지하철 목격자가 촬영한 사진을 커뮤니티·블로그에 올리며 확산, 이후 언론 보도로 전국적 화제화', '온라인 신상 공개·마녀사냥의 역사적 사례로 언급할 때만', '실존 개인을 공개 조리돌림한 사건이라 유머 소재로 가볍게 쓰면 안 됨',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2005, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%9C%EB%98%A5%EB%85%80%20%EC%82%AC%EA%B1%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('병맛', '병맛', array['병신맛']::text[], '''병신 같은 맛'', 논리 없고 뜬금없는 개그 스타일을 뜻하는 말', '디시인사이드 카툰-연재 갤러리에서 ''무악공고'' 등의 유저가 그린 아마추어 연재만화를 두고 붙은 표현에서 비롯됐다. 처음엔 성의 없어 보이지만 묘하게 웃긴 콘텐츠를 가리키는 긍정적 뉘앙스였다가, 점차 ''병맛 만화'', ''병맛 코드''처럼 하나의 개그 장르를 지칭하는 말로 자리잡았다.',
    '디시인사이드 카툰-연재 갤러리의 아마추어 만화 문화에서 발생', '엉뚱하고 논리 없는 개그물을 설명할 때 지금도 널리 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%B3%91%EB%A7%9B', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지못미', '지못미', array['지켜주지 못해 미안해']::text[], '''지켜주지 못해 미안해''의 줄임말, 안타까운 대상에 대한 위로 표현', '정확한 최초 출처는 불분명하나 2000년대 중반 온라인 커뮤니티에서 안타깝거나 딱한 상황(우스꽝스러운 사진 속 인물, 망가진 물건 등)에 붙이는 댓글 클리셰로 정착했다. 진지한 애도보다는 유머러스한 안타까움 표현으로 주로 쓰였다.',
    '온라인 커뮤니티 댓글 문화에서 자연발생적으로 확산, 정확한 최초 사용자는 불명', '우스꽝스럽지만 안쓰러운 짤방에 댓글로 달던 표현', '실제 비극적 사건에는 부적절, 가벼운 상황에만 어울림',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%A7%80%EC%BC%9C%EC%A3%BC%EC%A7%80%20%EB%AA%BB%ED%95%B4%20%EB%AF%B8%EC%95%88%ED%95%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엄친아', '엄친아', array['엄마 친구 아들','엄친딸']::text[], '''엄마 친구 아들''의 줄임말, 모든 면에서 완벽한 비교 대상을 뜻함', '부모가 자녀에게 ''엄마 친구 아들 OO는 공부도 잘하고 운동도 잘하고 잘생겼다''며 비교하는 상황에서 유래한 말로, 2005년부터 온라인에서 퍼지기 시작했다. 같은 해 12월 네이버 웹툰 ''골방환상곡''에서 소재로 다루며 대중적으로 확산됐다.',
    '부모의 자녀 비교 화법을 풍자한 인터넷 유행어, 골방환상곡 웹툰이 대중화에 기여', '지금도 완벽한 비교 대상을 가리킬 때 일상적으로 사용 가능', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%97%84%EB%A7%88%20%EC%B9%9C%EA%B5%AC%20%EC%95%84%EB%93%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('너나 잘하세요', '너나-잘하세요', array['금자씨 너나잘하세요']::text[], '영화 ''친절한 금자씨''(2005) 이영애의 냉소적 대사이자 리액션 짤방', '출소한 금자씨에게 착하게 살라며 두부를 건네는 전도사에게 무표정하게 두부를 엎으며 던진 대사. 존댓말과 반말을 섞은 냉소적 어조가 화제를 모아 그해 여름 최고 유행어가 됐고, 이영애의 표정 캡처가 반박·비웃음용 리액션 짤방으로 널리 쓰였다.',
    '영화 ''친절한 금자씨''(박찬욱 감독, 2005) 속 이영애의 대사', '훈계하는 상대에게 되받아치는 리액션으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('황빠·황까', '황빠·황까', array['황빠','황까']::text[], '2005년 황우석 줄기세포 논문 조작 사태로 생긴 극단 지지·비판 진영 용어', 'MBC PD수첩의 논문 조작 의혹 보도로 촉발된 황우석 사태 당시, 그를 맹목적으로 옹호하는 사람을 ''황빠'', 강하게 비판하는 사람을 ''황까''라 불렀다. 이후 특정 인물을 무조건 지지/비판하는 진영을 가리키는 ''~빠'', ''~까'' 접미사 유행의 시초 격 사례로 꼽힌다.',
    '2005년 황우석 논문 조작 사건을 둘러싼 온라인 논쟁 커뮤니티에서 발생', '팬덤·진영 논리를 비판적으로 이야기할 때 사례로 인용', '실존 논쟁을 다루므로 특정인 비하로 오용되지 않게 주의',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2005, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%99%A9%EB%B9%A0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('몸짱 아줌마', '몸짱-아줌마', array['봄날 아줌마','정다연']::text[], '평범한 주부가 다이어트·근육 몸매로 전국적 열풍을 일으킨 2005년 현상', '정다연 씨가 70kg에서 체지방을 감량해 탄탄한 몸매로 변신한 전후 사진이 2005년 언론과 온라인에 퍼지며 ''몸짱 아줌마'' 열풍을 일으켰다. 얼짱 신드롬과 대비되는, 노력으로 만든 건강한 몸이라는 서사가 대중적 공감을 얻어 국민적 다이어트 붐으로 이어졌다.',
    '2002년 딴지일보 기고로 알려진 정다연 씨의 다이어트 성공담이 2005년 언론 보도로 전국적 화제화', '2000년대 다이어트 열풍이나 몸매 관리 이야기 소재로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EC%A0%95%EB%8B%A4%EC%97%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('국민 여동생', '국민-여동생', array['국민여동생']::text[], '배우 문근영에게 붙은 애칭으로, 순수한 이미지의 인기 있는 젊은 여성을 뜻함', '2004년 영화 ''어린 신부''로 사랑받은 문근영에게 언론이 붙인 애칭이 2005~2006년 ''댄서의 순정'' 흥행과 함께 폭발적으로 확산됐다. 이후 다른 연예인들에게도 ''국민 여동생'' 타이틀이 계보처럼 이어지는 관용구가 됐다.',
    '언론이 배우 문근영의 이미지를 묘사하며 붙인 수식어', '대중적으로 사랑받는 젊은 여자 연예인을 가리킬 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EA%B5%AD%EB%AF%BC%20%EC%97%AC%EB%8F%99%EC%83%9D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오덕후', '오덕후', array['오덕','덕후']::text[], '일본어 ''오타쿠''를 한국식으로 변형한 말, 한 분야에 깊이 빠진 사람', '투니버스에서 방영된 나루토 팬덤 등에서 오타쿠를 한국식 발음으로 바꿔 부르던 관행에서 2005년 말 등장해 2006년 상반기 ''오덕'', ''덕후''로 축약됐다. 이후 五德厚(다섯 가지 덕이 두터움)라는 해학적 한자 뜻풀이가 붙으며 널리 퍼졌다.',
    '애니메이션 팬덤 커뮤니티에서 ''오타쿠''의 한국식 변형어로 발생', '특정 취미에 깊이 빠진 사람을 가리킬 때 지금도 통용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%98%A4%EB%8D%95%ED%9B%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('완소', '완소', array['완전소중']::text[], '''완전 소중''의 줄임말, 몹시 아끼고 사랑스러운 대상을 뜻함', '2005년 무렵 디시인사이드 등 온라인 커뮤니티와 10대 소녀들 사이에서 쓰이기 시작해 2006~2007년 청소년 사이 유행어로 자리잡았다. 정확한 최초 출처는 프로게이머 팬덤이나 만화 갤러리 유저 아이디에서 비롯됐다는 설이 있다.',
    '프로게이머 팬덤 또는 디시인사이드 만화 갤러리 유저 문화에서 발생, 정확한 기원은 여러 설이 존재', '레트로 10대 말투를 재현할 때', '현재는 거의 안 쓰여 실생활에 쓰면 옛날 느낌',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%99%84%EC%86%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마빡이', '마빡이', array['골목대장 마빡이']::text[], 'KBS 개그콘서트의 이마 두드리기 콩트, 2006년 시청률 부활 주역', '2006년 8월부터 방영된 개그콘서트 코너로, 대머리 가발을 쓴 개그맨 넷이 계속 자기 이마를 손으로 두드리는 몸개그가 특징이었다. 정종철의 ''내가 누군지 알어? 골목대장 마빡이!'' 대사가 대표 유행어가 됐다.',
    'KBS2 개그콘서트 코너, 정종철 등 출연', '2006년 개그콘서트 전성기를 언급할 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A7%88%EB%B9%A1%EC%9D%B4(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('야동순재', '야동순재', array['야동 순재']::text[], '시트콤 ''거침없이 하이킥''에서 이순재가 야동을 보다 들키는 캐릭터로 붙은 별명', '2006~2007년 방영된 MBC 시트콤 ''거침없이 하이킥''에서 배우 이순재가 연기한 순재가 밤마다 몰래 야한 동영상을 보다 가족에게 들키는 에피소드가 반복되며 붙은 별명. 이 에피소드 이후 시청률이 급상승해 2007년 최고 24.2%를 기록했고, 이순재는 이 캐릭터로 방송연예대상을 받았다.',
    'MBC 시트콤 ''거침없이 하이킥''(2006~2007) 속 이순재의 캐릭터 설정', '2000년대 시트콤 레전드 캐릭터 이야기할 때', '성인물 관련 소재라 맥락에 따라 언급이 민망할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%B4%EC%88%9C%EC%9E%AC(%EA%B1%B0%EC%B9%A8%EC%97%86%EC%9D%B4%20%ED%95%98%EC%9D%B4%ED%82%A5)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('된장녀', '된장녀', '{}', '명품·사치를 추구하는 여성을 비하하는 2006년 인터넷 신조어', '2006년 온라인 커뮤니티에 퍼진 ''된장녀의 하루'' 글과 스타벅스 소비 논란 기사를 계기로 급속히 확산된 여성 혐오성 표현. 경제적 능력 없이 명품·고급 소비를 추구하는 여성을 비하하는 데 쓰였으며, 여러 연예인 발언·결혼 논란과 엮여 사회적 논쟁을 낳았다.',
    '2006년 온라인 커뮤니티 확산 글과 언론 보도(''스타벅스 가면 된장녀'' 등)로 대중화', '2000년대 여성혐오 신조어 역사를 논할 때만 인용', '여성 비하가 본질인 표현으로 절대 실사용 금지, 아카이브 목적으로만 기록',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2006, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%90%9C%EC%9E%A5%EB%85%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('간지나다', '간지나다', array['간지','뽀대나다']::text[], '''폼 나다'', ''멋있다''는 뜻의 속어, 일본어 ''간지(感じ)''에서 유래', '2006년 무렵 온라인에서 이미 널리 쓰이고 있던 표현으로, 무언가 멋지고 폼 나는 상태를 가리켰다. 어원은 일본어 ''느낌''을 뜻하는 ''간지(感じ)''이며, ''뽀대나다''와 같은 뜻으로 함께 쓰였다.',
    '일본어 ''간지(感じ)''가 변형되어 온라인 속어로 정착', '2000년대 후반 말투 재현 콘텐츠에서 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%84%EC%A7%80(%EC%9C%A0%ED%96%89%EC%96%B4)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('콩라인', '콩라인', array['콩','콩드립']::text[], '프로게이머 홍진호의 준우승 행보에서 비롯된 ''만년 2등''을 부르는 계보', '스타크래프트 프로게이머 홍진호가 스타리그에서 우승 없이 5차례 준우승을 기록하며 붙은 별명 ''콩''에서 비롯됐다. 이후 그의 뒤를 잇듯 결승에서 계속 아깝게 지는 선수들을 ''콩라인''이라 부르는 문화가 형성됐다.',
    '프로게이머 홍진호의 별명 ''콩''과 반복된 준우승 기록에서 파생', '아깝게 2등만 하는 상황을 유머러스하게 표현할 때', '정확한 용어 정착 시점은 명확한 기록이 부족해 추정치임',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%BD%A9%EB%9D%BC%EC%9D%B8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허경영 어록', '허경영-어록', array['우주의 기운','축지법 허경영']::text[], '2007년 대선 후보 허경영의 기행적 발언들이 인터넷 밈으로 퍼진 사례', '2007년 17대 대선에 출마한 허경영이 자신의 IQ가 430이라거나 축지법과 공중부양을 할 수 있다고 주장하고, 태양이 다이아몬드로 이루어져 있다는 등의 발언을 하며 큰 화제를 모았다. 이런 비현실적 어록들이 온라인에서 패러디·인용되며 밈으로 확산됐다.',
    '2007년 17대 대통령 선거 유세 및 방송 발언', '황당하고 과장된 주장을 유머러스하게 인용할 때', '실존 정치인 발언이므로 조롱 맥락에 유의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%97%88%EA%B2%BD%EC%98%81/%EC%96%B4%EB%A1%9D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('훈남', '훈남', '{}', '마음을 훈훈하게 하는 잘생긴 남자를 뜻하는 2007년 무렵 신조어', '2007년경 온라인에서 널리 쓰인 신조어로, 단순히 잘생긴 것을 넘어 따뜻하고 정이 가는 인상의 남성을 가리켰다. ''완소'', ''엄친아'' 등과 함께 2000년대 후반 외모 관련 신조어 붐을 이뤘다.',
    '2000년대 중후반 온라인 커뮤니티에서 자연발생한 외모 관련 신조어', '지금도 훈훈한 인상의 남성을 가리킬 때 일상적으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오나전 캐안습', '오나전-캐안습', array['오나전']::text[], '''완전''의 오타에서 나온 ''오나전''과 ''안습''이 결합된 인터넷 말투', '휴대폰·컴퓨터 자판으로 ''완전''을 급히 치다 생기는 오타에서 비롯된 ''오나전''이 ''안습''의 강조형 ''캐안습''과 결합해 쓰였다. 2007년 12월 KBS 개그콘서트 ''대화가 필요해'' 코너에 등장하며 대중적으로 널리 퍼졌고 2008년 절정의 유행을 맞았다.',
    '휴대폰 자판 오타에서 비롯된 신조어, 개그콘서트 방영으로 대중화', '2000년대 후반 인터넷 말투 재현 콘텐츠에서 사용', '현재는 거의 사어(死語)가 되어 실생활에 쓰면 어색함',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쎄요체', '쎄요체', array['셔요체']::text[], '개그맨 박명수가 만든 ''~하셨쎄요?''식 어미 개그 말투', '2007년 무한도전에서 박명수가 인사말이나 의문문 어미를 ''~쎄요?''로 바꿔 말하려다 어설프게 실패한 것을, 유재석이 ''오셨쎄요?''로 절묘하게 받아치며 유행어 반열에 올랐다.',
    'MBC ''무한도전''에서 박명수가 시도하고 유재석이 완성시킨 말장난 개그', '무한도전 초창기 개그를 이야기할 때', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%8E%84%EC%9A%94%EC%B2%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('2MB', '2MB', array['투엠비']::text[], '이명박 전 대통령의 이니셜을 딴 별명이자, 뇌 용량을 비꼬는 조롱어로도 쓰인 표현', '2007년 대선을 앞두고 선대위 측이 ''YS'', ''DJ''처럼 영문 이니셜 애칭 효과를 노려 적극 홍보한 표현. 이후 반대파들 사이에서는 정보화 시대에 저장 용량이 2메가바이트 수준이라는 뜻의 조롱으로도 쓰이며 이중적 의미를 갖게 됐다.',
    '2007년 대선 당시 이명박 후보 선대위의 이니셜 홍보 전략에서 시작, 이후 비판적 재해석으로 확산', '2000년대 후반 정치 풍자 맥락을 설명할 때', '정치적으로 민감하며 조롱 의도로 쓰이는 경우가 많음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2007, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9D%B4%EB%AA%85%EB%B0%95/%EB%B3%84%EB%AA%85', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무비무비무비', '무비무비무비', '{}', '무한도전 멤버들이 이동할 때 항상 외치던 구호', '2007~2008년 무렵 무한도전에서 미션 수행을 위해 이동할 때마다 멤버들이 다 함께 ''무비 무비 무비''를 외치는 것이 관습처럼 자리잡아 시청자들 사이에서도 따라 하는 유행어가 됐다.',
    'MBC ''무한도전'' 촬영 현장에서 반복된 구호가 방송을 타며 유행어화', '다 같이 이동하자고 재촉할 때 장난스럽게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('복불복', '복불복', '{}', '1박2일에서 벌칙과 보상을 랜덤으로 정하는 게임 방식이자 유행어', '운수의 좋고 나쁨을 뜻하는 사전적 단어였으나, 2007년 KBS 1박2일(전신 ''준비됐어요'' 포함)에서 벌칙자를 랜덤으로 정하는 게임 코너로 자주 쓰이며 일상 유행어처럼 퍼졌다. 이후 예능 전반에서 랜덤 벌칙 게임을 가리키는 보통명사가 됐다.',
    'KBS 2TV ''1박2일''과 전신 프로그램의 랜덤 벌칙 게임 코너에서 대중화', '운에 따라 결과가 갈리는 상황을 가리킬 때 지금도 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('마린보이', '마린보이', '{}', '수영선수 박태환에게 붙은 별명, 애니메이션 ''바다의 왕자 마린보이''에서 유래', '2007년 세계수영선수권대회 무렵 박태환에게 붙은 별명으로, 옛 애니메이션 ''바다의 왕자 마린보이''에서 따왔다. 이후 방송에서 박태환이 등장할 때마다 해당 애니메이션 배경음악이 함께 나오는 것이 관례처럼 됐다.',
    '수영선수 박태환의 활약을 애니메이션 ''마린보이''에 빗댄 언론·팬덤의 별명', '박태환이나 수영 관련 레트로 콘텐츠에서 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('명박산성', '명박산성', '{}', '2008년 촛불집회 당시 도심에 설치된 컨테이너 바리케이드를 풍자한 말', '2008년 6월 10일 광우병 촛불집회 때 경찰이 시위대의 청와대 진입을 막기 위해 도심에 컨테이너 박스를 쌓아 만든 바리케이드를, 이명박과 산성을 합쳐 ''명박산성''이라 부르며 풍자했다. 시위대와 네티즌이 만든 신조어가 언론 보도를 통해 널리 알려졌다.',
    '2008년 촛불집회 당시 네티즌·시위대가 만든 풍자적 합성어', '2008년 촛불집회 관련 역사·시사 맥락에서 인용', '정치적으로 민감한 사건이므로 맥락 설명 없이 쓰면 오해 소지',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'News', 'https://namu.wiki/w/%EB%AA%85%EB%B0%95%EC%82%B0%EC%84%B1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('Yo DJ 뽕디스 파뤼', 'Yo-DJ-뽕디스-파뤼', array['뽕디스파뤼']::text[], '1박2일 은지원이 혹서기 캠프에서 무의식중에 외친 유행어', '2008년 1박2일 혹서기 특집에서 은지원이 팝송 ''Push the Feeling On''의 가사를 어레인지한 ''Yo DJ 뽕디스 파뤼''를 무의식적으로 외친 것이 방송을 타며 짧게 유행어가 됐다.',
    'KBS 2TV ''1박2일'' 방영분에서 은지원의 애드리브 발언', '1박2일 레전드 장면을 이야기할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('리얼이야 리얼', '리얼이야-리얼', array['MC몽 리얼']::text[], '1박2일에서 MC몽이 놀라움을 과장되게 표현하던 유행어 대사', '''우와 리얼이야! 리얼! 나 진짜 소름 돋았어!''라는 MC몽의 과장된 리액션 대사가 1박2일 시청자들 사이에서 유행어처럼 회자됐다.',
    'KBS 2TV ''1박2일''에서 MC몽의 리액션 대사', '과장된 놀람을 표현하는 패러디 대사로', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('루저의 난', '루저의-난', array['루저 논란']::text[], '''키 작은 남자는 루저''라는 2009년 방송 발언이 촉발한 신조어 논란 사건', '2009년 11월 KBS ''미녀들의 수다''에 출연한 한 여대생이 ''키 작은 남자는 루저(패배자)''라고 발언해 큰 논란이 됐다. 네티즌들이 키 큰 연예인 사진엔 ''위너'', 작은 연예인 사진엔 ''루저''를 붙이는 패러디를 쏟아내며 ''루저의 난''으로 불렸고, 방송사는 심의 규정 위반 판정을 받았다.',
    '2009년 KBS ''미녀들의 수다'' 출연자의 발언이 촉발한 온라인 논란', '외모 비하 발언 논란의 역사적 사례로 언급할 때', '신체를 비하하는 발언이 본질이라 유머 소재로만 쓰면 안 됨',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2009, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A3%A8%EC%A0%80%EC%9D%98%20%EB%82%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('1등만 기억하는 더러운 세상', '1등만-기억하는-더러운-세상', '{}', '개그콘서트 박성광의 유행어, 실력보다 순위만 기억되는 세태를 풍자', '2009년 11월부터 방영된 개그콘서트 코너에서 개그맨 박성광이 외친 대사로, 2등 이하는 아무리 노력해도 기억되지 않는 세태를 풍자해 큰 공감과 유행을 얻었다.',
    'KBS2 개그콘서트 코너에서 박성광의 대사', '과도한 순위 경쟁 세태를 풍자할 때 지금도 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
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
  values ('이말년 씨리즈', '이말년-씨리즈', array['이말년씨리즈']::text[], '디시인사이드 출신 작가 이말년의 병맛 웹툰, 2009년 데뷔작', '디시인사이드에서 아마추어 만화가로 활동하던 이말년이 ''불타는 버스'' 등으로 주목받은 뒤 2009년 정식 웹툰 ''이말년 씨리즈''로 데뷔했다. 논리적 개연성을 무시한 황당한 전개와 병맛 코드로 폭발적 인기를 끌며 병맛 웹툰 장르의 대표주자가 됐다.',
    '디시인사이드 아마추어 만화 연재 활동을 거쳐 정식 웹툰으로 데뷔', '병맛 웹툰의 원조 사례로 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9D%B4%EB%A7%90%EB%85%84%EC%94%A8%EB%A6%AC%EC%A6%88', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('레알', '레알', '{}', '''진짜'', ''정말''을 뜻하는 감탄사, 영어 real과 축구팀 레알 마드리드에서 유래', '디시인사이드의 ''~했다는 게 사실?''식 말투가 ''~리얼?''을 거쳐, 당시 인기 있던 스페인 축구팀 레알 마드리드의 이름을 따 ''~레알?''로 굳어졌다. 2009년 후반 본격적으로 확산돼 ''레알'' 단독으로도 널리 쓰이게 됐다.',
    '디시인사이드 말투가 영어 real과 축구팀 레알 마드리드 명칭을 거쳐 변형', '''진짜''라는 뜻의 감탄사로 지금도 널리 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%A0%88%EC%95%8C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('지름신', '지름신', array['지름신 강림','질러버렸다']::text[], '충동구매를 하게 만드는 가상의 신, 2005년 확산된 쇼핑 신조어', '물건을 사고 싶은 충동을 ''신이 내렸다''는 식으로 표현한 신조어로, 필요보다 디자인이나 겉모습에 끌려 충동구매할 때 ''지름신이 강림하셨다''라고 쓴다. 휴대폰·MP3 등 전자기기 커뮤니티를 중심으로 퍼지기 시작해 2005년 무렵 신문 기사에도 다뤄질 만큼 대중화됐다.',
    '2000년대 초중반 전자기기 동호회 커뮤니티에서 발생, 2005년 전후 언론 보도로 대중화', '충동구매한 상황을 재밌게 설명할 때 지금도 흔히 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('듣보잡', '듣보잡', array['듣도 보도 못한 잡것','듣보']::text[], '듣도 보도 못한 잡것의 준말, 무명을 낮잡는 2006년 유행어', '''듣지도 보지도 못한 잡것(잡놈)''의 줄임말로 인지도가 낮거나 근본 없는 대상을 낮잡아 부르는 말이다. 2006년 유행어 순위 7위에 오를 정도로 인터넷 커뮤니티 전반에서 널리 쓰였다.',
    '2006년 인터넷 커뮤니티에서 확산된 비하성 신조어', '장난스럽게 무명임을 놀릴 때, 상대와의 관계를 확인한 뒤 사용', '실제 비하로 들릴 수 있어 낯선 사람에게는 자제',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'negative'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나상실', '나상실', array['어이상실 개념상실 나상실','환상의 커플 나상실']::text[], '2006년 드라마 환상의 커플, ''~상실'' 말장난 캐릭터명 유행', '2006년 MBC 드라마 환상의 커플에서 기억을 잃은 재벌 ''안나 조''가 장철수에게 ''어이상실, 개념상실, 인격상실, 기억상실, 나상실''이라는 이름을 얻으며 붙여진 캐릭터명이다. 리듬감 있는 ''~상실'' 말장난과 한예슬의 망가짐 연기가 화제를 모으며 방영 당시 유행어와 어록을 다수 남겼다.',
    '2006년 MBC 주말특별기획드라마 환상의 커플 극중 설정', '어이없는 상황에 ''~상실'' 말장난으로 이름 붙일 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/나상실', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우왕ㅋ굳ㅋ', '우왕ㅋ굳ㅋ', array['우왕굳','ㅇㅇㅋㄱㅋ']::text[], '디시 카연갤 병맛만화 대사에서 유래한 2007년 최고 유행어', '2007년 디시인사이드 카툰연재 갤러리에 올라온 병맛만화 ''본격 미안해지는 만화''의 마지막 대사에서 유래했다. 서로 미안하다며 고개 숙이다 땅에 처박힌 두 사람을 보고 지나가던 행인이 내뱉은 한심하다는 반응으로, 그해 인터넷 최고 유행어로 꼽혔다. 단어 사이에 ㅋ를 넣는 표기법을 유행시킨 원조로도 꼽힌다.',
    '2007년 디시인사이드 카툰연재 갤러리 병맛만화 대사', '옛날 인터넷 말투를 흉내내는 드립으로만 씀', '요즘 쓰면 맥락을 몰라 못 알아듣는 사람이 많음',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/우왕ㅋ굳ㅋ', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('킹왕짱', '킹왕짱', array['킹왕짱 아이디']::text[], 'King+王+짱을 합친 극강의 최고, 2007년 방송까지 탄 유행어', '디시인사이드 와우 갤러리에서 한 이용자의 아이디 ''킹왕짱''을 캡처해 올린 것이 시초로, 영어 King과 한자 王, 은어 짱을 겹쳐 ''최고 중의 최고''라는 뜻으로 쓰였다. 갤러리 내 수식어로 굳어진 뒤 지상파 방송에도 등장할 만큼 퍼져 2007년 우왕ㅋ굳ㅋ과 함께 그해를 대표하는 통신언어로 꼽혔다.',
    '디시인사이드 와우 갤러리 이용자 아이디에서 유래, 2007년 널리 확산', '과장되게 최고라고 강조하는 레트로 드립으로 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/킹왕짱', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('하나마나송', '하나마나송', array['말하나 마나송']::text[], '무한도전 알래스카 특집에서 탄생한 2007년 자작곡 유행어', '2007년 2월 방영된 무한도전 알래스카 특집에서 정형돈의 별명 ''말하나 마나''에 보니 엠의 ''바하마 마마'' 멜로디를 붙여 박명수가 즉흥으로 부르며 탄생했다. 멤버들이 다 함께 부르는 병맛 개사곡으로 큰 인기를 끌며 이후 무한도전 자작곡 문화의 시초가 됐다.',
    '2007년 무한도전 알래스카 특집, 박명수·유재석 등이 즉흥 창작', '무한도전 초기 향수를 소환할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/하나마나송', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 무인도 특집', '무한도전-무인도-특집', array['무인도 특집','놀면 뭐하니 예언']::text[], '2007년 필리핀 무인도 생존기, 생존예능의 원조 격 특집', '2007년 6월 방영된 무한도전 특집으로 멤버들이 필리핀의 한 무인도에서 하루를 나는 서바이벌 내용을 담았다. 시청자가 뽑은 무한도전 역대 최고의 특집 1위에 꼽힐 만큼 회자되며, 이 특집에서 나온 노홍철의 발언이 훗날 ''놀면 뭐하니?'' 프로그램명을 예언했다는 우스갯소리로도 유명하다.',
    '2007년 MBC 무한도전 정규 특집', '무한도전 명특집을 이야기할 때 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/무인도 특집', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 미스코리아 특집', '무한도전-미스코리아-특집', array['미스코리아 특집','정형돈 여장 캐릭터']::text[], '2007년 무한도전 멤버들이 미스코리아로 분장한 여장 특집', '2007년 5월 방영된 무한도전 특집으로 멤버들이 저마다 여장을 하고 미스코리아 선발대회를 패러디했다. 여장에 거부감이 있던 정형돈이 이 특집에서 좋은 반응을 얻으며 이후 여장 캐릭터를 적극적으로 밀기 시작하는 계기가 됐다.',
    '2007년 MBC 무한도전 정규 특집', '2007년 무한도전 레전드 캐릭터를 회상할 때 언급', '여장 개그 소재라 맥락에 따라 불편하게 받아들이는 사람도 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('무한도전 소년명수', '무한도전-소년명수', array['소년명수','미래소녀 명수']::text[], '2007년 개그 실미도 특집에서 탄생한 박명수의 동안 캐릭터', '2007년 무한도전 ''개그 실미도'' 특집에서 노홍철과 하하가 박명수의 머리숱과 눈썹을 채워 넣어 만든 합성 캐릭터로, 100만 년 후 미래에서 온 동안 미남이라는 황당한 설정이 붙었다. 원본과 동떨어진 우스꽝스러운 동안 이미지가 화제가 되며 이후에도 종종 회자되는 무한도전 짤방 캐릭터로 남았다.',
    '2007년 MBC 무한도전 ''개그 실미도'' 특집에서 합성으로 탄생', '합성으로 앳돼 보이게 만든 사진에 붙이는 드립으로 활용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('무한도전 모내기 특집', '무한도전-모내기-특집', array['비 오나 비 오나 마나','노총각 명수 장가보내기 위원회']::text[], '2007년 폭우 속 강행한 무한도전 농촌 봉사 특집 유행어', '2007년 방영된 무한도전 모내기 특집에서 갑작스러운 폭우에도 촬영을 강행하며 나온 ''비 오나 비 오나 마나''라는 대사가 유행어가 됐다. 이 특집에는 박명수를 장가보내자는 콘셉트의 ''노총각 명수 장가보내기 위원회'' 코너도 포함돼 함께 회자됐다.',
    '2007년 MBC 무한도전 농촌 봉사 특집', '악조건에도 강행하는 상황을 농담처럼 표현할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('소녀시대 다시 만난 세계', '소녀시대-다시-만난-세계', array['다시 만난 세계','소녀시대 데뷔곡']::text[], '2007년 데뷔한 소녀시대의 데뷔곡, 이후 세대 초월 떼창곡으로 재조명', '2007년 8월 데뷔한 9인조 걸그룹 소녀시대의 데뷔곡으로, 밝고 희망적인 가사와 멜로디로 큰 인기를 끌었다. 이후 수년이 지나 대학가 시위 현장 등에서 세대를 초월한 떼창곡으로 재조명되며 꾸준히 회자되는 노래가 됐다.',
    '2007년 SM엔터테인먼트 소녀시대 데뷔 싱글', '2007년 아이돌 데뷔 붐을 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'song'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('우리 결혼했어요 알렉스-신애 커플', '우리-결혼했어요-알렉스-신애-커플', array['알신커플','로맨틱 커플']::text[], '2008년 우결의 대표 가상부부, ''여자의 로망 남자의 재앙''', '2008년 정규 편성된 MBC 우리 결혼했어요에서 알렉스와 신애 커플은 다정한 신혼부부 컨셉으로 큰 인기를 끌었다. 폴라로이드 사진, 동화책 읽어주기 등 알렉스의 로맨틱한 행동이 유행이 되며 ''여심 로망, 남심 공공의 적''이라는 평가를 받을 정도로 화제였다.',
    '2008년 MBC 우리 결혼했어요 출연 커플', '2008년 가상결혼 예능 붐을 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2008, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/우리 결혼했어요/커플', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('촛불소녀', '촛불소녀', array['촛불소녀 캐릭터']::text[], '2008년 촛불집회를 상징한 여중생 캐릭터 이미지', '2008년 미국산 쇠고기 수입 반대 촛불집회에서 처음 촛불을 든 10대 청소년들을 형상화한 캐릭터로, 시민단체 나눔문화가 저작권 없이 배포하며 집회 상징물로 급속히 퍼졌다. 이후 네티즌들이 촛불언니, 촛불오빠 등 파생 캐릭터를 만들며 확산됐다.',
    '2008년 시민단체 나눔문화가 제작·배포한 촛불집회 상징 캐릭터', '2008년 사회 현상을 설명할 때 자료 이미지로 활용', '정치적 사안과 얽혀 있어 맥락 없이 쓰면 논쟁 소지가 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/촛불소녀', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('미네르바', '미네르바', array['미네르바 사건','박대성']::text[], '2008년 경제 예측이 적중해 화제가 된 익명 논객 필명', '2008년 다음 아고라에서 ''미네르바''라는 필명으로 활동한 네티즌이 리먼브라더스 파산 등을 예측해 맞히며 큰 화제를 모았다. 방송 3사가 특집을 만들 정도로 신드롬을 일으켰으나 2009년 허위사실 유포 혐의로 체포되며 논란의 중심에 섰다.',
    '2008년 다음 아고라 경제 논객의 필명, 실존 인물 박대성', '인터넷 여론과 익명성 이슈를 설명할 때 사례로 인용', '실존 인물의 형사사건과 관련되어 있어 언급 시 사실관계 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/미네르바 사건', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('슈퍼스타K 시즌1', '슈퍼스타K-시즌1', array['슈스케1','서인국 조문근']::text[], '2009년 첫 방송된 국내 최초 대국민 오디션 신드롬', '2009년 첫 방송된 Mnet 슈퍼스타K 시즌1은 국내 최초의 대규모 오디션 서바이벌 프로그램으로, 결승에서 서인국이 심사위원 점수에서 앞선 조문근을 시청자 문자투표로 역전해 우승하며 화제를 모았다. 이후 매년 시즌을 이어가는 국내 오디션 예능 붐의 시초가 됐다.',
    '2009년 Mnet 슈퍼스타K 시즌1 방영', '국내 오디션 프로그램 원조를 이야기할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/슈퍼스타K', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('청춘불패', '청춘불패', array['청춘불패 시즌1']::text[], '2009년 아이돌들이 농촌에서 합숙하며 노는 예능 신드롬', '2009년 10월 첫 방송된 KBS 청춘불패는 소녀시대 유리, 카라 나르샤 등 여성 아이돌들이 농촌 마을에서 합숙하며 농사와 게임을 하는 콘셉트로 큰 인기를 끌었다. 아이돌의 털털하고 망가지는 예능 모습을 보여주며 ''아이돌 농촌 예능''이라는 장르를 대중화시켰다.',
    '2009년 KBS 예능 프로그램 청춘불패 시즌1', '2009년 아이돌 예능 전성기를 회상할 때 언급', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'challenge'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2009, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/청춘불패 시즌1', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('엄친아/엄친딸', '엄친아/엄친딸', array['엄친아','엄친딸','엄더엄']::text[], '엄마 친구 아들딸처럼 모든 면에서 완벽한 사람을 가리키는 말', '부모가 자녀와 남을 비교할 때 예로 드는 가상의 ''엄마 친구 아들/딸''에서 나온 말로, 공부·외모·성격 모든 면에서 뛰어난 사람을 가리킨다. 2005년부터 인터넷에서 급속히 퍼졌으며 이후 방송·기사에서도 흔히 쓰이는 표현이 됐다.',
    '부모들의 비교 화법에서 유래, 2005년 인터넷 커뮤니티에서 유행어로 확산', '타인의 재능·조건을 가볍게 부러워하는 상황에서 농담으로 사용', '과도하게 쓰면 비교·열등감을 조장하는 뉘앙스가 될 수 있음',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%97%84%EB%A7%88%20%EC%B9%9C%EA%B5%AC%20%EC%95%84%EB%93%A4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('낚시', '낚시', array['낚였다','낚시글']::text[], '제목이나 내용으로 사람을 속여 클릭·반응하게 만드는 것', '자극적이거나 오해할 만한 제목으로 글을 올려 사람들의 클릭과 반응을 유도하는 행위를 가리키는 말이다. 2005년 디시인사이드에서 벌어진 여러 조작·과장 게시글 사건들을 거치며 ''낚시'', ''낚였다''는 표현이 인터넷 전반의 표준 용어로 굳어졌다.',
    '2005년 디시인사이드 각종 허위·과장 게시글 사건들을 계기로 용어 확산', '제목과 다른 내용의 글이나 영상을 지적할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('므흣', '므흣', array['므흣하다']::text[], '야릇하고 흡족한 미소를 지을 때 쓰는 의성어 느낌의 표현', '일본 만화가 아다치 미츠루 작품 속 캐릭터가 짓는 야릇한 미소에서 유래한 일본어권 유행어가 국내 디시인사이드 이용자들 사이에서 퍼진 말이다. 2005년 9월 한 예능 프로그램 퀴즈 코너에 소개되며 대중적으로도 화제가 됐다.',
    '일본 만화 유래 표현이 국내 인터넷 커뮤니티에 유입, 2005년 방송 소개로 대중화', '흡족하거나 야릇한 표정을 묘사할 때 장난스럽게 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%AF%80%ED%9D%A3', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('대략난감', '대략난감', array['대략 난감']::text[], '이러지도 저러지도 못하는 매우 난처한 상황을 뜻하는 신조어', '만화 ''궁'' 등 2000년대 중반 콘텐츠를 통해 퍼진 것으로 알려진 표현으로, 네 글자로 압축된 ''넷자성어(인터넷 사자성어)'' 유행의 대표 사례다. 2005년 무렵 청소년과 인터넷 이용자 사이에서 널리 쓰였고 이후 드라마 제목으로도 쓰일 만큼 대중화됐다.',
    '2000년대 중반 만화·인터넷 문화에서 등장, 2005~2006년 청소년 사이 대유행', '곤란하거나 애매한 상황을 가볍게 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('마음의 소리', '마음의-소리', array['마음의소리','조석 웹툰']::text[], '조석 작가의 개그 웹툰, 2000년대 후반 병맛 유행어의 산실', '작가 조석이 자신의 블로그에 연재하던 만화가 2006년 9월 네이버 웹툰 정식 연재로 이어진 장수 개그 웹툰이다. 엉뚱하고 과장된 전개와 캐릭터들이 각종 유행어와 반응 이미지를 낳으며 2000년대 후반 ''병맛 웹툰'' 흐름을 대표하는 작품이 됐다.',
    '조석 작가가 2006년 9월 네이버 웹툰에 정식 연재 시작', '병맛 웹툰이나 2000년대 웹툰 문화를 소개할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, '기타', 'https://namu.wiki/w/%EB%A7%88%EC%9D%8C%EC%9D%98%EC%86%8C%EB%A6%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폐인', '폐인', array['폐인 캐릭터']::text[], '방구석에서 밤낮없이 인터넷·게임에 몰두하는 사람을 가리키는 말', '2000년대 초중반 디시인사이드에서 ''주침야활'', ''면식수행'' 같은 은어와 함께 쓰이던 ''폐인'' 문화를 만화가 김풍이 캐릭터로 형상화하며 대중적으로 알려졌다. 이후 책과 캐릭터 상품으로도 만들어질 만큼 하나의 밈 캐릭터로 자리잡았다.',
    '디시인사이드 폐인 문화를 만화가 김풍이 캐릭터화, 2005년 전후 확산', '게임·인터넷에 몰두하는 스스로를 자조적으로 표현할 때 사용', '타인을 지칭할 때는 무기력·은둔 비하로 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뇌구조 짤방', '뇌구조-짤방', array['뇌구조']::text[], '뇌 모양 그림에 자신의 관심사 비중을 나눠 적어 소개하는 짤방 형식', '뇌 그림을 여러 구역으로 나눠 자신이 좋아하는 것, 신경 쓰는 것의 비중을 표시하며 자기소개하는 방식의 짤방이다. 2000년대 중후반 커뮤니티와 블로그에서 친구나 유명인을 소재로 만들어 서로 퍼뜨리는 놀이로 유행했다.',
    '2000년대 중후반 국내 커뮤니티·블로그에서 자연발생', '자기소개나 캐릭터 소개용 짤방 포맷으로 활용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'image'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EB%87%8C%EA%B5%AC%EC%A1%B0', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭풍간지', '폭풍간지', array['간지폭풍']::text[], '압도적으로 멋지다는 뜻, ''폭풍-'' 접두어 유행의 대표 사례', '월드 오브 워크래프트를 소재로 한 온라인 만화 ''초보닥돌 와우만화''를 통해 이미지 매크로 형태로 널리 퍼지며 ''폭풍-'' 접두어 유행의 시초 격이 된 표현이다. 이후 폭풍눈물, 폭풍공감 등 같은 형식의 파생어가 잇따라 만들어졌다.',
    '온라인 게임 소재 웹만화 ''초보닥돌 와우만화''를 통해 확산, 2006년 전후 대유행', '과장된 멋짐을 강조하는 레트로풍 표현으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%84%EC%A7%80%ED%8F%AD%ED%92%8D', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭풍눈물', '폭풍눈물', array['롬곡옾눞']::text[], '펑펑 쏟아지는 눈물을 과장해 표현하는 ''폭풍-'' 계열 유행어', '''폭풍간지''와 같은 계열로 만들어진 표현으로, 매우 슬퍼서 눈물이 쏟아지는 상황을 과장되게 묘사할 때 쓰였다. 이 단어를 180도 뒤집으면 ''롬곡옾눞''이라는 글자가 되는 것도 함께 유행하며 재밋거리가 됐다.',
    '''폭풍-'' 접두어 유행의 파생어로 2006~2007년 확산', '과장된 슬픔이나 감동을 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('오나전', '오나전', array['오나전 캐안습']::text[], '자판 오타로 ''완전''이 ''오나전''이 된 데서 나온 유행어', '휴대폰이나 컴퓨터 자판으로 ''완전''을 입력하려다 흔히 발생하는 오타에서 비롯된 말이다. 이미 온라인 커뮤니티에서 쓰이던 표현이 2008년 12월 KBS 개그콘서트 코너에 등장하면서 전국적으로 화제가 됐다.',
    '자판 오타에서 비롯, 2008년 개그콘서트 방영으로 대중화', '오타를 소재로 한 농담이나 2000년대 유행어 회고에 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%98%A4%EB%82%98%EC%A0%84', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뭥미', '뭥미', array['뭐임']::text[], '''뭐임''을 잘못 친 오타에서 비롯된 황당함 표현 유행어', '''뭐임''을 입력하다 생긴 오타 ''뭥미''가 그대로 굳어져 황당하거나 이해되지 않는 상황을 표현하는 말로 쓰였다. 2008년 국내 인터넷 유행어 순위 상위에 오를 만큼 폭넓게 쓰였다.',
    '자판 오타에서 비롯, 2008년 인터넷 커뮤니티에서 대유행', '황당하거나 예상 밖의 상황에 대한 리액션으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('잉여', '잉여', array['잉여인간','잉여롭다']::text[], '딱히 하는 일 없이 시간을 흘려보내는 사람을 자조적으로 부르는 말', '''남아도는''이라는 뜻의 한자어 잉여(剩餘)가 인터넷 커뮤니티에서 뚜렷한 목적 없이 시간을 보내는 이용자 자신을 가리키는 자조적 표현으로 쓰이기 시작했다. 2008~2009년 디시인사이드를 중심으로 자기 비하성 유행어로 널리 퍼졌다.',
    '디시인사이드 등 커뮤니티에서 2008~2009년 자조적 표현으로 확산', '스스로를 가볍게 낮추는 자조 개그로 사용', '타인에게 쓰면 무기력함을 비하하는 뜻으로 들릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%9E%89%EC%97%AC', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('개드립', '개드립', array['개드립치다']::text[], '맥락 없고 형편없는 애드립이나 농담을 가리키는 말', '원래 악기 연주 갤러리에서 형편없는 애드립을 가리키던 말이었으나, 예능 프로그램의 무리한 개그성 애드립을 비꼬는 표현으로 코미디 갤러리 등에서 재사용되며 뜻이 바뀌었다. 2008년 전후 디시인사이드 전반으로 퍼지며 일상 유행어가 됐다.',
    '디시인사이드 악기 갤러리에서 시작, 코미디 갤러리를 거쳐 2008년경 뜻이 바뀌어 확산', '실없고 뜬금없는 농담을 가리킬 때 가볍게 사용', '''개''가 붙은 비하성 표현이라 격식 있는 자리는 피하는 게 좋음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2008, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EA%B0%9C%EB%93%9C%EB%A6%BD', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('어그로', '어그로', array['어그로 끌다']::text[], '주목이나 반응을 끌기 위해 자극적으로 행동하는 것', '온라인 게임에서 몬스터의 공격 대상을 자신에게 집중시키는 것을 뜻하는 영어 ''aggro''에서 나온 게임 용어다. 월드 오브 워크래프트 등이 국내에서 인기를 끌던 2005~2006년을 전후해 게임 밖에서도 관심을 끌기 위한 자극적 언행을 가리키는 말로 의미가 확장됐다.',
    'MMORPG 몬스터 어그로(threat) 개념에서 파생, 2006년 전후 일반 용어로 확장', '관심을 끌려는 과장된 언행을 지적할 때 사용', '상대를 비난하는 뉘앙스가 강해 논쟁을 유발할 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'controversial'::meme_sentiment, 2006, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%EC%96%B4%EA%B7%B8%EB%A1%9C', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('훈남/훈녀', '훈남/훈녀', array['훈남','훈녀']::text[], '외모보다 따뜻한 분위기와 인성으로 호감을 주는 사람을 가리키는 말', '얼짱 신드롬으로 외모지상주의가 심해지자, 외모와 상관없이 훈훈한 인상과 인성을 지닌 사람을 가리키는 말로 2006~2007년경 등장했다. 당시엔 외모보다 분위기를 강조하는 뜻이었으나 2010년대 들어 준수한 외모를 뜻하는 말로 의미가 변했다.',
    '얼짱 신드롬에 대한 반작용으로 2006~2007년경 등장', '호감 가는 인상이나 훈훈한 매력을 칭찬할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'wholesome'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%9B%88%EB%82%A8', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('헐', '헐', array['헐~']::text[], '놀랐을 때 내는 짧은 감탄사', '만화가 김성모의 작품에서 유래했다고 알려진 감탄사로, 2005년을 전후해 인터넷 유행어 순위에 오를 만큼 놀람을 표현하는 대표적인 감탄사로 자리잡았다. 이후에도 꾸준히 쓰이며 세대를 넘어 통용되는 표현이 됐다.',
    '만화 대사에서 유래한 것으로 알려짐, 2005년 전후 인터넷 유행어로 확산', '놀랍거나 황당한 상황에 짧게 반응할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('메이플스토리 고자시리즈', '메이플스토리-고자시리즈', array['고자비','고급 자이언트 비약']::text[], '메이플스토리 아이템 ''고급 자이언트 비약''의 줄임말이 낳은 말장난 밈', '캐릭터를 거대하게 만들어주는 아이템 ''고급 자이언트 비약''을 줄여 부르던 ''고자''라는 표현이 비표준적 의미(거세)와 겹치며 게임 커뮤니티에서 말장난 소재로 쓰였다. 거대화 상태에서 벌어지는 우스꽝스러운 장면들을 모아 부르는 용어로 확장됐다.',
    '메이플스토리 아이템 명칭 축약어가 게임 커뮤니티에서 말장난 소재로 확산', '메이플스토리 올드 유저 사이 게임 내 아이템 드립으로 사용', '단어 자체 의미(거세)가 불쾌할 수 있어 맥락 없이 쓰면 오해될 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('폭풍공감', '폭풍공감', array['폭풍-공감']::text[], '매우 강하게 공감된다는 뜻의 ''폭풍-'' 계열 유행어', '''폭풍간지'', ''폭풍눈물''과 같은 ''폭풍-'' 접두어 유행의 연장선에서 만들어진 표현으로, 어떤 말이나 상황에 격하게 공감할 때 쓰였다. 2000년대 후반 게시판 댓글 문화에서 흔히 볼 수 있었다.',
    '''폭풍-'' 접두어 유행의 파생어, 2007년 전후 확산', '댓글이나 반응에서 강한 공감을 과장되게 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('흠좀무', '흠좀무', array['흠, 이게 사실이라면 좀 무섭군요']::text[], '믿기 어렵지만 사실이라면 조금 무섭다는 뜻의 반응 표현', '''흠, 이게 사실이라면 좀 무섭다''는 문장이 줄어 만들어진 표현으로, 황당하거나 섬뜩한 이야기에 대한 반신반의 리액션으로 쓰였다. 2005년 인터넷 유행어 순위에 오를 정도로 커뮤니티에서 자주 쓰였다.',
    '2005년 전후 국내 인터넷 커뮤니티 댓글 문화에서 등장', '믿기 힘든 이야기에 반신반의하는 반응으로 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('여병추', '여병추', array['여기 병신 하나 추가요']::text[], '황당한 글이나 댓글을 쓴 사람을 비꼬는 인터넷 유행어', '''여기 병신 하나 추가요''를 줄인 말로, 맥락 없거나 이해할 수 없는 글을 올린 사람을 조롱할 때 쓰던 표현이다. 2005년 전후 인터넷 커뮤니티 댓글 문화에서 흔히 쓰였지만 비하적 어휘가 포함돼 있다.',
    '2005년 전후 국내 인터넷 커뮤니티 댓글 문화에서 등장', '레트로 인터넷 유행어 아카이브 목적의 소개에 한정', '''병신''이라는 멸칭이 포함돼 있어 실사용은 권장되지 않음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2005, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이뭐병', '이뭐병', array['이건 뭐 병신도 아니고']::text[], '어이없고 황당한 상황을 비꼬는 인터넷 유행어', '''이건 뭐 병신도 아니고''를 줄인 말로, 상식 밖의 황당한 상황이나 글을 접했을 때 쓰던 표현이다. 2005년 전후 커뮤니티 댓글 문화에서 자주 쓰였으나 비하적 어휘를 포함하고 있다.',
    '2005년 전후 국내 인터넷 커뮤니티 댓글 문화에서 등장', '레트로 인터넷 유행어 아카이브 목적의 소개에 한정', '''병신''이라는 멸칭이 포함돼 있어 실사용은 권장되지 않음',
    'red'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'negative'::meme_sentiment, 2005, jsonb_build_object('work','red','friends','green','family','red','sns','red'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('열폭', '열폭', array['열등감 폭발']::text[], '열등감이 폭발한 것 같은 과민 반응을 가리키는 말', '''열등감 폭발''을 줄인 말로, 논쟁 중 지나치게 흥분하거나 과민하게 반응하는 상대를 놀릴 때 쓰던 표현이다. 2005년 전후 인터넷 유행어 순위에 오를 만큼 커뮤니티 댓글 문화에서 흔히 쓰였다.',
    '2005년 전후 국내 인터넷 커뮤니티 논쟁 문화에서 등장', '과민 반응하는 상대를 가볍게 놀릴 때 사용', '상대를 자극해 논쟁을 키울 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'ironic'::meme_sentiment, 2005, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('안드로메다', '안드로메다', array['안드로메다로 갔다']::text[], '정신이 나가거나 정상 범위를 벗어났다는 뜻의 비유 표현', '''정신이 안드로메다로 갔다''는 식으로, 상식적이지 않거나 이해할 수 없는 상태·전개를 가리킬 때 쓰던 비유 표현이다. 2005년 전후 인터넷 유행어 순위에 이름을 올릴 만큼 널리 쓰였다.',
    '2005년 전후 국내 인터넷 커뮤니티에서 대중화', '이야기 전개나 상황이 산으로 갈 때 가볍게 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('쵝오', '쵝오', array['최고']::text[], '''최고''를 귀엽게 줄이거나 오타 낸 표현', '''최고''를 발음 나는 대로 혹은 장난스럽게 줄여 쓴 표현으로, 2000년대 중반 채팅과 게시판 댓글에서 감탄사처럼 흔히 쓰였다. 통신체·급식체 계열 표현의 초기 사례로 꼽힌다.',
    '2005년 전후 국내 인터넷 채팅·게시판 문화에서 등장', '복고풍 채팅체를 흉내 낼 때 장난스럽게 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('관광', '관광', array['관광보내다','관광시키다']::text[], '상대를 일방적으로 압도하거나 참패시키는 것을 가리키는 게임 은어', '게임 대전에서 한쪽이 손쓸 틈 없이 일방적으로 밀리는 상황을 마치 ''관광 온 듯'' 구경만 하게 됐다고 비유한 표현이다. 스타크래프트 등 온라인 게임 커뮤니티에서 2005년 전후로 널리 쓰이며 일상 유행어로도 확장됐다.',
    '2005년 전후 온라인 게임 대전 커뮤니티에서 유래', '게임이나 경쟁에서 일방적으로 패배한 상황을 가리킬 때 사용', null,
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('뽀샵', '뽀샵', array['뽀샵질']::text[], '포토샵으로 사진을 보정한다는 뜻의 줄임말', '''포토샵''을 발음 나는 대로 줄여 만든 속어로, 얼굴이나 몸매를 과도하게 보정한 사진을 가리킬 때 쓰였다. 얼짱·몸짱 신드롬과 함께 2005~2006년 사진 보정 문화가 확산되며 널리 퍼졌다.',
    '''포토샵''의 줄임말로 2005~2006년 사진 보정 문화와 함께 확산', '과도하게 보정된 사진을 가볍게 지적할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2005, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('후방주의', '후방주의', array['후방 주의']::text[], '게시글 하단에 민망하거나 자극적인 이미지가 있음을 미리 알리는 경고 문구', '게시글을 읽거나 스크롤하는 사람이 예상치 못한 상황(가족·동료가 화면을 볼 때 등)에 놓이지 않도록 미리 경고하는 커뮤니티 관용구다. 2000년대 후반 디시인사이드 등에서 자극적 이미지가 포함된 글의 제목 관행으로 자리잡았다.',
    '디시인사이드 등 커뮤니티의 게시글 제목 관행에서 2000년대 후반 정착', '민망하거나 자극적인 이미지 첨부 글에 미리 경고할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2007, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('스크롤압박', '스크롤압박', array['스크롤 압박']::text[], '글이나 이미지가 매우 길어 읽는 데 부담을 준다는 뜻의 경고 표현', '긴 게시글이나 연속된 이미지가 화면을 한참 내려야 할 만큼 길 때 이를 미리 알려주는 커뮤니티 관용구다. ''후방주의''와 함께 2000년대 후반 디시인사이드 등지의 게시글 제목 문화에서 정착됐다.',
    '커뮤니티 게시글 제목 관행에서 2000년대 후반 정착', '긴 글이나 이미지 게시물 제목에 미리 안내할 때 사용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2006, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('넘사벽', '넘사벽', array['넘을 수 없는 사차원의 벽']::text[], '실력 차이가 너무 커서 비교 자체가 불가능하다는 뜻의 표현', '''넘을 수 없는 사차원의 벽''을 줄인 말로, 격차가 너무 커서 도저히 따라잡거나 비교할 수 없는 상대·수준을 가리킬 때 쓰인다. 2009년 전후 온라인 커뮤니티에서 등장해 이후에도 꾸준히 쓰이는 표현으로 자리잡았다.',
    '2009년 전후 국내 온라인 커뮤니티에서 등장', '압도적인 실력·격차를 표현할 때 사용', null,
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2009, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('애정남 (애정한 것을 정해주는 남자)', '애정남-(애정한-것을-정해주는-남자)', array['애정男','애매한 것을 정해주는 남자']::text[], '애매한 일상 기준을 대신 정해주는 개콘 코너', '2011년 개그콘서트에서 방영된 코너로 최효종이 일상 속 애매한 상황들에 명쾌한 기준을 제시했다. ''~합니다잉'' 특유의 말투로 큰 인기를 끌었고 그 해 KBS 연예대상 최우수 아이디어상을 수상했다.',
    '2011년 8월 KBS 개그콘서트, 최효종·류근지·이원구·신종령 출연', '애매한 결정을 대신 내려줄 때 농담으로 인용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('사마귀 유치원 ''애매합니다잉''', '사마귀-유치원-애매합니다잉', array['일수꾼 최효종','애매합니다잉','경찰 출동 안해요']::text[], '최효종의 일수꾼 캐릭터 유행어 ''애매합니다잉''', '2011년 개그콘서트 ''사마귀 유치원'' 코너에서 최효종이 일수꾼 캐릭터로 등장해 ''요거 안 지킨다고 쇠고랑 안 찹니다잉'' 등의 대사로 유행어를 만들었다. 같은 코너의 정치 풍자 소재로 국회의원 강용석의 고소를 당해 사회적 화제가 되기도 했다.',
    '2011년 KBS 개그콘서트 ''사마귀 유치원'' 코너', '능청스럽게 얼버무릴 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%82%AC%EB%A7%88%EA%B7%80%20%EC%9C%A0%EC%B9%98%EC%9B%90', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('멘붕 (멘탈붕괴)', '멘붕-(멘탈붕괴)', array['멘탈붕괴','멘붕스쿨']::text[], '정신적 충격·당황 상태를 뜻하는 2011년 신조어', '2011년 12월 무한도전 방송 자막에서 처음 쓰이고 런닝맨 등 다른 예능에서도 사용되며 급속히 퍼졌다. 개그콘서트에 ''멘붕스쿨'' 코너가 생길 정도로 전국구 유행어가 됐고, 2012년 온라인 유행어 투표에서 압도적 1위를 차지했다.',
    '2011년 무한도전 방송 자막에서 확산', '당황스럽거나 충격받은 상황을 표현할 때', '지금은 다소 옛말투로 들릴 수 있음',
    'gray'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','gray','friends','green','family','gray','sns','gray'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%A9%98%ED%83%88%EB%B6%95%EA%B4%B4', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허니버터칩 품절대란', '허니버터칩-품절대란', array['허버칩','허니버터칩 대란']::text[], '2014년 출시 후 전국적 품절 사태를 부른 과자', '해태제과가 2014년 8월 출시한 감자칩으로 SNS 입소문을 타고 출시 2개월 만에 품귀 현상이 벌어졌다. 중고나라에서 정가의 3배 이상 가격에 거래될 정도로 ''품절 대란''의 대명사가 됐고 이 현상은 약 17개월간 이어졌다.',
    '2014년 8월 해태제과 출시, SNS 입소문으로 확산', '품귀 현상이나 갑작스러운 열풍을 비유할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'beginner'::meme_difficulty,
    'funny'::meme_sentiment, 2014, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'Community', 'https://namu.wiki/w/%ED%97%88%EB%8B%88%EB%B2%84%ED%84%B0%EC%B9%A9', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('허각 신드롬 (슈퍼스타K2)', '허각-신드롬-(슈퍼스타K2)', array['허각 우승','슈스케2 허각']::text[], '2010년 슈퍼스타K2에서 존박을 꺾고 우승한 신드롬', '2010년 10월 22일 오디션 프로그램 ''슈퍼스타K2'' 결승에서 인쇄소 근로자 출신 허각이 대학생 존박을 꺾고 최종 우승했다. 이변의 우승으로 ''역전 신화''의 상징이 됐고 그해 최고 화제의 예능 이벤트 중 하나로 꼽혔다.',
    '2010년 10월 Mnet ''슈퍼스타K2'' 결승전', '극적인 역전 스토리를 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%ED%97%88%EA%B0%81', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('이게 최선입니까? 확실해요?', '이게-최선입니까?-확실해요?', array['김주원 명대사','시크릿가든 명대사']::text[], '드라마 시크릿가든 김주원의 갑질 대사이자 패러디 밈', '2010년 SBS 드라마 ''시크릿가든''에서 백화점 CEO 김주원(현빈)이 부실한 기획안을 가져온 임원들을 다그치며 반복한 대사. 당시 각종 방송·광고에서 패러디되며 유행어가 됐고 이후로도 오랫동안 회자되는 명대사로 남았다.',
    '2010년 SBS 드라마 ''시크릿가든'' 김주원 대사', '완벽주의자 상사 흉내나 장난스러운 다그침에', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2010, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%B4%EA%B2%8C%20%EC%B5%9C%EC%84%A0%EC%9E%85%EB%8B%88%EA%B9%8C%3F%20%ED%99%95%EC%8B%A4%ED%95%B4%EC%9A%94%3F', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 가수다 임재범 신드롬', '나는-가수다-임재범-신드롬', array['여러분 임재범','나가수 임재범']::text[], '2011년 ''나는 가수다''에서 ''여러분''으로 큰 화제를 모은 무대', '2011년 5월 나는 가수다에서 임재범이 윤복희의 ''여러분''을 열창해 큰 반향을 일으켰다. 방송 직후 음원차트 1위에 오르는 등 ''임재범 신드롬''이라 불릴 정도로 화제를 모았다.',
    '2011년 5월 MBC ''나는 가수다'' 무대', '압도적인 무대나 감동적인 열창을 언급할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('나는 가수다 김건모 재도전 논란', '나는-가수다-김건모-재도전-논란', array['나가수 재도전 논란','김건모 재도전']::text[], '탈락자에게 재도전 기회를 준 것을 둘러싼 2011년 논란', '2011년 3월 ''나는 가수다''에서 7위로 첫 탈락자가 된 김건모에게 이소라·김제동 등 출연진의 요청으로 제작진이 재도전 기회를 준 사건. 시청자들의 거센 항의로 결국 김건모가 자진 하차하고 PD도 교체되는 등 큰 파장을 낳았다.',
    '2011년 3월 MBC ''나는 가수다'' 3회 방송', '룰이 특혜로 바뀌는 상황을 비판할 때', '특정 방송인에 대한 비난으로 흐르지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('비상대책위원회 ''야 안돼''', '비상대책위원회-야-안돼', array['김원효 안돼','야 안~돼애']::text[], '김원효가 핑계를 대며 외치는 개콘 유행어', '2011~2012년 개그콘서트 ''비상대책위원회'' 코너에서 경찰복을 입은 김원효가 상황을 무마하려 ''야, 안~돼애!''라고 외치던 유행어. 학교폭력 예방 교육 등 실제 현장에서도 패러디될 만큼 파급력이 컸다.',
    '2011년 KBS 개그콘서트 ''비상대책위원회'' 코너, 김원효', '곤란한 상황을 막으려 소리칠 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2011, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%B9%84%EC%83%81%EB%8C%80%EC%B1%85%EC%9C%84%EC%9B%90%ED%9A%8C(%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8)', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('비상대책위원회 ''고래''', '비상대책위원회-고래', array['김준현 고래','고래고래']::text[], '2012년 상반기 최고 유행어로 뽑힌 김준현의 개그 대사', '개그콘서트 ''비상대책위원회'' 코너에서 김준현이 반복한 대사 ''고래''가 2012년 상반기 온라인 리서치에서 최고 유행어 1위(지지율 47%)로 선정됐다.',
    '2012년 KBS 개그콘서트 ''비상대책위원회'' 코너, 김준현', '개콘 팬들 사이 인용용', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
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
  values ('네가지 ''맛이 있어''', '네가지-맛이-있어', array['김준현 네가지','마음만은 홀쭉하다']::text[], '뚱뚱함을 소재로 한 김준현의 개콘 유행어', '2012~2013년 방영된 개그콘서트 ''네가지'' 코너에서 뚱뚱한 캐릭터 김준현이 외친 유행어 ''맛이 있어!''와 ''마음만은 홀쭉하다''가 큰 인기를 끌었다.',
    '2012년 KBS 개그콘서트 ''네가지'' 코너, 김준현', '자기 외모를 셀프 디스할 때', '타인의 외모를 놀리는 용도로는 쓰지 않기',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%84%A4%EA%B0%80%EC%A7%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('네가지 ''아니되오''', '네가지-아니되오', array['허경환 네가지','키 작다고 오해하면']::text[], '작은 키를 소재로 한 허경환의 개콘 유행어', '개그콘서트 ''네가지'' 코너에서 허경환이 키가 작은 캐릭터로 등장해 ''키 작다고 오해하면, 아니 아니, 아~니되오!''라는 대사로 유행어를 만들었다.',
    '2012년 KBS 개그콘서트 ''네가지'' 코너, 허경환', '콤플렉스를 웃음으로 승화할 때', '외모 비하로 번지지 않도록 주의',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'funny'::meme_sentiment, 2012, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EB%84%A4%EA%B0%80%EC%A7%80', 'embeddable'::copyright_status from ins where true;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('짝 애정촌 ''남자1호·여자1호''', '짝-애정촌-남자1호·여자1호', array['애정촌','짝 몇호']::text[], '실명 대신 번호로 부르는 SBS ''짝''의 상징적 호칭', '2011년 3월 시작한 SBS 리얼리티 프로그램 ''짝''에서 출연자들을 실명 대신 ''남자1호'', ''여자1호'' 등으로 부른 방식이 화제가 되며 유행어처럼 쓰였다. 짝을 찾는 남녀 그룹을 지칭하는 ''애정촌''이라는 표현도 함께 널리 퍼졌다.',
    '2011년 SBS 리얼리티 프로그램 ''짝''', '소개팅·미팅 상황을 유쾌하게 지칭할 때', '프로그램 관련 실제 인명 사고는 별개로 다뤄야 함',
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'phrase'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('이광수 ''기린''', '이광수-기린', array['런닝맨 기린','광수 기린']::text[], '큰 키의 이광수를 부르는 런닝맨 시절 별명', '런닝맨 초반에는 ''광바타''로 불리던 이광수가 2012년 초부터 큰 키 때문에 ''기린''이라는 별명으로 자리잡았다. 이후 이광수를 상징하는 대표 별명이자 밈이 되어 각종 합성 이미지에도 쓰였다.',
    '2012년 초 SBS ''런닝맨''에서 정착된 별명', '키 큰 사람을 애정 어린 별명으로 부를 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
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
  values ('SNL코리아 여의도 텔레토비', 'SNL코리아-여의도-텔레토비', array['여의도 텔레토비','정치풍자 텔레토비']::text[], '2013년 대선 정치인을 텔레토비로 풍자한 SNL 코너', '2013년 대선을 앞두고 SNL 코리아가 어린이 프로그램 ''텔레토비'' 캐릭터에 박근혜(또)·문재인(문제니)·이정희(구라돌이)·안철수(안쳤어) 등을 빗대 정치풍자를 한 코너. 시청률이 가장 높았던 코너 중 하나로 정치권의 반발까지 불러왔다.',
    '2013년 tvN ''SNL 코리아'' 대선 특집 코너', '풍자적 맥락에서만 인용', '정치적 성향에 따라 호불호가 갈릴 수 있음',
    'yellow'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'deep'::meme_difficulty,
    'controversial'::meme_sentiment, 2013, jsonb_build_object('work','yellow','friends','green','family','yellow','sns','yellow'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', null, 'unknown'::copyright_status from ins where false;


with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values ('응답하라 1997 복고 신드롬', '응답하라-1997-복고-신드롬', array['응칠','응답하라 시리즈']::text[], '1990년대 팬덤 문화를 다룬 tvN 드라마의 복고 열풍', '2012년 7~9월 방영된 tvN ''응답하라 1997''이 1990년대 아이돌 팬덤 문화와 옛 유행어·물건들을 재조명하며 케이블 드라마 사상 최고 화제작으로 꼽혔다. 이후 ''응답하라'' 시리즈 전체와 복고 열풍의 시발점이 됐다.',
    '2012년 tvN 드라마 ''응답하라 1997''', '90년대 추억을 소환할 때', null,
    'green'::safety_level, 'archived'::lifecycle_status, 'approved'::moderation_status,
    'comment'::meme_category, 'image'::media_type, 'normal'::meme_difficulty,
    'wholesome'::meme_sentiment, 2012, jsonb_build_object('work','green','friends','green','family','green','sns','green'), now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, 'TV', 'https://namu.wiki/w/%EC%9D%91%EB%8B%B5%ED%95%98%EB%9D%BC%201997', 'embeddable'::copyright_status from ins where true;

commit;
