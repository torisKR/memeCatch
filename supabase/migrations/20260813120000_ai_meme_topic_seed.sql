begin;

alter table public.meme_contents
  drop constraint if exists meme_contents_thumbnail_url_check;

alter table public.meme_contents
  add constraint meme_contents_thumbnail_url_check check (
    thumbnail_url is null
    or thumbnail_url ~* '^https?://'
    or thumbnail_url ~ '^/ai-memes/[a-z0-9-]+\.jpg$'
  );

create temporary table ai_meme_seed (
  slug text primary key,
  title text not null,
  aliases text[] not null,
  summary text not null,
  description text not null,
  origin text not null,
  usage_context jsonb not null,
  usage_note text not null,
  caution text not null,
  usage_examples jsonb not null,
  category public.meme_category not null,
  safety_level public.safety_level not null,
  moderation_status public.moderation_status not null,
  sentiment public.meme_sentiment not null,
  image_path text not null,
  tags text[] not null
) on commit drop;

insert into ai_meme_seed values
  (
    'italian-brainrot',
    '이탈리안 브레인롯',
    array['Italian brainrot', '이탈리안 브레인 롯', '이탈리아 브레인롯'],
    'AI로 만든 동물·사물 혼합 캐릭터와 의사 이탈리아어 내레이션을 결합한 2025년의 초현실주의 인터넷 밈 흐름.',
    '이탈리안 브레인롯은 현실에 없는 동물과 사물을 합친 AI 이미지, 의미보다 리듬을 앞세운 의사 이탈리아어 이름, 합성 음성을 반복하는 밈 문법이다. 트랄랄레로 트랄랄라와 발레리나 카푸치나 같은 캐릭터가 서로 관계를 맺는 패러디와 게임으로 확장되며 세대 내부의 암호처럼 쓰였다. 하나의 작품이나 공식 설정이 아니라 수많은 사용자가 변형한 장르에 가까우며, 개별 캐릭터의 창작자와 첫 게시물 귀속은 항목별로 다르거나 확인되지 않았다.',
    '2025년 초 쇼트폼에서 넓게 보이기 시작했다는 보도가 일치하지만, 삭제된 게시물과 재업로드가 많아 장르 전체의 단일 최초 작자나 정확한 시작일을 확정하기는 어렵다. AP와 NYT는 트랄랄레로를 초기 핵심 사례로 소개한다.',
    '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}',
    '말이 안 되는 조합이나 반복 리듬 자체를 웃음거리로 삼거나, 빠른 AI 제작물의 느낌을 설명할 때 장르명으로 쓴다. 특정 음원을 그대로 재사용하기보다 맥락을 알아듣는 사람끼리 짧게 인용하는 편이 안전하다.',
    '일부 유행 음원에는 욕설·신성모독으로 받아들여질 표현이 있다. 어린이에게 노출하거나 종교적 맥락에서 쓰기 전에는 음원 내용을 먼저 확인해야 한다. 캐릭터의 브랜드 신발·파생 이미지는 상표와 저작권 문제가 생길 수 있으므로 상업적 복제를 피한다.',
    '[{"situation":"친구가 새 AI 캐릭터를 보여 줄 때","text":"이거 완전 이탈리안 브레인롯 문법이네."},{"situation":"의미 없는 반복 영상을 설명할 때","text":"설정보다 리듬으로 보는 브레인롯 계열이야."}]',
    'image', 'yellow', 'limited', 'ironic',
    '/ai-memes/italian-brainrot.jpg',
    array['AI 밈', '2025 밈', '쇼트폼', '초현실주의', '주의 필요']
  ),
  (
    'tralalero-tralala',
    '트랄랄레로 트랄랄라',
    array['Tralalero Tralala', '트랄라레로 트랄랄라', '트랄랄레로'],
    '세 개의 다리와 운동화를 가진 AI 상어로 알려진 이탈리안 브레인롯의 대표 캐릭터.',
    '트랄랄레로 트랄랄라는 상어, 세 개의 다리, 파란 운동화를 합친 AI 생성 캐릭터로 유통되었다. 이름을 반복하는 노래처럼 들리는 음성과 이미지의 부조화가 핵심이다. 이후 다른 캐릭터와 대결하거나 친구·가족 관계를 맺는 2차 설정이 수없이 붙었지만, 이는 공식 설정이 아니라 사용자 공동 패러디에 가깝다. 이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.',
    '2025년 초부터 확산했다는 보도는 많지만, NYT가 연결한 초기 계정의 게시물이 삭제되어 있고 다른 사용자의 재업로드가 섞여 있다. 따라서 특정 계정을 확정적 원작자로 표기하지 않고, AP·NYT가 초기 대표 사례로 보도했다는 수준으로 설명한다.',
    '{"work":"gray","friends":"yellow","family":"gray","sns":"yellow"}',
    '세 번 반복되는 이름의 리듬을 과장된 등장음이나 말이 안 되는 상황의 반응으로 쓴다. 원 음원을 모르는 상대에게는 캐릭터를 함께 설명해야 의미가 전달된다.',
    '초기에 결합된 일부 이탈리아어 음원에는 욕설과 신성모독으로 받아들여질 표현이 들어 있어, 어린이·학교·종교적 공간에서 음원 그대로의 재생을 피해야 한다. 운동화나 기존 파생 이미지를 상업 상품에 복제하면 상표·저작권 분쟁 위험이 있다.',
    '[{"situation":"누군가 유난스럽게 등장할 때","text":"트랄랄레로 트랄랄라처럼 등장했네."},{"situation":"캐릭터 퀴즈를 할 때","text":"세 다리 상어면 트랄랄레로지."}]',
    'image', 'gray', 'limited', 'controversial',
    '/ai-memes/tralalero-tralala.jpg',
    array['AI 밈', '이탈리안 브레인롯', '상어', '종교 주의', 'IP 주의']
  ),
  (
    'ballerina-cappuccina',
    '발레리나 카푸치나',
    array['Ballerina Cappuccina', '카푸치나 발레리나', '발레리나 카푸치노'],
    '카푸치노 잔 머리와 발레리나의 몸을 합친 이탈리안 브레인롯 계열의 AI 캐릭터.',
    '발레리나 카푸치나는 카푸치노 커피잔이 머리가 된 발레리나로 묘사되는 AI 생성 캐릭터다. 우아한 발레 자세와 조악한 합성 음성의 간극, 커피와 발레를 억지로 결합한 이름이 웃음의 핵심이다. 파생 영상에서는 카푸치노 암살자 등 다른 캐릭터와 관계가 붙지만 이런 설정은 사용자가 계속 덧붙인 공동 패러디이며 단일한 공식 정전은 아니다. 특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.',
    '2025년 초 쇼트폼에서 확산한 이탈리안 브레인롯 후발 캐릭터로 AP·NYT 등에 보도됐다. 수많은 재업로드와 파생물 때문에 첫 이미지의 작자나 세부 설정을 하나의 확정된 원전으로 단정하지 않는다.',
    '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}',
    '우아함과 엉뚱함이 동시에 느껴지는 장면을 비유하거나, 커피·발레와 관련된 가벼운 대화에서 캐릭터 이름을 장난스럽게 붙인다. 상대가 밈 맥락을 모르면 단순한 오타처럼 들릴 수 있다.',
    '어린 캐릭터처럼 소비되지만 AI 이미지의 작자·학습 자료·파생물 권리는 명확하지 않을 수 있다. 특정 포즈나 이미지를 상품에 그대로 복제하지 말고, 성별·외모를 희화화하는 파생 이야기도 피한다.',
    '[{"situation":"커피를 들고 회전하는 친구에게","text":"오늘 완전 발레리나 카푸치나네."},{"situation":"엉뚱하지만 우아한 영상에","text":"카푸치노와 발레를 섞은 브레인롯 감성이야."}]',
    'image', 'yellow', 'limited', 'funny',
    '/ai-memes/ballerina-cappuccina.jpg',
    array['AI 밈', '이탈리안 브레인롯', '커피', '캐릭터', 'IP 주의']
  ),
  (
    'ai-slop',
    'AI 슬롭',
    array['AI slop', '에이아이 슬롭', '인공지능 슬롭'],
    '생성형 AI로 대량 제작된 낮은 품질의 디지털 콘텐츠를 낮춰 부르는 비판적 인터넷 표현.',
    'AI 슬롭은 생성형 AI로 빠르게 대량 생산했지만 정확성, 독창성, 편집 품질이 낮다고 평가받는 이미지·글·영상을 가리키는 멸칭이다. 단순히 AI를 사용했다는 뜻이 아니라, 인간의 검토 없이 반복되거나 검색·피드를 점유하는 정황을 함께 비판할 때 주로 쓴다. 따라서 모든 AI 보조 작품에 자동으로 붙는 기술적 분류가 아니라 품질과 유통 방식을 평가하는 가치 판단이다. 한국어로는 AI 쓰레기 콘텐츠라는 뜻으로도 풀어 쓴다.',
    '2024년 전후 온라인 토론과 보도에서 두드러진 표현이지만 단일 창안자나 첫 용례는 확정하기 어렵다. Merriam-Webster는 후에 AI로 대량 생산된 낮은 품질의 디지털 콘텐츠라는 뜻을 사전에 반영했지만, 실제 사용 경계는 여전히 토론적이다.',
    '{"work":"yellow","friends":"green","family":"green","sns":"yellow"}',
    '반복되는 형식, 사실 확인 부족, 낮은 편집 품질 같은 구체적 문제를 짚은 뒤 콘텐츠 유통 현상을 설명할 때 쓴다. 작자 공격보다 아이템의 검토 가능한 품질을 비판하는 편이 정확하다.',
    '누군가의 작품을 AI 슬롭이라 단정하면 비하나 작자 공격이 될 수 있다. AI 사용 여부를 증거 없이 추정하지 말고, 표절·학습 데이터·허위 정보는 각각 구분해 확인해야 한다. 자동 생성 콘텐츠의 대량 게시는 플랫폼 스팸 정책에도 저촉될 수 있다.',
    '[{"situation":"검색 결과가 비슷한 AI 글로 도배됐을 때","text":"정보보다 키워드만 반복하는 AI 슬롭이 많네."},{"situation":"영상 품질을 비판할 때","text":"AI 사용 자체보다 검수 없이 대량 업로드한 게 슬롭으로 느껴져."}]',
    'phrase', 'yellow', 'approved', 'negative',
    '/ai-memes/ai-slop.jpg',
    array['AI 밈', 'AI 용어', '콘텐츠 품질', '스팸', '미디어 리터러시']
  ),
  (
    'shrimp-jesus',
    '새우 예수',
    array['Shrimp Jesus', '쉬림프 지저스', '갑각류 예수'],
    '새우나 갑각류로 예수의 형상을 구성한 AI 생성 이미지로, 소셜미디어 AI 스팸을 대표한 사례.',
    '새우 예수는 새우·게 같은 갑각류를 모아 예수의 형상으로 보이게 만든 AI 이미지 유형을 가리킨다. 페이스북에서 감탄·신앙 반응을 유도하는 문구와 함께 반복 게시되며 널리 알려졌다. 이미지 하나를 감상하는 밈이기도 하지만, 연구자들은 이런 이미지를 대량 게시하는 페이지가 관심을 모은 후 외부 사이트로 유도하는 스팸·스캠 생태계와 맞물린다고 분석했다. 그러므로 이 항목은 단순한 종교 패러디가 아니라 AI 피드 조작 사례로도 읽어야 한다.',
    '2024년 Stanford Internet Observatory와 Georgetown CSET 연구진이 AI 생성 이미지를 대량 게시한 페이스북 페이지를 조사하며 대표 사례로 소개했다. 여러 계정이 비슷한 이미지를 생성·재게시했기 때문에 특정 이미지의 첫 생성자나 원본 프롬프트는 확정하지 않는다.',
    '{"work":"gray","friends":"yellow","family":"gray","sns":"yellow"}',
    'AI 스팸이 사람의 신앙·감정·호기심을 어떻게 이용하는지 설명하는 사례로 쓴다. 이미지를 재게시하기보다 연구 맥락과 AI 생성물이라는 표시를 함께 제공하는 편이 적절하다.',
    '예수의 형상을 유희적으로 변형했다고 느끼는 신자에게 모욕적이거나 불편할 수 있다. 종교 공동체나 가족 대화에서는 신성한 표상을 존중하고, 실제 사진으로 오인하지 않도록 AI 생성물임을 밝힌다. 반응을 요구하거나 외부 링크를 누르게 하는 계정은 스팸·스캠 가능성을 의심해야 한다.',
    '[{"situation":"AI 스팸 연구를 설명할 때","text":"새우 예수는 감정 반응을 유도한 AI 페이스북 스팸의 대표 사례야."},{"situation":"의심스런 종교 이미지를 볼 때","text":"AI 생성 여부와 게시 계정의 링크부터 확인해 보자."}]',
    'image', 'gray', 'limited', 'controversial',
    '/ai-memes/shrimp-jesus.jpg',
    array['AI 밈', 'AI 슬롭', '새우 예수', '종교 주의', '스팸']
  );

insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_context,
  usage_note, caution, usage_examples, safety_level, lifecycle_status,
  moderation_status, category, media_type, difficulty, sentiment,
  origin_year, trend_score, published_at
)
select
  slug, title, aliases, summary, description, origin, usage_context,
  usage_note, caution, usage_examples, safety_level, 'active',
  moderation_status, category, 'image', 'normal', sentiment,
  case when slug = 'ai-slop' then 2024 else case when slug = 'shrimp-jesus' then 2024 else 2025 end end,
  0, now()
from ai_meme_seed
on conflict (slug) do update set
  title = excluded.title,
  aliases = excluded.aliases,
  summary = excluded.summary,
  description = excluded.description,
  origin = excluded.origin,
  usage_context = excluded.usage_context,
  usage_note = excluded.usage_note,
  caution = excluded.caution,
  usage_examples = excluded.usage_examples,
  safety_level = excluded.safety_level,
  lifecycle_status = excluded.lifecycle_status,
  category = excluded.category,
  media_type = excluded.media_type,
  difficulty = excluded.difficulty,
  sentiment = excluded.sentiment,
  origin_year = excluded.origin_year,
  published_at = coalesce(public.memes.published_at, excluded.published_at),
  updated_at = now();

do $$
begin
  if exists (
    select 1
    from public.memes meme
    join ai_meme_seed seed on seed.slug = meme.slug
    where meme.moderation_status = 'rejected'
  ) then
    raise exception 'AI meme seed cannot republish a rejected record';
  end if;
