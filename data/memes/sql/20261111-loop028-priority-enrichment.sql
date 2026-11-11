-- Idempotent UPDATE batch for already-public memes. The generator does not connect or write.
-- batch_id: loop-028-priority-enrichment-2026-11-11
-- Apply only after QA and toris approval. Do NOT apply to prod from this PR alone.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this-file>
-- Updates existing rows by short_id + slug + public moderation_status.
-- Does not INSERT new memes, and does not change moderation_status or published_at.
-- meme_sources rows are added only when the (meme_id, source_url) pair does not already exist.
-- Rollback is not a simple inverse of UPDATE; restore from a pre-apply backup if needed.
-- dropped: 4 memes from the original 83 were not included (see editorial catalog).
begin;
-- 새우 예수 (b9gzeysg / shrimp-jesus)
update public.memes set
  description = '새우 예수는 새우·게 같은 갑각류를 모아 예수의 형상으로 보이게 만든 AI 이미지 유형을 가리킨다. 페이스북에서 감탄·신앙 반응을 유도하는 문구와 함께 반복 게시되며 널리 알려졌다. 이미지 하나를 감상하는 밈이기도 하지만, 연구자들은 이런 이미지를 대량 게시하는 페이지가 관심을 모은 후 외부 사이트로 유도하는 스팸·스캠 생태계와 맞물린다고 분석했다. 그러므로 이 항목은 단순한 종교 패러디가 아니라 AI 피드 조작 사례로도 읽어야 한다.',
  origin = '2024년 Stanford Internet Observatory와 Georgetown CSET 연구진이 AI 생성 이미지를 대량 게시한 페이스북 페이지를 조사하며 대표 사례로 소개했다. NBC News 등도 같은 시기 페이스북에서 예수를 그린 기이한 AI 이미지에 신도들이 ‘아멘’으로 반응하는 현상을 보도했다. 여러 계정이 비슷한 이미지를 생성·재게시했기 때문에 특정 이미지의 첫 생성자나 원본 프롬프트는 확정하지 않는다.',
  usage_note = 'AI 스팸이 사람의 신앙·감정·호기심을 어떻게 이용하는지 설명하는 사례로 쓴다. 이미지를 재게시하기보다 연구 맥락과 AI 생성물이라는 표시를 함께 제공하는 편이 적절하다.',
  caution = '예수의 형상을 유희적으로 변형했다고 느끼는 신자에게 모욕적이거나 불편할 수 있다. 종교 공동체나 가족 대화에서는 신성한 표상을 존중하고, 실제 사진으로 오인하지 않도록 AI 생성물임을 밝힌다. 반응을 요구하거나 외부 링크를 누르게 하는 계정은 스팸·스캠 가능성을 의심해야 한다.',
  usage_examples = '[{"situation":"AI 스팸 연구를 설명할 때","text":"새우 예수는 감정 반응을 유도한 AI 페이스북 스팸의 대표 사례야."},{"situation":"의심스런 종교 이미지를 볼 때","text":"AI 생성 여부와 게시 계정의 링크부터 확인해 보자."}]'::jsonb,
  updated_at = now()
where short_id = 'b9gzeysg'
  and slug = 'shrimp-jesus'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.nbcnews.com/tech/tech-news/facebook-users-say-amen-bizarre-ai-generated-images-jesus-rcna143965', 'Facebook users say ''amen'' to bizarre AI-generated images of Jesus', 'NBC News',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'b9gzeysg' and meme.slug = 'shrimp-jesus'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.nbcnews.com/tech/tech-news/facebook-users-say-amen-bizarre-ai-generated-images-jesus-rcna143965'
  );

-- AI 슬롭 (xazbup6j / ai-slop)
update public.memes set
  description = 'AI 슬롭은 생성형 AI로 빠르게 대량 생산했지만 정확성, 독창성, 편집 품질이 낮다고 평가받는 이미지·글·영상을 가리키는 멸칭이다. 단순히 AI를 사용했다는 뜻이 아니라, 인간의 검토 없이 반복되거나 검색·피드를 점유하는 정황을 함께 비판할 때 주로 쓴다. 따라서 모든 AI 보조 작품에 자동으로 붙는 기술적 분류가 아니라 품질과 유통 방식을 평가하는 가치 판단이다. 한국어로는 AI 쓰레기 콘텐츠라는 뜻으로도 풀어 쓴다.',
  origin = '2024년 전후 온라인 토론과 보도에서 두드러진 표현이지만 단일 창안자나 첫 용례는 확정하기 어렵다. 개발자 사이먼 윌리슨은 2024년 5월 원치 않는 AI 생성물을 이메일의 스팸에 빗대 ‘슬롭’이라 부르자고 정리했다. 이후 케임브리지 사전은 AI slop을 인공지능이 만든 낮은 품질의 디지털 콘텐츠로 정의했고, 메리엄-웹스터는 2025년 올해의 단어로 slop을 선정하며 이 용법을 반영했다.',
  usage_note = '반복되는 형식, 사실 확인 부족, 낮은 편집 품질 같은 구체적 문제를 짚은 뒤 콘텐츠 유통 현상을 설명할 때 쓴다. 작자 공격보다 아이템의 검토 가능한 품질을 비판하는 편이 정확하다.',
  caution = '누군가의 작품을 AI 슬롭이라 단정하면 비하나 작자 공격이 될 수 있다. AI 사용 여부를 증거 없이 추정하지 말고, 표절·학습 데이터·허위 정보는 각각 구분해 확인해야 한다. 자동 생성 콘텐츠의 대량 게시는 플랫폼 스팸 정책에도 저촉될 수 있다.',
  usage_examples = '[{"situation":"검색 결과가 비슷한 AI 글로 도배됐을 때","text":"정보보다 키워드만 반복하는 AI 슬롭이 많네."},{"situation":"영상 품질을 비판할 때","text":"AI 사용 자체보다 검수 없이 대량 업로드한 게 슬롭으로 느껴져."}]'::jsonb,
  updated_at = now()
where short_id = 'xazbup6j'
  and slug = 'ai-slop'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://dictionary.cambridge.org/us/dictionary/english/ai-slop', 'AI slop | Cambridge English Dictionary', 'Cambridge Dictionary',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'xazbup6j' and meme.slug = 'ai-slop'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://dictionary.cambridge.org/us/dictionary/english/ai-slop'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://simonwillison.net/2024/May/8/slop/', 'Slop is the new name for unwanted AI-generated content', 'Simon Willison',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'xazbup6j' and meme.slug = 'ai-slop'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://simonwillison.net/2024/May/8/slop/'
  );

-- 뇌절 (k32wguve / 뇌절)
update public.memes set
  description = '뇌절은 같은 말이나 행동을 지겹도록 반복해 상대를 질리게 하는 일을 가리키는 인터넷 신조어다. ‘1절만 하라’는 핀잔을 넘어서까지 밀어붙일 때, 또는 이득을 더 보려다 일을 그르칠 때 쓴다. 게임 판에서는 욕심을 부리다 역전당하는 플레이를 뇌절이라고 부르기도 했다. 지금은 커뮤니티와 일상 대화에서 ‘적당히를 모른다’는 뜻으로 넓게 쓰인다.',
  origin = '어원은 만화·애니메이션 나루토에서 하타케 카카시가 쓰는 술법 이름 ‘뇌절(雷切)’과, ‘1절만 하라’는 말이 겹친 드립이다. 아시아경제 등 언론은 디시인사이드 만화 갤러리에서 카카시 관련 밈이 과도하게 반복되자 “1절, 2절도 모자라 카카시 뇌절까지 한다”는 조롱이 나왔다고 정리한다. 이후 게임 방송과 커뮤니티를 거쳐 일상어로 퍼졌고, ‘뇌가 절여졌다’는 민간 어원 설명도 함께 돌고 있으나 1차 용례로 확인된 것은 나루토 드립 쪽이다.',
  usage_note = '같은 농담이나 주장을 반복하는 상대를 타박할 때, 또는 스스로 선을 넘었다고 느낄 때 쓴다. 면전에서 쓰면 공격적으로 들릴 수 있다.',
  caution = '상대를 깎아내리는 말로 들릴 수 있다. 친한 사이에서만, 웃는 분위기에서 쓰자.',
  usage_examples = '[{"situation":"같은 농담을 여러 번 들을 때","text":"그 얘기 벌써 세 번째야. 이제 뇌절이야."},{"situation":"게임에서 무리한 한 타를 보다가","text":"이기던 판을 뇌절해서 뒤집혔네."}]'::jsonb,
  updated_at = now()
where short_id = 'k32wguve'
  and slug = '뇌절'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.asiae.co.kr/article/2020040814253172269', '[신조어사전] 뇌절 - 집착에 가까운 반복', '아시아경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'k32wguve' and meme.slug = '뇌절'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.asiae.co.kr/article/2020040814253172269'
  );

-- 내돈내산 (qqzf3wyy / 내돈내산)
update public.memes set
  description = '내돈내산은 ‘내 돈 주고 내가 산’의 줄임말로, 협찬이나 광고비를 받지 않고 직접 사서 써 본 제품이라는 점을 강조할 때 쓰는 말이다. 유튜브·블로그·숏폼 리뷰에서 해시태그로 자주 붙이며, 광고성 후기와 구별하려는 신호가 됐다. 다만 영수증만 보여주고 따로 대가를 받는 경우도 있어, 태그만으로 진정성을 단정할 수는 없다. 2020년 전후 인플루언서 뒷광고 논란과 함께 이 표현이 다시 주목받았다.',
  origin = '2010년대 중반 이후 리뷰 창작자들 사이에서 퍼진 말로, 이투데이 등 언론은 ‘내 돈 주고 내가 산 제품’을 뜻하는 SNS·유튜브 신조어로 소개한다. SBS 등 보도에 따르면 2020년 유명 인플루언서가 내돈내산을 내세우고도 광고·협찬을 명확히 표시하지 않은 ‘뒷광고’ 논란이 일며 공정위 표시 지침 강화 논의와 맞물렸다. 최초 사용자를 한 사람으로 단정한 기록은 언론에서 교차 확인되지 않는다.',
  usage_note = '직접 사서 쓴 후기를 올릴 때, 또는 광고와 실제 구매 후기를 구분해 말할 때 쓴다. 대가를 받았다면 이 말을 붙이지 않는 것이 맞다.',
  caution = '실제로 광고를 받았다면 이 말을 쓰면 안 된다. 광고 표시를 숨기면 법에 걸릴 수 있다.',
  usage_examples = '[{"situation":"구매 후기를 올릴 때","text":"이 이어폰은 내돈내산이야. 협찬 아니니까 단점도 같이 적을게."},{"situation":"광고처럼 보이는 리뷰를 볼 때","text":"내돈내산 태그만 믿지 말고 광고 표시부터 확인하자."}]'::jsonb,
  updated_at = now()
where short_id = 'qqzf3wyy'
  and slug = '내돈내산'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://news.sbs.co.kr/news/endPage.do?news_id=N1005920467', '[Pick Q&A] ''내돈내산''에 속았다…이거 ''사기'' 아닌가요?', 'SBS',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'qqzf3wyy' and meme.slug = '내돈내산'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://news.sbs.co.kr/news/endPage.do?news_id=N1005920467'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.bbc.com/korean/features-53720146', '인플루언서 ‘뒷광고'' 처벌받을 수 있나?', 'BBC News 코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'qqzf3wyy' and meme.slug = '내돈내산'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.bbc.com/korean/features-53720146'
  );

-- 애교 (ruayk4d9 / 애교)
update public.memes set
  description = '애교는 귀엽고 다정하게 보여 상대의 호감을 얻으려는 말투·표정·몸짓을 가리킨다. 연인 사이, 가족과 친구 사이, 아이돌 팬 소통에서 자주 나타나며, 한국어를 배우는 외국인에게는 aegyo라는 이름으로 소개된다. 목소리를 살짝 높이거나 끝을 늘이는 말투, 하트 모양 손동작이 전형적인 예다. 친근함을 표현하는 놀이일 수도 있지만, 상대가 원하지 않으면 부담이나 강요가 될 수 있다.',
  origin = '한국어의 오랜 단어로, 귀엽고 사랑스럽게 구는 태도를 뜻해 왔다. 2000년대 이후 아이돌 문화와 예능을 통해 해외에도 aegyo로 알려졌고, 영어 위키백과와 코리아헤럴드 등이 이 관습을 한국 대중문화의 특징으로 소개한다. 최근 연구에서는 성인이 애교를 쓸 때 아이처럼 짧은 성대 길이의 목소리를 흉내 내는 경향이 관찰되기도 했다.',
  usage_note = '가까운 사이에서 장난스럽게 귀여운 말투나 제스처를 요청하거나 묘사할 때 쓴다. 처음 보는 사람이나 공식 자리에서는 오해를 부를 수 있다.',
  caution = '누군가에게 "애교 좀 해 봐"라고 시키는 건 실례가 될 수 있다. 특히 성별에 따라 강요하지 말자.',
  usage_examples = '[{"situation":"가까운 친구에게 부탁할 때","text":"에이, 애교 한 번만 더 부리면 사 줄게."},{"situation":"아이돌 영상을 보며","text":"이번 예능에서 애교 장면이 과하지 않고 재미있었어."}]'::jsonb,
  updated_at = now()
where short_id = 'ruayk4d9'
  and slug = '애교'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.koreaherald.com/article/3299428', '‘Aegyo’: The psyche behind childlike adults', 'The Korea Herald',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'ruayk4d9' and meme.slug = '애교'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.koreaherald.com/article/3299428'
  );

-- 눈치 (stm8qern / 눈치)
update public.memes set
  description = '눈치는 다른 사람의 기분이나 그 자리의 분위기를 말로 듣지 않고도 빠르게 알아채는 능력이다. 한국 사람 사이의 관계에서 중요하게 여겨지며, “눈치가 빠르다”, “눈치 좀 챙겨”처럼 쓴다. 영어에는 딱 맞는 한 단어가 없어 해외에서는 nunchi라는 이름으로 소개된다. 배려의 감각일 수도 있지만, “눈치 없다”는 말은 상대를 나무라는 핀잔이 되기 쉽다.',
  origin = '눈치는 한국어의 오래된 말로, 17세기 문헌에도 비슷한 용법이 보인다고 정리된다. 2010년대 이후 해외 언론과 교양서가 한국 사회를 이해하는 개념으로 nunchi를 소개했고, 코리아헤럴드와 영어 위키백과가 이 용법을 다루고 있다. 단순히 ‘감이 좋다’기보다, 상대의 말·표정·침묵을 관찰해 자리를 읽는 사회적 기술로 설명되는 경우가 많다.',
  usage_note = '분위기를 잘 읽는 사람을 칭찬하거나, 눈치 없이 군 일을 가볍게 지적할 때 쓴다. 꾸짖는 말로 쓰면 관계가 상할 수 있다.',
  caution = '"눈치 없다"는 말은 상대를 깎아내리는 말이 될 수 있다. 처음 보는 자리에서는 농담으로도 삼가는 편이 안전하다.',
  usage_examples = '[{"situation":"친구가 분위기를 잘 맞췄을 때","text":"역시 눈치 빠르다. 지금 자리 물러나 주길 잘했어."},{"situation":"둘만 있고 싶은 친구들을 보고","text":"눈치 챙긴다, 나는 먼저 갈게."}]'::jsonb,
  updated_at = now()
where short_id = 'stm8qern'
  and slug = '눈치'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.koreaherald.com/article/3844092', '‘Nunchi’', 'The Korea Herald',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'stm8qern' and meme.slug = '눈치'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.koreaherald.com/article/3844092'
  );

-- 파이팅 (x85wgk74 / 파이팅)
update public.memes set
  description = '파이팅은 영어 fighting에서 왔지만, 한국에서는 “힘내”, “잘해 보자”라는 뜻으로 쓰는 응원 구호다. 영어권의 ‘싸움’이라는 뜻과는 쓰임이 달라, 한국어를 모르는 사람은 이 의미를 바로 알아듣지 못하기도 한다. 운동 경기, 시험, 발표를 앞두고 주먹을 쥐고 외치는 장면이 방송과 K-팝 영상에도 자주 나온다. 표기는 ‘파이팅’과 ‘화이팅’이 함께 쓰인다.',
  origin = '한겨레 등 보도는 이 구호가 영어 fighting을 일본에서 ‘파이트/화이또’로 받아 쓰던 용법에서 비롯됐다고 본다. 한국에서 응원 구호로 확인되는 이른 용례로는 1964년 도쿄 올림픽 무렵의 ‘파이팅 코리아’가 자주 인용된다. 이후 학교 운동회와 스포츠 중계, 대중음악을 거치며 일상적인 격려 표현으로 정착했다. 일제 잔재 논란이 주기적으로 나오지만, 오늘날 용법은 응원·격려에 가깝다.',
  usage_note = '시험, 경기, 발표를 앞둔 사람을 응원할 때 쓴다. 외국인 친구에게는 “힘내”라는 뜻이라고 함께 알려 주는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"시험 보러 가는 친구에게","text":"오늘 시험 파이팅! 끝나고 맛있는 거 먹자."},{"situation":"팀 회의를 마치며","text":"이번 프로젝트 다 같이 파이팅하자."}]'::jsonb,
  updated_at = now()
where short_id = 'x85wgk74'
  and slug = '파이팅'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hani.co.kr/arti/sports/sports_general/858587.html', '일본도 안 쓰는 일본식 구호 ‘파이팅’', '한겨레',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'x85wgk74' and meme.slug = '파이팅'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hani.co.kr/arti/sports/sports_general/858587.html'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wiktionary.org/wiki/%ED%99%94%EC%9D%B4%ED%8C%85', '화이팅', '한국어 위키낱말사전',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'x85wgk74' and meme.slug = '파이팅'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wiktionary.org/wiki/%ED%99%94%EC%9D%B4%ED%8C%85'
  );

-- 직관 (87pakbhn / 직관)
update public.memes set
  description = '직관은 ‘직접 관람’의 줄임말로, 야구나 축구 경기, 콘서트를 경기장이나 공연장에 가서 직접 보는 일을 말한다. 반대로 집에서 중계로 보는 것은 ‘집관’이라고 부른다. 한국 프로야구 응원 문화가 알려지면서 현장 응원가를 함께 부르는 재미를 찾으러 가는 사람도 많아졌다. 표를 구하기 어려운 인기 경기는 “직관 티켓 전쟁”이라는 말과 함께 쓰이기도 한다.',
  origin = '스포츠·공연 팬들 사이에서 ‘직접 관람’을 줄여 쓰기 시작한 말로, 정확한 첫 사용 시점이나 창안자는 확인되지 않는다. 비즈한국 등 야구 속어 안내는 중계가 아닌 경기장에 가서 보는 행위를 직관이라고 풀이한다. 2000년대 이후 프로야구 관중 문화와 SNS 직관 후기가 늘며 일상어로 굳어졌고, ‘집관’이라는 짝말도 함께 퍼졌다.',
  usage_note = '경기나 공연을 보러 간다고 말할 때 쓴다. 야구, 축구, 콘서트 약속에 특히 잘 어울린다.',
  caution = caution,
  usage_examples = '[{"situation":"주말 계획을 정할 때","text":"토요일에 야구 직관 갈래? 응원가 같이 부르면 재미있을 거야."},{"situation":"표를 못 구했을 때","text":"이번엔 직관은 글렀으니 집관으로 만족해야겠다."}]'::jsonb,
  updated_at = now()
where short_id = '87pakbhn'
  and slug = '직관'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.bizhankook.com/bk/article/13120', '''야알못'' 직장인을 위한 야구속어사전', '비즈한국',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '87pakbhn' and meme.slug = '직관'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.bizhankook.com/bk/article/13120'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://julimmal.com/en/word/jikgwan', 'jikgwan (직관): Watching live in person', 'Julimmal',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '87pakbhn' and meme.slug = '직관'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://julimmal.com/en/word/jikgwan'
  );

-- 치맥 (42d6qeqm / 치맥)
update public.memes set
  description = '치맥은 프라이드치킨과 맥주의 앞 글자를 딴 말이다. 둘 다 원래 한국에서 비롯된 음식은 아니지만, 함께 즐기는 조합은 한국을 대표하는 일상 문화로 여겨진다. 2002년 월드컵 응원과 함께 더 널리 퍼졌고, 2013~2014년 드라마 ‘별에서 온 그대’의 치맥 장면이 중국 등에서 큰 화제가 되며 해외에도 알려졌다. 지금은 영어 위키백과에도 Chimaek 항목이 있다.',
  origin = '1990년대 호프집 안주 문화 속에서 치킨과 맥주 조합이 자리 잡았고, 2000년대 들어 치맥이라는 줄임말이 퍼졌다. 2014년 동아일보·SBS 등은 드라마 ‘별에서 온 그대’ 인기에 힘입어 중국에서 한국식 치킨을 사려는 줄이 늘었다고 보도했다. 정확한 조어 시점이나 첫 사용자은 단정하기 어렵지만, 월드컵 응원과 한류 드라마를 거치며 국내외로 확산된 경위는 여러 언론이 공통으로 적고 있다.',
  usage_note = '친구와 저녁 약속을 잡거나 스포츠 중계를 함께 볼 때 쓴다. 술이 들어가므로 상대가 마실 수 있는지부터 확인하는 것이 좋다.',
  caution = '술이 들어가는 문화라 미성년자나 술을 못 마시는 사람에게 강요하지 말자.',
  usage_examples = '[{"situation":"축구 경기가 있는 날","text":"오늘 경기 보면서 치맥 어때?"},{"situation":"퇴근길","text":"이번 주 고생했으니 치맥 한잔하자."}]'::jsonb,
  updated_at = now()
