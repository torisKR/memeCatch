-- 2026-10-27 K-밈 입문 묶음 6 (로컬 우선 적용)
-- 주제: 영화·예능 명대사와 오래 살아남은 인터넷 말
-- 실행: supabase db query --local -f data/memes/sql/20261027-k-meme-starter-6.sql
-- 선행: 20261027-k-meme-starter.sql (로컬 검토자 계정 생성)
-- 원칙: 나무위키·위키백과에서 뜻과 유래를 확인한 것만 넣는다. 첫 사용자가 불확실하면 단정하지 않는다.
-- supabase db query는 명령 하나만 받으므로 DO 블록 하나로 묶는다 (블록 전체가 한 트랜잭션).

do $migration$
begin

-- ── 1. 밈 ───────────────────────────────────────────────────────
insert into memes (
  title, slug, aliases, summary, description, origin,
  usage_note, caution, usage_context, usage_examples,
  safety_level, lifecycle_status, moderation_status, category, media_type,
  difficulty, sentiment, origin_year, korea_viral_year, year_precision, era_type,
  trend_score, published_at
)
select v.title, v.slug, v.aliases, v.summary, v.description, v.origin,
  v.usage_note, v.caution, v.usage_context::jsonb, v.usage_examples::jsonb,
  v.safety_level::safety_level, v.lifecycle_status::lifecycle_status,
  'approved'::moderation_status, v.category::meme_category, v.media_type::media_type,
  v.difficulty::meme_difficulty, v.sentiment::meme_sentiment,
  v.origin_year, v.korea_viral_year, v.year_precision, v.era_type,
  v.trend_score, now()