end $$;

update public.memes meme
set moderation_status = 'fact_checking'
from ai_meme_seed seed
where meme.slug = seed.slug
  and meme.moderation_status = 'pending';

update public.memes meme
set moderation_status = 'rights_checking'
from ai_meme_seed seed
where meme.slug = seed.slug
  and meme.moderation_status = 'fact_checking';

update public.memes meme
set moderation_status = seed.moderation_status
from ai_meme_seed seed
where meme.slug = seed.slug
  and meme.moderation_status = 'rights_checking';

update public.memes meme
set moderation_status = seed.moderation_status
from ai_meme_seed seed
where meme.slug = seed.slug
  and meme.moderation_status in ('approved', 'limited')
  and meme.moderation_status is distinct from seed.moderation_status;

insert into public.tags (name, type)
select distinct tag_name, case
  when tag_name in ('종교 주의', 'IP 주의', '주의 필요', '스팸') then 'risk'
  when tag_name in ('2025 밈') then 'generation'
  else 'topic'
end
from ai_meme_seed seed
cross join lateral unnest(seed.tags) tag_name
on conflict (name) do nothing;

insert into public.meme_tags_map (meme_id, tag_id)
select meme.id, tag.id
from ai_meme_seed seed
join public.memes meme on meme.slug = seed.slug
cross join lateral unnest(seed.tags) tag_name
join public.tags tag on tag.name = tag_name
on conflict (meme_id, tag_id) do nothing;