where short_id = '42d6qeqm'
  and slug = '치맥'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.donga.com/news/Entertainment/article/all/20140304/61423642/1', '중국 치맥 열풍, 치킨 먹으려면 3시간 줄...‘별그대 영향’', '동아일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '42d6qeqm' and meme.slug = '치맥'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.donga.com/news/Entertainment/article/all/20140304/61423642/1'
  );

-- 대박 (4f25qzwc / 대박)
update public.memes set
  description = '대박은 무언가 크게 성공했거나 깜짝 놀랄 만큼 좋을 때 쓰는 말이다. “대박 났다”, “대박 사건”처럼 쓰고, 그보다 규모가 작으면 ‘중박’, 크게 실패하면 ‘쪽박’이라고 대응시킨다. 영화나 사업이 크게 흥행했을 때 쓰이던 말이 일상 감탄사로 넓어졌다. K-드라마와 예능을 통해 외국 팬들도 daebak이라는 발음으로 많이 알게 됐다.',
  origin = '어원에 대해서는 도박판에서 판돈보다 큰돈을 땄을 때 쓰던 말이라는 설명이 가장 흔하다. 서울신문 칼럼과 코리아헤럴드 등은 이 말이 영화계와 언론을 거쳐 1990년대 이후 일상어로 퍼졌다고 소개한다. 흥부전의 ‘박’이나 큰 배(대박)와 연결하는 민간 어원도 있으나, 문헌으로 단정된 단일 기원은 없다. 이후 예능 감탄사와 해외 팬덤 용어로까지 쓰임이 넓어졌다.',
  usage_note = '좋은 소식이나 놀라운 일에 감탄할 때 쓴다. 공식 문서보다 대화와 SNS에서 편하게 쓰는 말이다.',
  caution = caution,
  usage_examples = '[{"situation":"친구가 합격 소식을 전할 때","text":"대박! 진짜 축하해. 그동안 고생한 보람이 있네."},{"situation":"맛집에서","text":"여기 떡볶이 대박이다. 다음에도 여기로 오자."}]'::jsonb,
  updated_at = now()
where short_id = '4f25qzwc'
  and slug = '대박'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.seoul.co.kr/news/editOpinion/column/find_wordlight/2020/01/02/20200102029009', '[말빛 발견] 대박', '서울신문',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '4f25qzwc' and meme.slug = '대박'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.seoul.co.kr/news/editOpinion/column/find_wordlight/2020/01/02/20200102029009'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.koreaherald.com/article/3457306', 'Daebak!', 'The Korea Herald',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '4f25qzwc' and meme.slug = '대박'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.koreaherald.com/article/3457306'
  );

-- 막내 (u6mxpr58 / 막내)
update public.memes set
  description = '막내는 가족에서 가장 어린 자식, 또는 어떤 무리에서 나이가 가장 어린 사람을 가리키는 말이다. K-팝 그룹에서도 가장 어린 멤버를 막내라고 불러, 외국 팬들에게는 maknae로 알려졌다. 노래와 춤을 두루 잘하는 막내는 ‘황금막내’라고 부르기도 한다. 한편 직장에서는 막내라는 이유만으로 잡무를 맡기는 관습이 있다는 지적이 반복된다.',
  origin = '가족 관계를 나타내는 오래된 한국어로, 정확한 조어 시점을 한해로 특정하지는 않는다. 2010년대 K-팝 팬 문화를 통해 maknae라는 표기가 해외에 퍼졌다. 한겨레 말글살이 등 한국어 칼럼과 노동·인권 단체 글은, 직장에서 ‘막내라서’ 회식 준비나 잡무를 떠안는 문화를 따로 문제 삼아 왔다. 가족 호칭과 조직 내 역할이 겹쳐 쓰이는 말이라는 점이 오늘날 논의의 핵심이다.',
  usage_note = '그룹이나 가족에서 가장 어린 사람을 부를 때 쓴다. 직장에서 잡무를 떠넘기는 핑계로 쓰는 것은 피해야 한다.',
  caution = caution,
  usage_examples = '[{"situation":"아이돌 이야기를 할 때","text":"그 그룹 막내가 춤을 제일 잘 춰."},{"situation":"새 후배가 들어온 날","text":"우리 팀 막내가 들어왔으니, 잡무를 나이로 정하지는 말자."}]'::jsonb,
  updated_at = now()
where short_id = 'u6mxpr58'
  and slug = '막내'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hani.co.kr/arti/opinion/column/1222084.html', '[말글살이] 막내', '한겨레',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'u6mxpr58' and meme.slug = '막내'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hani.co.kr/arti/opinion/column/1222084.html'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://rights.or.kr/1447', '막내니까 이 정도는 해야지! 막내여서 이런 걸 해야해?', '인권교육센터 들',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'u6mxpr58' and meme.slug = '막내'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://rights.or.kr/1447'
  );

-- 멍때리기 (63485cxm / 멍때리기)
update public.memes set
  description = '멍때리기는 아무 생각 없이 한곳을 바라보며 넋을 놓는 일을 말한다. 영어의 space out에 가까운 상태다. 2014년 서울에서 ‘멍때리기 대회’가 열리며 널리 알려졌고, 이후 캠핑장에서 불을 보는 ‘불멍’, 물을 보는 ‘물멍’ 같은 파생어도 퍼졌다. 한때 부정적으로만 보이던 표현이, 잠깐의 휴식으로 다시 읽히기도 한다.',
  origin = '표준국어대사전에는 아직 올라 있지 않은 신조어로, ‘멍하다’와 ‘때리다’가 결합한 형태로 설명된다. 동아일보에 따르면 2014년 프로젝트 듀오 전기호가 서울광장에서 멍때리기 대회를 열어 화제가 됐다. 연합뉴스와 매일경제 등은 이후 불멍·물멍처럼 대상 뒤에 ‘멍’을 붙이는 용법이 이어졌다고 적는다. 정확한 첫 사용 연도는 단정하기 어렵고, 대회를 계기로 대중화된 것은 여러 보도가 일치한다.',
  usage_note = '잠깐 쉬고 싶을 때, 또는 캠핑이나 바다에서 편히 쉬는 모습을 말할 때 쓴다. 수업이나 회의 중 집중하지 못한 일을 사과할 때도 쓴다.',
  caution = caution,
  usage_examples = '[{"situation":"캠핑장에서","text":"오늘 밤은 불멍하면서 쉬자."},{"situation":"회의 중에 한눈을 팔았을 때","text":"미안, 잠깐 멍때렸어. 지금 다시 설명해줄래?"}]'::jsonb,
  updated_at = now()
where short_id = '63485cxm'
  and slug = '멍때리기'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.donga.com/news/Culture/article/all/20141025/67428036/1', '[토요일에 만난 사람]‘멍때리기 대회’ 여는 프로젝트 듀오', '동아일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '63485cxm' and meme.slug = '멍때리기'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.donga.com/news/Culture/article/all/20141025/67428036/1'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20230522114900022', '[논&설] ''∼멍·∼멍·∼멍''…멍때리기 신드롬', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '63485cxm' and meme.slug = '멍때리기'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20230522114900022'
  );

-- 엄근진 (9r3fjkwr / 엄근진)
update public.memes set
  description = '엄근진은 ‘엄격, 근엄, 진지’의 앞 글자를 딴 말이다. 별것 아닌 일에 지나치게 딱딱하고 진지하게 구는 모습을 장난스럽게 말할 때 쓴다. 처음에는 과하게 따지는 사람을 놀리는 용도가 강했지만, 지금은 “엄근진 모드”처럼 스스로 자세를 다잡을 때도 쓴다. 2018년 영화 ‘신과함께’ 홍보 자리에서는 이정재가 이 말을 처음 듣고 엉뚱한 풀이를 해 화제가 되기도 했다.',
  origin = '인터넷 커뮤니티에서 2014년 무렵 ‘엄격 진지’라는 표현이 쓰이다, 2015년 디시인사이드에 연재된 만화 ‘교도소 일기’의 기동순찰팀 장면과 함께 ‘근엄’이 붙어 널리 퍼진 것으로 정리된다. 원 게시물의 정확한 날짜와 작성자는 2차 자료만으로는 확정하지 않는다. 2018년 인사이트 등 연예 보도는 배우 이정재가 V라이브에서 엄근진을 ‘엄마, 근처에 오시면…’으로 오해해 웃음을 샀다고 전했다. 이후 조롱과 유머러스한 묘사가 함께 남아 있다.',
  usage_note = '농담 분위기에서 진지해진 사람을 가볍게 놀리거나, 나 스스로 자세를 다잡을 때 쓴다. 상대의 진짜 고민을 가볍게 여기는 말로 들리면 안 된다.',
  caution = '상대의 진지한 고민에 쓰면 무시하는 말로 들릴 수 있다.',
  usage_examples = '[{"situation":"친구가 게임 규칙을 너무 따질 때","text":"왜 이렇게 엄근진이야. 그냥 재미로 하는 게임인데."},{"situation":"시험 공부를 시작할 때","text":"지금부터 엄근진 모드 들어간다. 한 시간만 핸드폰 멀리 둘게."}]'::jsonb,
  updated_at = now()
where short_id = '9r3fjkwr'
  and slug = '엄근진'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.insight.co.kr/news/168411', '“엄마, 근처에 오시면···” ‘엄근진’ 뜻을 새롭게 해석한 ‘염라’ 이정재', '인사이트',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '9r3fjkwr' and meme.slug = '엄근진'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.insight.co.kr/news/168411'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mediatoday.co.kr/news/articleView.html?idxno=145463', '엄격·근엄·진지하지 말라? 꿀잼하라고?', '미디어오늘',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '9r3fjkwr' and meme.slug = '엄근진'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mediatoday.co.kr/news/articleView.html?idxno=145463'
  );

-- 댕댕이 (5jysgx3d / 댕댕이)
update public.memes set
  description = '댕댕이는 강아지를 뜻하는 ‘멍멍이’의 글자 모양을 바꿔 쓴 말이다. ‘멍’과 비슷한 모양의 ‘댕’으로 바꿔 부르는 이 표기는 야민정음이라고 하는 글자 비틀기 놀이에서 나왔다. 처음에는 인터넷 게시판에서 시작됐지만 발음이 쉽고 귀여워 예능, 광고, 애견 카페 이름으로까지 퍼졌다. 지금은 반려견을 친근하게 부르는 말 가운데 하나로 자리 잡았다.',
  origin = '야민정음은 2010년대 디시인사이드 국내야구 갤러리에서 글자 모양을 비슷하게 바꿔 쓰던 놀이로, 한겨레·YTN 등은 ‘멍멍이’가 ‘댕댕이’로 바뀐 대표 사례로 이 말을 든다. 이후 SNS와 방송을 타고 일반 명사처럼 쓰이기 시작했다. 국립국어원이 관련 행사를 열며 언어 파괴 논란이 일기도 했으나, 일상에서는 귀여운 호칭으로 정착한 편이다.',
  usage_note = '반려견이나 길에서 본 강아지를 귀엽게 부를 때 쓴다. 공식 문서보다는 대화와 SNS에 더 잘 어울린다.',
  caution = caution,
  usage_examples = '[{"situation":"산책하는 강아지를 보고","text":"저 댕댕이 너무 귀엽다. 꼬리를 엄청 흔드네."},{"situation":"반려견을 자랑할 때","text":"우리 집 댕댕이 오늘 미용하고 왔어."}]'::jsonb,
  updated_at = now()
where short_id = '5jysgx3d'
  and slug = '댕댕이'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hani.co.kr/arti/society/society_general/813654.html', '롬곡롬곡·댕댕이·띵곡…‘야민정음’ 아세요', '한겨레',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '5jysgx3d' and meme.slug = '댕댕이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hani.co.kr/arti/society/society_general/813654.html'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.ytn.co.kr/_ln/0106_201710091317539361', '[문화]멍멍이가 댕댕이?...야민정음 "한글 파괴" vs "언어 유희"', 'YTN',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '5jysgx3d' and meme.slug = '댕댕이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.ytn.co.kr/_ln/0106_201710091317539361'
  );

-- 럭키비키 (cdkdz2tv / 럭키비키)
update public.memes set
  description = '럭키비키는 아이브 장원영의 영어 이름 비키(Vicky)와 행운을 뜻하는 럭키를 합친 말이다. 뜻대로 하면 ‘운 좋은 비키’에 가깝다. 일이 뜻대로 되지 않아도 남은 조건을 긍정적으로 다시 읽는 태도를 가리키며, 같은 맥락에서 ‘원영적 사고’라는 말도 함께 퍼졌다. 2024년 여러 매체에서 그해 유행어로 꼽혔다.',
  origin = '장원영이 스페인 여행 중 사려던 빵이 다 팔렸지만, 기다리니 갓 나온 빵을 받게 됐다며 그 상황을 행운으로 해석한 SNS 후기가 출발점으로 알려져 있다. 매일경제·뉴시스·YTN 등은 이 일화와 ‘럭키비키’·‘원영적 사고’가 2024년 크게 퍼졌다고 보도했다. 이후 작은 불운을 애써 밝게 재해석하는 말투로 일상과 광고에도 자주 등장했다.',
  usage_note = '작은 불운을 긍정적으로 다시 말할 때 쓴다. 상대가 크게 힘든 일을 겪고 있을 때 쓰면 고민을 가볍게 여기는 말로 들릴 수 있다.',
  caution = '상대가 크게 힘든 일을 겪고 있을 때 쓰면 고민을 가볍게 여기는 말로 들릴 수 있다.',
  usage_examples = '[{"situation":"버스를 놓쳤을 때","text":"덕분에 산책했네, 완전 럭키비키잖아."},{"situation":"비 때문에 약속이 취소됐을 때","text":"집에서 쉴 수 있으니 오히려 럭키비키야."}]'::jsonb,
  updated_at = now()
where short_id = 'cdkdz2tv'
  and slug = '럭키비키'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.mk.co.kr/news/culture/11144024', '20대 ''럭키비키'' 외치는 이유', '매일경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'cdkdz2tv' and meme.slug = '럭키비키'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.mk.co.kr/news/culture/11144024'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.ytn.co.kr/_ln/0106_202412220209210241', '올해의 유행어 ''럭키비키''...''저성장 시대'' 삶의 지혜?', 'YTN',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'cdkdz2tv' and meme.slug = '럭키비키'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.ytn.co.kr/_ln/0106_202412220209210241'
  );

-- 스불재 (gf66ref6 / 스불재)
update public.memes set
  description = '스불재는 ‘스스로 불러온 재앙’의 줄임말이다. 내가 한 선택 때문에 내가 고생하게 된 상황을 웃프게 말할 때 쓴다. 과제를 미루다 밤을 새우거나, 약속을 너무 많이 잡아 주말이 사라지는 경우가 대표적이다. 남 탓을 하지 않고 스스로를 놀리는 말이라 분위기를 가볍게 만드는 데 쓰인다.',
  origin = '록 밴드 넥스트(N.EX.T)의 1997년 노래 ‘Lazenca, Save Us’ 가사 가운데 “스스로 불러온 재앙에 짓눌려”라는 구절에서 왔다. 노래방 화면이나 가사 캡처가 커뮤니티에 퍼지며 줄임말 ‘스불재’로 정착했고, 2010년대 후반 이후 일상 자조 표현으로 널리 쓰였다. 원곡과 밴드는 한국어 위키백과 N.EX.T 항목에서도 확인할 수 있다.',
  usage_note = '자기가 벌인 일 때문에 고생할 때 셀프 디스로 쓴다. 남의 진짜 불행에 붙이면 비꼬는 말로 들릴 수 있다.',
  caution = '남의 진짜 불행에 쓰면 비꼬는 말로 들릴 수 있다. 상대가 웃을 수 있는 일에만 쓰자.',
  usage_examples = '[{"situation":"과제를 미루다 밤샐 때","text":"이건 완벽한 스불재다. 어제 조금만 손댔어도 이렇게까지는 안 됐는데."},{"situation":"약속을 세 개 잡은 주말","text":"토요일 약속 세 개, 스불재 확정이야."}]'::jsonb,
  updated_at = now()
where short_id = 'gf66ref6'
  and slug = '스불재'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/N.EX.T', 'N.EX.T', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'gf66ref6' and meme.slug = '스불재'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/N.EX.T'
  );

-- 내 마음속에 저장 (t4n9can6 / 내-마음속에-저장)
update public.memes set
  description = '2017년 Mnet 오디션 예능 ‘프로듀스 101 시즌2’에서 박지훈이 카메라를 보며 윙크하고 한 말로 유명해졌다. 이 장면이 크게 화제가 되면서 그는 ‘윙크 남신’이라는 별명을 얻었다. 그 뒤 사람들은 마음에 드는 사진이나 순간을 보고 “내 마음속에 저장”이라고 쓰기 시작했다. 지금은 조금 옛 유행어처럼 들리기도 하지만, 귀엽게 좋아하는 마음을 표현할 때 여전히 쓰인다.',
  origin = '2017년 방송된 프로듀스 101 시즌2에서 박지훈이 윙크하며 “내 마음속에 저장”이라고 말한 장면이 출발점이다. 해당 방송과 출연진 정보는 한국어 위키백과 항목으로도 확인할 수 있고, 클립은 유튜브 등에서 반복 공유되며 유행어가 됐다. 이후 팬 커뮤니티와 SNS에서 귀여운 이미지나 순간을 저장한다는 뜻의 짧은 말로 자리 잡았다.',
  usage_note = '좋아하는 사진이나 순간을 보고 장난스럽게 쓴다. 윙크 이모티콘과 함께 쓰면 잘 어울린다.',
  caution = caution,
  usage_examples = '[{"situation":"귀여운 강아지 사진을 보고","text":"이건 내 마음속에 저장."},{"situation":"친구가 잘 나온 사진을 보냈을 때","text":"이 사진 내 마음속에 저장했어."}]'::jsonb,
  updated_at = now()
where short_id = 't4n9can6'
  and slug = '내-마음속에-저장'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 중요한 건 꺾이지 않는 마음 (9uyxmw4g / 중요한-건-꺾이지-않는-마음)
update public.memes set
  description = '‘중요한 건 꺾이지 않는 마음’은 줄여서 중꺾마라고도 부른다. 포기하지 않겠다는 다짐을 짧게 담은 응원 문구로, 2022년 하반기 한국에서 크게 유행했다. e스포츠 선수 인터뷰에서 먼저 주목받은 뒤, 같은 해 카타르 월드컵에서 대한민국이 16강에 오르며 대표팀의 근성을 상징하는 말로 퍼졌다. 이후 시험, 취업, 경기처럼 힘든 상황을 버티는 다짐으로도 쓰인다.',
  origin = '2022년 리그 오브 레전드 월드 챔피언십에서 DRX의 데프트(김혁규)가 남긴 인터뷰 발언이 널리 인용되며 시작점으로 정리된다. 연합뉴스·SBS·한국일보 등은 이 문구가 그해 e스포츠와 카타르 월드컵 16강 진출을 거치며 ‘올해의 명언’처럼 회자됐다고 보도했다. 조어 자체는 그 이전 팬덤에서도 쓰였다는 설명도 있으나, 전국적 유행의 계기는 2022년 하반기 스포츠 이슈다.',
  usage_note = '힘든 상황에서 포기하지 않겠다는 다짐이나 응원의 말로 쓴다. 상대의 노력을 가볍게 치켜세울 때보다, 실제로 버티고 있는 맥락에 붙이는 편이 자연스럽다.',
  caution = caution,
  usage_examples = '[{"situation":"시험 기간 단톡방에서","text":"오늘도 도서관이다. 중요한 건 꺾이지 않는 마음."},{"situation":"경기를 앞둔 친구에게","text":"중꺾마로 가자. 끝까지 하면 기회는 와."}]'::jsonb,
  updated_at = now()
where short_id = '9uyxmw4g'
  and slug = '중요한-건-꺾이지-않는-마음'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20221206081700004', '[월드컵] 태극전사가 소환한 ''중꺾마''…"올해 최고의 명언"', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '9uyxmw4g' and meme.slug = '중요한-건-꺾이지-않는-마음'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20221206081700004'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://news.sbs.co.kr/news/endPage.do?news_id=N1006997373', '''중요한 것은 꺾이지 않는 마음''…"올해 최고의 명언"', 'SBS',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '9uyxmw4g' and meme.slug = '중요한-건-꺾이지-않는-마음'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://news.sbs.co.kr/news/endPage.do?news_id=N1006997373'
  );

-- 꼰대 (kh75j5f8 / 꼰대)
update public.memes set
  description = '꼰대는 나이나 지위를 앞세워 아랫사람 말을 듣지 않고 자기 경험만을 강요하는 사람을 낮춰 부르는 말이다. 원래는 늙은 남자를 헐뜯는 은어에 가까웠으나, 2010년대 이후에는 나이와 상관없이 권위적인 태도를 가리키는 말로 넓어졌다. 직장, 학교, 가족 대화에서 “꼰대같다”고 하면 대개 훈계와 간섭을 문제 삼는 것이다. 영어권에서는 kkondae라는 표기로도 소개된다.',
  origin = '한국어 은어로 오랜 기간 쓰여 왔으나, 정확한 첫 용례 연도는 단정하기 어렵다. 영어 위키백과 Kkondae 항목과 코리아헤럴드 등은 이 말을 한국의 권위적·훈계적 태도를 가리키는 사회 문화 개념으로 소개한다. 2010년대 청년 담론과 직장 문화 비판 속에서 재조명되며, 단순히 ‘나이 많은 사람’이 아니라 ‘태도의 문제’로 읽히게 됐다.',
  usage_note = '권위적으로 훈계하는 태도를 비판할 때 쓴다. 나이나 세대 전체를 싸잡아 부르는 말로 쓰면 오해가 커질 수 있다.',
  caution = '사람을 낮춰 부르는 말이라, 당사자 앞이나 직장에서 쓰면 다툼이 생길 수 있다.',
  usage_examples = '[{"situation":"회의에서 의견이 막혔을 때","text":"나이를 이유로 말을 끊으면 꼰대처럼 들려."},{"situation":"친구의 잔소리를 농담으로 받을 때","text":"너 오늘따라 꼰대 같다. 한 번만 내 얘기도 들어 줘."}]'::jsonb,
  updated_at = now()