from (values
(
  '밥은 먹고 다니냐', '밥은-먹고-다니냐', array['밥은 먹고 다니냐?','살인의 추억 명대사','Bab-eun meokgo danini','Memories of Murder'],
  '영화 ''살인의 추억''에서 송강호가 한 명대사',
  '2003년 봉준호 감독의 영화 ''살인의 추억''에서 형사 박두만(송강호)이 용의자에게 지친 얼굴로 "밥은 먹고 다니냐?"라고 묻는 장면에서 나왔다. 영화는 실제 미제 연쇄살인 사건을 바탕으로 했다. 한국에서는 "밥 먹었어?"가 안부 인사이기도 해서, 이 말은 걱정과 허탈함이 섞인 묘한 대사로 기억된다. 지금은 친구 근황을 장난스럽게 물을 때 성대모사처럼 쓴다.',
  '2003년 개봉한 봉준호 감독의 영화 ''살인의 추억''에서 송강호가 연기한 박두만의 대사',
  '오랜만에 만난 친구에게 장난스럽게 안부를 물을 때 쓴다. 성대모사로 많이 쓴다.',
  '영화가 실제 연쇄살인 사건을 다뤘기 때문에, 피해자나 사건을 가볍게 다루는 맥락에서는 쓰지 말자.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"바빠 보이는 친구에게","text":"요즘 밥은 먹고 다니냐?"},{"situation":"영화 이야기","text":"송강호가 밥은 먹고 다니냐 하는 장면 진짜 소름이었어"}]',
  'yellow', 'archived', 'phrase', 'video', 'normal', 'ironic', 2003, 2003, 'year', 'early_web', 31.0
),
(
  '묻고 더블로 가', '묻고-더블로-가', array['묻고 더블로 가!','곽철용','타짜 곽철용','Mutgo double-ro ga','Tazza','Double or nothing'],
  '영화 ''타짜''의 곽철용 대사, 판을 더 키우자는 뜻',
  '2006년 영화 ''타짜''에서 김응수가 연기한 악당 곽철용이 도박판에서 자신만만하게 "묻고 더블로 가!"라고 외친 대사다. 영화가 나오고 13년 뒤인 2019년 하반기에 곽철용 캐릭터를 다시 보는 유머 글과 성대모사가 퍼지며 크게 역주행했다. 지금은 어떤 일에 더 크게 도전하자, 판을 키우자는 뜻으로 장난스럽게 쓴다.',
  '2006년 영화 ''타짜''의 곽철용 대사가 2019년 하반기 인터넷 재평가와 성대모사로 역주행',
  '내기나 도전에서 장난스럽게 판을 키우자고 할 때 쓴다.',
  '실제 도박을 부추기는 말로 쓰지 말자.',
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"친구와 내기할 때","text":"졌다고? 그럼 묻고 더블로 가!"},{"situation":"야근 중 농담","text":"이번 마감도 묻고 더블로 가는 거야?"}]',
  'green', 'archived', 'phrase', 'video', 'beginner', 'funny', 2006, 2019, 'year', 'social_media', 34.0
),
(
  '니가 가라 하와이', '니가-가라-하와이', array['니가 가라, 하와이','친구 명대사','Niga gara Hawaii','Friend movie'],
  '영화 ''친구''의 명대사, 네가 대신 가라는 뜻',
  '2001년 영화 ''친구''에서 한동수(장동건)가 어릴 적 친구 이준석(유오성)에게 하는 대사다. 준석이 동수를 위해 하와이로 잠시 피해 있으라고 하자, 동수는 부산 사투리로 "니가 가라, 하와이"라고 거절한다. 무거운 장면이지만 짧고 강한 말투 때문에 크게 유행했다. 지금은 귀찮은 일을 떠넘길 때 "네가 해라"라는 뜻으로 장난스럽게 쓴다.',
  '2001년 개봉한 곽경택 감독의 영화 ''친구''에서 장동건이 연기한 한동수의 부산 사투리 대사',
  '친구가 귀찮은 일을 떠넘길 때 장난스럽게 되받아칠 때 쓴다.',
  null,
  '{"sns":"green","work":"yellow","family":"green","friends":"green"}',
  '[{"situation":"편의점 심부름을 미룰 때","text":"나 말고 니가 가라 하와이"},{"situation":"영화 이야기","text":"니가 가라 하와이는 지금 들어도 명대사다"}]',
  'green', 'archived', 'phrase', 'video', 'beginner', 'funny', 2001, 2001, 'year', 'early_web', 30.0
),
(
  '나만 아니면 돼', '나만-아니면-돼', array['나만 아니면 돼!','복불복','복불복이여 영원하라','Naman animyeon dwae','2 Days 1 Night'],
  '예능 ''1박 2일''에서 벌칙을 피한 멤버들이 외친 말',
  'KBS 예능 ''1박 2일''에서 복불복 게임이 끝난 뒤 벌칙을 피한 멤버들이 "나만 아니면 돼!"라고 외치던 데서 나왔다. 처음에는 노홍철이 실내 취침에 당첨되며 외쳤고, 이후 강호동이 과장된 표정과 동작으로 자주 외치며 짤로 남았다. 원래는 운 좋게 살아남은 자신을 축하하는 말이었지만, 지금은 남의 불행을 보며 "나는 괜찮다"고 놀리는 뜻으로도 쓴다.',
  'KBS 예능 ''1박 2일''의 복불복 게임에서 벌칙을 피한 멤버들의 외침에서 시작해 인터넷 밈으로 확산',
  '게임이나 제비뽑기에서 벌칙을 피했을 때 장난스럽게 쓴다.',
  '남이 진짜로 곤란한 상황에 쓰면 조롱으로 들린다.',
  '{"sns":"green","work":"gray","family":"green","friends":"green"}',
  '[{"situation":"제비뽑기에서 청소 당번을 피했을 때","text":"나만 아니면 돼~!"},{"situation":"게임이 끝나고","text":"복불복이여 영원하라, 나만 아니면 돼!"}]',
  'yellow', 'archived', 'phrase', 'video', 'beginner', 'funny', 2008, 2008, 'approximate', 'early_web', 32.0
),
(
  '갑툭튀', '갑툭튀', array['갑자기 툭 튀어나오다','갑툭튀하다','Gaptuktwi','Jump scare'],
  '''갑자기 툭 튀어나오다''의 줄임말',
  '예상하지 못한 것이 갑자기 나타날 때 쓰는 말이다. 공포 영화나 게임에서 귀신이 갑자기 튀어나오는 장면, 영어로 ''점프 스케어''도 갑툭튀라고 한다. 신화의 신혜성이 2003년 무렵 팬 게시판에서 자주 쓰면서 퍼졌고, 그룹 S의 강타, 이지훈과 함께 만든 말로 알려져 있다. 같은 멤버들이 만든 말로 ''깜놀''이 있다.',
  '2003년 무렵 신화 신혜성이 공식 홈페이지 게시판에서 쓰면서 팬들을 통해 온라인에 퍼짐',
  '갑자기 나타난 사람이나 물건, 공포 영화 장면을 말할 때 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"공포 영화를 보며","text":"으악, 갑툭튀 너무 심하다"},{"situation":"친구가 갑자기 나타났을 때","text":"어디서 갑툭튀했어?"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', 2003, 2005, 'approximate', 'early_web', 33.0
),
(
  '넘사벽', '넘사벽', array['넘을 수 없는 사차원의 벽','넘사','Neomsabyeok','Out of league'],
  '''넘을 수 없는 사차원의 벽''의 줄임말, 비교가 안 될 만큼 뛰어남',
  '둘을 비교할 때 한쪽이 너무 뛰어나서 아예 비교가 안 되는 수준을 말한다. 처음에는 "A>>>>넘사벽>>>>B"처럼 부등호 사이에 넣어 썼고, 부등호가 많을수록 차이가 크다는 뜻이었다. 지금은 "실력이 넘사벽이다"처럼 문장 안에서 압도적이라는 뜻으로 쓴다. 줄여서 ''넘사''라고도 한다.',
  '2000년대 인터넷 커뮤니티에서 비교 글에 부등호와 함께 쓰이며 퍼진 줄임말 (정확한 시작은 알려지지 않음)',
  '누군가의 실력이나 무언가의 수준이 압도적일 때 감탄하며 쓴다.',
  null,
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"게임 실력을 보고","text":"저 사람 실력은 진짜 넘사벽이다"},{"situation":"맛집 비교","text":"여기 짜장면은 다른 집이랑 넘사벽이야"}]',
  'green', 'cooling', 'phrase', 'text', 'beginner', 'funny', null, null, 'unknown', 'early_web', 32.0
),
(
  '엄친아', '엄친아', array['엄마 친구 아들','엄친딸','Eomchina'],
  '''엄마 친구 아들''의 줄임말, 뭐든 잘하는 완벽한 사람',
  '부모님이 "엄마 친구 아들은 이번에도 1등이래"처럼 자식을 남과 비교하던 말에서 나왔다. 그 ''엄마 친구 아들''은 공부, 외모, 집안까지 다 갖춘 완벽한 사람처럼 들려서, 지금은 뭐든 잘하는 사람을 부르는 말이 됐다. 딸이면 ''엄친딸''이라고 한다. 2005년 무렵 인터넷에서 퍼졌고, 같은 해 웹툰 ''골방환상곡''이 소재로 써서 더 알려졌다.',
  '2005년 무렵 인터넷에서 퍼졌고, 같은 해 네이버 웹툰 ''골방환상곡''이 소재로 쓰며 널리 알려짐',
  '뭐든 잘하는 사람을 칭찬하거나, 부모님의 비교를 농담으로 말할 때 쓴다.',
  '실제 사람을 비교하며 쓰면 상대가 불편할 수 있다.',
  '{"sns":"green","work":"green","family":"yellow","friends":"green"}',
  '[{"situation":"전교 1등 친구 이야기","text":"걔는 진짜 엄친아 그 자체야"},{"situation":"부모님 잔소리 이야기","text":"또 엄친아 이야기 들었어"}]',
  'green', 'archived', 'phrase', 'text', 'beginner', 'ironic', 2005, 2005, 'year', 'early_web', 34.0
),
(
  '흑역사', '흑역사', array['흑역사 생성','黒歴史','Heukyeoksa','Dark history'],
  '지우고 싶은 부끄러운 과거',
  '다시 떠올리고 싶지 않은 부끄러운 과거의 말이나 행동을 말한다. 원래 일본 애니메이션 ''∀(턴에이) 건담''에서 잊혀진 어두운 인류 역사를 부르던 이름이었다. 이 말이 크게 공감을 얻어 일본에서는 사전에 실렸고, 한국에서도 남녀노소가 쓰는 말이 됐다. 옛날 SNS 글이나 사진을 보고 "흑역사 생성"이라고 웃으며 쓴다.',
  '일본 애니메이션 ''∀ 건담''(1999)의 용어가 한국 인터넷에 들어와 일상어로 자리 잡음',
  '내 부끄러운 과거를 웃으며 이야기할 때 쓴다.',
  '남의 흑역사를 일부러 퍼뜨리면 상처가 될 수 있다.',
  '{"sns":"green","work":"green","family":"green","friends":"green"}',
  '[{"situation":"옛날 사진을 보고","text":"이 사진은 내 흑역사야, 지워 줘"},{"situation":"술자리 다음 날","text":"어제 노래방은 흑역사로 남겨 두자"}]',
  'green', 'active', 'phrase', 'text', 'beginner', 'funny', 1999, 2005, 'approximate', 'early_web', 35.0
)
) as v(title, slug, aliases, summary, description, origin,
  usage_note, caution, usage_context, usage_examples,
  safety_level, lifecycle_status, category, media_type,
  difficulty, sentiment, origin_year, korea_viral_year, year_precision, era_type, trend_score)
on conflict (slug) do update set
  title = excluded.title, aliases = excluded.aliases, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin,
  usage_note = excluded.usage_note, caution = excluded.caution,
  usage_context = excluded.usage_context, usage_examples = excluded.usage_examples,
  origin_year = excluded.origin_year, korea_viral_year = excluded.korea_viral_year,
  year_precision = excluded.year_precision, era_type = excluded.era_type;

-- ── 2. 확인한 출처 (2026-10-27 존재 확인) ────────────────────────
insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis)
select m.id, 'Web', v.url, v.title, v.publisher, 'unknown'::copyright_status, 'secondary_reference', 'link_only'
from (values
('밥은-먹고-다니냐', 'https://namu.wiki/w/%EC%82%B4%EC%9D%B8%EC%9D%98%20%EC%B6%94%EC%96%B5', '살인의 추억', '나무위키'),
('묻고-더블로-가', 'https://namu.wiki/w/%EA%B3%BD%EC%B2%A0%EC%9A%A9', '곽철용', '나무위키'),
('니가-가라-하와이', 'https://namu.wiki/w/%EB%8B%88%EA%B0%80%20%EA%B0%80%EB%9D%BC%20%ED%95%98%EC%99%80%EC%9D%B4', '니가 가라 하와이', '나무위키'),
('나만-아니면-돼', 'https://namu.wiki/w/%EB%82%98%EB%A7%8C%20%EC%95%84%EB%8B%88%EB%A9%B4%20%EB%8F%BC', '나만 아니면 돼', '나무위키'),
('갑툭튀', 'https://namu.wiki/w/%EA%B0%91%ED%88%AD%ED%8A%80', '갑툭튀', '나무위키'),
('넘사벽', 'https://namu.wiki/w/%EB%84%98%EC%82%AC%EB%B2%BD', '넘사벽', '나무위키'),
('엄친아', 'https://namu.wiki/w/%EC%97%84%EB%A7%88%20%EC%B9%9C%EA%B5%AC%20%EC%95%84%EB%93%A4', '엄마 친구 아들', '나무위키'),
('흑역사', 'https://namu.wiki/w/%ED%9D%91%EC%97%AD%EC%82%AC', '흑역사', '나무위키')
) as v(slug, url, title, publisher)
join memes m on m.slug = v.slug
where not exists (
  select 1 from meme_sources s where s.meme_id = m.id and s.source_url = v.url
);

-- ── 3. 영어 번역 (외국 사용자용, 로컬 검토자 계정) ─────────────────
insert into meme_translations (
  meme_id, locale, localized_slug, title, summary, description, origin,
  usage_note, caution, aliases, usage_examples,
  status, source_updated_at, provider, model, prompt_version, reviewed_at, reviewed_by
)
select m.id, 'en', t.lslug, t.title, t.summary, t.description, t.origin,
  t.usage_note, t.caution, t.aliases, t.usage_examples::jsonb,
  'reviewed', m.updated_at, 'editorial', 'human', 1, now(), '00000000-0000-0000-0000-00000000e0e0'
from (values
('밥은-먹고-다니냐', 'have-you-been-eating', 'Bab-eun Meokgo Danini (밥은 먹고 다니냐): Have You Been Eating?',
 'A famous line from "Memories of Murder" by Song Kang-ho',
 'In Bong Joon-ho''s 2003 film "Memories of Murder", detective Park Doo-man (Song Kang-ho) wearily asks a suspect, "Have you been eating?" The film is based on a real unsolved serial murder case. In Korea, "did you eat?" is also a greeting, so the line mixes concern and despair. People now use it as a playful impression.',
 'From Bong Joon-ho''s 2003 film "Memories of Murder"',
 'Use it as a joking check-in with a friend.', 'The film is about real murders, so do not use it to joke about victims.',
 array['Memories of Murder'],
 '[{"situation":"A busy friend","text":"Bab-eun meokgo danini? Have you been eating?"}]'),
('묻고-더블로-가', 'double-or-nothing', 'Mutgo Double-ro Ga (묻고 더블로 가): Double It!',
 'A line from the film "Tazza": raise the stakes',
 'In the 2006 film "Tazza: The High Rollers", villain Kwak Cheol-yong (Kim Eung-soo) confidently shouts "Leave it in and double it!" at the card table. Thirteen years later, in late 2019, jokes and impressions reviving the character made the line go viral again.',
 'From the 2006 film "Tazza", viral again in late 2019',
 'Use it to jokingly raise the stakes on a bet or challenge.', 'Do not use it to encourage real gambling.',
 array['Tazza','Double or nothing'],
 '[{"situation":"Losing a friendly bet","text":"Lost? Then mutgo double-ro ga!"}]'),
('니가-가라-하와이', 'you-go-to-hawaii', 'Niga Gara Hawaii (니가 가라 하와이): You Go to Hawaii',
 'A line from the film "Friend": you go instead',
 'In the 2001 film "Friend", Dong-su (Jang Dong-gun) refuses his old friend Joon-seok''s (Yoo Oh-sung) offer to hide in Hawaii, saying in Busan dialect, "You go. Hawaii." The scene is grim, but the short, punchy line became a hit. Now people say it to push a chore back on someone.',
 'From Kwak Kyung-taek''s 2001 film "Friend"',
 'Use it jokingly when a friend tries to hand you a chore.', null,
 array['Friend movie'],
 '[{"situation":"Avoiding a convenience-store run","text":"Not me. Niga gara Hawaii."}]'),
('나만-아니면-돼', 'as-long-as-its-not-me', 'Naman Animyeon Dwae (나만 아니면 돼): As Long as It''s Not Me',
 'What winners shouted after dodging a penalty on "2 Days & 1 Night"',
 'On the KBS show "2 Days & 1 Night", members who escaped the penalty in luck games shouted "As long as it''s not me!" Kang Ho-dong''s exaggerated version became a famous meme image. It first meant celebrating your own luck, but is now also used to mock others'' misfortune.',
 'From luck games on the KBS variety show "2 Days & 1 Night"',
 'Use it when you dodge a penalty in a game.', 'Using it on someone in real trouble sounds cruel.',
 array['2 Days and 1 Night','Bokbulbok'],
 '[{"situation":"Escaping cleaning duty in a draw","text":"Naman animyeon dwae~!"}]'),
('갑툭튀', 'gaptuktwi', 'Gap-tuk-twi (갑툭튀): Popping Out of Nowhere',
 'Short for "suddenly popping out"',
 'Used when something appears out of nowhere, including jump scares in horror films and games. Shinhwa''s Shin Hye-sung used it often on a fan board around 2003, and it is said he made it with Kangta and Lee Ji-hoon of the group S, who also made "kkamnol".',
 'Spread from Shinhwa member Shin Hye-sung''s fan board posts around 2003',
 'Use it for surprise appearances or jump scares.', null,
 array['Jump scare'],
 '[{"situation":"Watching a horror film","text":"Ah! Too much gap-tuk-twi."}]'),
('넘사벽', 'neomsabyeok', 'Neomsabyeok (넘사벽): Out of Your League',
 'Short for "an uncrossable fourth-dimension wall"',
 'Used when one side is so far ahead that comparison is pointless. It began inside inequality signs like "A>>>>neomsabyeok>>>>B", with more signs meaning a bigger gap. Now people say "their skill is neomsabyeok".',
 'Spread in 2000s Korean forums; exact start unknown',
 'Use it to praise an overwhelming skill or quality.', null,
 array['Out of league','Next level'],
 '[{"situation":"Watching a pro gamer","text":"That skill is neomsabyeok."}]'),
('엄친아', 'eomchina', 'Eomchina (엄친아): Mom''s Friend''s Son',
 'The "perfect" kid parents compare you to',
 'From parents saying "Mom''s friend''s son got first place again." That son sounds perfect at everything, so the word now means anyone who excels at all things. A daughter is "eomchinttal". It spread online around 2005, helped by the webtoon "Golbang Hwansanggok".',
 'Spread online around 2005, popularized by a Naver webtoon',
 'Use it for someone who is good at everything.', 'Comparing real people can make them uncomfortable.',
 array['Perfect kid','eomchinttal'],
 '[{"situation":"Talking about a top student","text":"He is a total eomchina."}]'),
('흑역사', 'heukyeoksa', 'Heukyeoksa (흑역사): Dark History',
 'An embarrassing past you want to erase',
 'Embarrassing things you said or did and would rather forget. It comes from the Japanese anime "Turn A Gundam", where "dark history" named a forgotten era. It caught on so widely that Japan added it to dictionaries, and Koreans of all ages use it too.',
 'From the 1999 Japanese anime "Turn A Gundam", adopted into Korean slang',
 'Use it to laugh about your own past.', 'Spreading someone else''s dark history can hurt.',
 array['Cringe past'],
 '[{"situation":"Seeing an old photo","text":"This photo is my heukyeoksa. Delete it."}]')
) as t(slug, lslug, title, summary, description, origin, usage_note, caution, aliases, usage_examples)
join memes m on m.slug = t.slug
on conflict (meme_id, locale) do update set
  localized_slug = excluded.localized_slug, title = excluded.title, summary = excluded.summary,
  description = excluded.description, origin = excluded.origin, usage_note = excluded.usage_note,
  caution = excluded.caution, aliases = excluded.aliases, usage_examples = excluded.usage_examples,
  status = 'reviewed', source_updated_at = excluded.source_updated_at,
  reviewed_at = excluded.reviewed_at, reviewed_by = excluded.reviewed_by;

-- ── 4. 출신 국가 = 한국 (흑역사는 일본 애니메이션 용어라 제외) ─────────────
insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by)
select m.id, 'KR', 'ko-KR', 'origin', m.title, 'reviewed', now(), '00000000-0000-0000-0000-00000000e0e0'
from memes m
where m.slug in ('밥은-먹고-다니냐','묻고-더블로-가','니가-가라-하와이','나만-아니면-돼','갑툭튀','넘사벽','엄친아')
on conflict (meme_id, market_code, role) do nothing;

end
$migration$;