create or replace function public.search_ai_memes(
  p_query text,
  p_limit int default 20
) returns setof public.memes
language sql stable security definer set search_path = public as $$
  select meme.*
  from public.memes meme
  where meme.moderation_status in ('approved', 'limited')
    and exists (
      select 1
      from public.meme_tags_map map
      join public.tags tag on tag.id = map.tag_id
      where map.meme_id = meme.id
        and tag.name = 'AI 밈'
    )
    and (
      meme.title ilike '%' || p_query || '%'
      or meme.summary ilike '%' || p_query || '%'
      or meme.title_chosung ilike '%' || p_query || '%'
      or exists (
        select 1 from unnest(meme.aliases) alias
        where alias ilike '%' || p_query || '%'
      )
      or similarity(meme.title, p_query) > 0.25
    )
  order by
    (meme.title ilike '%' || p_query || '%') desc,
    similarity(meme.title, p_query) desc,
    meme.trend_score desc
  limit least(p_limit, 50)
$$;

revoke all on function public.search_ai_memes(text, int) from public;
grant execute on function public.search_ai_memes(text, int) to anon, authenticated;

update public.meme_contents content
set is_representative = false
from ai_meme_seed seed
join public.memes meme on meme.slug = seed.slug
where content.meme_id = meme.id
  and content.is_representative
  and content.thumbnail_url is distinct from seed.image_path;