where short_id = 'kh75j5f8'
  and slug = '꼰대'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.koreaherald.com/article/10844914', '꼰대', 'The Korea Herald',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'kh75j5f8' and meme.slug = '꼰대'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.koreaherald.com/article/10844914'
  );

-- 도마도마 챌린지 (2au7br9f / 도마도마-챌린지)
update public.memes set
  description = '2025년 발표된 브라질 펑크 MENTE MÁ의 후렴구 “바이 도마도마도마”에서 이름을 딴 댄스 챌린지다. 2025년 7월 그룹 라이즈의 원빈이 선보인 안무 영상이 중국 도우인에서 크게 히트한 뒤 한국으로 역수입됐다. 이후 백현, 스테이씨, TXT 등 다수의 아이돌이 참여하며 그해 가을 숏폼 콘텐츠를 장악했다. 원곡 가사는 다소 거친 내용이지만 한국에서는 중독적인 비트와 도마도마 발음의 재미로 소비된다.',
  origin = '2025년 발표된 브라질 펑크 MENTE MÁ에 맞춰 라이즈 원빈이 2025년 7월 선보인 안무 영상이 중국 도우인에서 히트한 뒤 한국으로 역수입되며 확산됐다. 공식 챌린지 영상은 유튜브에도 올라 있으며, 국내 소개 기사와 함께 그해 숏폼 유행의 한 축이 됐다.',
  usage_note = '숏폼에서 시크한 표정과 슬로우모션 안무를 따라 찍을 때 쓴다. 원곡 가사는 거칠 수 있어, 가사 없이 안무만 올리는 경우가 많다.',
  caution = caution,
  usage_examples = '[{"situation":"친구가 괜히 있어 보이는 포즈를 잡을 때","text":"야 그거 완전 도마도마 각인데?"},{"situation":"숏폼 안무 챌린지 얘기할 때","text":"이번 주말에 도마도마 챌린지 같이 찍자, 나 안무 다 외웠어."}]'::jsonb,
  updated_at = now()
where short_id = '2au7br9f'
  and slug = '도마도마-챌린지'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 국민학교→초등학교 개칭 (7kqc35wv / 국민학교→초등학교-개칭)
update public.memes set
  description = '일제강점기인 1941년 총독부 칙령으로 붙은 ''국민학교''라는 명칭이 광복 50주년이던 1995년 교육부 발표와 법 개정을 거쳐 1996년 3월 1일부로 ''초등학교''로 공식 변경됐다. 일제 잔재 청산의 상징적 조치로, 이 시기 학생이었던 세대는 ''국딩''이라는 표현으로 스스로를 구분하기도 한다.',
  origin = '1995년 8월 11일 교육부 장관이 명칭 변경을 공식 발표했고, 광복 50주년을 맞아 ''일제 잔재를 청산하고 민족정기를 바로 세운다''는 취지가 배경으로 제시됐다. 국민학교라는 명칭은 1941년 일제 칙령에 의해 ''황국신민학교''의 줄임말로 만들어져 군국주의적 색채가 짙다는 지적을 받아왔다. 준비 기간을 거쳐 1996년 3월 1일부터 전국 초등학교가 일제히 새 명칭을 사용하기 시작했다. 광복 이후로도 50년 넘게 남아 있던 식민지 잔재가 뒤늦게 정리된 대표 사례로 꼽히며, 이 시기 학교를 다닌 세대는 스스로를 ''국민학교 마지막 세대''로 부르곤 한다.',
  usage_note = '일제 잔재 청산이나 세대 구분을 이야기할 때 역사적 사례로 언급한다. 지금 초등학교에 다니는 아이 앞에서 장난처럼 ‘국민학교’라고 부를 필요는 없다.',
  caution = caution,
  usage_examples = '[{"situation":"학창 시절을 회상할 때","text":"나는 국민학교 마지막 세대라, 졸업장에 초등학교라고 적혀 있던 기억이 어색했어."},{"situation":"지명이 바뀐 이야기를 할 때","text":"1996년에 국민학교가 초등학교로 바뀐 것도 일제 잔재를 정리한 일이었지."}]'::jsonb,
  updated_at = now()
where short_id = '7kqc35wv'
  and slug = '국민학교→초등학교-개칭'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 포켓몬빵 띠부씰 (s2v2pzh9 / 포켓몬빵-띠부씰)
update public.memes set
  description = '1999년 출시된 포켓몬빵은 애니메이션 ''포켓몬스터'' 인기에 힘입어 봉지 속 ''띠부띠부씰'' 스티커를 모으는 것이 어린이들 사이에서 큰 유행이 됐다. 1999년 11월에는 일평균 150만 봉 판매 기록을 세웠고, 스티커만 챙기고 빵을 버리는 문제로 뉴스에 오르기도 했다.',
  origin = '일본 애니메이션 ''포켓몬스터'' 인기에 힘입어 1999년 세기말 국내에서 포켓몬빵이 출시됐고, 당시 제조를 맡았던 샤니가 봉지 안에 캐릭터 스티커 ''띠부띠부씰''을 동봉하며 수집 열풍이 촉발됐다. 학생들이 스티커만 확인하고 빵은 버리는 사례가 속출해 자원 낭비 논란이 일었고, 이 현상이 저녁 9시 뉴스에 보도될 정도로 사회적 이슈가 됐다. 2011년부터 SPC삼립이 생산을 이어받았으며, 2022년 재출시 당시에도 다시금 ''없어서 못 파는'' 품귀 현상을 일으키며 세대를 넘나드는 수집 밈으로 재조명됐다.',
  usage_note = '수집욕을 자극하는 마케팅 사례로도, 어린 시절 추억으로도 언급할 수 있다',
  caution = caution,
  usage_examples = '[{"situation":"편의점에서 품절 안내를 보고","text":"포켓몬빵 띠부씰 때문에 또 줄이 생겼네. 스티커만 찾는 사람이 여전하구나."},{"situation":"어릴 적 추억을 이야기할 때","text":"우리는 띠부씰 모으느라 포켓몬빵을 여러 봉 사던 세대야."}]'::jsonb,
  updated_at = now()
where short_id = 's2v2pzh9'
  and slug = '포켓몬빵-띠부씰'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 엽기 신드롬 (xq7ycnys / 엽기-신드롬)
update public.memes set
  description = '2000~2001년 방송사 설문에서 최고의 유행어로 꼽힌 ''엽기''는 본래 기이한 일을 좇는다는 뜻에서 벗어나 ''황당하고 유쾌하게 톡톡 튀는 것''을 뜻하는 말로 널리 쓰였다. 영화 ''엽기적인 그녀'', 플래시 애니메이션 ''마시마로'' 등 당대 문화 코드 전반을 관통하는 키워드였다.',
  origin = '''엽기''는 원래 기이하고 비정상적인 것에 흥미를 갖는다는 뜻이었으나, 1990년대 말 일본 하위문화에서 그로테스크·고어를 가리키던 용법이 1998년 일본 대중문화 개방 이후 역수입되며 한국식으로 ''병맛''에 가까운 코믹한 뉘앙스로 재해석됐다. 최초 진원지로는 딴지일보가 꼽히며, PC통신과 초기 인터넷 게시판을 타고 급속히 퍼져 2000~2001년 방송·신문이 ''올해 최고의 유행어''로 꼽을 만큼 사회 전반의 화두가 됐다. KTF ''na'' 브랜드, 하이홈 등 통신사·기업 광고들이 달동네 복고풍 콘셉트로 엽기 코드를 차용하며 유행에 불을 지폈다.',
  usage_note = '황당하거나 톡톡 튀는 상황을 회상하거나, 2000년대 초 문화를 설명할 때 쓴다. 지금 대화에서 아무 일에나 ‘엽기다’고 붙이면 다소 옛말처럼 들릴 수 있다.',
  caution = caution,
  usage_examples = '[{"situation":"2000년대 초 문화를 설명할 때","text":"그때는 조금만 이상해도 엽기라고 불렀어. 최고의 유행어였거든."},{"situation":"옛 플래시 만화를 보다가","text":"마시마로 보던 시절이 진짜 엽기 신드롬이었어."}]'::jsonb,
  updated_at = now()
where short_id = 'xq7ycnys'
  and slug = '엽기-신드롬'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 폐인 문화 (j5sbgbev / 폐인-문화)
update public.memes set
  description = '2003년 MBC 드라마 <다모>의 열성 팬들이 밤새워 인터넷 게시판에서 토론하다 눈 밑이 시커메진 모습을 스스로 ‘다모폐인’이라 부르며 생긴 신조어다. 그 이전에도 일부 드라마 팬덤에서 ‘폐인’이라는 말이 쓰였다는 기록이 있으나, 다모를 계기로 대중화됐다. 이후 특정 취미나 콘텐츠에 깊게 몰입하는 사람을 가리키는 ‘~폐인’ 표현이 널리 퍼졌다. 지금은 자조와 애정이 섞인 말로 쓰이는 경우가 많다.',
  origin = '''폐인''이라는 표현은 2000년 드라마 <네 멋대로 해라> 팬덤에서 먼저 쓰인 것으로 알려져 있으며, 2003년 MBC 드라마 <다모>(2003.7.28~9.9)가 방영되며 본격적으로 대중화됐다. 인터넷 게시판에서 밤새 드라마 이야기를 나누다 눈 밑이 시커메진 열성 시청자들을 가리켜 팬들 스스로 ''다모폐인''이라 불렀다. 방영일이면 평소 한산하던 방송사 시청자 게시판이 대형 커뮤니티 못지않은 글 폭주를 보였을 정도로 반응이 뜨거웠다. 이를 계기로 ''폐인''은 특정 드라마·게임·콘텐츠에 몰입해 일상을 소홀히 할 정도로 빠진 사람을 가리키는 일반 신조어로 확장됐다.',
  usage_note = '어떤 작품이나 취미에 깊이 빠진 상태를 자조적으로 말할 때 쓴다. 상대를 비하하는 낙인처럼 붙이면 기분이 상할 수 있다.',
  caution = caution,
  usage_examples = '[{"situation":"드라마를 정주행하고 나서","text":"어제 밤을 새우고 다 봤어. 완전 폐인 됐네."},{"situation":"게임 이야기에 빠져 있을 때","text":"주말 내내 그 게임만 해서, 주변에서 폐인 소리 듣는다."}]'::jsonb,
  updated_at = now()
where short_id = 'j5sbgbev'
  and slug = '폐인-문화'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%8B%A4%EB%AA%A8_(%EB%93%9C%EB%9D%BC%EB%A7%88)', '다모 (드라마)', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'j5sbgbev' and meme.slug = '폐인-문화'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%8B%A4%EB%AA%A8_(%EB%93%9C%EB%9D%BC%EB%A7%88)'
  );

-- 프리챌 유료화 논란 (nvmtccc6 / 프리챌-유료화-논란)
update public.memes set
  description = '2002년 11월 커뮤니티 서비스 프리챌이 동호회 운영자에게 월정액을 강제하는 유료화 정책을 고압적으로 밀어붙이자 이용자들이 대거 반발해 110만 개였던 동호회가 40만 개로 줄었다. 이용자들은 다음 카페와 싸이월드 클럽으로 대거 이동했고, 프리챌은 결국 쇠락의 길을 걸었다.',
  origin = '프리챌은 2002년 11월 국내 최대 커뮤니티 서비스로 군림하던 중, 동호회 운영자에게 월 3300원의 유료 결제를 요구하는 유료화 정책을 전격 도입했다. 전체 회원이 아닌 운영자만 대상이었음에도 애착이 컸던 핵심 이용자층이 크게 반발했고, 110만 개에 달하던 동호회가 40만 개로 급감할 만큼 대규모 이탈이 이어져 이용자들은 싸이월드와 다음카페로 옮겨갔다. 반년 만에 정책을 철회했지만 한번 떠난 이용자는 돌아오지 않았고, 이 사건은 "무료로 키운 서비스는 유료 전환이 어렵다"는 업계의 교훈으로 오래 회자됐다.',
  usage_note = '무료로 키운 서비스를 갑자기 유료로 바꾸다 이용자가 떠난 사례로 언급한다. 현재 커뮤니티 정책 논쟁에 성급하게 대입할 때는 시기와 조건을 분명히 해야 한다.',
  caution = caution,
  usage_examples = '[{"situation":"플랫폼이 요금을 올릴 때","text":"프리챌 유료화 논란 생각난다. 한번 떠난 사람은 잘 안 돌아오더라고."},{"situation":"2000년대 인터넷을 회상할 때","text":"그때 동호회가 다음 카페로 우르르 옮겨 간 게 프리챌 유료화 이후였어."}]'::jsonb,
  updated_at = now()
where short_id = 'nvmtccc6'
  and slug = '프리챌-유료화-논란'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%ED%94%84%EB%A6%AC%EC%B1%8C', '프리챌', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'nvmtccc6' and meme.slug = '프리챌-유료화-논란'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%ED%94%84%EB%A6%AC%EC%B1%8C'
  );

-- 아이러브스쿨 동창찾기 열풍 (n4srdru6 / 아이러브스쿨-동창찾기-열풍)
update public.memes set
  description = '1999년 9월 문을 연 아이러브스쿨은 출신 학교와 졸업 연도로 동창을 찾아 주는 서비스로, 2000년 한 해 만에 회원 수백만 명을 모으며 선풍적 인기를 끌었다. 초등학교 동창끼리 재회해 결혼에 이른 사례가 보도되는 한편, 기혼자들의 불륜 문제로도 사회 이슈가 됐다. 별다른 광고 없이도 입소문만으로 성장한 초기 인터넷 신드롬의 대표 사례로 남아 있다.',
  origin = '카이스트 박사과정이던 김영삼이 자본금 5000만 원으로 1999년 9월 ''모교사랑''을 설립하고 10월 정식 서비스를 시작한 동창 찾기 사이트다. 졸업 학교명만 입력하면 동창과 은사를 찾을 수 있는 방식으로, 별다른 광고 없이도 9개월 만에 회원 300만 명을 모았고 국내 커뮤니티 사이트 중 최단 기간 회원 500만 명을 돌파하는 기록을 세운 것으로 알려져 있다. 2000년 전국적인 ''동창 찾기 붐''을 일으키며 사회 현상으로 자리잡았다.',
  usage_note = '2000년대 초 동창 찾기 열풍을 이야기할 때 사례로 언급한다. 사생활 침해나 불륜 스캔들만 따로 웃음의 소재로 소비하지 말고, 당시 부작용이 있었다는 점도 함께 말하는 편이 정확하다.',
  caution = '당시 기혼자 불륜 문제 등 부작용도 있었다는 맥락을 함께 언급하는 것이 정확하다',
  usage_examples = '[{"situation":"옛 동창 이야기를 할 때","text":"아이러브스쿨 덕분에 초등학교 친구를 다시 만난 사람이 주변에 진짜 있었어."},{"situation":"초기 인터넷 열풍을 설명할 때","text":"2000년에는 아이러브스쿨 동창 찾기가 사회 현상처럼 뉴스에 나왔어."}]'::jsonb,
  updated_at = now()
where short_id = 'n4srdru6'
  and slug = '아이러브스쿨-동창찾기-열풍'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%95%84%EC%9D%B4%EB%9F%AC%EB%B8%8C%EC%8A%A4%EC%BF%A8', '아이러브스쿨', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'n4srdru6' and meme.slug = '아이러브스쿨-동창찾기-열풍'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%95%84%EC%9D%B4%EB%9F%AC%EB%B8%8C%EC%8A%A4%EC%BF%A8'
  );

-- 디워 사태 (wsjz865n / 디워-사태)
update public.memes set
  description = '2007년 심형래 감독의 영화 <디워> 개봉 후 흥행과 별개로 평론 비판이 일자, 이를 옹호하는 네티즌들의 반발과 비평가·블로거에 대한 악플 공세가 벌어진 사건이다. 온라인 여론과 애국주의 마케팅이 맞물린 논쟁의 대표 사례로 꼽힌다. 작품 평가와 감독 개인, 민족 감정을 한꺼번에 둘러싼 갈등은 이후 한국 영화 담론에도 자주 소환된다.',
  origin = '2007년 8월 1일 개봉한 심형래 감독의 영화 <디워>가 16일 만에 관객 700만 명을 넘기며 흥행하는 가운데, 8월 7일 MBC ''생방송 오늘아침''에서 경향신문 유인경 기자가 심형래를 코미디 프로에서 다시 보고 싶다는 취지의 발언을 하며 논란이 촉발됐다. 이어 8월 9일 MBC ''100분 토론''에서 평론가 진중권이 작품성을 신랄히 비판하면서 논쟁이 격화됐고, 온라인 커뮤니티를 중심으로 ''충무로 대 대중''이라는 프레임과 애국주의적 여론전으로 확산됐다.',
  usage_note = '2000년대 온라인 여론전 사례로 다룰 때 신중히 언급한다. 특정 평론가나 블로거를 다시 공격하는 방식으로 쓰면 안 된다.',
  caution = '특정 개인(평론가·블로거)에 대한 온라인 공격으로 번진 사례이므로 조심스럽게 다뤄야 함',
  usage_examples = '[{"situation":"2000년대 영화 담론을 회고할 때","text":"디워 사태 때 흥행과 평론이 완전히 따로 놀았던 기억이 나."},{"situation":"온라인 여론을 이야기할 때","text":"그때는 영화 이야기인데도 애국 프레임으로 번져서, 디워 사태라는 말이 남았어."}]'::jsonb,
  updated_at = now()
where short_id = 'wsjz865n'
  and slug = '디워-사태'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/D-War', 'D-War', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'wsjz865n' and meme.slug = '디워-사태'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/D-War'
  );

-- PC통신 모뎀 접속음 (yeyam8cm / PC통신-모뎀-접속음)
update public.memes set
  description = '1990년대 하이텔·나우누리 등 PC통신에 접속할 때 나던 특유의 다이얼업 모뎀 연결음은 그 시절 인터넷 세대를 상징하는 소리로 남아 있다. 전화선을 쓰다 보니 누군가가 수화기를 들면 접속이 끊기는 일도 흔했다. 초고속 인터넷이 보급된 뒤에는 사라졌지만, 유튜브 추억 영상과 샘플링 음원으로 자주 소환된다.',
  origin = '1990년대 초중반 하이텔·천리안·나우누리 등 PC통신에 접속할 때 전화선을 통해 들리던 ''삐~ 지지직~ 쉬이익'' 하는 다이얼업 모뎀 신호음을 가리킨다. 전화 회선으로 디지털 신호를 주고받기 위한 핸드셰이크 과정에서 나는 소리로, 당시 이용자들 사이에서는 흔히 ''화장실 물 내려가는 소리''나 ''비명소리''로 불리며 하나의 밈으로 통용됐다. 초고속 인터넷망 보급 이후 자취를 감췄지만, 이 소리를 샘플링한 음원이나 유튜브 추억 영상이 꾸준히 제작되면서 1980~90년대 학창시절을 보낸 세대의 향수를 자극하는 문화 기호로 남아 있다.',
  usage_note = 'PC통신 시절의 향수를 이야기할 때 소리를 흉내내며 회상할 수 있다. 처음 듣는 사람에게는 무슨 소리인지 한 줄로 설명해 주는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대를 회상할 때","text":"그 모뎀 접속음 들으면 숙제하다가 하이텔 하던 생각이 바로 나."},{"situation":"전화선 인터넷을 설명할 때","text":"그때는 누가 전화 받으면 PC통신이 끊겼어. 모뎀 소리가 곧 인터넷의 시작이었지."}]'::jsonb,
  updated_at = now()
where short_id = 'yeyam8cm'
  and slug = 'PC통신-모뎀-접속음'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 검정고무신 애니메이션 (5pzu8tzp / 검정고무신-애니메이션)
update public.memes set
  description = '이영일·이우영의 만화 ‘검정고무신’은 1992년 소년챔프에 연재를 시작해 2006년까지 이어지며 국내 최장수 연재 만화 기록을 세웠다. 1999년 KBS 설날 특집으로 첫 애니메이션 에피소드가 높은 시청률을 기록한 뒤, 2000년 정식 시리즈로 제작됐다. 1970년대 서민 가족의 일상을 그린 정서가 세대를 넘어 회자되며, 지금도 장면 단위 밈으로 자주 다시 소비된다.',
  origin = '검정고무신은 이영일(필명 도래미)이 글을 쓰고 이우영이 그려 1992년 소년챔프에 연재를 시작한 만화로, 2006년까지 이어지며 국내 코믹스 최장수 연재 기록을 세웠다. TV애니메이션은 1999년 2월 17일 파일럿 방영을 거쳐 2000년 12월 15일부터 2001년 3월 16일까지 방영됐으며, 원작보다 접근성이 좋은 애니메이션판이 더 널리 알려지면서 2000년대 초 국민 애니메이션급 인지도를 얻었다. 1970년대 서민 가족의 일상을 그린 정서가 세대를 넘어 공감을 얻은 것으로 알려져 있다.',
  usage_note = '1990년대 후반~2000년대 초 향수 어린 국민 만화로 언급할 수 있다. 특정 장면을 패러디할 때는 원작과 애니메이션을 구분해서 말하는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"추억 만화를 이야기할 때","text":"검정고무신 보면 기영이네 집 풍경부터 생각이 나."},{"situation":"옛 애니메이션을 공유할 때","text":"이거 완전 검정고무신 기철이 말투다."}]'::jsonb,
  updated_at = now()
where short_id = '5pzu8tzp'
  and slug = '검정고무신-애니메이션'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EA%B2%80%EC%A0%95%EA%B3%A0%EB%AC%B4%EC%8B%A0', '검정고무신', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '5pzu8tzp' and meme.slug = '검정고무신-애니메이션'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EA%B2%80%EC%A0%95%EA%B3%A0%EB%AC%B4%EC%8B%A0'
  );

-- 버디버디 메신저 (q7cjtg8h / 버디버디-메신저)
update public.memes set
  description = '2000년 1월 서비스를 시작한 버디버디는 네이트온·MSN 메신저에 이어 국내에서 널리 쓰인 메신저로, 2000년대 중반 학생층에서는 계정이 없는 사람이 드물 정도였다. 상태 메시지와 특수문자 닉네임으로 감정을 표현하는 문화가 함께 유행했다. 이후 스마트폰 메신저에 자리를 내주며 서비스가 종료됐지만, 그 시절 추억의 상징으로 자주 소환된다.',
  origin = '버디버디는 2000년 1월 13일 서비스를 시작한 인스턴트 메신저로, 네이트온과 MSN 메신저에 이어 국내에서 세 번째로 많이 쓰인 메신저였던 것으로 알려져 있다. 주 이용층은 중고생이었고, 2003년부터 2009년 사이에는 초등학교 고학년부터 고등학생까지 계정을 하나쯤 갖고 있는 것이 당연할 만큼 확산돼 2008년 8월에는 시장 점유율 56.21%를 기록했다. 상태 메시지로 ''허걱'', ''뽀뽀'', ''애정결핍'' 같은 감정을 표현하는 기능과 특수문자를 활용한 닉네임 꾸미기 문화가 유행하며 10대들의 놀이 문화로 자리잡았다.',
  usage_note = '2000년대 초 학생 메신저 문화의 대표 사례로 언급할 수 있다. 지금의 메신저와 비교할 때는 상태 메시지와 아바타 문화를 함께 설명하면 이해가 쉽다.',
  caution = caution,
  usage_examples = '[{"situation":"학창 시절을 회상할 때","text":"그때는 버디버디 상태 메시지에 마음을 다 적어 뒀잖아."},{"situation":"옛 메신저를 비교할 때","text":"카톡 이전에 우리 반 연락망은 거의 버디버디였어."}]'::jsonb,
  updated_at = now()
where short_id = 'q7cjtg8h'
  and slug = '버디버디-메신저'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%B2%84%EB%94%94%EB%B2%84%EB%94%94', '버디버디', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'q7cjtg8h' and meme.slug = '버디버디-메신저'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%B2%84%EB%94%94%EB%B2%84%EB%94%94'
  );

-- 신승훈 발라드 황제 (rc2d9rq9 / 신승훈-발라드-황제)
update public.memes set
  description = '1990년대 초 데뷔한 신승훈은 댄스와 레게 열풍 속에서도 발라드로 대중적 인기를 끌어 ‘발라드 황제’라는 별명을 얻었다. 연속 밀리언셀러와 오랜 시상식 수상이 그 별명을 뒷받침하는 기록으로 자주 인용된다. 이후 한국 발라드 시장의 대표 가수로 불리며, 세대가 바뀐 뒤에도 이 수식어와 함께 소환된다.',
  origin = '신승훈은 1990년 11월 자작곡 ''미소 속에 비친 그대''로 데뷔했다. 이듬해인 1991년 발표한 2집 타이틀곡 ''보이지 않는 사랑''이 가요 순위 프로그램에서 14주 연속 1위를 차지하는 진기록을 세우며 한국 기네스북에 등재됐고, 그해 골든디스크 대상을 수상했다. 이 압도적인 성공을 계기로 ''발라드의 황제''라는 별명이 대중 사이에 굳어졌다. 이후 1집부터 7집까지 연속으로 밀리언셀러를 기록하고 골든디스크 본상을 10년 연속 수상하는 등 1990년대 한국 발라드 시장을 대표하는 아이콘으로 불렸다.',
  usage_note = '1990년대 발라드 전성기를 이야기할 때 대표 사례로 언급할 수 있다. 별명은 찬사이므로, 다른 가수와 우열을 가르는 말처럼 단정할 필요는 없다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대 노래를 들을 때","text":"이 감성 들으니 신승훈 발라드 황제 시절이 생각나."},{"situation":"가요 역사를 이야기할 때","text":"댄스 전성기에도 발라드로 버틴 가수를 떠올리면 신승훈이 먼저 나와."}]'::jsonb,
  updated_at = now()
where short_id = 'rc2d9rq9'
  and slug = '신승훈-발라드-황제'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%8B%A0%EC%8A%B9%ED%9B%88', '신승훈', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'rc2d9rq9' and meme.slug = '신승훈-발라드-황제'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%8B%A0%EC%8A%B9%ED%9B%88'
  );

-- TTL 임은경 '스무살의 011' (ywh3wq2f / TTL-임은경-스무살의-011)
update public.memes set
  description = '1999년 7월 SK텔레콤이 20대 초반을 겨냥해 선보인 요금제 브랜드 TTL은 신인 모델 임은경을 내세워 정체를 밝히지 않는 신비주의 티저 광고로 큰 화제를 모았다. 붉은 머리의 임은경이 물속에서 촬영한 CF는 지금도 성공적인 브랜드 마케팅 사례로 꼽힌다. 임은경 본인은 이후 인터뷰에서 비밀 유지 계약 때문에 TTL 소녀라고 말하지 못했다고 밝혔다.',
  origin = 'SK텔레콤은 1999년 7월 19~24세 청년층을 겨냥한 브랜드 TTL을 출범시키며, 제품 설명 없이 궁금증만 유발하는 신비주의 티저 광고를 택했다. 무명 신인이던 임은경을 ‘TTL 소녀’로 캐스팅하고 정체를 쉽게 밝히지 않는 전략을 썼다는 점이 SBS·브랜드브리프 등 보도에 반복된다. 수중 촬영 영상이 화제가 되며 서비스 초기 가입자가 빠르게 늘었고, 2000년대 초 마케팅 교과서처럼 회자됐다.',
  usage_note = '신비주의 마케팅이나 1999~2000년 통신 광고를 이야기할 때 사례로 언급한다. 모델 개인의 사생활보다 광고 전략을 중심으로 말하는 편이 안전하다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 CF를 보다가","text":"저 물속 장면, TTL 임은경 광고 아니야?"},{"situation":"마케팅 사례를 들 때","text":"정체를 안 밝히고 궁금증만 키운 전형적인 예가 TTL 소녀 캠페인이었어."}]'::jsonb,
  updated_at = now()
where short_id = 'ywh3wq2f'
  and slug = 'TTL-임은경-스무살의-011'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ent.sbs.co.kr/news/article.do?article_id=E10007025505', '임은경 "신비소녀? TTL소녀 비밀유지 계약서 있었다"', 'SBS 연예뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'ywh3wq2f' and meme.slug = 'TTL-임은경-스무살의-011'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ent.sbs.co.kr/news/article.do?article_id=E10007025505'
  );

-- Y2K 밀레니엄버그 (mx2p9d97 / Y2K-밀레니엄버그)
update public.memes set
  description = '1999년 12월 31일에서 2000년 1월 1일로 넘어가는 시점에, 연도를 두 자리로만 처리한 컴퓨터가 날짜를 오인할 수 있다는 우려가 확산됐다. 재난 대비 물품이 팔릴 정도로 사회적 소동이 일었으나, 실제로는 큰 피해 없이 지나갔다. 이후에는 과장된 공포가 찻잔 속 태풍으로 끝났다는 평가와 함께 세기말 풍속도로 자주 회자된다.',
  origin = 'Y2K(밀레니엄버그)는 컴퓨터가 연도를 마지막 두 자리로만 인식해 2000년을 1900년으로 오인, 전산 대란이 일어날 수 있다는 우려에서 비롯된 문제다. 1999년 1월 경향신문 등 언론이 "금융망 마비, 통신 두절로 사회가 공황 상태에 빠질 수 있다"고 잇달아 보도하면서 한국 사회 전체가 촉각을 곤두세웠고, 정부와 기업은 하반기 내내 전산·네트워크 점검에 매달렸다. 이 시기를 틈타 바이러스와 해킹까지 기승을 부리며 불안을 키웠으나, 정작 새해가 밝은 뒤 별다른 사고는 일어나지 않아 ''찻잔 속 태풍''으로 끝났다는 평가를 받는다.',
  usage_note = '과장된 공포가 실제로는 큰 일 없이 지나간 사례로 언급할 수 있다. 당시 전산 점검 자체를 헛수고로만 단정하지는 않는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"세기말 이야기를 할 때","text":"Y2K 밀레니엄버그 때는 진짜 컴퓨터가 멈출 줄 알고 긴장했었어."},{"situation":"과장된 예측을 농담할 때","text":"그 소문은 Y2K처럼 지나갈 수도 있어. 일단 확인하고 판단하자."}]'::jsonb,
  updated_at = now()
where short_id = 'mx2p9d97'
  and slug = 'Y2K-밀레니엄버그'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Year_2000_problem', 'Year 2000 problem', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'mx2p9d97' and meme.slug = 'Y2K-밀레니엄버그'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Year_2000_problem'
  );

-- ㅋㅋㅋ 표기 (ewwjd6g7 / ㅋㅋㅋ-표기)
update public.memes set
  description = '웃음소리를 자음 ‘ㅋ’만으로 표기하는 방식은 1999년 무렵 최고의 유행어로 꼽히며 한국어 인터넷 채팅의 기본 표현이 됐다. ‘킥킥’, ‘크크’ 같은 의성어를 초성만 남긴 관행에서 비롯된 것으로 설명된다. 온라인 게임 채팅창의 글자 수 제한이 축약을 가속했다는 이야기도 함께 전해진다. 지금까지도 가장 흔한 한국어 웃음 표기다.',
  origin = '자음 ''ㅋ''을 반복해 웃음소리를 표기하는 방식은 1990년대 말 PC통신·초기 인터넷 채팅 문화에서 자연스럽게 발전한 것으로 알려져 있으며, 정확한 최초 사용 시점은 확인되지 않는다. ''킥킥'', ''큭큭'', ''크크'' 같은 웃음 의성어를 초성만 따서 표기하던 관행에서 비롯됐으며, 1997년 이후 ''바람의나라''·''리니지'' 등 온라인 게임 채팅창의 글자 수 제한이 축약 표기 확산을 가속화한 것으로 알려져 있다. 1999년 무렵에는 ''쿄쿄쿄'', ''켜켜켜'' 같은 변형 표기와 경쟁하다가 최종적으로 ''ㅋㅋㅋ''가 표준 표기로 굳어지며 그해 최고 유행어 중 하나로 꼽혔다.',
  usage_note = '웃음을 표현할 때 부담 없이 쓸 수 있는 표기다. 횟수와 길이에 따라 농담, 비웃음, 어색함 등 느낌이 달라질 수 있으니 상대와 상황을 본다.',
  caution = caution,
  usage_examples = '[{"situation":"채팅에서 가벼운 농담을 받을 때","text":"그 말 듣고 진짜 웃겼어 ㅋㅋㅋ"},{"situation":"인터넷 말투를 설명할 때","text":"한국어로는 웃음 소리를 ㅋㅋㅋ로 쓰는 게 제일 흔해."}]'::jsonb,
  updated_at = now()
where short_id = 'ewwjd6g7'
  and slug = 'ㅋㅋㅋ-표기'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/ㅋㅋ', 'ㅋㅋ', '위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'ewwjd6g7' and meme.slug = 'ㅋㅋㅋ-표기'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/ㅋㅋ'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankookilbo.com/news/article/201507211545312014', 'ㅋㅋㅋ', '한국일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'ewwjd6g7' and meme.slug = 'ㅋㅋㅋ-표기'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankookilbo.com/news/article/201507211545312014'
  );

-- 탑블레이드 팽이 붐 (fzmt7ngh / 탑블레이드-팽이-붐)
update public.memes set
  description = '2001년 10월 SBS에서 방영을 시작한 애니메이션 ‘탑블레이드’를 계기로 국내에서 팽이 붐이 일었다. 완구 제조사 손오공이 큰 매출을 올린 한편, 중국산 모조 팽이가 범람하는 사회 문제도 함께 보도됐다. 이후 시즌이 이어지며 2000년대 초 어린이 놀이 문화의 상징처럼 남았다.',
  origin = '탑블레이드는 팽이 완구를 소재로 한 일본 애니메이션으로, 국내에는 2001년 10월 9일부터 2002년 4월 9일까지 SBS에서 방영됐다. 방영과 함께 국내에서도 팽이 붐이 일어 완구업체 손오공이 관련 상품으로 약 1조원에 달하는 매출을 올렸고, 2001년 한 해에만 3천만 개 넘는 팽이가 팔려나갔다. 인기가 폭발하면서 중국산 모조품이 시중에 범람해 사회 문제로 번졌고, SBS 예능 ''호기심천국''이 이를 다룰 정도로 화제성이 컸다. 이후 V, G 시즌까지 이어지며 3년간 총 154화가 방영됐다.',
  usage_note = '2000년대 초 어린이 완구 열풍의 대표 사례로 언급할 수 있다. 모조품 문제까지 함께 말하면 당시 분위기를 더 정확히 전할 수 있다.',
  caution = caution,
  usage_examples = '[{"situation":"어린 시절 장난감을 회상할 때","text":"우리 때는 탑블레이드 팽이 배틀이 학교 놀이터를 점령했었어."},{"situation":"완구 유행을 비교할 때","text":"요즘 베이블레이드 보면 탑블레이드 붐이 생각나."}]'::jsonb,
  updated_at = now()
where short_id = 'fzmt7ngh'
  and slug = '탑블레이드-팽이-붐'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Beyblade', 'Beyblade', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'fzmt7ngh' and meme.slug = '탑블레이드-팽이-붐'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Beyblade'
  );

-- 바츠 해방전쟁 (jcdupe54 / 바츠-해방전쟁)
update public.memes set
  description = '2004년 6월부터 2008년 3월까지 온라인 게임 리니지2의 바츠 서버에서, 서버를 장악한 DK 혈맹의 독재에 맞서 일반 유저들이 연합해 싸운 사건이다. 연인원 수십만 명이 참여한 것으로 알려져 ‘온라인 시민혁명’에 비유되기도 했다. 이후 게임 판타지와 커뮤니티 서사에 깊은 인상을 남긴 사례로 회자된다.',
  origin = '2004년 6월 리니지2 바츠 서버를 장악한 ''드래곤나이츠(DK) 혈맹''이 저레벨 유저 필수품의 세율을 올리는 등 독점적 운영을 강화하자, 다수의 유저 연합인 ''바츠연합군''이 결성돼 맞서면서 시작됐다. 전쟁은 2008년 3월까지 이어지며 연인원 20만 명이 참여한 것으로 알려져 있고, 게시판에는 전황을 알리는 글이 폭주했으며 일반 언론도 이를 ''온라인 시민혁명''에 비유해 보도했다. 이후 논문·전시·문학 등 다양한 콘텐츠로 재생산되며 국내 온라인 게임사에서 손꼽히는 사건으로 남았다.',
  usage_note = '온라인 게임 커뮤니티 문화나 대규모 유저 연대를 이야기할 때 언급한다. 실제 게이머 사이의 갈등과 감정의 골이 깊었던 사건이므로 유희적으로만 소비하지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"게임 역사를 이야기할 때","text":"리니지2 바츠 해방전쟁은 유저들이 서버 질서에 집단으로 맞선 일로 유명해."},{"situation":"커뮤니티 연대를 설명할 때","text":"그때 게시판에 전황 글이 끊이질 않았대. 바츠 해방전쟁이 그래서 뉴스에도 났어."}]'::jsonb,
  updated_at = now()
where short_id = 'jcdupe54'
  and slug = '바츠-해방전쟁'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 서태지와 아이들 컴백홈 현상 (rf3dt6mp / 서태지와-아이들-컴백홈-현상)
update public.memes set
  description = '1995년 발표된 서태지와 아이들의 ‘컴백홈’은 갱스터 랩 스타일의 파격으로 주목받았다. 이 노래를 듣고 가출 청소년이 집으로 돌아왔다는 사연이 뉴스에 보도되며 ‘컴백홈 현상’이라는 말이 생겼다. 공익 캠페인과 표절 논란 등 주변 이야기도 함께 남았지만, 대중에게는 귀가 서사로 가장 오래 기억된다.',
  origin = '서태지와 아이들 4집 타이틀곡으로, 1995년 10월 15일 뮤직비디오가 공개됐다. 발매 후 가출 청소년들이 이 노래를 듣고 집으로 돌아왔다는 사례가 잇따라 SBS ''뉴스 따라잡기'', KBS 9시 뉴스 등 주요 언론에 ''컴백홈 현상''으로 보도되며 사회적 화제가 됐다. 정부 위촉으로 가출 청소년 귀가 캠페인 공익광고에도 출연했으나, 일부 운동권에서는 체제 순응적 메시지라는 비판도 제기했다. 한편 미국 힙합그룹 사이프러스 힐의 곡과 유사하다는 표절 논란이 일었으나, 사이프러스 힐 측이 직접 표절이 아니라고 인정한 것으로 알려져 있다.',
  usage_note = '가출과 귀가처럼 민감한 사연을 이야기할 때 배경지식으로 쓸 수 있다. 실제 가출 청소년에 대한 훈계나 낭만화는 피해야 한다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대 노래를 들을 때","text":"컴백홈 들으면 그때 뉴스에서 귀가 사연을 전하던 장면이 겹쳐."},{"situation":"서태지 이야기를 할 때","text":"서태지와 아이들 컴백홈 현상은 노래가 사회 뉴스가 된 드문 경우였어."}]'::jsonb,
  updated_at = now()
where short_id = 'rf3dt6mp'
  and slug = '서태지와-아이들-컴백홈-현상'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%84%9C%ED%83%9C%EC%A7%80%EC%99%80_%EC%95%84%EC%9D%B4%EB%93%A4', '서태지와 아이들', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'rf3dt6mp' and meme.slug = '서태지와-아이들-컴백홈-현상'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%84%9C%ED%83%9C%EC%A7%80%EC%99%80_%EC%95%84%EC%9D%B4%EB%93%A4'
  );

-- 대장금 홍시 (m9qmrhxz / 대장금-홍시)
update public.memes set
  description = '2003년 방영된 MBC 드라마 ‘대장금’ 5회에서 어린 장금이가 최고상궁의 질문에 홍시 맛을 알아본 이유를 시원하게 설명하지 못하는 장면이 오랫동안 회자됐다. 시청률 50%대를 오가던 국민 드라마의 명대사로, 이유를 딱 잘라 말하기 어려운 직관적 판단을 가리킬 때 패러디된다. “홍시 맛이 나서 홍시라 생각했다”는 식의 인용은 일상 농담으로도 자주 쓰인다.',
  origin = '2003년 9월 29일 방영된 MBC 드라마 <대장금> 5회에서 나온 장면이다. 수라간 최고상궁 정상궁이 음식 재료를 알아맞히게 하자 어린 장금이가 유일하게 홍시를 맞히며 "그냥 홍시 맛이 나서 홍시라 생각한 것이온데, 어찌 홍시라 생각했느냐 하시면…"이라는 대사를 남겼다. 시청률 50%대를 넘나들던 국민 드라마의 장면이었던 만큼 오랫동안 회자되며, 이유를 명확히 설명하기 어려운 직관적 판단을 가리키는 관용구처럼 인용되고 있다.',
  usage_note = '이유를 설명하기 애매한 상황을 유머러스하게 표현할 때 대사를 패러디할 수 있다. 사극 말투를 과하게 흉내 낼 필요는 없고, 상대가 맥락을 알 때 더 잘 통한다.',
  caution = caution,
  usage_examples = '[{"situation":"이유를 묻기 어려울 때","text":"왜 이 메뉴를 골랐냐고? 그냥 홍시 맛이 나서 홍시라 한 것이온데."},{"situation":"드라마 명대사를 이야기할 때","text":"대장금 홍시 장면은 아직도 직관을 설명할 때 꺼내 쓰게 돼."}]'::jsonb,
  updated_at = now()
where short_id = 'm9qmrhxz'
  and slug = '대장금-홍시'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%8C%80%EC%9E%A5%EA%B8%88', '대장금', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'm9qmrhxz' and meme.slug = '대장금-홍시'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%8C%80%EC%9E%A5%EA%B8%88'
  );