update public.meme_contents content
set
  type = 'image',
  platform = 'MemeCatch',
  url = null,
  caption = seed.title || ' — 밈캐치 편집 삽화',
  is_representative = true,
  availability = 'live',
  moderation_status = 'approved'
from ai_meme_seed seed
join public.memes meme on meme.slug = seed.slug
where content.meme_id = meme.id
  and content.thumbnail_url = seed.image_path;

insert into public.meme_contents (
  meme_id, type, platform, url, thumbnail_url, caption,
  is_representative, availability, moderation_status
)
select
  meme.id, 'image', 'MemeCatch', null, seed.image_path,
  seed.title || ' — 밈캐치 편집 삽화',
  true, 'live', 'approved'
from ai_meme_seed seed
join public.memes meme on meme.slug = seed.slug
where not exists (
  select 1 from public.meme_contents existing
  where existing.meme_id = meme.id
    and existing.thumbnail_url = seed.image_path
);

create temporary table ai_meme_source_seed (
  slug text not null,
  platform text not null,
  source_url text not null,
  title text not null,
  creator_name text not null
) on commit drop;

insert into ai_meme_source_seed values
  ('italian-brainrot', 'Associated Press', 'https://apnews.com/article/7600d1faea12be53609f3c2092e02eb7', 'Don''t look now, but there''s an AI-generated Italian teacup on your child''s phone', 'Associated Press'),
  ('italian-brainrot', 'The New York Times', 'https://www.nytimes.com/2025/04/30/style/italian-brain-rot-ballerina-cappuccina.html', 'Meet Ballerina Cappuccina and the Italian Brain Rot Crew', 'The New York Times'),
  ('tralalero-tralala', 'Associated Press', 'https://apnews.com/article/7600d1faea12be53609f3c2092e02eb7', 'Don''t look now, but there''s an AI-generated Italian teacup on your child''s phone', 'Associated Press'),
  ('tralalero-tralala', 'The New York Times', 'https://www.nytimes.com/2025/04/30/style/italian-brain-rot-ballerina-cappuccina.html', 'Meet Ballerina Cappuccina and the Italian Brain Rot Crew', 'The New York Times'),
  ('ballerina-cappuccina', 'Associated Press', 'https://apnews.com/article/7600d1faea12be53609f3c2092e02eb7', 'Don''t look now, but there''s an AI-generated Italian teacup on your child''s phone', 'Associated Press'),
  ('ballerina-cappuccina', 'The New York Times', 'https://www.nytimes.com/2025/04/30/style/italian-brain-rot-ballerina-cappuccina.html', 'Meet Ballerina Cappuccina and the Italian Brain Rot Crew', 'The New York Times'),
  ('ai-slop', 'Merriam-Webster', 'https://www.merriam-webster.com/dictionary/slop', 'Slop Definition and Meaning', 'Merriam-Webster'),
  ('shrimp-jesus', 'Stanford FSI', 'https://fsi.stanford.edu/news/ai-spam-accounts-build-followers', 'How Spammers, Scammers and Creators Leverage AI-Generated Images on Facebook for Audience Growth', 'Stanford Internet Observatory');

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status
)
select
  meme.id, source.platform, source.source_url, source.title,
  source.creator_name, 'permission_needed'
from ai_meme_source_seed source
join public.memes meme on meme.slug = source.slug
where not exists (
  select 1 from public.meme_sources existing
  where existing.meme_id = meme.id
    and existing.source_url = source.source_url
);

commit;