-- 종이접기 아저씨 김영만 (s5tx6yzk / 종이접기-아저씨-김영만)
update public.memes set
  description = '1988년부터 KBS 어린이 프로그램 등에서 종이접기를 가르친 김영만은 1990년대 어린이들 사이에서 ‘초통령’이라 불릴 만큼 인기가 높았다. 얼굴이 담긴 색종이·문구 상품도 잘 팔렸다. 활동이 뜸해졌다가 2010년대 예능 출연을 계기로, 어른이 된 옛 시청자들 사이에서 향수를 자극하는 인물로 다시 소환됐다.',
  origin = '김영만은 1980년대 후반 KBS 아동 프로그램 ''TV유치원 하나둘셋''에 출연하며 얼굴을 알렸고, 이후 KBS 2TV ''혼자서도 잘해요''와 EBS ''딩동댕 유치원'' 등에서 20여 년간 종이접기·종이공작을 가르쳤다. 1990년대 방송을 보고 자란 어린이들에게 압도적인 인기를 끌어, 오늘날 표현으로 ''초통령''이라 부를 만한 존재였다고 전해진다. 이후 활동이 뜸해졌다가 2010년대 중반 한 예능 프로그램 등장을 계기로 성인이 된 옛 시청자들 사이에서 향수를 자극하는 밈으로 재조명되며 온라인에서 다시 화제가 됐다.',
  usage_note = '1990년대 어린이 방송의 향수 어린 상징으로 언급할 수 있다. 실명과 초상, 상품을 다룰 때는 존중하는 톤이 어울린다.',
  caution = caution,
  usage_examples = '[{"situation":"종이접기를 하다가","text":"이거 김영만 선생님한테 배운 접기 같은데."},{"situation":"어린이 프로그램을 회상할 때","text":"우리 세대 초통령은 연예인보다 종이접기 아저씨 김영만이었어."}]'::jsonb,
  updated_at = now()
where short_id = 's5tx6yzk'
  and slug = '종이접기-아저씨-김영만'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EA%B9%80%EC%98%81%EB%A7%8C', '김영만', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 's5tx6yzk' and meme.slug = '종이접기-아저씨-김영만'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EA%B9%80%EC%98%81%EB%A7%8C'
  );

-- 노스트라다무스 지구멸망설 (f2jjy62y / 노스트라다무스-지구멸망설)
update public.memes set
  description = '노스트라다무스가 남겼다고 알려진 ‘1999년 7월 하늘에서 공포의 대왕이 내려온다’는 문구를 둘러싸고 관련 서적이 쏟아지며 사회적 화제가 됐다. 국내 일부 종말론과 맞물려 불안이 커졌으나, 예정된 날짜가 지나도 아무 일도 일어나지 않으며 해프닝으로 끝났다. Y2K 소동과 함께 세기말 한국을 상징하는 에피소드로 자주 묶여 이야기된다.',
  origin = '16세기 프랑스 예언가 노스트라다무스가 ''1999년 일곱째 달, 하늘에서 공포의 대왕이 내려올 것''이라 남겼다는 예언은 1973년 일본 논픽션 작가 고토 벤의 저서를 통해 대중화됐고, 이 책이 국내에 소개되며 한국에서도 화제가 됐다. 1999년 7월 예언 시점이 다가오자 사이비 종교 다미선교회의 ''휴거설'' 소동과 맞물려 서점가에서 관련 서적이 불티나게 팔리는 등 사회적 불안이 확산됐다. 그러나 예언된 7월 24일 아무 일도 일어나지 않으면서 세기말 해프닝으로 마무리됐다.',
  usage_note = '세기말 종말론 소동의 대표 사례로 언급할 수 있다. 특정 종교나 신자를 비웃는 방식으로 확장하지 않는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"1999년을 회상할 때","text":"그때는 노스트라다무스 지구멸망설 때문에 주변에서 진지하게 걱정하는 사람도 있었어."},{"situation":"근거 없는 예언을 볼 때","text":"날짜만 박아 둔 예언은 1999년 멸망설처럼 지나가는 경우가 많아."}]'::jsonb,
  updated_at = now()
where short_id = 'f2jjy62y'
  and slug = '노스트라다무스-지구멸망설'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 온게임넷 스타리그 출범 (wyu84dvf / 온게임넷-스타리그-출범)
update public.memes set
  description = '1999년 ‘99 PKO’를 시초로, 2000년 전후 ‘스타리그’라는 이름과 함께 자리 잡은 온게임넷 스타리그는 개방형 스튜디오와 관중석을 도입하며 국내 e스포츠 관람 문화를 대중화한 출발점으로 평가된다. 같은 시기 ‘e스포츠’라는 용어도 사회적으로 통용되기 시작했다. 이후 한국 프로게임 중계의 상징처럼 오랫동안 기억된다.',
  origin = '국내 e스포츠 리그 문화는 1999년 ''99 PKO'' 대회를 시초로 태동했고, 2000년 하나로통신배 투니버스 스타리그부터 ''스타리그''라는 명칭이 처음 쓰였다. 이 대회의 흥행에 힘입어 2000년 7월 24일 황형준의 제안으로 게임 전문 채널 온게임넷이 개국했으며, 계약직 서너 명이 창고방에서 시작한 방송이 80여 명 규모의 전문 방송국으로 성장했다. 같은 시기인 2000년 2월 21세기프로게임협회(현 한국e스포츠협회) 창립식에서 문화관광부 장관이 ''e스포츠''라는 용어를 언급하며 이 표현이 사회적으로 통용되기 시작했다.',
  usage_note = '국내 e스포츠 산업의 출발점을 이야기할 때 언급할 수 있다. 후대 리그와 명칭이 바뀐 만큼, 시기를 분명히 하는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"e스포츠 역사를 설명할 때","text":"한국에서 게임 중계가 스포츠처럼 보이기 시작한 게 온게임넷 스타리그 출범 무렵이었어."},{"situation":"옛 경기를 볼 때","text":"이 경기장 소리 들으니 스타리그 결승 실황이 생각나."}]'::jsonb,
  updated_at = now()
where short_id = 'wyu84dvf'
  and slug = '온게임넷-스타리그-출범'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/OnGameNet', 'OnGameNet', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'wyu84dvf' and meme.slug = '온게임넷-스타리그-출범'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/OnGameNet'
  );

-- 젝스키스 '학원별곡' (rmpwzmy7 / 젝스키스-학원별곡)
update public.memes set
  description = '1997년 데뷔한 젝스키스의 타이틀곡 ‘학원별곡’은 입시 위주 교육 현실을 꼬집는 가사와 강렬한 퍼포먼스로 10대의 폭넓은 공감을 얻었다. 국악 타령조를 랩에 접목한 편곡과 아크로바틱한 군무가 화제가 되며, H.O.T.와 함께 1세대 아이돌 양강 구도를 알리는 신호탄이 됐다. 반항적 메시지를 담은 데뷔곡으로 이후 그룹들에도 영향을 준 사례로 평가된다.',
  origin = '젝스키스는 1997년 4월 15일 KMTV ''쇼 뮤직탱크''에서 데뷔곡 ''학원별곡''으로 첫 방송 무대를 가졌고, 같은 해 5월 14일 동명의 데뷔 음반이 발매됐다. 성적지상주의 등 당시 입시 교육의 문제를 정면으로 비판하는 가사와 국악 타령조를 랩에 접목한 독특한 편곡, 아크로바틱한 군무가 10대 사이에서 화제를 모으며 가요톱텐 10위권에 진입했다. H.O.T.와 함께 1세대 아이돌 양강 구도를 형성하는 신호탄이 된 곡으로, 반항적 메시지를 담은 아이돌 데뷔곡이라는 점에서 이후 그룹들에 영향을 준 것으로 평가된다.',
  usage_note = '1세대 아이돌과 1990년대 후반 학원가 정서를 이야기할 때 대표곡으로 언급할 수 있다. 가사 속 현실 비판을 지금 학교에 그대로 대입할 때는 시기 차이를 밝히는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대 아이돌을 이야기할 때","text":"젝스키스는 데뷔곡 학원별곡부터 기존 아이돌이랑 결이 달랐어."},{"situation":"입시 이야기를 하다가","text":"학원별곡 가사 듣면 그때 수험생들이 왜 열광했는지 감이 와."}]'::jsonb,
  updated_at = now()
where short_id = 'rmpwzmy7'
  and slug = '젝스키스-학원별곡'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 갈갈이 삼형제 (by5gkxee / 갈갈이-삼형제)
update public.memes set
  description = '갈갈이 삼형제는 코미디언 박명수를 중심으로 한 개그콘서트 코너로, 날카로운 입담과 반복 대사, 과장된 캐릭터가 2000년대 초 큰 인기를 끌었다. ‘갈갈이’라는 별명과 코너의 장면들은 당시 예능 유행어와 짤의 재료가 됐다. 이후에도 박명수의 대표 레퍼토리처럼 회자되며 그때의 공개 코미디를 상징하는 코너로 남았다.',
  origin = 'KBS 개그콘서트의 코너는 원래 외화 ''긴급구조 911''을 한국어 더빙으로 패러디한 ''패러디 보이스''라는 이름으로 시작했다. 2001년 9월 첫 방송에서 물에 빠진 사람을 구하려 배를 만든다며 무 속을 이로 파내는 장면이 예상외로 큰 웃음을 얻자, 이를 마지막에 반복해 보여주는 구성으로 코너를 개편하면서 이름도 ''갈갈이 삼형제''로 바뀌었다. 박준형·정종철·이승환이 출연해 ''무를 주세요''라는 유행어를 남겼고, 2003년 7월까지 방영되며 개그콘서트 초창기 대표 코너로 자리잡았다.',
  usage_note = '2000년대 초 공개 코미디와 박명수의 초기 캐릭터를 이야기할 때 언급한다. 코너의 공격적 유머를 지금 그대로 따라 하면 과하게 들릴 수 있다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 개그콘서트를 볼 때","text":"이 호흡 보니 갈갈이 삼형제 시절 박명수가 생각나."},{"situation":"예능 역사를 회고할 때","text":"2000년대 초에는 갈갈이 삼형제만 나와도 시청률이 달랐대."}]'::jsonb,
  updated_at = now()
where short_id = 'by5gkxee'
  and slug = '갈갈이-삼형제'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EA%B0%9C%EA%B7%B8_%EC%BD%98%EC%84%9C%ED%8A%B8', '개그 콘서트', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'by5gkxee' and meme.slug = '갈갈이-삼형제'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EA%B0%9C%EA%B7%B8_%EC%BD%98%EC%84%9C%ED%8A%B8'
  );

-- 임요환 '테란의 황제' (au7za8te / 임요환-테란의-황제)
update public.memes set
  description = '임요환은 스타크래프트 프로게이머 시절 테란 종족을 다루며 ‘테란의 황제’라는 별명을 얻었다. 온게임넷 스타리그를 비롯한 대회 우승과 공격적인 운영이 그 별명을 만든 배경으로 자주 설명된다. 한국 e스포츠 1세대를 대표하는 선수 가운데 한 명으로, 이후 예능과 해설, 사업 등 활동과 함께 이름이 계속 소환된다.',
  origin = '''테란의 황제''는 스타크래프트 1.07 버전 시기 테란 종족이 열세로 평가받던 시절, 임요환이 특유의 바이오닉 컨트롤과 참신한 전략으로 각종 대회를 휩쓸며 얻은 별명이다. 그는 온게임넷 스타리그에서 2회 연속 우승을 포함해 양대 리그 통산 3회 우승을 거뒀고, WCG 스타크래프트 브루드워 부문에서는 2연속 금메달을 딴 유일한 선수로 기록됐다. 이러한 성적을 바탕으로 ''황제''라는 별칭이 굳어졌고, 이후에는 별다른 수식어 없이 그냥 ''황제''로 불릴 만큼 e스포츠 초창기를 상징하는 인물이 됐다.',
  usage_note = '초기 e스포츠 스타를 이야기할 때 대표 별명으로 언급할 수 있다. 경기 내용과 별명을 혼동하지 말고, 특정 판의 승패를 과장하지 않는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 스타 경기를 볼 때","text":"이 운영 보면 왜 임요환을 테란의 황제라고 불렀는지 알 것 같아."},{"situation":"e스포츠 1세대를 회고할 때","text":"스타리그 하면 제일 먼저 떠오르는 이름 중 하나가 임요환이야."}]'::jsonb,
  updated_at = now()
where short_id = 'au7za8te'
  and slug = '임요환-테란의-황제'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%9E%84%EC%9A%94%ED%99%98', '임요환', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'au7za8te' and meme.slug = '임요환-테란의-황제'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%9E%84%EC%9A%94%ED%99%98'
  );

-- 젝스키스 해체(2000) (t6jrbnbd / 젝스키스-해체(2000))
update public.memes set
  description = '젝스키스는 1997년 데뷔 이후 H.O.T.와 함께 1세대 아이돌 양강으로 불리며 큰 인기를 누리다 2000년 해체를 발표했다. 갑작스러운 해체 소식은 팬덤에 큰 충격을 주었고, 당시 청소년 문화의 사건처럼 보도됐다. 이후 재결합과 개별 활동이 이어지면서도, 2000년 해체는 그 시대 아이돌사의 분기점으로 자주 언급된다.',
  origin = '젝스키스는 2000년 5월 18일 돌연 기자회견을 열어 해체를 발표했다. 구체적 사유는 명확히 밝히지 않았으나 소속사와의 처우 갈등, 멤버들의 음악적 방향 차이, 인기 절정에서 활동을 마무리하려는 의지 등이 배경으로 꼽힌다. 해체 발표 이틀 뒤인 5월 20일 서울올림픽주경기장에서 열린 드림콘서트가 사실상 고별 무대가 됐고, 약 5만 명의 팬이 몰려 마지막을 지켰다. 멤버들은 음성사서함 메시지로 팬들과 만나고 싶어 매니저에게 부탁해 드림콘서트 출연 일정이 잡혔다고 설명했다.',
  usage_note = '1세대 아이돌의 전성기와 공백을 이야기할 때 언급할 수 있다. 해체 이유에 대해 확인되지 않은 소문을 보태지 않는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대 아이돌을 회고할 때","text":"젝스키스 해체 소식 듣고 울었다는 친구 이야기가 우리 학년에도 있었어."},{"situation":"재결합 뉴스를 볼 때","text":"2000년 해체 때 그 충격을 알면, 다시 모였을 때 왜 화제가 됐는지 이해가 돼."}]'::jsonb,
  updated_at = now()
where short_id = 't6jrbnbd'
  and slug = '젝스키스-해체(2000)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4', '젝스키스', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 't6jrbnbd' and meme.slug = '젝스키스-해체(2000)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4'
  );

-- TV는 사랑을 싣고 (vtu3rkyg / TV는-사랑을-싣고)
update public.memes set
  description = 'KBS 프로그램 ‘TV는 사랑을 싣고’는 헤어졌거나 소식이 끊긴 사람을 찾아 주는 휴먼 다큐 형식의 방송으로, 1990년대 큰 시청률과 화제를 모았다. 출연자의 사연과 재회 장면이 많은 가정에서 저녁 이야깃거리가 됐다. 이후 유사 포맷의 재회 프로그램이 이어지며, 그 시대 텔레비전 감성을 대표하는 제목으로 남아 있다.',
  origin = 'TV는 사랑을 싣고는 1994년 5월 3일 시작해 2010년까지 총 805회 방영된 KBS 시사교양·예능 프로그램으로, 제작진이 유명인의 첫사랑·은사·동창 등 지인을 수소문해 찾아주는 형식으로 꾸며졌다. 의뢰인과 지인의 옛 사연을 무명 배우들이 재연하고 김종환·장혜선, 이후 김일 등의 내레이션이 감동을 더하는 구성이 인기를 끌었으며, 1997년 무렵에는 화제성과 시청률 모두 절정에 달하는 전성기를 맞았다. 지인을 찾아주는 리얼리티 포맷의 원조 격 프로그램으로 오랫동안 방영되며 세대를 아우르는 인기를 얻었다.',
  usage_note = '1990년대 휴먼 교양 프로그램을 회상할 때 언급할 수 있다. 실제 이산과 재회 사연을 웃음의 소재로만 소비하지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 교양 프로그램을 이야기할 때","text":"주말에 TV는 사랑을 싣고 틀면 온 가족이 조용히 보게 됐어."},{"situation":"사람을 찾는 이야기를 할 때","text":"지금은 SNS로 찾지만, 그때는 방송 프로그램이 그 역할을 했지."}]'::jsonb,
  updated_at = now()
where short_id = 'vtu3rkyg'
  and slug = 'TV는-사랑을-싣고'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/TV%EB%8A%94_%EC%82%AC%EB%9E%91%EC%9D%84_%EC%8B%A3%EA%B3%A0', 'TV는 사랑을 싣고', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'vtu3rkyg' and meme.slug = 'TV는-사랑을-싣고'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/TV%EB%8A%94_%EC%82%AC%EB%9E%91%EC%9D%84_%EC%8B%A3%EA%B3%A0'
  );

-- 떡밥과 낚시글 (8kz4upjt / 떡밥과-낚시글)
update public.memes set
  description = '인터넷에서 떡밥은 사람의 호기심을 끌어 클릭이나 댓글을 유도하는 미끼성 제목·내용을 뜻하고, 낚시글은 그렇게 끌어들인 뒤 기대와 다른 내용으로 한 번 속이는 글을 가리킨다. 게시판 초창기부터 쓰인 말로, 자극적인 제목의 기사나 영상을 비판할 때도 같이 등장한다. 한겨레 등 한국어 칼럼도 ‘낚시질’이라는 새말을 이 맥락에서 설명한 바 있다.',
  origin = '온라인 게시판 문화에서 미끼를 던진다는 뜻으로 ‘떡밥’과 ‘낚시’가 비유적으로 쓰이기 시작했다. 정확한 첫 사용 시점은 단정하기 어려우나, 2000년대 한국 인터넷에서 이미 널리 퍼진 표현이다. 한국어 위키백과 ‘낚시 (인터넷)’ 항목과 한겨레 말글 칼럼은 독자를 끌기 위한 자극적 제목·글을 이 말로 풀이한다. 이후 뉴스 헤드라인 비판과 커뮤니티 용어로 정착했다.',
  usage_note = '제목과 내용이 다르거나, 관심을 끌기 위한 미끼 글을 지적할 때 쓴다. 상대의 글을 너무 쉽게 낚시로 단정하면 논쟁이 커질 수 있다.',
  caution = caution,
  usage_examples = '[{"situation":"제목만 자극적인 글을 보고","text":"또 낚시글이네. 본문이랑 제목이 완전히 달라."},{"situation":"미리 힌트만 던질 때","text":"떡밥만 던져 두고 내일 알려 줄게. 오늘은 여기까지."}]'::jsonb,
  updated_at = now()
where short_id = '8kz4upjt'
  and slug = '떡밥과-낚시글'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%82%9A%EC%8B%9C_(%EC%9D%B8%ED%84%B0%EB%84%B7)', '낚시 (인터넷)', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '8kz4upjt' and meme.slug = '떡밥과-낚시글'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%82%9A%EC%8B%9C_(%EC%9D%B8%ED%84%B0%EB%84%B7)'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hani.co.kr/arti/opinion/column/146193.html', '[새말탐험] 낚시질 / 김한샘', '한겨레',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '8kz4upjt' and meme.slug = '떡밥과-낚시글'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hani.co.kr/arti/opinion/column/146193.html'
  );

-- 찔러맨 (sw48ahk5 / 찔러맨)
update public.memes set
  description = '찔러맨은 2000년대 초 엽기하우스 등 플래시 사이트에서 인기를 끈 스틱맨 애니메이션 캐릭터다. 단순한 막대 인간 그림체와 과격하고 우스운 액션이 당시 초고속 인터넷 보급과 맞물려 학생들 사이에서 퍼졌다. 겟타맨·졸라맨과 함께 그 시절 ‘맨’ 캐릭터 유행의 한 축으로 기억된다.',
  origin = '2000년대 초 플래시 애니메이션 사이트 엽기하우스를 중심으로 북서니 작가의 스틱맨 작품이 연재되며 찔러맨이 알려졌다. 정확한 첫 회차 날짜는 2차 자료만으로 단정하지 않으나, 시선뉴스 등은 한 시대를 풍미한 ‘맨’ 캐릭터의 흐름 속에서 이 계열 작품을 회고한다. 플래시 아카이브에는 2004년경 찔러맨 뮤직 플래시가 남아 있어, 당시 유통 형태를 확인할 수 있다.',
  usage_note = '2000년대 초 플래시 애니메이션과 엽기 코드를 회상할 때 언급한다. 과격한 개그 장면이 있으므로 어린이에게 무심코 보여 주지는 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"플래시 만화를 회상할 때","text":"그때 학교 컴퓨터실에서 찔러맨 보느라 수업 시작 벨도 놓쳤어."},{"situation":"엽기하우스를 이야기할 때","text":"겟타맨이랑 찔러맨이 그 사이트 대표 스틱맨이었지."}]'::jsonb,
  updated_at = now()
where short_id = 'sw48ahk5'
  and slug = '찔러맨'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://flasharch.com/ko/archive/play/363fd7c21b9a566c88be582e9195ffc1', '찔러맨 뮤직플래시 아카이브', 'Flasharch',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'sw48ahk5' and meme.slug = '찔러맨'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://flasharch.com/ko/archive/play/363fd7c21b9a566c88be582e9195ffc1'
  );

-- 새삥 챌린지 (지코) (89b37mrx / 새삥 챌린지 (지코))
update public.memes set
  description = '‘새삥 챌린지’는 Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥 (Prod. ZICO) (Feat. 호미들)’의 안무를 따라 하는 댄스 챌린지다. The CHOOM 공식 댄스 비디오는 안무가를 위댐보이즈 바타로 표기하며, 바타가 알려주는 공식 안무 튜토리얼도 공개되어 있다.

CJ 공식 뉴스룸은 이 곡의 댄스 비디오와 지코 등 아티스트의 챌린지 참여를 소개한다. 곡을 듣고 감상하는 콘텐츠와 안무를 따라 하는 챌린지는 구분해서 설명한다. 상세 동작 순서는 연결된 공식 댄스 비디오·튜토리얼에서 확인할 수 있으며, 이 문서는 메타데이터만으로 특정 팔 동작이나 단계 수를 단정하지 않는다.',
  origin = '2022년 Mnet 프로그램 스트릿 맨 파이터의 리더 계급 미션곡으로 ‘새삥 (Prod. ZICO) (Feat. 호미들)’이 공개되며 안무 챌린지가 시작됐다. 공식 댄스 비디오는 안무가를 위댐보이즈 바타로 표기하고, 튜토리얼과 아티스트 참여 영상이 이어졌다. CJ 공식 뉴스룸도 댄스 비디오와 챌린지 확산을 소개했다. 이후 숏폼에서 포인트 안무를 따라 하는 대표적인 2022년 댄스 밈이 됐다.',
  usage_note = '공식 안무를 따라 찍은 숏폼이나 챌린지 영상을 소개할 때 쓴다. 동작의 세부 순서는 공식 튜토리얼을 기준으로 확인하고, 추측으로 단계를 단정하지 않는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"댄스 챌린지를 제안할 때","text":"이번 주에는 새삥 챌린지 안무 영상 하나 찍어 보자."},{"situation":"포인트 안무를 보고","text":"저 구간만 나와도 새삥인지 바로 알겠어."}]'::jsonb,
  updated_at = now()
where short_id = '89b37mrx'
  and slug = '새삥 챌린지 (지코)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 바람의나라 (3rqfnny8 / 바람의나라)
update public.memes set
  description = '바람의나라는 1996년 서비스를 시작한 국내 초기 그래픽 온라인 게임으로, 오랜 기간 운영되며 한국 MMORPG의 원조 가운데 하나로 불린다. 서버 공동체와 업데이트, 추억의 필드 이미지가 세대 이야기로 자주 소환된다. PC통신 이후 인터넷 게임 문화가 자리 잡는 과정을 이야기할 때 빼놓기 어려운 작품이다.',
  origin = '바람의나라는 김진의 만화를 원작으로 넥슨이 한국IBM과 공동 개발한 국내 최초의 2차원 그래픽 온라인게임이다. 1994년 12월 기획에 들어가 1995년 12월 25일 PC통신 천리안을 통해 베타테스트를 진행했고, 1996년 4월 5일 정식 서비스를 시작했다. 고구려 대무신왕과 호동왕자, 낙랑공주 설화를 세계관으로 삼아 당시로선 파격적인 그래픽 MMORPG를 선보이며 PC통신 이용자 사이에서 화제를 모았다. 이후 해외 서비스로도 확장돼 2011년에는 세계에서 가장 오래 서비스된 MMORPG로 기네스북에 등재됐다.',
  usage_note = '1990년대 후반~2000년대 온라인 게임 문화를 회상할 때 언급할 수 있다. 현재 서비스 상태와 과거 추억을 섞어 말할 때는 시점을 분명히 하는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 온라인 게임을 이야기할 때","text":"우리 형이 바람의나라 할 때, 집에 전화선 인터넷을 독점했어."},{"situation":"한국 게임 역사를 설명할 때","text":"그래픽 온라인 게임의 초기를 보려면 바람의나라를 빼기 어렵지."}]'::jsonb,
  updated_at = now()
where short_id = '3rqfnny8'
  and slug = '바람의나라'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%B0%94%EB%9E%8C%EC%9D%98_%EB%82%98%EB%9D%BC', '바람의 나라', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '3rqfnny8' and meme.slug = '바람의나라'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%B0%94%EB%9E%8C%EC%9D%98_%EB%82%98%EB%9D%BC'
  );

-- 뿌까 캐릭터 (pg778k4u / 뿌까-캐릭터)
update public.memes set
  description = '뿌까는 붉은 전통 옷과 가리개처럼 가려진 눈이 특징인 한국 캐릭터로, 2000년대 초 플래시 애니메이션과 상품을 통해 국내외에 알려졌다. 짧고 과장된 개그 템포가 당시 인터넷 사용자에게 잘 맞았다. 이후 방송과 라이선스 상품으로 확장되며, 그 시절을 상징하는 캐릭터 지식재산 가운데 하나로 남았다.',
  origin = '뿌까는 김부경이 세운 캐릭터 디자인 회사 부즈(Vooz)가 1999년부터 이미지 설정 작업을 시작해 2000년 발표한 캐릭터다. 이름은 "뽀뽀해 뿌까"라는 표현에서 따왔고, 동양적 인상을 강조하려 그린 찢어진 눈과 리듬감을 살린 양갈래 머리가 우연히 중국 경극 배우를 연상시키는 모습이 됐다. 2001년 부즈 공식 홈페이지에 플래시 애니메이션 ''Pucca Funny Love''가 공개되며 본격적으로 대중에 알려졌고, 이후 전 세계 150개국에 수출되며 한국 대표 캐릭터로 자리매김했다.',
  usage_note = '2000년대 초 캐릭터 애니메이션과 한국산 콘텐츠의 해외 진출을 이야기할 때 언급할 수 있다. 캐릭터 디자인을 패러디할 때는 저작권을 염두에 두는 것이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"옛 플래시 애니메이션을 볼 때","text":"저 눈 가리개 실루엣, 완전 뿌까다."},{"situation":"캐릭터 상품을 이야기할 때","text":"문구점에 뿌까 스티커가 잔뜩 있던 때가 있었지."}]'::jsonb,
  updated_at = now()
where short_id = 'pg778k4u'
  and slug = '뿌까-캐릭터'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Pucca', 'Pucca', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'pg778k4u' and meme.slug = '뿌까-캐릭터'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Pucca'
  );

-- 박카스 '그날의 피로는 그날에' (amhqsvt2 / 박카스-그날의-피로는-그날에)
update public.memes set
  description = '1993년 동아제약은 평범한 직장인·서민을 모델로 한 광고 시리즈를 통해 ‘그날의 피로는 그날에 푼다’는 카피를 선보였다. 담백한 문장과 노동하는 일상의 장면이 오랫동안 회자되며 코미디 프로그램에서도 자주 패러디됐다. 화려한 스타 대신 보통 사람의 피로를 전면에 둔 카피로, 이후 한국 광고 문구의 대표 사례처럼 인용된다.',
  origin = '동아제약은 1976년부터 1993년까지 17년간 정부 규제로 박카스 광고를 하지 못하다가, 1993년 평범한 서민을 모델로 내세운 ''새 한국인'' 시리즈 광고로 복귀했다. ''그날의 피로는 그날에'' 카피는 버스종점 근무자, 환경미화원 등 음지에서 묵묵히 일하는 보통 사람들의 모습을 담은 이 시리즈를 통해 확산됐으며, 1997년까지 총 13편이 제작되며 큰 반향을 얻었다. 화려한 스타 모델 대신 노동하는 시민의 일상을 조명한 휴먼 광고 문법이 이후 국내 공익·기업 광고에 영향을 준 것으로 평가된다.',
  usage_note = '피곤한 하루를 마무리하며 스스로를 다독일 때 인용할 수 있다. 음료 광고 문장이므로, 건강이나 음주 문제를 희화화하는 용도로는 쓰지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"야근을 마치고","text":"오늘은 여기까지. 그날의 피로는 그날에 풀자."},{"situation":"옛 광고를 이야기할 때","text":"박카스 CF 한 줄이 아직도 저녁 인사처럼 쓰이네."}]'::jsonb,
  updated_at = now()
where short_id = 'amhqsvt2'
  and slug = '박카스-그날의-피로는-그날에'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 시티폰 (pnphbt7f / 시티폰)
update public.memes set
  description = '시티폰은 1990년대 후반 한국에서 쓰인 저렴한 도심형 이동전화 서비스로, 일반 휴대폰보다 제한된 방식이었지만 학생과 서민층 사이에 널리 보급됐다. 디지털데일리 등 회고 기사는 드라마 속 소품으로도 자주 등장한 이 기기가, 휴대폰 요금이 비싸던 시대의 대안이었다고 설명한다. 2000년 전후 서비스가 정리되며 일상에서 사라졌고, 지금은 그 시절을 상징하는 통신 기기로 회자된다.',
  origin = '시티폰은 한국통신(현 KT)이 제공한 도심형 이동전화로, 일반 PCS·휴대폰과 다른 제한적 통화 방식이었다. 디지털데일리와 서울경제 보도에 따르면 이용자가 휴대폰으로 옮겨 가며 2000년 1월 26일 서비스가 중단됐다. 비싼 휴대폰을 쓰기 어렵던 학생층에게는 한때 유용한 대안이었고, 이후 복고 드라마의 소품으로도 자주 등장했다.',
  usage_note = '1990년대 통신 문화나 복고 드라마 소품을 이야기할 때 언급할 수 있다. 이동통신 회사와 서비스 주체를 혼동하지 않도록, ‘한국통신의 시티폰’처럼 구체적으로 말하는 편이 정확하다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대를 회상할 때","text":"첫 휴대 기기가 시티폰이었어. 집 밖으로만 나가도 연락이 되니까 신기했지."},{"situation":"복고 드라마를 보다가","text":"저 단말기, 시티폰 맞지? 그때 학생들이 많이 썼잖아."}]'::jsonb,
  updated_at = now()
where short_id = 'pnphbt7f'
  and slug = '시티폰'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.ddaily.co.kr/page/view/2022012109032973484', '[IT발자국] ‘응답하라’ 드라마 속 시티폰, 왜 사라졌을까?', '디지털데일리',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'pnphbt7f' and meme.slug = '시티폰'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.ddaily.co.kr/page/view/2022012109032973484'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sedaily.com/article/10122712', '시티폰 26일부터 서비스 중단', '서울경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'pnphbt7f' and meme.slug = '시티폰'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sedaily.com/article/10122712'
  );

-- 유희왕 카드게임 유행 (hmhac9nw / 유희왕-카드게임-유행)
update public.memes set
  description = '유희왕 카드게임은 동명 만화·애니메이션의 인기에 힘입어 2000년대 초 국내 학생들 사이에서 크게 유행했다. 카드 수집과 대전, 희귀 카드 시세가 학교 안팎의 화제가 됐고, 관련 상품도 많이 팔렸다. 이후에도 시리즈가 이어지며, 그 시절 수집 놀이 문화를 상징하는 이름 가운데 하나로 남았다.',
  origin = '유희왕은 다카하시 가즈키의 만화를 원작으로 한 트레이딩카드게임으로, 국내에는 1999년 도서출판 대원이 만화 한국어판을 정발하며 먼저 알려졌다. 이후 만화의 인기를 발판 삼아 카드게임이 함께 확산됐고, 2000년대 초 전국 곳곳에 카드게임 전문점이 생겨나며 초등학생 사이에서 카드를 모으고 대결을 벌이는 문화가 자리잡았다. 오컬트물로 시작한 원작이 카드 듀얼을 중심 소재로 바꾼 뒤 세계적인 흥행작으로 성장한 과정이 국내 유행의 배경으로 알려져 있다.',
  usage_note = '2000년대 초 카드 게임 열풍과 수집 문화를 이야기할 때 언급할 수 있다. 실제 카드의 금전 거래나 도박성 내기를 미화하지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"학창 시절을 회상할 때","text":"쉬는 시간마다 책상에 유희왕 카드 펼쳐 놓고 대전했었어."},{"situation":"수집 열풍을 비교할 때","text":"포켓몬빵 띠부씰이랑 비슷하게, 그때는 유희왕 카드가 그 역할을 했지."}]'::jsonb,
  updated_at = now()
where short_id = 'hmhac9nw'
  and slug = '유희왕-카드게임-유행'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Yu-Gi-Oh!', 'Yu-Gi-Oh!', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'hmhac9nw' and meme.slug = '유희왕-카드게임-유행'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Yu-Gi-Oh!'
  );

-- 펌프 잇업 (8eacrtkx / 펌프-잇업)
update public.memes set
  description = '펌프 잇 업은 발판을 밟아 리듬에 맞추는 아케이드 음악 게임으로, 1999년 전후 국내 오락실을 중심으로 크게 유행했다. 어려운 채보를  클리어하는 하는 문화와 대회, 학교 앞 오락실 풍경이 2000년대 초 청소년 문화의 일부가 됐다. 이후 시리즈가 이어지며 리듬 게임의 대표 이름 가운데 하나로 남았다.',
  origin = '국내 업체 안다미로는 일본 DDR이 오락실을 휩쓸던 1999년, 이를 겨냥한 국산 리듬게임 ''펌프 잇 업''을 처음 출시했다. 발판 배치와 곡 구성을 국내 정서에 맞게 다듬은 것이 주효해 2000년 무렵 DDR을 밀어내고 오락실 리듬게임 시장을 평정했다. 거리에서 브레이크댄스를 연습하던 청소년들이 조명이 켜진 펌프 기계 위로 몰려들면서 단순한 게임을 넘어선 하나의 놀이 문화로 발전했다는 평가를 받는다. 이후 디아블로2 흥행으로 오락실 인구가 PC방으로 옮겨가며 열풍은 점차 잦아들었다.',
  usage_note = '1990년대 말~2000년대 오락실 리듬 게임 문화를 이야기할 때 언급할 수 있다. 실제 기기에서 무리한 발판 플레이는 부상 위험이 있으니 자랑처럼 부추기지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"오락실을 회상할 때","text":"하굣길에 펌프 잇 업 한 판 하고 집에 가던 때가 있었지."},{"situation":"리듬 게임을 비교할 때","text":"요즘 리듬 게임 보면 펌프 잇 업이 원조처럼 느껴져."}]'::jsonb,
  updated_at = now()
where short_id = '8eacrtkx'
  and slug = '펌프-잇업'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Pump_It_Up', 'Pump It Up', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '8eacrtkx' and meme.slug = '펌프-잇업'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Pump_It_Up'
  );

-- H.O.T. 캔디 (mzgvq8xt / H.O.T.-캔디)
update public.memes set
  description = 'H.O.T.의 ‘캔디’는 1990년대 후반 한국 아이돌 문화를 상징하는 대표곡 가운데 하나다. 밝은 멜로디와 중독성 있는 후렴, 팬덤 응원 문화가 겹치며 당시 10대에게 큰 인기를 끌었다. 이후에도 복고 공연과 미디어에서 반복 소환되며, 1세대 아이돌의 시작을 이야기할 때 자주 언급된다.',
  origin = '1996년 H.O.T. 1집 후속곡으로, 원래 SM은 ''캔디''를 타이틀곡으로 밀었으나 멤버들의 의견에 따라 ''전사의 후예''가 먼저 발표됐다. 이 곡이 표절 논란으로 활동을 중단하면서 후속곡으로 ''캔디'' 활동이 시작됐고, 곡을 작곡한 장용진은 당시 H.O.T. 멤버들과 동갑인 고등학생이었다고 알려져 있다. 문희준의 파워레이서춤, 장우혁의 망치춤 등 멤버별 안무와 함께 털모자·털옷 패션이 10대 사이에서 유행하며 아이돌 최초의 메가 히트곡이자 길거리 패션 신드롬을 만들었다.',
  usage_note = '1세대 아이돌과 1990년대 후반 팬 문화를 이야기할 때 대표곡으로 언급할 수 있다. 응원 도구와 떼창 문화를 함께 설명하면 맥락이 더 분명해진다.',
  caution = caution,
  usage_examples = '[{"situation":"90년대 노래를 들을 때","text":"이 후렴 나오니 완전 H.O.T. 캔디 시절이야."},{"situation":"아이돌 역사를 설명할 때","text":"1세대 아이돌 하면 많은 사람이 캔디부터 떠올려."}]'::jsonb,
  updated_at = now()
where short_id = 'mzgvq8xt'
  and slug = 'H.O.T.-캔디'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/H.O.T.', 'H.O.T.', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'mzgvq8xt' and meme.slug = 'H.O.T.-캔디'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/H.O.T.'
  );

-- 겟타맨 (8e9dyfqp / 겟타맨)
update public.memes set
  description = '겟타맨은 2000년대 초 엽기하우스 등에서 유행한 스틱맨 플래시 애니메이션으로, 막대 인간 히어로가 과격하고 우스운 액션을 펼치는 구성이 특징이다. 찔러맨·졸라맨과 함께 그 시절 인터넷 동영상 문화를 상징하는 ‘맨’ 캐릭터로 기억된다. 시선뉴스 등 회고 기사는 한 시대를 풍미했던 각종 ‘맨’ 콘텐츠의 흐름 속에서 이 계열 작품을 언급한다.',
  origin = '2000년대 초 초고속 인터넷과 플래시 애니메이션이 겹치며 엽기하우스를 중심으로 스틱맨 작품이 크게 퍼졌다. 겟타맨은 그 흐름 속에서 히어로물을 패러디한 막대 인간 애니메이션으로 학생층에게 인기를 끌었다. 정확한 첫 공개 일자는 2차 자료만으로 단정하지 않으나, 시선뉴스의 회고와 유튜브 재업로드를 통해 당시 유행의 존재는 확인할 수 있다.',
  usage_note = '2000년대 초 플래시 애니메이션과 엽기 코드를 회상할 때 언급한다. 과격한 개그가 섞여 있으므로 어린 시청자에게 무심코 재생하지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"플래시 만화를 회상할 때","text":"컴퓨터 시간마다 겟타맨 돌리던 친구들이 꼭 있었어."},{"situation":"엽기 콘텐츠를 설명할 때","text":"그 시절 스틱맨 히어로라면 겟타맨이 바로 떠올라."}]'::jsonb,
  updated_at = now()
where short_id = '8e9dyfqp'
  and slug = '겟타맨'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sisunnews.co.kr/news/articleView.html?idxno=31370', '기억 속 저편, 한 시대를 풍미했던 각종 ‘맨’들', '시선뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '8e9dyfqp' and meme.slug = '겟타맨'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sisunnews.co.kr/news/articleView.html?idxno=31370'
  );

-- 스티커사진 (n5s5eq5p / 스티커사진)
update public.memes set
  description = '1995년 일본에서 유행한 프린트클럽을 본떠 1990년대 후반 국내에 도입된 스티커사진관은, 디지털카메라가 흔치 않던 시절 즉석으로 사진을 뽑아 주고 여학생들 사이에서 큰 인기를 끌었다. 오락실과 문구점 앞이 주요 장소였다. 이후 카메라폰 보급으로 한풀 꺾였다가, 인생네컷 같은 무인 사진관 문화로 형태를 바꿔 다시 소환됐다.',
  origin = '1995년 일본 아틀루스가 출시한 프린트클럽(プリント倶楽部)이 일본에서 선풍적 인기를 끈 뒤, 1996~1998년경 국내에도 즉석 스티커사진 자판기가 도입됐다. 디지털카메라가 보급되기 전 손쉽게 즉석에서 사진을 인화할 수 있다는 점이 여학생들 사이에서 큰 호응을 얻으며 오락실·문구점 앞을 중심으로 급속히 퍼졌고, 1990년대 후반 청소년 문화를 상징하는 놀이로 자리잡았다. 2000년대 들어 디지털카메라·휴대폰 카메라 보급으로 한풀 꺾였다가, 2010년대 말 뉴트로 열풍을 타고 ''인생네컷'' 등 무인 셀프사진관 형태로 부활했다.',
  usage_note = '1990년대 말~2000년대 초 학생 문화를 회상할 때 언급할 수 있다. 지금의 셀프 사진관과 비교하면 이해가 쉽다.',
  caution = caution,
  usage_examples = '[{"situation":"학창 시절 사진을 보다가","text":"이거 완전 스티커사진 시절 포즈다."},{"situation":"인생네컷을 찍으며","text":"우리 때는 스티커사진관이 이 역할이었어."}]'::jsonb,
  updated_at = now()
where short_id = 'n5s5eq5p'
  and slug = '스티커사진'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 기억의 습작 (9gzfuejc / 기억의-습작)
update public.memes set
  description = '김동률의 ‘기억의 습작’은 1990년대 한국 대중음악에서 자주 소환되는 발라드다. 섬세한 가사와 멜로디가 대학 시절과 첫사랑의 정서를 담은 곡으로 받아들여지며, 노래방과 라디오를 통해 오랫동안 불렸다. 세대를 넘어 잔잔한 회고의 배경음악처럼 쓰이기도 한다. 김동률의 초기 대표곡으로, 지금도 첫사랑이나 캠퍼스 정서를 이야기할 때 자주 소환된다.',
  origin = '김동률과 서동욱은 1993년 12월 MBC 대학가요제에 2인조 듀오 전람회로 출전해 대상과 특별상을 받았다. 이듬해인 1994년, 신해철·김형석 등이 제작에 참여한 1집 앨범 《Exhibition》을 발표했고, 그 첫 트랙이 기억의 습작이었다. 작사·작곡·편곡을 모두 맡은 김동률의 섬세한 멜로디로 발매 당시부터 사랑받은 곡이다. 2012년 개봉한 영화 <건축학개론>에 삽입되며 다시 한 번 대중적으로 크게 주목받아 음원 차트에 역주행했고, 이후 세대를 넘어 한국 발라드의 대표곡으로 자리매김했다.',
  usage_note = '1990년대 발라드와 청춘의 정서를 이야기할 때 대표곡으로 언급할 수 있다. 개인 추억에 붙일 때는 상대가 곡을 아는 자리에서 더 자연스럽다.',
  caution = caution,
  usage_examples = '[{"situation":"노래방에서","text":"이 분위기면 기억의 습작이 맞다."},{"situation":"옛 노래를 추천할 때","text":"잔잔한 90년대 발라드를 찾는다면 김동률의 기억의 습작부터 들어 봐."}]'::jsonb,
  updated_at = now()
where short_id = '9gzfuejc'
  and slug = '기억의-습작'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EA%B9%80%EB%8F%99%EB%A5%A0', '김동률', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '9gzfuejc' and meme.slug = '기억의-습작'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EA%B9%80%EB%8F%99%EB%A5%A0'
  );

-- 이정현 '바꿔'·'와' (qqu8andb / 이정현-바꿔·와)
update public.memes set
  description = '1999년 발표된 이정현의 ‘와’는 그해 하반기 테크노 열풍을 이끌며 긴 기간 인기를 끌었다. 외눈이 그려진 빨간 부채와 새끼손가락 마이크, 무당을 연상시키는 의상이 세기말 분위기를 상징하는 파격적 콘셉트로 화제가 됐다. 후속곡 ‘바꿔’의 기계 날개 의상도 강한 인상을 남기며, 이정현은 ‘테크노 여전사’라는 별명으로 불렸다.',
  origin = '1999년 10월 20일 발매된 이정현 1집 ''Let''s Go To My Star''의 타이틀곡 ''와''에서 비롯된 콘셉트다. 붉은 외눈 부채, 손가락 마이크, 긴 비녀와 무속적 분위기의 의상 등 파격적인 스타일링은 소속사 내부에서도 강한 반발을 샀을 정도로 시대를 앞선 것이었다고 알려져 있다. 이 콘셉트가 1999년 하반기 가요계를 휩쓸던 테크노 열풍을 대중적 신드롬으로 키우면서 이정현은 ''테크노 여전사''라는 별명을 얻었다.',
  usage_note = '1999년 세기말 테크노 콘셉트의 대표 사례로 언급할 수 있다. 의상과 소품이 강렬하니, 문화 현상으로 설명할 때 과장된 조롱은 줄이는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"situation":"세기말 음악을 이야기할 때","text":"부채 들고 나오는 장면만 봐도 이정현의 ‘와’야."},{"situation":"1999년 가요를 회고할 때","text":"그해 테크노 하면 이정현의 와와 바꿔를 빼놓기 어렵지."}]'::jsonb,
  updated_at = now()
where short_id = 'qqu8andb'
  and slug = '이정현-바꿔·와'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%A0%95%ED%98%84', '이정현', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'qqu8andb' and meme.slug = '이정현-바꿔·와'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%A0%95%ED%98%84'
  );

-- 과자 사꾸 (ajvzf7pk / 과자-사꾸)
update public.memes set
  description = '과자 포장지에 인쇄된 글자만 골라 원하는 문구를 만든 뒤 사진으로 찍어 SNS에 인증하는 트렌드다. 해외에서 맥도날드 감자튀김 봉지의 M 로고로 Miss you 문구를 만들던 트렌드로 출발해, 국내에서는 오리온 나! 과자로 "나 지금 퇴근해" 같은 문장을 만드는 방식으로 번졌다. 이후 활용 범위가 좋아하는 과자 전체로 넓어지며 2026년 상반기 SNS 밈 아카이브에서 정점 단계 밈으로 꼽혔다.',
  origin = '해외에서 맥도날드 감자튀김 봉지의 M 로고에 글자를 붙여 ‘Miss you’ 같은 문구를 만들던 인증 놀이가 선행 사례로 알려져 있다. 국내에서는 오리온 ‘나!’ 과자 포장의 글자를 이용해 짧은 문장을 만드는 방식으로 변형됐고, 이후 다양한 과자 봉지로 범위가 넓어졌다. 오픈애즈·위픽 등 트렌드 소개 글이 2026년 상반기 SNS에서 이 놀이를 정리하며 이름이 더 퍼졌다.',
  usage_note = '과자 봉지의 글자를 조합해 짧은 문장을 만들고 사진으로 공유할 때 쓴다. 상표를 훼손하거나 쓰레기를 함부로 버리지 않도록 주의하는 말이 함께 따라온다.',
  caution = caution,
  usage_examples = '[{"text":"이 과자 봉지에서 ㄴ 찾았다ㅋㅋ 오늘 드디어 퇴근함, 과자사꾸 인증","situation":"인스타 스토리"},{"text":"야 이 과자 봉지 글자 조합하면 딱 네 이름 나와, 완전 과자사꾸각이야","situation":"친구 채팅"}]'::jsonb,
  updated_at = now()
where short_id = 'ajvzf7pk'
  and slug = '과자-사꾸'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 슬릭백 챌린지 (7nh5djcf / 슬릭백-챌린지)
update public.memes set
  description = '2022년 미국 틱톡커 jubi2fye가 시작한 춤으로, LAKIM의 ''A Pimp Named Slickback''을 배경음악 삼아 양발을 번갈아 미끄러뜨리며 걷는 동작이 특징이다. 2023년 10월 한국 중학생 이효철의 영상이 20일 만에 조회수 2억 회를 돌파하며 국내에서 폭발적으로 유행했고, 마침 화제였던 초전도체 밈과 결합해 ''초전도체 춤''으로도 불렸다.',
  origin = '2022년 미국 틱톡 사용자 jubi2fye가 LAKIM의 곡 ‘A Pimp Named Slickback’에 맞춰 옆으로 미끄러지듯 걷는 춤을 선보이며 시작됐다. 2023년 10월 한국 중학생 이효철의 영상이 짧은 기간에 수억 회 조회수를 기록하며 국내에서 폭발적으로 퍼졌고, 당시 화제였던 초전도체 밈과 결합해 ‘초전도체 춤’으로도 불렸다. 공식 음원과 숏폼 플랫폼을 통해 전 세계적으로 확산된 왁킹 계열 챌린지다.',
  usage_note = '숏폼에서 슬릭백 안무를 따라 하거나, 2023년 춤 유행을 회고할 때 언급한다. 동작 난이도가 높아 따라하다 다칠 수 있다는 보도가 있었으므로 무리하게 강요하지 않는 편이 좋다.',
  caution = '난이도가 높아 따라하다 다칠 수 있다는 보도가 있었음',
  usage_examples = '[{"text":"너 슬릭백 할 줄 알아? 한번 보여 줘","situation":"쉬는 시간 교실에서"},{"text":"뭐야, 슬릭백 하면서 오는 줄","situation":"친구가 빨리 걸어올 때"}]'::jsonb,
  updated_at = now()
where short_id = '7nh5djcf'
  and slug = '슬릭백-챌린지'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 평창올림픽 팀추월 왕따 논란 (db3bd33n / 평창올림픽-팀추월-왕따-논란)
update public.memes set
  description = '2018년 2월 19일 평창올림픽 스피드스케이팅 여자 팀추월 준준결승에서 김보름·박지우와 노선영 사이에 큰 거리 차이가 나며 결승선을 통과했고, 중계진의 지적으로 ''왕따 주행'' 의혹이 확산됐다. 문화체육관광부 조사 결과 선수 고의는 없었으며 코치진의 지시 미흡이 원인으로 결론났지만, 김보름은 이미 큰 여론의 뭇매를 맞아 심리치료까지 받아야 했다. 김보름은 이후 노선영을 상대로 손해배상 소송을 제기해 일부 승소했고, 2025년 말 현역 은퇴를 선언했다.',
  origin = '2018년 2월 평창 동계올림픽 여자 스피드스케이팅 팀추월에서 노선영이 김보름·박지우와 크게 벌어져 결승선을 통과한 장면이 중계되며 ‘왕따 주행’ 논란이 일었다. BBC와 연합뉴스 등은 경기 후 선수 간 갈등과 협회 소통 문제가 도마에 올랐다고 보도했다. 이후 감사에서는 고의 감속·가속은 확인되지 않았고, 팀 내 의사소통 부족이 지적됐다. 스포츠 윤리와 팀워크를 둘러싼 사회적 논쟁으로 남았다.',
  usage_note = '언론 중계가 여론을 왜곡한 대표 사례로 미디어 리터러시 논의에도 인용된다.',
  caution = '이후 조사로 왕따 의혹이 사실이 아니라고 밝혀졌으므로 사실관계를 왜곡해 서술하지 않도록 주의.',
  usage_examples = '[{"situation":"스포츠 논란을 회고할 때","text":"평창 팀추월 논란은 경기 결과보다 팀 내 소통 문제가 더 오래 기억돼."},{"situation":"중계를 다시 이야기할 때","text":"그 장면만 잘라 보면 오해가 커질 수 있어. 당시 감사 결과까지 같이 봐야 해."}]'::jsonb,
  updated_at = now()
where short_id = 'db3bd33n'
  and slug = '평창올림픽-팀추월-왕따-논란'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.bbc.com/korean/news-43140165', '평창올림픽: 팀추월에 드러난 문제점', 'BBC News 코리아',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'db3bd33n' and meme.slug = '평창올림픽-팀추월-왕따-논란'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.bbc.com/korean/news-43140165'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20180523041400007', '평창 팀추월 ''지독한 불통''이 왕따 주행 불렀다', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'db3bd33n' and meme.slug = '평창올림픽-팀추월-왕따-논란'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20180523041400007'
  );

-- 강정호 3회 음주운전 사건 (56hnkxyk / 강정호-3회-음주운전-사건)
update public.memes set
  description = '강정호는 2009년, 2011년에 이어 2016년 12월 음주 상태로 가드레일을 들이받고 도주해 세 번째 음주운전 적발과 함께 뺑소니 혐의까지 받았다. 법원은 그에게 징역 8개월에 집행유예 2년을 선고했고, 동승자에게 대신 운전했다는 거짓 진술을 시킨 사실도 드러났다. 이 전력으로 KBO 복귀가 사실상 불가능해졌고, 2018년 말에야 메이저리그로 복귀할 수 있었다.',
  origin = '강정호는 2009년과 2011년에 이어 2016년 12월 음주 운전으로 세 번째 적발됐고, 사고 후 자리를 뜬 뺑소니 혐의까지 받았다. 연합뉴스 등 당시 보도와 영어 위키백과 선수 항목이 이 경위를 기록한다. 법원은 징역형에 집행유예를 선고했고, 이 전력은 이후 국내 복귀 논란의 핵심이 됐다. 선수 개인의 반복된 범죄 이력으로, 가십이 아니라 사실 관계로 다루어야 하는 사건이다.',
  usage_note = '선수 개인의 반복된 음주운전 범죄 실화이므로 유희적으로만 소비하지 않도록 주의.',
  caution = '음주운전 3범이라는 중대 범죄 이력을 다루므로 미화하지 않도록 주의가 필요하다.',
  usage_examples = '[{"situation":"스포츠 범죄를 설명할 때","text":"강정호 음주운전 사건은 한 번의 실수가 아니라 반복된 전과가 핵심이야."},{"situation":"복귀 논의를 보다가","text":"2016년 세 번째 적발과 뺑소니 혐의를 빼고는 이 사안을 말하기 어려워."}]'::jsonb,
  updated_at = now()
where short_id = '56hnkxyk'
  and slug = '강정호-3회-음주운전-사건'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20161206115151004', '강정호 "팬들에 너무 죄송…야구로 보답할 일밖에 없어"(종합)', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '56hnkxyk' and meme.slug = '강정호-3회-음주운전-사건'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20161206115151004'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Jung-ho_Kang', 'Jung-ho Kang', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '56hnkxyk' and meme.slug = '강정호-3회-음주운전-사건'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Jung-ho_Kang'
  );

-- 2026년 롯데 자이언츠 원정 도박 사건 (utxgy8un / 2026년-롯데-자이언츠-원정-도박-사건)
update public.memes set
  description = '2026년 2월 롯데 자이언츠 소속 고승민·김동혁·김세민·나승엽이 대만 타이난 전지훈련 중 현지 불법 도박장을 이용한 사실이 드러났다. 구단은 즉각 이들을 귀국 조치했고, KBO 상벌위원회는 김동혁에게 50경기, 나머지 3명에게 각 30경기 출장정지 징계를 내렸다. 사건 여파로 구단 유튜브 콘텐츠 업로드까지 무기한 중단되는 등 파장이 컸다.',
  origin = '2026년 2월 롯데 자이언츠 소속 고승민·김동혁·김세민·나승엽이 대만 타이난 전지훈련 중 현지에서 불법으로 분류되는 도박장을 이용한 사실이 드러났다. 연합뉴스는 구단이 즉각 귀국 조치하고 KBO에 신고했다고 보도했다. KBO 상벌위원회는 김동혁에게 50경기, 나머지 3명에게 각 30경기 출장 정지 징계를 내렸고, 이후 수사 공조가 이어졌다는 후속 보도도 나왔다.',
  usage_note = '최근 발생한 실제 징계 사건으로, 선수 개인 비난 목적의 조롱은 지양해야 한다.',
  caution = '현재진행형 징계 사건이므로 사실관계 확인 없이 추측성 서술을 덧붙이지 않도록 주의.',
  usage_examples = '[{"situation":"프로야구 징계 뉴스를 볼 때","text":"롯데 원정 도박 사건은 스프링캠프 중 벌어진 일이라 구단 전체가 타격을 입었어."},{"situation":"스포츠 윤리 이야기를 할 때","text":"이 사안은 농담으로 소비하기보다, 발표된 징계와 보도를 기준으로 말해야 해."}]'::jsonb,
  updated_at = now()
where short_id = 'utxgy8un'
  and slug = '2026년-롯데-자이언츠-원정-도박-사건'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.yna.co.kr/view/AKR20260213190700007', '프로야구 롯데, 대만서 4명 불법도박장 출입인정…즉각 귀국조처', '연합뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'utxgy8un' and meme.slug = '2026년-롯데-자이언츠-원정-도박-사건'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.yna.co.kr/view/AKR20260213190700007'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.sportschosun.com/baseball/2026-05-05/202605050100020530001335', '사행성 베팅 징계 끝. 롯데 고승민 김세민 나승엽', '스포츠조선',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'utxgy8un' and meme.slug = '2026년-롯데-자이언츠-원정-도박-사건'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.sportschosun.com/baseball/2026-05-05/202605050100020530001335'
  );

-- 나만 아니면 돼 (ah2zk3m5 / 나만 아니면 돼)
update public.memes set
  description = 'KBS 예능 ''1박 2일''에서 복불복 게임이 끝난 뒤 벌칙을 피한 멤버들이 "나만 아니면 돼!"라고 외치던 데서 나왔다. 처음에는 노홍철이 실내 취침에 당첨되며 외쳤고, 이후 강호동이 과장된 표정과 동작으로 자주 외치며 짤로 남았다. 원래는 운 좋게 살아남은 자신을 축하하는 말이었지만, 지금은 남의 불행을 보며 "나는 괜찮다"고 놀리는 뜻으로도 쓴다.',
  origin = 'KBS 예능 ‘1박 2일’의 복불복 게임에서 벌칙을 피한 멤버들이 “나만 아니면 돼!”라고 외치던 장면이 출발점이다. 초기에 노홍철이 실내 취침에 당첨되며 외친 말이, 이후 강호동의 과장된 리액션과 함께 반복 방송되며 짤로 남았다. 유튜브 레전드 모음과 프로그램 위키 항목을 통해 원출처가 확인된다. 원래는 운 좋게 살아남은 자신을 자축하는 말이었으나, 지금은 남의 불행을 보며 안도하는 이기심을 희화할 때도 쓴다.',
  usage_note = '가벼운 복불복이나 벌칙 게임에서 살아남았을 때 장난으로 쓴다. 상대가 실제로 곤란한 상황에 붙이면 조롱으로 들린다.',
  caution = '남이 진짜로 곤란한 상황에 쓰면 조롱으로 들린다.',
  usage_examples = '[{"text":"나만 아니면 돼~!","situation":"제비뽑기에서 청소 당번을 피했을 때"},{"text":"복불복이여 영원하라, 나만 아니면 돼!","situation":"게임이 끝나고"}]'::jsonb,
  updated_at = now()
where short_id = 'ah2zk3m5'
  and slug = '나만 아니면 돼'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/1%EB%B0%95_2%EC%9D%BC', '1박 2일', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'ah2zk3m5' and meme.slug = '나만 아니면 돼'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/1%EB%B0%95_2%EC%9D%BC'
  );

-- 니가 가라 하와이 (xyfnse8f / 니가-가라-하와이)
update public.memes set
  description = '2001년 영화 ''친구''에서 한동수(장동건)가 어릴 적 친구 이준석(유오성)에게 하는 대사다. 준석이 동수를 위해 하와이로 잠시 피해 있으라고 하자, 동수는 부산 사투리로 "니가 가라, 하와이"라고 거절한다. 무거운 장면이지만 짧고 강한 말투 때문에 크게 유행했다. 지금은 귀찮은 일을 떠넘길 때 "네가 해라"라는 뜻으로 장난스럽게 쓴다.',
  origin = '2001년 개봉한 곽경택 감독의 영화 ‘친구’에서 한동수(장동건)가 이준석(유오성)에게 하는 부산 사투리 대사다. 하와이로 잠시 피하라는 권유를 거절하며 “니가 가라, 하와이”라고 말하는 장면이 짧고 강한 어조 때문에 크게 유행했다. 영어 위키백과 영화 항목과 영상 클립을 통해 출처를 확인할 수 있다. 이후 귀찮은 일을 떠넘길 때 “네가 해라”는 뜻의 장난스러운 인용구가 됐다.',
  usage_note = '친한 사이에서 심부름이나 귀찮은 일을 미룰 때, 또는 영화 명대사를 패러디할 때 쓴다. 실제 폭력이나 조직 서사를 흉내 내는 용도로는 쓰지 않는 편이 좋다.',
  caution = caution,
  usage_examples = '[{"text":"나 말고 니가 가라 하와이","situation":"편의점 심부름을 미룰 때"},{"text":"니가 가라 하와이는 지금 들어도 명대사다","situation":"영화 이야기"}]'::jsonb,
  updated_at = now()
where short_id = 'xyfnse8f'
  and slug = '니가-가라-하와이'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Friend_(2001_film)', 'Friend (2001 film)', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'xyfnse8f' and meme.slug = '니가-가라-하와이'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Friend_(2001_film)'
  );

-- 파이어 누들 챌린지 (불닭볶음면 챌린지) (cg9uvyv5 / 파이어-누들-챌린지-(불닭볶음면-챌린지))
update public.memes set
  description = '2014년 유튜브 채널 ''영국남자''의 조쉬가 선물받은 불닭볶음면을 먹는 영상을 올린 것을 계기로 해외 유튜버들 사이에서 ''Fire Noodle Challenge''로 확산됐다. 삼양식품이 별도 마케팅 개입 없이 소비자들의 자발적 챌린지 확산에 힘입어 불닭볶음면을 ''K-매운맛''의 상징으로 키운 대표 사례로 꼽힌다.',
  origin = '삼양식품의 불닭볶음면이 2012년 출시된 뒤, 2014년 유튜브 채널 ‘영국남자’의 조쉬가 이 면을 먹는 영상을 올리며 해외에서 Fire Noodle Challenge로 퍼졌다. 별도의 대규모 광고보다 자발적 시식 영상이 누적되며 ‘K-매운맛’ 상징이 됐다. 한국어 위키백과 불닭볶음면 항목과 원영상 재공유를 통해 이 경위를 확인할 수 있다.',
  usage_note = '매운 음식 챌린지 소재로 활용, 과도한 매운맛 섭취 주의 문구를 함께 안내',
  caution = '매운맛으로 인한 신체 반응(복통·화상감)이 있을 수 있어 무리한 섭취는 권장하지 않음',
  usage_examples = '[{"situation":"매운맛 챌린지를 이야기할 때","text":"불닭볶음면 챌린지는 외국 유튜버들이 먼저 크게 키운 경우야."},{"situation":"도전 영상을 보기 전에","text":"파이어 누들 챌린지는 재미있어도, 너무 매운 음식은 억지로 먹지 않는 게 좋아."}]'::jsonb,
  updated_at = now()
where short_id = 'cg9uvyv5'
  and slug = '파이어-누들-챌린지-(불닭볶음면-챌린지)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%B6%88%EB%8B%AD%EB%B3%B6%EC%9D%8C%EB%A9%B4', '불닭볶음면', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'cg9uvyv5' and meme.slug = '파이어-누들-챌린지-(불닭볶음면-챌린지)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%B6%88%EB%8B%AD%EB%B3%B6%EC%9D%8C%EB%A9%B4'
  );

-- 설거지론 (f6dvsvvv / 설거지론)
update public.memes set
  description = '주식 갤러리에서 쓰이던 은어 ''설거지''(수익을 챙긴 뒤 넘긴다는 뜻)에서 파생되어, 연애 경험이 많은 상대와 결혼하는 것을 비합리적 선택이라 주장하는 담론으로 확산되었다. 2021년 하반기부터 퍼지기 시작해 2022년까지 온라인 커뮤니티에서 계속 회자되며 젠더 갈등을 부추긴다는 비판을 받았다.',
  origin = '주식 갤러리 등 온라인 남성 커뮤니티에서 쓰이던 은어 ‘설거지’(수익을 챙긴 뒤 넘긴다는 뜻)에서 파생된 담론이다. 2021년 하반기부터 퍼져 2022년까지 크게 논쟁됐으며, 연애 경험이 많은 상대와의 결혼을 비하적으로 비유하는 말로 쓰였다. 한국일보와 뉴스핌 등은 이 표현이 여성을 대상화하고 젠더 갈등을 부추긴다는 비판을 보도했다. 일상 대화에서 긍정적으로 쓸 표현이 아니다.',
  usage_note = '성별 갈등을 조장하는 표현이므로 일반적인 용도로 사용하지 않는 것이 좋음',
  caution = '여성혐오적 시각이라는 비판이 큰 논쟁적 담론으로, 일상적 대화나 콘텐츠에 인용하면 갈등을 유발할 수 있음',
  usage_examples = '[{"situation":"온라인 담론을 설명할 때","text":"설거지론은 유행어라기보다, 젠더 갈등을 키운 혐오적 비유로 이해하는 편이 정확해."},{"situation":"관련 표현을 봤을 때","text":"그 말은 사람을 낮추는 비유라서, 그냥 따라 쓰지 않는 게 좋아."}]'::jsonb,
  updated_at = now()
where short_id = 'f6dvsvvv'
  and slug = '설거지론'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.hankookilbo.com/news/article/A2021102611400003375', '온라인 달구는 ''설거지론''이 뭐길래...''남성 자조'' 놀이가 된 여성 혐오', '한국일보',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'f6dvsvvv' and meme.slug = '설거지론'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.hankookilbo.com/news/article/A2021102611400003375'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.newspim.com/news/view/20211230000767', '[2021 갈등] ④ ''설거지론''·''퐁퐁남''…젠더갈등 노골화', '뉴스핌',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'f6dvsvvv' and meme.slug = '설거지론'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.newspim.com/news/view/20211230000767'
  );

-- 테스형 (t2fpqhcs / 테스형)
update public.memes set
  description = '가황 나훈아가 2020년 8월 발매한 정규 9집 타이틀곡 ''테스형!''은 아버지에 대한 그리움을 소크라테스에게 말 걸듯 풀어낸 노래다. 2020년 한가위 특별공연 ''대한민국 어게인 나훈아''에서 열창하며 폭발적인 인기를 얻었고, 세상이 왜 이러냐고 묻는 후렴구가 온갖 상황에 빗대 패러디되는 만능 유행어로 자리 잡았다.',
  origin = '나훈아가 2020년 8월 20일 발매한 정규 9집 ‘아홉 이야기’의 타이틀곡 ‘테스형!’에서 비롯됐다. 같은 해 추석 특별공연 ‘대한민국 어게인 나훈아’에서 이 노래를 부르며 크게 화제가 됐고, 소크라테스에게 세상사를 묻는 후렴이 만능 패러디 구호가 됐다. 가수와 곡의 존재는 한국어 위키백과 나훈아 항목과 공연 영상으로 확인된다.',
  usage_note = '''테스형'' 자리에 다른 대상을 넣어 세상 답답함을 하소연할 때 쓰기 좋다',
  caution = caution,
  usage_examples = '[{"situation":"세상 일이 답답할 때","text":"테스형, 세상이 왜 이래. 오늘 일정만 세 번 바뀌었어."},{"situation":"공연 영상을 보다가","text":"나훈아 테스형 무대는 한번 보면 후렴이 계속 떠올라."}]'::jsonb,
  updated_at = now()
where short_id = 't2fpqhcs'
  and slug = '테스형'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EB%82%98%ED%9B%88%EC%95%84', '나훈아', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 't2fpqhcs' and meme.slug = '테스형'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EB%82%98%ED%9B%88%EC%95%84'
  );

-- 고마워요 사토 (G.G.사토) (bucts34h / 고마워요-사토-(G.G.사토))
update public.memes set
  description = '2008 베이징올림픽 야구 준결승 한일전에서 일본 대표 G.G.사토가 고영민의 뜬공을 놓치는 실책을 저질러 한국의 승리에 기여했다. 허구연 해설위원이 중계에서 ''고마워요 사토''라 말한 것이 계기가 되어, 이후 국제대회에서 상대팀 선수의 대형 실수가 한국에 유리하게 작용할 때 ''고마워요 OO''라 부르는 밈으로 자리잡았다. 10년이 넘게 지나도 이 장면은 ''세기의 낙구''로 회자된다.',
  origin = '2008년 베이징 올림픽 야구 준결승 한일전에서 일본 대표 G.G.사토가 고영민의 뜬공을 놓치는 실책을 범했다. 허구연 해설위원이 중계에서 ‘고마워요 사토’라고 말한 것이 널리 퍼지며, 이후 국제대회에서 상대의 큰 실수가 한국에 유리하게 작용할 때 ‘고마워요 OO’로 패러디되는 밈이 됐다. 노컷뉴스와 아시아경제 등이 이 장면과 발언을 회고한 바 있다.',
  usage_note = '국제대회에서 상대의 실수로 한국이 이득을 볼 때 감사를 표하는 반어적 밈.',
  caution = caution,
  usage_examples = '[{"situation":"국제대회를 보다가","text":"상대 실책 나오니까 또 고마워요 사토가 떠오르네."},{"situation":"야구 명장면을 이야기할 때","text":"2008년 그 낙구와 허구연 위원 멘트가 하나의 세트처럼 남았어."}]'::jsonb,
  updated_at = now()
where short_id = 'bucts34h'
  and slug = '고마워요-사토-(G.G.사토)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.nocutnews.co.kr/news/4498012', '''고마워요 G.G 사토'' 이제는 말할 수 있다', '노컷뉴스',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'bucts34h' and meme.slug = '고마워요-사토-(G.G.사토)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.nocutnews.co.kr/news/4498012'
  );

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://www.asiae.co.kr/article/2012070420232962598', '[김성훈의 X-파일]“고마워요, 사토!” 그 이후', '아시아경제',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'bucts34h' and meme.slug = '고마워요-사토-(G.G.사토)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://www.asiae.co.kr/article/2012070420232962598'
  );

-- 피식대학 영양군 지역비하 사태 (q246gvj2 / 피식대학-영양군-지역비하-사태)
update public.memes set
  description = '2024년 5월 유튜브 코미디 채널 피식대학이 경북 영양군을 다룬 영상에서 지역 비하성 발언을 해 큰 논란이 됐다. 이후 8월 채널이 영양군 관련 콘텐츠를 잇달아 올리고 군수가 직접 출연하는 등 화해 행보를 보이다 결국 영양군 홍보대사로 위촉되는 반전이 하나의 밈처럼 회자됐다.',
  origin = '2024년 5월 유튜브 코미디 채널 피식대학이 경북 영양군을 다룬 영상에서 지역 비하성 발언을 해 논란이 됐다. 농민신문 등이 이 사태를 보도했고, 이후 채널이 영양군 관련 콘텐츠를 이어 가며 군수 출연과 홍보대사 위촉 등 화해 행보가 보도되며 하나의 서사처럼 회자됐다. 지역 비하 자체는 해프닝으로 넘길 사안이 아니다.',
  usage_note = '지역 비하 논란이 배경이므로 그대로 인용해 특정 지역을 조롱하는 데 쓰지 않아야 함',
  caution = '실제 지역 비하 논란 사건으로 집단 비하 소지가 있어 언급 시 맥락 설명이 필요',
  usage_examples = '[{"situation":"지역 비하 논란을 설명할 때","text":"피식대학 영양군 사태는 웃음 소재가 지역을 낮출 때 어떤 반발이 나오는지를 보여 줘."},{"situation":"후속 보도를 이야기할 때","text":"처음엔 사과 논란이었는데, 나중엔 홍보대사 위촉까지 이어져서 서사가 복잡해졌어."}]'::jsonb,
  updated_at = now()
where short_id = 'q246gvj2'
  and slug = '피식대학-영양군-지역비하-사태'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

-- 갑툭튀 (93grdumg / 갑툭튀)
update public.memes set
  description = '예상하지 못한 것이 갑자기 나타날 때 쓰는 말이다. 공포 영화나 게임에서 귀신이 갑자기 튀어나오는 장면, 영어로 ''점프 스케어''도 갑툭튀라고 한다. 신화의 신혜성이 2003년 무렵 팬 게시판에서 자주 쓰면서 퍼졌고, 그룹 S의 강타, 이지훈과 함께 만든 말로 알려져 있다. 같은 멤버들이 만든 말로 ''깜놀''이 있다.',
  origin = '‘갑자기 툭 튀어나오다’를 줄인 말로, 공포 영화나 게임의 점프 스케어를 가리킬 때도 쓴다. 2003년 무렵 그룹 신화의 신혜성이 팬 게시판에서 자주 쓰며 퍼졌고, 같은 멤버들과 함께 만든 말로 알려져 있다. 비슷한 시기 만들어진 말로 ‘깜놀’이 있다. 신혜성의 활동은 한국어 위키백과 항목으로 확인할 수 있으며, 정확한 첫 게시 일자는 단정하지 않는다.',
  usage_note = '예상 밖의 등장이나 상황을 가볍게 표현할 때 쓴다. 실제로 사람을 놀라게 하는 장난에는 위험과 불쾌감이 따를 수 있다.',
  caution = caution,
  usage_examples = '[{"text":"으악, 갑툭튀 너무 심하다","situation":"공포 영화를 보며"},{"text":"어디서 갑툭튀했어?","situation":"친구가 갑자기 나타났을 때"}]'::jsonb,
  updated_at = now()
where short_id = '93grdumg'
  and slug = '갑툭튀'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%8B%A0%ED%98%9C%EC%84%B1', '신혜성', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '93grdumg' and meme.slug = '갑툭튀'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%8B%A0%ED%98%9C%EC%84%B1'
  );

-- 나는 행복합니다 (한화 이글스 행복송) (gqdszbfz / 나는-행복합니다-(한화-이글스-행복송))
update public.memes set
  description = '1980년 윤항기가 부른 ''나는 행복합니다''는 2011년부터 한화 이글스 응원가로 쓰였는데, 밝고 긍정적인 가사와 팀의 부진한 성적이 대비되며 팬들 사이에서 아이러니한 밈으로 자리잡았다. 2014년 9월 한상훈의 끝내기 안타 직후 이 노래가 울려퍼진 장면이 특히 회자됐다. ''고산병'' 등 후속 한화 관련 밈과 함께 팀의 자학개그 문화를 상징한다.',
  origin = '1980년 윤항기가 부른 ‘나는 행복합니다’가 2011년부터 한화 이글스 응원가로 쓰이기 시작했다. 밝고 긍정적인 가사와 팀의 부진한 성적이 대비되며 팬들 사이에서 아이러니한 밈이 됐고, 2014년 9월 한상훈의 끝내기 안타 직후 이 노래가 울려 퍼진 장면이 특히 회자됐다. 구단과 응원 문화는 한국어 위키백과 한화 이글스 항목과 현장 영상으로 확인된다.',
  usage_note = '부진한 상황에서 역설적으로 밝은 노래를 트는 한화 팬 특유의 자학 유머.',
  caution = caution,
  usage_examples = '[{"situation":"야구 중계를 보다가","text":"한화가 또 어려운 경기를 하면 나는 행복합니다가 더 아이러니하게 들려."},{"situation":"직관에서","text":"이 노래 나오면 한화 팬들의 자조 개그가 시작되는 느낌이야."}]'::jsonb,
  updated_at = now()
where short_id = 'gqdszbfz'
  and slug = '나는-행복합니다-(한화-이글스-행복송)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%ED%95%9C%ED%99%94_%EC%9D%B4%EA%B8%80%EC%8A%A4', '한화 이글스', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'gqdszbfz' and meme.slug = '나는-행복합니다-(한화-이글스-행복송)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%ED%95%9C%ED%99%94_%EC%9D%B4%EA%B8%80%EC%8A%A4'
  );

-- KIA타이거즈 남행열차 응원가 (fxp7dc8y / KIA타이거즈-남행열차-응원가)
update public.memes set
  description = '패티김의 ''그대 없이는 못살아''를 원곡으로 하는 ''남행열차''는 KIA 타이거즈의 연고지인 호남 지역을 상징하는 응원가로, 보통 경기 후반 KIA가 승기를 잡았을 때 울려퍼진다. 노래가 나오면 응원단장의 지시 없이도 팬들이 자리에서 일어나 함께 부르는 것이 관례처럼 자리잡았다. ''고래사냥'', ''목포의 눈물''과 함께 KIA의 비공식 상징곡으로 꼽힌다.',
  origin = '패티김의 ‘그대 없이는 못살아’를 원곡으로 하는 ‘남행열차’는 호남 연고 KIA 타이거즈(전신 해태 타이거즈)를 상징하는 응원가로 자리 잡았다. 보통 경기 후반 팀이 승기를 잡았을 때 울려 퍼지며, 응원단장의 지시 없이도 팬들이 일어나 함께 부르는 관례가 됐다. 구단 응원 문화는 한국어 위키백과 KIA 타이거즈 항목과 현장 영상으로 확인할 수 있다. 정확한 최초 도입 연도는 자료마다 차이가 있어 단정하지 않는다.',
  usage_note = 'KIA 타이거즈 팬덤과 호남 지역 정체성을 상징하는 응원가로 소개할 때 쓴다.',
  caution = caution,
  usage_examples = '[{"situation":"경기 후반을 보다가","text":"남행열차 나오면 KIA 팬들이 일제히 일어나는 게 장관이야."},{"situation":"응원가를 이야기할 때","text":"호남 기차 이미지를 담은 남행열차는 KIA를 상징하는 노래가 됐지."}]'::jsonb,
  updated_at = now()
where short_id = 'fxp7dc8y'
  and slug = 'KIA타이거즈-남행열차-응원가'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/KIA_%ED%83%80%EC%9D%B4%EA%B1%B0%EC%A6%88', 'KIA 타이거즈', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'fxp7dc8y' and meme.slug = 'KIA타이거즈-남행열차-응원가'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/KIA_%ED%83%80%EC%9D%B4%EA%B1%B0%EC%A6%88'
  );

-- 페페 더 프로그(슬픈 개구리 페페) (jkd7vu6x / 페페 더 프로그(슬픈 개구리 페페))
update public.memes set
  description = '2005년 맷 퓨리의 만화 보이즈 클럽 캐릭터 페페가 2008년경부터 슬픔·여유 등 다양한 감정을 표현하는 이미지 매크로로 퍼졌다. 국내 커뮤니티에서도 슬픈 반응짤로 오래 쓰였으나, 해외에서는 일부 극단 커뮤니티가 혐오 상징으로 도용한 이력이 있어 맥락에 예민한 밈이다. 국내에서는 대체로 순수한 반응짤로 소비된다.',
  origin = '2005년 맷 퓨리의 만화 Boy’s Club에 등장한 개구리 캐릭터 페페가, 2008년경부터 슬픔·여유 등 다양한 감정을 담은 이미지 매크로로 퍼졌다. 영어 위키백과 Pepe the Frog 항목이 원작과 밈화, 이후 일부 극단 세력의 혐오 상징 도용 이력을 정리한다. 국내 커뮤니티에서는 대체로 슬픈 반응짤로 소비됐으나, 국제적 맥락에서는 상징의 전용 문제를 함께 설명해야 한다.',
  usage_note = '해외 극단주의 상징 이력이 있어 국제적 맥락의 자리에서는 조심스럽게 사용',
  caution = caution,
  usage_examples = '[{"situation":"반응짤을 고를 때","text":"이 표정은 슬픈 개구리 페페가 제일 잘 살려."},{"situation":"해외 커뮤니티를 설명할 때","text":"페페는 원래 만화 캐릭터인데, 해외에서는 혐오 상징으로 오용된 역사가 있어 조심해야 해."}]'::jsonb,
  updated_at = now()
where short_id = 'jkd7vu6x'
  and slug = '페페 더 프로그(슬픈 개구리 페페)'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://en.wikipedia.org/wiki/Pepe_the_Frog', 'Pepe the Frog', 'Wikipedia',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'jkd7vu6x' and meme.slug = '페페 더 프로그(슬픈 개구리 페페)'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://en.wikipedia.org/wiki/Pepe_the_Frog'
  );

-- SNL 코리아 무신사 냄새 (nrjutpq7 / SNL-코리아-무신사-냄새)
update public.memes set
  description = '2022년 12월 방영된 SNL 코리아 ''MZ오피스''에서 신입사원(지코)의 옷차림을 두고 ''무신사 냄새 지린다''는 대사가 나오며 화제와 논란이 동시에 일었다. 무채색 기본템 위주의 획일적인 패션을 비꼬는 표현으로 확산되었으나, 남성을 겨냥한 비하 표현이라는 반발도 상당했다.',
  origin = '2022년 12월 10일 방영된 SNL 코리아 리부트 시즌3 ‘MZ오피스’ 코너에서, 신입사원 역 지코의 옷차림을 두고 ‘무신사 냄새 지린다’는 대사가 나왔다. 무채색 기본 아이템 위주의 획일적 패션을 비꼬는 말로 퍼졌으나, 남성을 겨냥한 비하라는 반발도 컸다. 프로그램과 논란의 존재는 한국어 위키백과 SNL 코리아 항목과 방송 클립으로 확인할 수 있다.',
  usage_note = '무난하고 획일적인 패션 스타일을 가리킬 때 쓰이나 성별 논쟁의 소지가 있음',
  caution = '특정 성별을 겨냥한 비하로 받아들여져 젠더 갈등 논란을 일으킨 표현임',
  usage_examples = '[{"situation":"패션 유행을 이야기할 때","text":"무신사 냄새라는 말은 기본티에 조거팬츠 조합을 놀릴 때 쓰이기 시작했어."},{"situation":"예능 논란을 설명할 때","text":"웃긴 대사였지만, 성별을 겨냥한 표현으로 받아들여져 논란이 됐지."}]'::jsonb,
  updated_at = now()
where short_id = 'nrjutpq7'
  and slug = 'SNL-코리아-무신사-냄새'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/SNL_%EC%BD%94%EB%A6%AC%EC%95%84', 'SNL 코리아', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'nrjutpq7' and meme.slug = 'SNL-코리아-무신사-냄새'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/SNL_%EC%BD%94%EB%A6%AC%EC%95%84'
  );

-- MSG 워너비 (4ae4pkpa / MSG-워너비)
update public.memes set
  description = '2021년 MBC 놀면 뭐하니에서 기획한 세 번째 프로젝트 그룹으로, SG워너비의 향수를 노리고 만들어졌다. 환불원정대를 프로듀싱한 지미유의 쌍둥이 동생 ''유야호''가 제작진으로 설정됐으며, 이름은 ''MSG를 친 듯 노래를 맛깔나게 부르는 그룹'' 또는 ''MBC+SG워너비''라는 중의적 의미를 담았다.',
  origin = '2021년 MBC 예능 ‘놀면 뭐하니’에서 기획한 세 번째 프로젝트 그룹이다. SG워너비의 향수를 겨냥해 만들어졌고, ‘MSG를 친 듯 맛깔나게 부르는 그룹’ 또는 ‘MBC+SG워너비’라는 중의적 이름이 붙었다. 환불원정대를 프로듀싱한 지미유의 쌍둥이 동생 ‘유야호’가 제작진으로 설정됐다. 데뷔 무대와 그룹 정보는 공식 영상과 한국어 위키백과 항목으로 확인된다.',
  usage_note = '놀면 뭐하니 프로젝트 그룹 계보(싹쓰리·환불원정대·유산슬)의 연장선으로 언급됨',
  caution = caution,
  usage_examples = '[{"situation":"예능 프로젝트 그룹을 이야기할 때","text":"싹쓰리 다음에 환불원정대, 그다음이 MSG 워너비 순서야."},{"situation":"데뷔 무대를 회상할 때","text":"바라만 본다 나왔을 때 MSG 워너비가 예능을 넘어 음원 차트까지 갔지."}]'::jsonb,
  updated_at = now()
where short_id = '4ae4pkpa'
  and slug = 'MSG-워너비'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/MSG_%EC%9B%8C%EB%84%88%EB%B9%84', 'MSG 워너비', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = '4ae4pkpa' and meme.slug = 'MSG-워너비'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/MSG_%EC%9B%8C%EB%84%88%EB%B9%84'
  );

-- 이종범 바람의 아들 (kkk7mx6b / 이종범-바람의-아들)
update public.memes set
  description = '가수 하청일이 야구용품점 단골이던 이종범에게 ''도루할 때 바람을 일으키며 들어간다''는 뜻으로 붙여준 별명이다. 이종범은 1994년 한 시즌 84도루를 기록하는 등 압도적 주루 능력을 보여줬다. 이후 아들 이정후가 데뷔하며 ''바람의 손자''라는 별명을 물려받아 부자 별명 계보가 이어졌다.',
  origin = '1990년대 초 가수 하청일이, 야구용품점 단골이던 이종범에게 ‘도루할 때 바람을 일으키며 들어간다’는 뜻으로 ‘바람의 아들’이라는 별명을 붙였다고 전해진다. 이종범은 1994년 한 시즌 84도루를 기록하는 등 주루 능력으로 이 별명을 대중적 수식어로 만들었고, 이후 아들 이정후에게 ‘바람의 손자’라는 별명이 이어졌다. 선수 기록과 별명은 한국어 위키백과 이종범 항목과 영상 자료로 확인된다.',
  usage_note = '이종범의 대표 별명으로, 아들 이정후의 ''바람의 손자''와 함께 언급된다.',
  caution = caution,
  usage_examples = '[{"situation":"야구 별명을 이야기할 때","text":"이종범 하면 역시 바람의 아들이지."},{"situation":"부자 선수를 볼 때","text":"이정후를 바람의 손자라고 부르는 건, 이종범의 별명에서 이어진 거야."}]'::jsonb,
  updated_at = now()
where short_id = 'kkk7mx6b'
  and slug = '이종범-바람의-아들'
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, 'Web', 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%A2%85%EB%B2%94', '이종범', '한국어 위키백과',
  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'
from public.memes as meme
where meme.short_id = 'kkk7mx6b' and meme.slug = '이종범-바람의-아들'
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%A2%85%EB%B2%94'
  );
commit;
